import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status') || 'pendente';

  const respostas = await prisma.emailRespostaRecebida.findMany({
    where: { status },
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Placas do lote batido por protocolo — uma segunda consulta agregada em
  // vez de modelar registrationIds como tabela de junção (MVP: a lista já
  // sai pronta do match por protocolo na ingestão).
  const todosOsIds = respostas.flatMap(r => r.registrationIds);
  const veiculosPorRegistro = todosOsIds.length
    ? await prisma.concesssionaireRegistration.findMany({
        where: { id: { in: todosOsIds } },
        select: { id: true, vehicle: { select: { plate: true } } },
      })
    : [];
  const placaPorRegistro = new Map(veiculosPorRegistro.map(r => [r.id, r.vehicle.plate]));

  return NextResponse.json(
    respostas.map(r => ({
      id: r.id,
      orgao: r.account.name,
      remetente: r.remetente,
      assunto: r.assunto,
      recebidoEm: r.recebidoEm,
      corpoResumo: r.corpoResumo,
      protocoloDetectado: r.protocoloDetectado,
      classificacaoDetectada: r.classificacaoDetectada,
      placas: r.registrationIds
        .map(id => placaPorRegistro.get(id))
        .filter((p): p is string => Boolean(p)),
      status: r.status,
      createdAt: r.createdAt,
    }))
  );
}
