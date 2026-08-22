import { NextRequest, NextResponse } from 'next/server';
import { processarRespostasDeTodosOsOrgaos } from '@/lib/processar-respostas';

// Le headers para autenticar o cron, entao nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Disparo automático da leitura de respostas por e-mail.
 *
 * Mesmo padrão de /api/cron/alertas: o cron do Vercel faz GET com
 * `Authorization: Bearer <CRON_SECRET>`. Sem o segredo configurado a rota
 * fica fechada.
 *
 * Rede de segurança, não o caminho principal — o plano Hobby da Vercel
 * limita cron a poucos disparos por dia. O botão "Verificar agora" (
 * /api/respostas/verificar-agora) é quem dá verificação quase em tempo real.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo) {
    console.error('CRON_SECRET não configurado: leitura automática de respostas desativada.');
    return NextResponse.json({ error: 'Cron não configurado no servidor' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const resumo = await processarRespostasDeTodosOsOrgaos();

    console.log(
      `Cron de respostas: ${resumo.orgaosVerificados} órgão(s) verificado(s), ` +
        `${resumo.emailsNovos} e-mail(s) novo(s), ${resumo.emailsComProtocolo} com protocolo detectado.`
    );

    return NextResponse.json({ success: true, ...resumo });
  } catch (error) {
    console.error('Erro no cron de respostas:', error);
    return NextResponse.json({ error: 'Erro ao verificar respostas' }, { status: 500 });
  }
}
