import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processarItensDoLote } from '@/lib/registration-orchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Continua a varredura de um lote (botão "Processar pendências"). Admin-only. */
export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string; loteId: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const lote = await prisma.solicitacaoIsencaoLote.findUnique({
    where: { id: params.loteId },
    select: { id: true, accountId: true },
  });
  if (!lote || lote.accountId !== params.accountId) {
    return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
  }

  const resumo = await processarItensDoLote(lote.id);

  return NextResponse.json(resumo);
}
