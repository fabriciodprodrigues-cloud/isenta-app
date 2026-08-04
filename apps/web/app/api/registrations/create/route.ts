import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { vehicleId, concessionaireId } = body;

    if (!vehicleId || !concessionaireId) {
      return NextResponse.json(
        { error: 'Veículo e concessionária são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o veículo pertence ao usuário
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Verificar permissão (operador só pode criar para sua conta)
    if (// @ts-ignore
      (session.user as any)?.role === 'operator' && vehicle.accountId !== (session.user as any)?.accountId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se já existe registração
    const existingRegistration = await prisma.concesssionaireRegistration.findFirst({
      where: {
        vehicleId,
        concessionaireId,
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Já existe uma solicitação para este veículo nesta concessionária' },
        { status: 409 }
      );
    }

    // Criar nova solicitação
    const registration = await prisma.concesssionaireRegistration.create({
      data: {
        vehicleId,
        concessionaireId,
        status: 'rascunho',
        sentAt: null,
      },
      include: {
        vehicle: { select: { plate: true } },
        concessionaire: { select: { name: true } },
      },
    });

    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar solicitação' },
      { status: 500 }
    );
  }
}
