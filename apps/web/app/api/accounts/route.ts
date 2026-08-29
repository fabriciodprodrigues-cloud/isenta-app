import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validate_cnpj } from '@/lib/utils';
import { calcularImunidadeEmLote } from '@/lib/imunidade';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const create_account_schema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  // O formulario envia razaoSocial e a coluna existe no schema. Sem declarar
  // aqui, o Zod descartava o campo silenciosamente e a conta era gravada com
  // razaoSocial null — que por sua vez quebrava a listagem de orgaos.
  razaoSocial: z.string().min(3, 'Razão social deve ter ao menos 3 caracteres'),
  cnpj: z.string().refine(validate_cnpj, 'CNPJ inválido'),
  responsibleName: z.string().min(3),
  responsibleEmail: z.string().email(),
  responsiblePhone: z.string().min(10),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  cep: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const accounts = await prisma.account.findMany({
      include: {
        users: {
          where: { role: 'operator' },
          select: { id: true, email: true, name: true },
        },
        vehicles: {
          select: {
            id: true,
            registrations: {
              select: { id: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const imunidadePorConta = await calcularImunidadeEmLote(accounts.map((a: any) => a.id));

    const accountsWithStats = accounts.map((account: any) => {
      // Cadastros pendem de Vehicle, nao de Account: a conta so os alcanca
      // atravessando seus veiculos.
      const registrations = account.vehicles.flatMap((v: any) => v.registrations);

      const totalCadastros = registrations.length;
      const cadastrosAtivos = registrations.filter((r: any) => r.status === 'aprovado').length;
      const cadastrosPendentes = registrations.filter((r: any) => r.status === 'enviado' || r.status === 'aguardando_resposta').length;

      let saude = 'amarelo';
      if (totalCadastros > 0) {
        const taxa = cadastrosAtivos / totalCadastros;
        if (taxa >= 0.8) saude = 'verde';
        else if (taxa >= 0.5) saude = 'amarelo';
        else saude = 'vermelho';
      }

      return {
        id: account.id,
        razaoSocial: account.razaoSocial,
        cnpj: account.cnpj,
        name: account.name,
        email: account.email,
        telefone: account.telefone,
        city: account.city,
        state: account.state,
        status: account.status,
        responsibleName: account.responsibleName,
        responsibleEmail: account.responsibleEmail,
        responsiblePhone: account.responsiblePhone,
        address: account.address,
        cep: account.cep,
        numero: account.numero,
        complemento: account.complemento,
        bairro: account.bairro,
        operadores: account.users.length,
        veiculos: account.vehicles.length,
        cadastrosAtivos,
        cadastrosPendentes,
        saude,
        imunidade: imunidadePorConta.get(account.id)?.status ?? 'PARCIAL',
      };
    });

    return NextResponse.json(accountsWithStats);
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
