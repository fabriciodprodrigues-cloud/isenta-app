import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Marca o deferimento/indeferimento da ARTESP manualmente -- não há
 * integração automatizada de status ainda (fase [POSTERIOR] do módulo).
 * Admin-only, mesmo padrão de aprovar-manual pras concessionárias comuns.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const decisao = body.decisao;

  if (decisao !== 'deferido' && decisao !== 'indeferido' && decisao !== 'exigencia') {
    return NextResponse.json({ error: 'decisao deve ser "deferido", "indeferido" ou "exigencia"' }, { status: 400 });
  }

  const cadastro = await prisma.artespCadastro.findUnique({ where: { id: params.id } });
  if (!cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  }

  if (cadastro.status !== 'protocolado' && decisao !== 'exigencia') {
    return NextResponse.json(
      { error: 'Só é possível registrar decisão em um cadastro já protocolado.' },
      { status: 400 }
    );
  }

  const atualizado = await prisma.artespCadastro.update({
    where: { id: params.id },
    data: {
      status: decisao,
      decisaoEm: new Date(),
      decisaoObs: typeof body.observacao === 'string' ? body.observacao : null,
    },
  });

  return NextResponse.json(atualizado);
}
