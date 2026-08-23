import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Aprovação decidida fora do sistema (por telefone, no próprio portal da
// concessionária, etc.) e registrada manualmente pelo órgão -- não depende
// da leitura automática de e-mail nem do robô. Aceita uma data no passado
// porque a aprovação pode já ter acontecido antes do órgão vir marcar aqui.
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const registro = await prisma.concesssionaireRegistration.findUnique({
    where: { id: params.id },
    select: { status: true, vehicle: { select: { accountId: true } } },
  });

  if (!registro) {
    return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
  }

  const papel = (session.user as any)?.role;
  if (papel === 'operator' && registro.vehicle.accountId !== (session.user as any)?.accountId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  if (registro.status === 'rascunho') {
    return NextResponse.json(
      { error: 'Só é possível marcar como aprovada uma solicitação já enviada.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const approvedAt = body.approvedAt ? new Date(body.approvedAt) : new Date();

  if (Number.isNaN(approvedAt.getTime())) {
    return NextResponse.json({ error: 'Data de aprovação inválida' }, { status: 400 });
  }

  const atualizado = await prisma.concesssionaireRegistration.update({
    where: { id: params.id },
    data: {
      status: 'aprovado',
      approvedAt,
      rejectionReason: null,
    },
  });

  return NextResponse.json(atualizado);
}
