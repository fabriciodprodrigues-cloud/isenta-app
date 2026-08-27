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
    const role = (session.user as any)?.role;

    if (role === 'operator' && !accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    // Verificar permissão operador
    if (role === 'operator' && (session.user as any)?.accountId !== accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Admin: listar todas as TAGs; Operator: apenas da sua conta
    const where: any = {};
    if (role === 'operator' && accountId) {
      where.vehicle = { accountId };
    }

    const tags = await prisma.tag.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, plate: true, accountId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { serialNumber, vehicleId, expiresAt, operadora } = body;

    if (!serialNumber) {
      return NextResponse.json(
        { error: 'Missing serialNumber' },
        { status: 400 }
      );
    }

    // Verificar se serial já existe
    const existing = await prisma.tag.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'TAG serial já existe' },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        serialNumber,
        vehicleId: vehicleId || null,
        status: vehicleId ? 'assigned' : 'available',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedAt: vehicleId ? new Date() : null,
        operadora: operadora || null,
      },
      include: {
        vehicle: { select: { plate: true } },
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tagId, vehicleId, operadora } = body;

    if (!tagId) {
      return NextResponse.json({ error: 'Missing tagId' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    // vehicleId undefined = não mexe no vínculo (chamada só de "editar
    // operadora"); vehicleId === '' ou null = desvincula de propósito.
    if (vehicleId !== undefined) {
      data.vehicleId = vehicleId || null;
      data.status = vehicleId ? 'assigned' : 'available';
      data.assignedAt = vehicleId ? new Date() : null;
    }
    if (operadora !== undefined) {
      data.operadora = operadora || null;
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data,
      include: {
        vehicle: { select: { plate: true } },
      },
    });

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
