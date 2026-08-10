import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { days_until_expiry } from '@/lib/utils';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/**
 * Números da visão geral do admin.
 *
 * Existe porque a tela trazia valores fixos no código ("347 veículos", "12
 * órgãos") que não vinham de lugar nenhum — com o banco zerado, ela seguia
 * exibindo um sistema movimentado.
 */
export async function GET() {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const [
      orgaosAtivos,
      veiculos,
      tagsEstoque,
      tagsAtivadas,
      cadastrosPorStatus,
      recusados,
      semDocumento,
    ] = await Promise.all([
      prisma.account.count({ where: { status: 'active' } }),
      prisma.vehicle.findMany({
        where: { expiresAt: { not: null } },
        select: { expiresAt: true },
      }),
      prisma.tag.count({ where: { status: 'available' } }),
      prisma.tag.count({ where: { status: 'assigned' } }),
      prisma.concesssionaireRegistration.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.concesssionaireRegistration.findMany({
        where: { status: 'recusado' },
        take: 20,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          rejectionReason: true,
          vehicle: { select: { plate: true, account: { select: { name: true } } } },
          concessionaire: { select: { name: true } },
        },
      }),
      // Solicitações travadas por falta de CRLV: o orquestrador as recusa, e
      // sem isso na tela ninguém descobre por que não saíram.
      prisma.concesssionaireRegistration.findMany({
        where: { status: 'rascunho', vehicle: { documents: { none: { type: 'crlv' } } } },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          vehicle: { select: { plate: true, account: { select: { name: true } } } },
          concessionaire: { select: { name: true } },
        },
      }),
    ]);

    const porStatus = Object.fromEntries(
      cadastrosPorStatus.map(c => [c.status, c._count])
    );

    let vencendo = 0;
    let vencidos = 0;
    for (const v of veiculos) {
      const dias = days_until_expiry(v.expiresAt);
      if (dias < 0) vencidos++;
      else if (dias <= 7) vencendo++;
    }

    return NextResponse.json({
      orgaosAtivos,
      veiculosGerenciados: await prisma.vehicle.count(),
      cadastrosAtivos: porStatus['aprovado'] ?? 0,
      cadastrosAguardando: porStatus['aguardando_resposta'] ?? 0,
      cadastrosRascunho: porStatus['rascunho'] ?? 0,
      cadastrosRecusados: porStatus['recusado'] ?? 0,
      cadastrosVencendo: vencendo,
      cadastrosVencidos: vencidos,
      tagsEstoque,
      tagsAtivadas,
      pendencias: {
        recusados: recusados.map(r => ({
          id: r.id,
          placa: r.vehicle.plate,
          orgao: r.vehicle.account.name,
          concessionaria: r.concessionaire.name,
          motivo: r.rejectionReason ?? 'Motivo não informado',
        })),
        semDocumento: semDocumento.map(r => ({
          id: r.id,
          placa: r.vehicle.plate,
          orgao: r.vehicle.account.name,
          concessionaria: r.concessionaire.name,
        })),
      },
    });
  } catch (error) {
    console.error('Erro ao montar resumo do admin:', error);
    return NextResponse.json({ error: 'Erro ao carregar o resumo' }, { status: 500 });
  }
}
