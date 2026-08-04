import { auth } from '@/lib/auth';
import { getQueueStats, getFailedJobs } from '@/lib/queue-service';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();

    // Apenas admins podem ver stats da fila
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getQueueStats();
    const failed = await getFailedJobs();

    return NextResponse.json({
      queue: {
        stats,
        failedJobs: failed,
        totalJobs: stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao obter stats da fila:', error);
    return NextResponse.json(
      { error: 'Erro ao obter dados da fila' },
      { status: 500 }
    );
  }
}
