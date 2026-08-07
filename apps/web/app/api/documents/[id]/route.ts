import { NextRequest, NextResponse } from 'next/server';
import { get, del } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarDocumento } from '@/lib/document-access';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/**
 * Baixa o documento.
 *
 * A store e privada: o arquivo so pode ser lido com credencial, e quem le e o
 * servidor. A permissao e conferida imediatamente antes do get(), como a
 * propria documentacao da Vercel recomenda — auth em middleware pode ser
 * contornada por erro de configuracao e expor conteudo privado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarDocumento(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const { documento } = permissao;

  try {
    const resultado = await get(documento.url, { access: 'private' });

    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      console.error(`Blob indisponível para o documento ${documento.id}`);
      return NextResponse.json(
        { error: 'Arquivo não disponível no armazenamento' },
        { status: 502 }
      );
    }

    return new NextResponse(resultado.stream, {
      headers: {
        'Content-Type': resultado.blob.contentType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(documento.fileName)}"`,
        // nosniff impede que o navegador reinterprete o tipo do arquivo.
        'X-Content-Type-Options': 'nosniff',
        // CRLV e dado pessoal: nada fica em disco, cada acesso passa pela
        // verificacao de permissao acima.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro ao baixar documento:', error);
    return NextResponse.json({ error: 'Erro ao baixar documento' }, { status: 500 });
  }
}

/** Remove o documento do Blob e do banco. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarDocumento(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  try {
    // O registro sai mesmo que o Blob falhe: deixar a linha apontando para um
    // arquivo inexistente seria pior do que um orfao no storage.
    await del(permissao.documento.url).catch(erro =>
      console.error('Falha ao remover do Blob (registro será removido mesmo assim):', erro)
    );

    await prisma.document.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover documento:', error);
    return NextResponse.json({ error: 'Erro ao remover documento' }, { status: 500 });
  }
}
