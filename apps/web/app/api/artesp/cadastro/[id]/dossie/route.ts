import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';
import { montarDossieArtesp } from '@/lib/pdf-dossie';
import { TIPOS_DOCUMENTO_ARTESP, NOME_DOCUMENTO_ARTESP } from '@/lib/artesp-dados';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function bufferDoBlob(pathname: string): Promise<Buffer> {
  const resultado = await get(pathname, { access: 'private' });
  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    throw new Error(`arquivo indisponível no Blob: ${pathname}`);
  }
  return Buffer.from(await new Response(resultado.stream).arrayBuffer());
}

/**
 * Mescla os 5 documentos já gerados num único PDF pra download (ver seção
 * 5.1 da especificação -- "Gerar dossiê único (PDF)"). Prefere a via
 * assinada quando existe, mesmo padrão de documentos/[id]/route.ts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarArtespCadastro(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const cadastro = await prisma.artespCadastro.findUnique({
    where: { id: params.id },
    include: { account: true, documentos: true, veiculos: true },
  });

  if (!cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  }

  const faltando = TIPOS_DOCUMENTO_ARTESP.filter(
    tipo => !cadastro.documentos.find(d => d.tipo === tipo && d.urlGerado)
  );
  if (faltando.length > 0) {
    return NextResponse.json(
      {
        error: 'Gere todos os 5 documentos antes de montar o dossiê único.',
        faltando: faltando.map(tipo => NOME_DOCUMENTO_ARTESP[tipo]),
      },
      { status: 428 }
    );
  }

  try {
    const documentos = await Promise.all(
      TIPOS_DOCUMENTO_ARTESP.map(async tipo => {
        const doc = cadastro.documentos.find(d => d.tipo === tipo)!;
        const pathname = doc.urlAssinado ?? doc.urlGerado!;
        const buffer = await bufferDoBlob(pathname);
        return { nome: NOME_DOCUMENTO_ARTESP[tipo], buffer };
      })
    );

    const dossie = await montarDossieArtesp(documentos, {
      orgaoNome: cadastro.account.razaoSocial || cadastro.account.name,
      cnpj: cadastro.account.cnpj,
      quantidadeVeiculos: cadastro.veiculos.length,
      dataEmissao: new Date(),
    });

    const nomeArquivo = `Dossie ARTESP - ${cadastro.account.name}.pdf`.replace(/[\\/:*?"<>|]/g, '-');

    return new NextResponse(Uint8Array.from(dossie), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(nomeArquivo)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (erro) {
    console.error('Erro ao montar dossiê ARTESP:', erro);
    return NextResponse.json({ error: 'Erro ao montar o dossiê único' }, { status: 500 });
  }
}
