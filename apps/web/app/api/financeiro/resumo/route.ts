import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { calcularResumoFinanceiro } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

/** Alimenta o dashboard de /dashboard/admin/cobranca. */
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  return NextResponse.json(await calcularResumoFinanceiro());
}
