import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { gerarDocumentoConcessionaria } from '@/lib/modelo-documento';
import { dadosDeExemploParaModelo } from '@/lib/dados-exemplo';
import { ModeloDocxInvalidoError } from '@/lib/modelo-docx';
import { ModeloXlsxInvalidoError } from '@/lib/modelo-xlsx';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Gera um documento de teste com dados fictícios, usando a config atual do
 * formulário (mesmo se ainda não salva) em vez da persistida -- permite
 * iterar no mapeamento sem precisar salvar a cada tentativa. Não persiste
 * nada; é só geração + retorno do arquivo pra abrir/baixar no navegador.
 *
 * Reaproveita a MESMA função dispatcher usada pelo envio real
 * (processRegistration) -- a garantia de "preview == envio real" vem de
 * reuso de código, não de um modo especial dentro dos geradores.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const persistido = await prisma.modeloDocumentoConcessionaria.findUnique({
    where: { concessionariaId: params.id },
  });

  if (!persistido?.arquivoUrl) {
    return NextResponse.json({ error: 'Envie o arquivo-modelo antes de pré-visualizar.' }, { status: 400 });
  }

  const corpo = await request.json().catch(() => ({}));
  const tipo = corpo.tipo ?? persistido.tipo;
  const mapeamentoCampos = corpo.mapeamentoCampos ?? persistido.mapeamentoCampos;
  const formatoSaida = corpo.formatoSaida ?? persistido.formatoSaida;

  if (tipo !== 'DOCX' && tipo !== 'XLSX') {
    return NextResponse.json({ error: 'Tipo inválido para pré-visualização.' }, { status: 400 });
  }

  const concessionaria = await prisma.concessionaire.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  if (!concessionaria) {
    return NextResponse.json({ error: 'Concessionária não encontrada' }, { status: 404 });
  }

  try {
    const resultado = await get(persistido.arquivoUrl, { access: 'private' });
    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      return NextResponse.json({ error: 'Arquivo-modelo indisponível' }, { status: 502 });
    }
    const arquivoBuffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());

    const documento = await gerarDocumentoConcessionaria(
      { ...dadosDeExemploParaModelo, concessionariaNome: concessionaria.name },
      { tipo, mapeamentoCampos, formatoSaida, arquivoBuffer }
    );

    return new NextResponse(Uint8Array.from(documento.buffer), {
      headers: {
        'Content-Type': documento.mimeType,
        'Content-Disposition': `inline; filename="${documento.fileName}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof ModeloDocxInvalidoError || error instanceof ModeloXlsxInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro ao pré-visualizar modelo de documento:', error);
    return NextResponse.json({ error: 'Erro ao gerar a pré-visualização' }, { status: 500 });
  }
}
