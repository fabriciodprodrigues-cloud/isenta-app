import { auth } from '@/lib/auth';
import { processPendingRegistrations } from '@/lib/registration-orchestrator';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await auth();

    // Apenas admins podem processar registrações
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Iniciando processamento de solicitações pendentes...');
    await processPendingRegistrations();

    return NextResponse.json({
      success: true,
      message: 'Solicitações pendentes processadas com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao processar solicitações:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitações' },
      { status: 500 }
    );
  }
}
