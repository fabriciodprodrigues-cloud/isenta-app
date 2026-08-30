import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { criarContrato } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

/** Contratos de um órgão (principal + mini-contratos), com veículos e faturas. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get('accountId');
  if (!accountId) {
    return NextResponse.json({ error: 'accountId é obrigatório' }, { status: 400 });
  }

  const contratos = await prisma.contrato.findMany({
    where: { accountId },
    include: {
      veiculos: { include: { vehicle: { select: { plate: true } } } },
      faturas: { orderBy: { dataVencimento: 'asc' } },
      historicoPrecos: { orderBy: { dataAlteracao: 'desc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(contratos);
}

/** Fluxo 1: fechamento de novo contrato. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const contrato = await criarContrato({
      accountId: body.accountId,
      veiculoIds: body.veiculoIds ?? [],
      precoUnitarioMensalCentavos: Number(body.precoUnitarioMensalCentavos),
      dataInicio: body.dataInicio ? new Date(body.dataInicio) : undefined,
      modalidadeContratacao: body.modalidadeContratacao,
      numeroProcesso: body.numeroProcesso || null,
      observacoes: body.observacoes || null,
      formaPagamento: body.formaPagamento,
      numeroEmpenho: body.numeroEmpenho || null,
      parcelas: body.parcelas ? Number(body.parcelas) : undefined,
    });
    return NextResponse.json(contrato, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao criar contrato';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
