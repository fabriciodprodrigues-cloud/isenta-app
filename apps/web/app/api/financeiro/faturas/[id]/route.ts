import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STATUS_VALIDOS = ['emitida', 'aguardando_empenho', 'paga', 'cancelada'];

/**
 * Marca o status de uma fatura manualmente -- nunca auto-flip. "Atrasada"
 * não é um status que se marca aqui: é calculado a partir de
 * dataVencimento (ver lib/financeiro.ts).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json(
      { error: `status precisa ser um de: ${STATUS_VALIDOS.join(', ')}` },
      { status: 400 }
    );
  }

  const fatura = await prisma.fatura.findUnique({ where: { id: params.id } });
  if (!fatura) {
    return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
  }

  // Marcar paga registra a data; reverter uma fatura que estava paga limpa
  // a data (corrigindo um marcar-como-paga por engano).
  let dataPagamento = fatura.dataPagamento;
  if (status === 'paga') dataPagamento = new Date();
  else if (fatura.status === 'paga') dataPagamento = null;

  const atualizada = await prisma.fatura.update({
    where: { id: params.id },
    data: { status, dataPagamento },
  });

  return NextResponse.json(atualizada);
}
