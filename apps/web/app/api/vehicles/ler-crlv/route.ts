import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { head } from '@vercel/blob';
import { auth } from '@/lib/auth';
import {
  lerCrlv,
  TAMANHO_MAXIMO_BYTES,
  DocumentoGrandeDemaisError,
  LeituraRecusadaError,
} from '@/lib/leitura-crlv';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Ler um PDF grande com vision passa dos 10s padrao. O teto do plano cobre.
export const maxDuration = 60;

// .strict(): campo que o formulario manda e o schema nao declara seria
// descartado em silencio, com resposta 200 e dado pela metade.
const schema = z
  .object({
    // O arquivo ja subiu para o Blob pelo navegador — aqui vem so o ponteiro.
    // Mandar os bytes pela rota esbarraria no limite de 4,5 MB da Vercel, que
    // e justamente o que o upload direto existe para contornar.
    pathname: z.string().min(1, 'Informe o arquivo enviado.'),
  })
  .strict();

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'A leitura automática não está configurada no servidor (ANTHROPIC_API_KEY ausente).',
      },
      { status: 503 }
    );
  }

  try {
    const { pathname } = schema.parse(await request.json());

    const meta = await head(pathname, { access: 'private' } as any);

    if (meta.size > TAMANHO_MAXIMO_BYTES) {
      return NextResponse.json(
        { error: new DocumentoGrandeDemaisError(meta.size).message },
        { status: 413 }
      );
    }

    const arquivo = await fetch(meta.downloadUrl ?? meta.url);
    if (!arquivo.ok) {
      return NextResponse.json(
        { error: 'Não foi possível abrir o arquivo enviado.' },
        { status: 502 }
      );
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const dados = await lerCrlv(bytes, meta.contentType || 'application/pdf');

    console.log(
      `CRLV lido por ${(session.user as any).email}: placa ${dados.placa ?? '—'}, ` +
        `${dados.camposIncertos.length} campo(s) incerto(s)`
    );

    return NextResponse.json({ dados });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    if (error instanceof DocumentoGrandeDemaisError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }

    if (error instanceof LeituraRecusadaError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error('Erro ao ler CRLV:', error);
    return NextResponse.json(
      {
        error:
          'Não foi possível ler o documento. Preencha os campos manualmente — o arquivo continua anexado.',
      },
      { status: 500 }
    );
  }
}
