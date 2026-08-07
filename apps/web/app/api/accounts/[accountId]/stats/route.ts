import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { days_until_expiry } from '@/lib/utils';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se tem permissão
    if ((session.user as any)?.role === 'operator' && (session.user as any)?.accountId !== params.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Carregar estatísticas
    const vehicles = await prisma.vehicle.findMany({
      where: { accountId: params.accountId },
    });

    const documents = await prisma.document.findMany({
      where: { vehicle: { accountId: params.accountId } },
    });

    // TAGs sao universais (aceitas em qualquer concessionaria) e so ganham
    // vinculo com uma conta quando atribuidas a um veiculo. Logo "disponiveis"
    // e o estoque global ainda nao atribuido, nao um subconjunto da conta.
    const availableTags = await prisma.tag.count({
      where: { status: 'available', vehicleId: null },
    });

    // Calcular dados
    const totalVehicles = vehicles.length;
    const approvedVehicles = vehicles.filter(v => v.status === 'aprovado').length;
    const draftVehicles = vehicles.filter(v => v.status === 'rascunho').length;
    const expiringIn30Days = vehicles.filter(v => {
      if (!v.expiresAt) return false;
      // Terceira implementacao do mesmo calculo no projeto, e a unica que nao
      // normalizava o dia — contava fracoes de 24h a partir do instante atual.
      const days = days_until_expiry(v.expiresAt);
      return days > 0 && days <= 30;
    }).length;

    const pendingDocuments = documents.filter(
      d => new Date(d.uploadedAt).getMonth() === new Date().getMonth()
    ).length;

    return NextResponse.json({
      totalVehicles,
      approvedVehicles,
      draftVehicles,
      pendingDocuments,
      availableTags,
      expiringIn30Days,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
