import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ABRANGENCIA_PADRAO } from '@/lib/artesp-dados';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const INCLUDE_CADASTRO = {
  account: { select: { name: true, razaoSocial: true } },
  veiculos: { include: { vehicle: { select: { plate: true, type: true } } } },
  documentos: true,
} as const;

/** Operador vê o cadastro da própria conta; admin lista todos (ou filtra por accountId). */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const papel = (session.user as any)?.role;
  const accountIdParam = request.nextUrl.searchParams.get('accountId');

  if (papel === 'operator') {
    const accountId = (session.user as any)?.accountId;
    const cadastro = await prisma.artespCadastro.findFirst({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_CADASTRO,
    });
    return NextResponse.json(cadastro);
  }

  // admin
  const cadastros = await prisma.artespCadastro.findMany({
    where: accountIdParam ? { accountId: accountIdParam } : undefined,
    orderBy: { createdAt: 'desc' },
    include: INCLUDE_CADASTRO,
  });
  return NextResponse.json(cadastros);
}

/** Cria o cadastro ARTESP do órgão (passo 1+2 do wizard). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const papel = (session.user as any)?.role;
  const body = await request.json().catch(() => ({}));

  const accountId =
    papel === 'operator' ? (session.user as any)?.accountId : body.accountId;

  if (!accountId) {
    return NextResponse.json({ error: 'accountId é obrigatório' }, { status: 400 });
  }

  const { tipoEntidade, responsavelFrotaNome, responsavelFrotaTelefone, responsavelFrotaEmail } = body;

  if (tipoEntidade !== 'A' && tipoEntidade !== 'B') {
    return NextResponse.json({ error: 'tipoEntidade deve ser "A" ou "B"' }, { status: 400 });
  }

  // Um cadastro em andamento (não indeferido) já cobre a conta -- reaproveita
  // em vez de deixar criar duplicado.
  const existente = await prisma.artespCadastro.findFirst({
    where: { accountId, status: { not: 'indeferido' } },
  });
  if (existente) {
    return NextResponse.json(
      { error: 'Já existe um cadastro ARTESP em andamento para este órgão', cadastroId: existente.id },
      { status: 409 }
    );
  }

  const cadastro = await prisma.artespCadastro.create({
    data: {
      accountId,
      tipoEntidade,
      abrangencia: ABRANGENCIA_PADRAO[tipoEntidade] ?? null,
      responsavelFrotaNome: responsavelFrotaNome ?? null,
      responsavelFrotaTelefone: responsavelFrotaTelefone ?? null,
      responsavelFrotaEmail: responsavelFrotaEmail ?? null,
    },
    include: INCLUDE_CADASTRO,
  });

  return NextResponse.json(cadastro, { status: 201 });
}
