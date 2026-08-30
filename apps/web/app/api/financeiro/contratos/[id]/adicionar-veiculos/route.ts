import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adicionarVeiculosAoOrgao } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

/** Fluxo 2: adiciona veículos ao órgão -- cria um mini-contrato vinculado ao contrato deste id. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const contratoReferencia = await prisma.contrato.findUnique({
    where: { id: params.id },
    select: { accountId: true },
  });
  if (!contratoReferencia) {
    return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const contrato = await adicionarVeiculosAoOrgao({
      accountId: contratoReferencia.accountId,
      veiculoIds: body.veiculoIds ?? [],
      precoUnitarioMensalCentavos: body.precoUnitarioMensalCentavos
        ? Number(body.precoUnitarioMensalCentavos)
        : undefined,
      formaPagamento: body.formaPagamento,
      numeroEmpenho: body.numeroEmpenho || null,
      parcelas: body.parcelas ? Number(body.parcelas) : undefined,
    });
    return NextResponse.json(contrato, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao adicionar veículos';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
