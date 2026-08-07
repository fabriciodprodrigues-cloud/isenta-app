import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarDocumento } from '@/lib/document-access';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/**
 * Baixa o documento.
 *
 * O arquivo e buscado no Blob pelo servidor e devolvido ao cliente, de modo
 * que a url do Blob nunca chega ao navegador. Redirecionar para ela entregaria
 * um link permanente e sem autenticacao — bastaria repassa-lo para qualquer
 * pessoa ver um CRLV.
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
    const resposta = await fetch(documento.url);

    if (!resposta.ok || !resposta.body) {
      console.error(
        `Blob indisponível para o documento ${documento.id}: HTTP ${resposta.status}`
      );
      return NextResponse.json(
        { error: 'Arquivo não disponível no armazenamento' },
        { status: 502 }
      );
    }

    return new NextResponse(resposta.body, {
      headers: {
        'Content-Type':
          resposta.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(documento.fileName)}"`,
        // Documento sensivel: nao deve ficar em cache compartilhado.
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
