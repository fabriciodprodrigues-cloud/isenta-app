import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Todos os campos sao opcionais: esta rota atende tanto a edicao completa pelo
// VehicleForm quanto atualizacoes pontuais de status/documentos. Os campos do
// veiculo precisam estar declarados — o Zod descarta chaves nao declaradas, e
// sem eles a edicao pelo formulario gravava um update vazio e retornava 200.
const update_vehicle_schema = z.object({
  plate: z.string().min(7).optional(),
  renavam: z.string().min(9).optional(),
  type: z.enum(['proprio', 'locado']).optional(),
  category: z.enum(['oficial', 'ambulancia', 'bombeiro', 'outro']).optional(),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  cor: z.string().optional().nullable(),
  anoFabricacao: z.number().int().optional().nullable(),
  anoModelo: z.number().int().optional().nullable(),

  status: z.enum(['rascunho', 'enviado', 'aguardando', 'aprovado', 'recusado', 'vencido']).optional(),
  documentUrl: z.string().optional().nullable(),
  contractUrl: z.string().optional().nullable(),
  crlvUrl: z.string().optional().nullable(),
  tagSerialNumber: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.id },
      include: {
        account: true,
        registrations: true,
        alerts: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error('Erro ao buscar veículo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar veículo' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = update_vehicle_schema.parse(body);

    if (data.plate) {
      data.plate = data.plate.toUpperCase();
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: params.id },
      data,
      include: {
        account: true,
        registrations: true,
      },
    });

    return NextResponse.json(vehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }

    // A placa e unica dentro da conta (@@unique([accountId, plate])), entao
    // renomear para uma ja existente e um erro do usuario, nao do servidor.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Já existe um veículo com esta placa neste órgão' },
        { status: 400 },
      );
    }

    console.error('Erro ao atualizar veículo:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar veículo' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    await prisma.vehicle.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar veículo:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar veículo' },
      { status: 500 },
    );
  }
}
