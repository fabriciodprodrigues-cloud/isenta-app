import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';
import { avaliarCompletudeArtesp } from '@/lib/artesp-documentos';

export const dynamic = 'force-dynamic';

/**
 * Registra o protocolo junto à SUROD/ARTESP. Número informado manualmente:
 * não há canal automatizado de protocolo com a ARTESP ainda (pendência do
 * documento de especificação do módulo — confirmar formato/canal aceito).
 *
 * Bloqueado enquanto o cadastro não estiver completo (Art. 11 da Portaria
 * 56/2025: cadastro incompleto não dá direito a estorno se cobrado
 * indevidamente, então mais vale nunca deixar protocolar incompleto).
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
    include: { veiculos: true, documentos: true, account: { select: { modeloOficioUrl: true } } },
  });

  if (!cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  }

  const completude = avaliarCompletudeArtesp({
    tipoEntidade: cadastro.tipoEntidade,
    veiculos: cadastro.veiculos,
    documentos: cadastro.documentos,
    temModeloOficio: Boolean(cadastro.account.modeloOficioUrl),
  });

  if (!completude.completa) {
    return NextResponse.json(
      { error: 'Cadastro incompleto — não é possível protocolar ainda.', pendencias: completude.pendencias },
      { status: 428 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const protocolo = String(body.protocolo ?? '').trim();
  if (!protocolo) {
    return NextResponse.json({ error: 'Informe o número do protocolo' }, { status: 400 });
  }

  const protocoladoEm = body.protocoladoEm ? new Date(body.protocoladoEm) : new Date();
  if (Number.isNaN(protocoladoEm.getTime())) {
    return NextResponse.json({ error: 'Data de protocolo inválida' }, { status: 400 });
  }

  const atualizado = await prisma.artespCadastro.update({
    where: { id: params.id },
    data: {
      status: 'protocolado',
      protocolo,
      protocoladoEm,
      protocoladoPor: (session.user as any)?.email ?? null,
    },
  });

  return NextResponse.json(atualizado);
}
