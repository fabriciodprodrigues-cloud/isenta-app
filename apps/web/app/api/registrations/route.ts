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
    const papel = (session.user as any)?.role;

    // Operador só enxerga a própria conta, e o parâmetro é obrigatório para
    // ele. O admin pode omitir para ver todos os cadastros — a Central de
    // Cadastros precisa dessa visão e antes usava dados fixos no código.
    if (papel === 'operator') {
      if (!accountId) {
        return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
      }
      if ((session.user as any)?.accountId !== accountId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const registrations = await prisma.concesssionaireRegistration.findMany({
      where: accountId ? { vehicle: { accountId } } : {},
      include: {
        vehicle: {
          select: { plate: true, account: { select: { name: true } } },
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
