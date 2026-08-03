import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    const query: any = {};
    if (accountId) {
      query.accountId = accountId;
    } else if ((session.user as any)?.role === 'operator') {
      query.accountId = (session.user as any)?.accountId;
    }

    const vehicles = await prisma.vehicle.findMany({
      where: query,
      select: {
        id: true,
        plate: true,
        marca: true,
        modelo: true,
      },
      orderBy: { plate: 'asc' },
    });

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
