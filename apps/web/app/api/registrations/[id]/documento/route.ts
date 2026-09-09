import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/** Devolve o ofício/documento arquivado no envio (ou recuperado do IMAP) de uma solicitação. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const registration = await prisma.concesssionaireRegistration.findUnique({
    where: { id: params.id },
    select: {
      protocol: true,
      documentoUrl: true,
      documentoTipo: true,
      vehicle: { select: { accountId: true } },
    },
  });

  if (!registration) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  }

  // Mesma regra corrigida em api/vehicles/[id] e api/accounts/[accountId]
  // nesta sessão: operador só acessa a própria conta -- 404 (não 403), pra
  // não confirmar a existência do id pra quem não tem acesso.
  if (
    (session.user as any)?.role === 'operator' &&
    registration.vehicle.accountId !== (session.user as any)?.accountId
  ) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  }

  if (!registration.documentoUrl) {
    return NextResponse.json(
      { error: 'Nenhum documento arquivado para esta solicitação' },
      { status: 404 }
    );
  }

  const resultado = await get(registration.documentoUrl, { access: 'private' });

  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    return NextResponse.json({ error: 'Documento indisponível' }, { status: 502 });
  }

  return new NextResponse(resultado.stream, {
    headers: {
      'Content-Type': registration.documentoTipo ?? resultado.blob.contentType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="oficio-${registration.protocol ?? params.id}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
