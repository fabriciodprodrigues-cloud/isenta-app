import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { obterConfiguracaoFinanceira, atualizarPrecoReferencia } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return null;
  }
  return session;
}

/** Preço de referência (só pré-preenche o formulário de novo contrato). */
export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  return NextResponse.json(await obterConfiguracaoFinanceira());
}

export async function PUT(request: NextRequest) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const centavos = Number(body.precoReferenciaMensalCentavos);
    if (!Number.isFinite(centavos)) {
      return NextResponse.json({ error: 'precoReferenciaMensalCentavos inválido' }, { status: 400 });
    }
    return NextResponse.json(await atualizarPrecoReferencia(centavos));
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao atualizar configuração';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
