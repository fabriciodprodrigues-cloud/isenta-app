import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

    const tags = await prisma.tag.findMany({
      where: {
        concessionaire: {
          tags: {
            some: { vehicle: { accountId: params.accountId } }
          }
        }
      },
    });

    // Calcular dados
    const totalVehicles = vehicles.length;
    const approvedVehicles = vehicles.filter(v => v.status === 'aprovado').length;
    const draftVehicles = vehicles.filter(v => v.status === 'rascunho').length;
    const expiringIn30Days = vehicles.filter(v => {
      if (!v.expiresAt) return false;
      const days = Math.ceil((v.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30;
    }).length;

    const pendingDocuments = documents.filter(
      d => new Date(d.uploadedAt).getMonth() === new Date().getMonth()
    ).length;

    const availableTags = tags.filter(t => t.status === 'available').length;

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
