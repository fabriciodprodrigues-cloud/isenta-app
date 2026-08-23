import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validate_cnpj } from '@/lib/utils';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const update_account_schema = z.object({
  name: z.string().min(3).optional(),
  cnpj: z.string().refine(validate_cnpj, 'CNPJ inválido').optional(),
  responsibleName: z.string().min(3).optional(),
  responsibleEmail: z.string().email().optional(),
  responsiblePhone: z.string().min(10).optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  state: z.string().length(2).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  razaoSocial: z.string().optional(),
  cep: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { id: params.accountId },
      include: {
        users: true,
        vehicles: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Conta não encontrada' },
        { status: 404 },
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error('Erro ao buscar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar conta' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const session = await auth();

  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = update_account_schema.parse(body);

    const account = await prisma.account.update({
      where: { id: params.accountId },
      data,
      include: {
        users: true,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }

    console.error('Erro ao atualizar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar conta' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const session = await auth();

  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    await prisma.account.delete({
      where: { id: params.accountId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar conta' },
      { status: 500 },
    );
  }
}
