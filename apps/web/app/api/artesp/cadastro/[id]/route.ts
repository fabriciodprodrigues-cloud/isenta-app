import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';
import { ABRANGENCIA_PADRAO } from '@/lib/artesp-dados';

export const dynamic = 'force-dynamic';

/** Atualiza classificação e/ou dados do responsável pela frota. */
export async function PATCH(
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

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.tipoEntidade === 'A' || body.tipoEntidade === 'B') {
    data.tipoEntidade = body.tipoEntidade;
    data.abrangencia = body.abrangencia ?? ABRANGENCIA_PADRAO[body.tipoEntidade];
  }
  if (typeof body.responsavelFrotaNome === 'string') data.responsavelFrotaNome = body.responsavelFrotaNome;
  if (typeof body.responsavelFrotaTelefone === 'string') data.responsavelFrotaTelefone = body.responsavelFrotaTelefone;
  if (typeof body.responsavelFrotaEmail === 'string') data.responsavelFrotaEmail = body.responsavelFrotaEmail;

  const atualizado = await prisma.artespCadastro.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(atualizado);
}
