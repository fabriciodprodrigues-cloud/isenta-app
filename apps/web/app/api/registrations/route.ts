import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    // Verificar permissão
    if (// @ts-ignore
      (session.user as any)?.role === 'operator' && (session.user as any)?.accountId !== accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Listar registrações da conta
    const registrations = await prisma.concesssionaireRegistration.findMany({
      where: {
        vehicle: {
          accountId: accountId,
        },
      },
      include: {
        vehicle: {
          select: { plate: true },
        },
        concessionaire: {
          select: {
            id: true,
            name: true,
            cnpj: true,
            email: true,
            phone: true,
            website: true,
            cidade: true,
            estados: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
