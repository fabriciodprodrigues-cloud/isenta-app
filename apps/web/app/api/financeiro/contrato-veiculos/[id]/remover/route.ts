import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { removerVeiculo } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

/** Fluxo 3: remove um veículo do contrato -- sem estorno nem crédito. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const atualizado = await removerVeiculo(params.id);
    return NextResponse.json(atualizado);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao remover veículo';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
