import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import {
  lerCrlv,
  TAMANHO_MAXIMO_BYTES,
  DocumentoGrandeDemaisError,
  LeituraRecusadaError,
} from '@/lib/leitura-crlv';
import { lerCrlvDoTexto, extracaoFoiSuficiente } from '@/lib/leitura-crlv-texto';

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

  // Sem checagem de ANTHROPIC_API_KEY aqui: a leitura pela camada de texto do
  // PDF não usa modelo nenhum e funciona sem chave. A verificação acontece
  // adiante, só se for preciso cair para a leitura por imagem.

  try {
    const { pathname } = schema.parse(await request.json());

    // get() e não fetch na URL: o store é privado, e a URL do blob não abre
    // sem credencial — buscá-la direto falha com "não foi possível abrir o
    // arquivo". Aqui a própria biblioteca autentica, e ainda devolve tipo e
    // tamanho junto do conteúdo, dispensando um head() antes.
    const blob = await get(pathname, { access: 'private' });

    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json(
        { error: 'Não foi possível abrir o arquivo enviado.' },
        { status: 502 }
      );
    }

    if (blob.blob.size > TAMANHO_MAXIMO_BYTES) {
      return NextResponse.json(
        { error: new DocumentoGrandeDemaisError(blob.blob.size).message },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    const tipo = blob.blob.contentType || 'application/pdf';

    // Caminho gratuito primeiro. O CRLV-e é gerado pelo Detran e traz o texto
    // dentro do PDF; ler dali não custa nada e não interpreta — transcreve.
    if (tipo === 'application/pdf') {
      try {
        const { dados, temTexto } = await lerCrlvDoTexto(bytes);

        if (temTexto && extracaoFoiSuficiente(dados)) {
          console.log(
            `CRLV lido do texto por ${(session.user as any).email}: ` +
              `placa ${dados.placa}, ${dados.camposIncertos.length} campo(s) incerto(s), custo zero`
          );
          return NextResponse.json({ dados, origem: 'texto' });
        }

        console.log(
          temTexto
            ? 'CRLV tem texto mas o layout não rendeu placa e RENAVAM; caindo para leitura por visão.'
            : 'CRLV sem camada de texto (digitalizado); caindo para leitura por visão.'
        );
      } catch (erroTexto) {
        // PDF corrompido ou protegido não deve derrubar a leitura — só perde a
        // via gratuita.
        console.error('Falha ao extrair texto do PDF:', erroTexto);
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Não foi possível ler este arquivo pelo texto, e a leitura por imagem não está configurada. Preencha manualmente.',
        },
        { status: 422 }
      );
    }

    const { dados, custo } = await lerCrlv(bytes, tipo);

    // O custo vai para o log de propósito: sem número medido, a conta do mês
    // chega sem ninguém saber quanto custa uma leitura nem o que a encarece.
    console.log(
      `CRLV lido por ${(session.user as any).email}: placa ${dados.placa ?? '—'}, ` +
        `${dados.camposIncertos.length} campo(s) incerto(s), ` +
        `${(blob.blob.size / 1024 / 1024).toFixed(1)} MB, ` +
        `${custo.tokensEntrada} tokens de entrada + ${custo.tokensSaida} de saída, ` +
        `US$ ${custo.dolares.toFixed(4)}`
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
