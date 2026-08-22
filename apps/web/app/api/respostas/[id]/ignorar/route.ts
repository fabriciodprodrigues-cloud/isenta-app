import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { ignorarResposta, RespostaJaTratadaError } from '@/lib/processar-respostas';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ignorarResposta(params.id, (session.user as any).email);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RespostaJaTratadaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Erro ao ignorar resposta:', error);
    return NextResponse.json({ error: 'Erro ao ignorar resposta' }, { status: 500 });
  }
}
