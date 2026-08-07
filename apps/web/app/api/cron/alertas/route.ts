import { NextRequest, NextResponse } from 'next/server';
import { dispararAlertas } from '@/lib/alert-service';
import { EmailNaoConfiguradoError } from '@/lib/email-service';

// Le headers para autenticar o cron, entao nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/**
 * Disparo automatico dos alertas de vencimento.
 *
 * O cron do Vercel faz GET e, quando CRON_SECRET esta definido, envia
 * `Authorization: Bearer <CRON_SECRET>`. Sem o segredo configurado a rota fica
 * fechada — um endpoint publico que dispara e-mails para todos os orgaos seria
 * um vetor de abuso.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo) {
    console.error('CRON_SECRET não configurado: disparo automático desativado.');
    return NextResponse.json(
      { error: 'Cron não configurado no servidor' },
      { status: 503 }
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const resumo = await dispararAlertas();

    console.log(
      `Cron de alertas: ${resumo.enviados.length} enviado(s), ${resumo.falhas.length} falha(s).`
    );

    return NextResponse.json({
      success: true,
      enviados: resumo.enviados.length,
      falhas: resumo.falhas.length,
      detalhes: resumo,
    });
  } catch (error) {
    if (error instanceof EmailNaoConfiguradoError) {
      console.error('Cron de alertas abortado: SMTP ausente.');
      return NextResponse.json(
        { error: 'SMTP não configurado; nenhum alerta foi registrado.' },
        { status: 503 }
      );
    }

    console.error('Erro no cron de alertas:', error);
    return NextResponse.json({ error: 'Erro ao disparar alertas' }, { status: 500 });
  }
}
