import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmarResposta, RespostaJaTratadaError } from '@/lib/processar-respostas';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const schema = z.object({
  decisao: z.enum(['aprovado', 'recusado']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { decisao } = schema.parse(await request.json());

    await confirmarResposta(params.id, decisao, (session.user as any).email);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    if (error instanceof RespostaJaTratadaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Erro ao confirmar resposta:', error);
    return NextResponse.json({ error: 'Erro ao confirmar resposta' }, { status: 500 });
  }
}
