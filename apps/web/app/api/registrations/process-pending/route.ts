import { auth } from '@/lib/auth';
import { processPendingRegistrations } from '@/lib/registration-orchestrator';
import { EmailNaoConfiguradoError } from '@/lib/email-service';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();

    // Apenas admins podem processar registrações
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumo = await processPendingRegistrations();

    return NextResponse.json({
      success: true,
      ...resumo,
      // Antes a resposta era sempre "processadas com sucesso", mesmo quando
      // nenhuma solicitacao saia — o resumo agora diz o que de fato ocorreu.
      message:
        `${resumo.enviados} enviada(s)` +
        (resumo.naoAutomatizaveis > 0
          ? `, ${resumo.naoAutomatizaveis} sem canal automatizável`
          : '') +
        (resumo.erros > 0 ? `, ${resumo.erros} com erro` : ''),
    });
  } catch (error) {
    if (error instanceof EmailNaoConfiguradoError) {
      return NextResponse.json(
        {
          error:
            'O envio de e-mail ainda não está configurado no servidor. Nenhuma solicitação foi marcada como enviada.',
        },
        { status: 503 }
      );
    }

    console.error('Erro ao processar solicitações:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitações' },
      { status: 500 }
    );
  }
}
