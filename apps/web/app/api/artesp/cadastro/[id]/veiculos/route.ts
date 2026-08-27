import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';

export const dynamic = 'force-dynamic';

interface VeiculoInput {
  vehicleId: string;
  registroPatrimonial?: string;
  prefixo?: string;
}

/**
 * Define a lista de veículos do cadastro (substitui o conjunto inteiro —
 * mais simples que incremental, e o wizard sempre manda a lista completa
 * da tela de frota).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarArtespCadastro(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const body = await request.json().catch(() => ({}));
  const veiculos: VeiculoInput[] = Array.isArray(body.veiculos) ? body.veiculos : [];

  if (veiculos.length === 0) {
    return NextResponse.json({ error: 'Inclua ao menos um veículo' }, { status: 400 });
  }

  const vehicleIds = veiculos.map(v => v.vehicleId);
  const frota = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    include: { documents: { select: { type: true } } },
  });

  const frotaPorId = new Map(frota.map(v => [v.id, v]));

  // Cada veículo precisa: pertencer à mesma conta do cadastro, ter CRLV, e
  // ter contrato de locação se for locado -- mesma exigência que
  // registration-orchestrator.ts já aplica pro fluxo de e-mail (Art. 6º).
  const problemas: string[] = [];
  for (const v of veiculos) {
    const veiculo = frotaPorId.get(v.vehicleId);
    if (!veiculo) {
      problemas.push(`Veículo ${v.vehicleId} não encontrado`);
      continue;
    }
    if (veiculo.accountId !== permissao.cadastro.accountId) {
      problemas.push(`${veiculo.plate} não pertence a este órgão`);
      continue;
    }
    if (!veiculo.documents.some(d => d.type === 'crlv')) {
      problemas.push(`${veiculo.plate}: falta o CRLV`);
    }
    if (veiculo.type === 'locado' && !veiculo.documents.some(d => d.type === 'contract')) {
      problemas.push(`${veiculo.plate}: veículo locado sem contrato de locação`);
    }
  }

  if (problemas.length > 0) {
    return NextResponse.json({ error: problemas.join('; ') }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.artespVeiculo.deleteMany({ where: { artespCadastroId: params.id } }),
    prisma.artespVeiculo.createMany({
      data: veiculos.map(v => ({
        artespCadastroId: params.id,
        vehicleId: v.vehicleId,
        registroPatrimonial: v.registroPatrimonial ?? null,
        prefixo: v.prefixo ?? null,
      })),
    }),
  ]);

  const atualizado = await prisma.artespCadastro.findUnique({
    where: { id: params.id },
    include: { veiculos: { include: { vehicle: true } } },
  });

  return NextResponse.json(atualizado);
}
