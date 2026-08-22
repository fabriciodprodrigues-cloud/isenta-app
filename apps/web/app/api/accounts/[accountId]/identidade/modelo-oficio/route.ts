import { NextRequest, NextResponse } from 'next/server';
import { put, get, del } from '@vercel/blob';
import JSZip from 'jszip';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Modelo de ofício é só o cabeçalho/timbre do órgão num .docx (corpo em
// branco) — cabe folgado no limite de corpo de função da Vercel.
const TAMANHO_MAXIMO = 4 * 1024 * 1024;
const TIPO_MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Confere que o arquivo é um .docx utilizável pelo enxerto de corpo
 * (montarOficioDocx, em lib/oficio-docx.ts): zip válido, com
 * word/document.xml, e uma única seção (um único <w:sectPr> final) — a
 * técnica de enxerto assume isso. Não exige cabeçalho com imagem: um órgão
 * pode legitimamente ter timbre só de texto, ou nenhum.
 */
async function validarModelo(buffer: Buffer): Promise<string | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return 'Arquivo corrompido ou não é um .docx válido.';
  }

  const documentXml = zip.file('word/document.xml');
  if (!documentXml || !zip.file('[Content_Types].xml')) {
    return 'Arquivo não parece ser um .docx válido (falta word/document.xml).';
  }

  const conteudo = await documentXml.async('string');
  const secoes = (conteudo.match(/<w:sectPr[ >]/g) ?? []).length;
  if (secoes > 1) {
    return 'Modelo com mais de uma seção não é suportado; use um documento simples com um único cabeçalho.';
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const arquivo = form.get('file');

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande: ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é 4 MB.`,
        },
        { status: 400 }
      );
    }

    if (arquivo.type !== TIPO_MIME_DOCX) {
      return NextResponse.json(
        { error: 'Envie o modelo em Word (.docx).' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const erroValidacao = await validarModelo(buffer);
    if (erroValidacao) {
      return NextResponse.json({ error: erroValidacao }, { status: 400 });
    }

    const orgao = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, modeloOficioUrl: true },
    });

    if (!orgao) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    const blob = await put(`modelos-oficio/${orgao.id}/modelo.docx`, buffer, {
      access: 'private',
      addRandomSuffix: true,
      contentType: TIPO_MIME_DOCX,
    });

    // Remove o anterior para não acumular modelos órfãos a cada substituição.
    if (orgao.modeloOficioUrl) {
      await del(orgao.modeloOficioUrl).catch(erro =>
        console.error('Falha ao remover o modelo de ofício anterior:', erro)
      );
    }

    await prisma.account.update({
      where: { id: orgao.id },
      data: { modeloOficioUrl: blob.pathname },
    });

    return NextResponse.json({ success: true, modeloOficioUrl: blob.pathname });
  } catch (error) {
    console.error('Erro ao enviar modelo de ofício:', error);
    return NextResponse.json({ error: 'Erro ao enviar o modelo' }, { status: 500 });
  }
}

/** Devolve o modelo para download/conferência pelo admin. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const orgao = await prisma.account.findUnique({
    where: { id: params.accountId },
    select: { modeloOficioUrl: true },
  });

  if (!orgao?.modeloOficioUrl) {
    return NextResponse.json({ error: 'Modelo não enviado' }, { status: 404 });
  }

  const resultado = await get(orgao.modeloOficioUrl, { access: 'private' });

  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    return NextResponse.json({ error: 'Modelo indisponível' }, { status: 502 });
  }

  return new NextResponse(resultado.stream, {
    headers: {
      'Content-Type': TIPO_MIME_DOCX,
      'Content-Disposition': 'attachment; filename="modelo-oficio.docx"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
