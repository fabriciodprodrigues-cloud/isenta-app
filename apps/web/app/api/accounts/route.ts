import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validate_cnpj } from '@/lib/utils';

const create_account_schema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  cnpj: z.string().refine(validate_cnpj, 'CNPJ inválido'),
  responsibleName: z.string().min(3),
  responsibleEmail: z.string().email(),
  responsiblePhone: z.string().min(10),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
});

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const accounts = await prisma.account.findMany({
      include: {
        users: true,
        vehicles: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar contas' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = create_account_schema.parse(body);

    const existing = await prisma.account.findUnique({
      where: { cnpj: data.cnpj },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'CNPJ já cadastrado' },
        { status: 400 },
      );
    }

    const account = await prisma.account.create({
      data: {
        ...data,
        status: 'active',
      },
      include: {
        users: true,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }

    console.error('Erro ao criar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao criar conta' },
      { status: 500 },
    );
  }
}
