import { auth } from '@/lib/auth';
import { enqueueRegistration } from '@/lib/queue-service';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { registrationId } = body;

    if (!registrationId) {
      return NextResponse.json(
        { error: 'ID da solicitação é obrigatório' },
        { status: 400 }
      );
    }

    // Enfileirar para processamento com retry automático
    const job = await enqueueRegistration(registrationId);

    return NextResponse.json({
      success: true,
      message: 'Solicitação enfileirada para envio',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Erro ao enfileirar solicitação:', error);
    return NextResponse.json(
      { error: 'Erro ao enfileirar solicitação' },
      { status: 500 }
    );
  }
}
