import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { detectarCamposDocx, detectarCamposXlsx } from '@/lib/modelo-deteccao';
import { ModeloDocxInvalidoError } from '@/lib/modelo-docx';
import { ModeloXlsxInvalidoError } from '@/lib/modelo-xlsx';

// Usa auth() (lê cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Detecção automática dos campos do modelo já enviado (seção 4 da tela de
 * mapeamento) -- só lê o arquivo persistido e devolve sugestões; nunca grava
 * nada. Mesmo padrão RBAC/erro de preview/route.ts (admin-only, 400/422/502).
 */
export async function POST(
  _request: Request,
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
    return NextResponse.json({ error: 'Envie o arquivo-modelo antes de detectar os campos.' }, { status: 400 });
  }
  if (persistido.tipo !== 'DOCX' && persistido.tipo !== 'XLSX') {
    return NextResponse.json({ error: 'Detecção automática não se aplica a este tipo de modelo.' }, { status: 400 });
  }

  try {
    const resultado = await get(persistido.arquivoUrl, { access: 'private' });
    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      return NextResponse.json({ error: 'Arquivo-modelo indisponível' }, { status: 502 });
    }
    const arquivoBuffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());

    if (persistido.tipo === 'DOCX') {
      const deteccao = await detectarCamposDocx(arquivoBuffer);
      return NextResponse.json(deteccao);
    }

    const deteccao = await detectarCamposXlsx(arquivoBuffer);
    return NextResponse.json(deteccao);
  } catch (error) {
    if (error instanceof ModeloDocxInvalidoError || error instanceof ModeloXlsxInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro ao detectar campos do modelo de documento:', error);
    return NextResponse.json({ error: 'Erro ao detectar os campos' }, { status: 500 });
  }
}
