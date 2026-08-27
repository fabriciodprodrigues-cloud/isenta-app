import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespDocumento } from '@/lib/artesp-acesso';
import { NOME_DOCUMENTO_ARTESP, type TipoDocumentoArtesp } from '@/lib/artesp-dados';

export const dynamic = 'force-dynamic';

/**
 * Baixa a via gerada (?versao=gerado) ou assinada (?versao=assinado, padrão)
 * do documento. Store privada, permissão checada antes do get() -- mesmo
 * padrão de apps/web/app/api/documents/[id]/route.ts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarArtespDocumento(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const versao = request.nextUrl.searchParams.get('versao') === 'gerado' ? 'gerado' : 'assinado';

  const documento = await prisma.artespDocumento.findUnique({ where: { id: params.id } });
  if (!documento) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  const pathname = versao === 'assinado' ? documento.urlAssinado ?? documento.urlGerado : documento.urlGerado;
  if (!pathname) {
    return NextResponse.json({ error: 'Este documento ainda não foi gerado' }, { status: 404 });
  }

  const nome = NOME_DOCUMENTO_ARTESP[documento.tipo as TipoDocumentoArtesp] ?? documento.tipo;

  try {
    const resultado = await get(pathname, { access: 'private' });
    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      return NextResponse.json({ error: 'Arquivo não disponível no armazenamento' }, { status: 502 });
    }

    return new NextResponse(resultado.stream, {
      headers: {
        'Content-Type': resultado.blob.contentType ?? 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(nome)}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro ao baixar documento ARTESP:', error);
    return NextResponse.json({ error: 'Erro ao baixar documento' }, { status: 500 });
  }
}
