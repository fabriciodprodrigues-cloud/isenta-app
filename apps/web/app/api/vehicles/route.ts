import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validate_plate, validate_renavam, calculate_expiry_date } from '@/lib/utils';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const create_vehicle_schema = z.object({
  accountId: z.string().min(1),
  plate: z.string().refine(validate_plate, 'Placa inválida'),
  renavam: z.string().refine(validate_renavam, 'RENAVAM inválido'),
  type: z.enum(['proprio', 'locado']),
  category: z.enum(['oficial', 'ambulancia', 'bombeiro', 'outro']),
});

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const includeDocuments = searchParams.get('includeDocuments') === 'true';

    const query: any = {};
    if (accountId) {
      query.accountId = accountId;
    } else if (session.user?.role === 'operator') {
      query.accountId = session.user?.accountId;
    }

    const include: any = {
      account: true,
      registrations: true,
      tags: true,
    };

    if (includeDocuments) {
      include.documents = true;
    }

    const vehicles = await prisma.vehicle.findMany({
      where: query,
      include,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Erro ao buscar veículos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar veículos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = create_vehicle_schema.parse(body);

    const account = await prisma.account.findUnique({
      where: { id: data.accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Conta não encontrada' },
        { status: 404 },
      );
    }

    const existing = await prisma.vehicle.findUnique({
      where: {
        accountId_plate: {
          accountId: data.accountId,
          plate: data.plate,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Veículo já cadastrado nesta conta' },
        { status: 400 },
      );
    }

    const expiryDate = calculate_expiry_date(data.type);

    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        status: 'rascunho',
        expiresAt: expiryDate,
      },
      include: {
        account: true,
      },
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }

    console.error('Erro ao criar veículo:', error);
    return NextResponse.json(
      { error: 'Erro ao criar veículo' },
      { status: 500 },
    );
  }
}
