import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { dispararAlertas } from '@/lib/alert-service';
import { EmailNaoConfiguradoError } from '@/lib/email-service';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/** Disparo manual pela interface do admin. O cron usa /api/cron/alertas. */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const corpo = await request.json().catch(() => ({}));
    const resumo = await dispararAlertas(corpo?.accountId);

    return NextResponse.json({
      success: true,
      enviados: resumo.enviados.length,
      falhas: resumo.falhas.length,
      detalhes: resumo,
      message:
        resumo.falhas.length > 0
          ? `${resumo.enviados.length} alerta(s) enviado(s), ${resumo.falhas.length} falharam`
          : `${resumo.enviados.length} alerta(s) enviado(s)`,
    });
  } catch (error) {
    if (error instanceof EmailNaoConfiguradoError) {
      return NextResponse.json(
        {
          error:
            'O envio de e-mail ainda não está configurado no servidor. Nenhum alerta foi registrado como enviado.',
        },
        { status: 503 }
      );
    }

    console.error('Erro ao enviar alertas:', error);
    return NextResponse.json({ error: 'Erro ao enviar alertas' }, { status: 500 });
  }
}
