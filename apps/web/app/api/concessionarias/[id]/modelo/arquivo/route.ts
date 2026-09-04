import { NextRequest, NextResponse } from 'next/server';
import { put, get, del } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Documentos reais (.docx/.xlsx com estilos/imagens de fundo) costumam
// passar de 1 MB -- teto acima do do timbre (4 MB, só imagem), abaixo do
// limite de corpo de função da Vercel.
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

const MIME_POR_TIPO: Record<'DOCX' | 'XLSX', string> = {
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const EXTENSAO_POR_TIPO: Record<'DOCX' | 'XLSX', string> = { DOCX: 'docx', XLSX: 'xlsx' };

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const modelo = await prisma.modeloDocumentoConcessionaria.findUnique({
      where: { concessionariaId: params.id },
      select: { tipo: true, arquivoUrl: true },
    });

    if (!modelo || modelo.tipo === 'GENERICO') {
      return NextResponse.json(
        { error: 'Escolha o tipo de documento (DOCX ou XLSX) antes de enviar o arquivo.' },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const arquivo = form.get('file');

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande: ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é 8 MB.`,
        },
        { status: 400 }
      );
    }

    const tipo = modelo.tipo as 'DOCX' | 'XLSX';
    if (arquivo.type !== MIME_POR_TIPO[tipo]) {
      return NextResponse.json(
        { error: `Envie um arquivo .${EXTENSAO_POR_TIPO[tipo]} -- o tipo configurado para esta concessionária é ${tipo}.` },
        { status: 400 }
      );
    }

    const extensao = EXTENSAO_POR_TIPO[tipo];
    const blob = await put(`modelos-concessionaria/${params.id}/modelo.${extensao}`, arquivo, {
      access: 'private',
      addRandomSuffix: true,
      contentType: arquivo.type,
    });

    if (modelo.arquivoUrl) {
      await del(modelo.arquivoUrl).catch(erro =>
        console.error('Falha ao remover o modelo anterior:', erro)
      );
    }

    // Um arquivo novo invalida qualquer ativação anterior -- o admin precisa
    // pré-visualizar e reativar conscientemente, nunca um upload acidental
    // vira o próximo envio real sem revisão.
    await prisma.modeloDocumentoConcessionaria.update({
      where: { concessionariaId: params.id },
      data: {
        arquivoUrl: blob.pathname,
        arquivoNome: arquivo.name,
        ativo: false,
        atualizadoPor: (session.user as any)?.email ?? 'desconhecido',
      },
    });

    return NextResponse.json({ success: true, arquivoNome: arquivo.name });
  } catch (error) {
    console.error('Erro ao enviar modelo de documento:', error);
    return NextResponse.json({ error: 'Erro ao enviar o arquivo' }, { status: 500 });
  }
}

/** Devolve o arquivo-modelo atual para o admin baixar/inspecionar. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const modelo = await prisma.modeloDocumentoConcessionaria.findUnique({
    where: { concessionariaId: params.id },
    select: { arquivoUrl: true, arquivoNome: true },
  });

  if (!modelo?.arquivoUrl) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 404 });
  }

  const resultado = await get(modelo.arquivoUrl, { access: 'private' });

  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    return NextResponse.json({ error: 'Arquivo indisponível' }, { status: 502 });
  }

  return new NextResponse(resultado.stream, {
    headers: {
      'Content-Type': resultado.blob.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${modelo.arquivoNome ?? 'modelo'}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const modelo = await prisma.modeloDocumentoConcessionaria.findUnique({
    where: { concessionariaId: params.id },
    select: { arquivoUrl: true },
  });

  if (modelo?.arquivoUrl) {
    await del(modelo.arquivoUrl).catch(erro =>
      console.error('Falha ao remover o modelo:', erro)
    );
  }

  await prisma.modeloDocumentoConcessionaria.update({
    where: { concessionariaId: params.id },
    data: {
      arquivoUrl: null,
      arquivoNome: null,
      ativo: false,
      atualizadoPor: (session.user as any)?.email ?? 'desconhecido',
    },
  });

  return NextResponse.json({ success: true });
}
