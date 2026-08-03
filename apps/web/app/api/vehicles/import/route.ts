import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 },
      );
    }

    const { vehicles, accountId } = await request.json();

    if (!vehicles || !Array.isArray(vehicles)) {
      return NextResponse.json(
        { error: 'Veículos deve ser um array' },
        { status: 400 },
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId é obrigatório' },
        { status: 400 },
      );
    }

    // Verificar se o usuário tem permissão para acessar esta conta
    if (session.user?.role === 'operator' && session.user?.accountId !== accountId) {
      return NextResponse.json(
        { error: 'Sem permissão para acessar esta conta' },
        { status: 403 },
      );
    }

    const imported: any[] = [];
    const errors: any[] = [];

    // Processar cada veículo
    for (const vehicle of vehicles) {
      try {
        // Validar campos obrigatórios
        if (!vehicle.placa || !vehicle.renavam) {
          errors.push({
            rowIndex: vehicle.rowIndex,
            message: 'Placa e RENAVAM são obrigatórios',
          });
          continue;
        }

        // Verificar se já existe veículo com esta placa
        const existing = await prisma.vehicle.findUnique({
          where: { plate: vehicle.placa.toUpperCase() },
        });

        if (existing) {
          errors.push({
            rowIndex: vehicle.rowIndex,
            message: `Veículo com placa ${vehicle.placa} já existe`,
          });
          continue;
        }

        // Criar veículo
        const created = await prisma.vehicle.create({
          data: {
            plate: vehicle.placa.toUpperCase(),
            renavam: vehicle.renavam.toString(),
            marca: vehicle.marca || '',
            modelo: vehicle.modelo || '',
            cor: vehicle.cor || '',
            anoFabricacao: parseInt(vehicle.anoFabricacao) || new Date().getFullYear(),
            anoModelo: parseInt(vehicle.anoModelo) || new Date().getFullYear(),
            type: vehicle.type || 'proprio',
            category: vehicle.category || 'oficial',
            accountId,
          },
        });

        imported.push({
          rowIndex: vehicle.rowIndex,
          id: created.id,
          plate: created.plate,
          message: `Veículo ${created.plate} importado com sucesso`,
        });
      } catch (error) {
        errors.push({
          rowIndex: vehicle.rowIndex,
          message: error instanceof Error ? error.message : 'Erro ao criar veículo',
        });
      }
    }

    return NextResponse.json({
      imported,
      errors,
      summary: {
        total: vehicles.length,
        success: imported.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error('Erro ao importar veículos:', error);
    return NextResponse.json(
      { error: 'Erro ao processar importação' },
      { status: 500 },
    );
  }
}
