import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const query: any = {};

    if (type) {
      query.type = type;
    }

    // Mesma regra de /api/vehicles: o operador nao escolhe a conta que
    // consulta. Antes o accountId recebido era usado como veio, expondo os
    // alertas de qualquer orgao a qualquer operador autenticado.
    if (session.user?.role === 'operator') {
      query.accountId = session.user?.accountId ?? '__sem_conta__';
    } else if (accountId) {
      query.accountId = accountId;
    }

    const alerts = await prisma.alert.findMany({
      where: query,
      include: {
        vehicle: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar alertas' },
      { status: 500 },
    );
  }
}
