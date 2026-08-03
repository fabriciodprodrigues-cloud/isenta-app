import { auth } from '@/lib/auth';
import { retryFailedJob } from '@/lib/queue-service';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await auth();

    // Apenas admins podem fazer retry
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId é obrigatório' },
        { status: 400 }
      );
    }

    await retryFailedJob(jobId);

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} enfileirado para retry`,
    });
  } catch (error) {
    console.error('❌ Erro ao fazer retry do job:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer retry' },
      { status: 500 }
    );
  }
}
