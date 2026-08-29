import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Marca um item COM_PROBLEMA de volta pra PENDENTE_PRE_REQUISITO, pra a
 * próxima varredura (processarItensDoLote) tentar de novo -- ex.: o
 * operador acabou de anexar o documento que faltava. As
 * ConcesssionaireRegistration do grupo continuam "rascunho" (o envio
 * original falhou antes de marcá-las como enviadas), então não precisa
 * resetar nada nelas. Admin-only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string; loteId: string; itemId: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const item = await prisma.solicitacaoIsencaoItem.findUnique({
    where: { id: params.itemId },
    select: { id: true, loteId: true, lote: { select: { accountId: true } } },
  });

  if (!item || item.loteId !== params.loteId || item.lote.accountId !== params.accountId) {
    return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  }

  const atualizado = await prisma.solicitacaoIsencaoItem.update({
    where: { id: item.id },
    data: { status: 'PENDENTE_PRE_REQUISITO', ultimoErro: null },
  });

  return NextResponse.json(atualizado);
}
