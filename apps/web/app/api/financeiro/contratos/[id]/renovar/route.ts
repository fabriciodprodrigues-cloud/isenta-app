import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { renovarContrato } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

/** Fluxo 4: renovação -- atualiza o contrato existente e gera nova fatura. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const contrato = await renovarContrato({
      contratoId: params.id,
      novoPrecoUnitarioMensalCentavos: body.novoPrecoUnitarioMensalCentavos
        ? Number(body.novoPrecoUnitarioMensalCentavos)
        : undefined,
      motivoAlteracaoPreco: body.motivoAlteracaoPreco || null,
      formaPagamento: body.formaPagamento,
      numeroEmpenho: body.numeroEmpenho || null,
      parcelas: body.parcelas ? Number(body.parcelas) : undefined,
    });
    return NextResponse.json(contrato);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao renovar contrato';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
