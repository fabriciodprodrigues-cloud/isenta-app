import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcularImunidade } from '@/lib/imunidade';

export const dynamic = 'force-dynamic';

/**
 * Resumo de imunidade do órgão + os itens do lote mais recente (pra tabela
 * de acompanhamento). O selo/contagem vem de calcularImunidade, que olha o
 * item mais recente por concessionária entre TODOS os lotes -- a tabela
 * mostra só o último disparo, mais simples de ler.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const role = (session.user as any)?.role;
  if (role === 'operator' && (session.user as any)?.accountId !== params.accountId) {
    return NextResponse.json({ error: 'Proibido' }, { status: 403 });
  }

  const account = await prisma.account.findUnique({
    where: { id: params.accountId },
    select: { id: true, name: true, razaoSocial: true },
  });
  if (!account) {
    return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
  }

  const [resumo, lote] = await Promise.all([
    calcularImunidade(params.accountId),
    prisma.solicitacaoIsencaoLote.findFirst({
      where: { accountId: params.accountId },
      orderBy: { createdAt: 'desc' },
      include: {
        itens: {
          include: { concessionaria: { select: { name: true } } },
          orderBy: { concessionaria: { name: 'asc' } },
        },
      },
    }),
  ]);

  return NextResponse.json({ account, resumo, lote });
}
