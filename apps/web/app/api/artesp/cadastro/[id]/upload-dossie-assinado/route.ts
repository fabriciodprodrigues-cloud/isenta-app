import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';
import { TIPOS_DOCUMENTO_ARTESP, NOME_DOCUMENTO_ARTESP } from '@/lib/artesp-dados';

export const dynamic = 'force-dynamic';

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10MB

/**
 * Recebe o dossiê único já assinado (uma assinatura cobrindo os 5
 * documentos de uma vez, ver seção 6 da especificação) e marca todos os
 * 5 ArtespDocumento como assinados, apontando pro mesmo arquivo -- evita
 * ter que assinar e enviar cada documento separadamente quando a ARTESP
 * aceita o dossiê consolidado.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarArtespCadastro(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const cadastro = await prisma.artespCadastro.findUnique({
    where: { id: params.id },
    include: { documentos: true },
  });

  if (!cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  }

  const faltando = TIPOS_DOCUMENTO_ARTESP.filter(
    tipo => !cadastro.documentos.find(d => d.tipo === tipo)
  );
  if (faltando.length > 0) {
    return NextResponse.json(
      {
        error: 'Gere os 5 documentos antes de enviar o dossiê assinado.',
        faltando: faltando.map(tipo => NOME_DOCUMENTO_ARTESP[tipo]),
      },
      { status: 428 }
    );
  }

  const form = await request.formData();
  const arquivo = form.get('file');

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo 10MB (enviado: ${(arquivo.size / 1024 / 1024).toFixed(2)}MB)` },
      { status: 400 }
    );
  }

  if (arquivo.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Envie o PDF assinado.' }, { status: 400 });
  }

  const caminho = `artesp/${cadastro.accountId}/${cadastro.id}/dossie-assinado.pdf`;
  const blob = await put(caminho, arquivo, {
    access: 'private',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });

  await prisma.artespDocumento.updateMany({
    where: { artespCadastroId: cadastro.id },
    data: { urlAssinado: blob.pathname, status: 'assinado', assinadoEm: new Date() },
  });

  const atualizado = await prisma.artespCadastro.findUnique({
    where: { id: cadastro.id },
    include: { documentos: true },
  });

  return NextResponse.json(atualizado);
}
