import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { processarRespostasDeTodosOsOrgaos } from '@/lib/processar-respostas';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Verifica todos os órgãos com IMAP configurado — mais tempo que o padrão
// de 10s pode cobrir.
export const maxDuration = 60;

/**
 * Caminho principal de leitura de respostas — o admin clica quando sabe que
 * uma chegou, sem esperar o cron diário (que é só rede de segurança).
 */
export async function POST() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resumo = await processarRespostasDeTodosOsOrgaos();
    return NextResponse.json({ success: true, ...resumo });
  } catch (error) {
    console.error('Erro ao verificar respostas:', error);
    return NextResponse.json({ error: 'Erro ao verificar respostas' }, { status: 500 });
  }
}
