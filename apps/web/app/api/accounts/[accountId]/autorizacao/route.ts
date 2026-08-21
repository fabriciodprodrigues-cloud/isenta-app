import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PODERES } from '@/lib/identidade-envio';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const schema = z
  .object({
    poderes: z.array(z.enum(PODERES)).min(1, 'Selecione ao menos um poder'),
    arquivoUrl: z.string().nullable().optional(),
    assinadoEm: z.string().datetime().nullable().optional(),
    validoAte: z.string().datetime().nullable().optional(),
    ativo: z.boolean(),
  })
  .superRefine((dados, ctx) => {
    // Ativar sem registrar a assinatura seria dizer que há respaldo documental
    // quando não há. É justamente esse respaldo que o termo existe para provar.
    if (dados.ativo && !dados.assinadoEm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a data de assinatura antes de ativar o termo.',
        path: ['assinadoEm'],
      });
    }

    // arquivoUrl é opcional — o termo pode ser ativado sem link/identificador
  });

export async function PUT(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schema.parse(await request.json());

    const orgao = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, name: true },
    });

    if (!orgao) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    const valores = {
      poderes: dados.poderes,
      arquivoUrl: dados.arquivoUrl ?? null,
      assinadoEm: dados.assinadoEm ? new Date(dados.assinadoEm) : null,
      validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
      ativo: dados.ativo,
    };

    const termo = await prisma.termoAutorizacao.upsert({
      where: { accountId: orgao.id },
      create: { accountId: orgao.id, ...valores },
      update: valores,
    });

    console.log(
      `Termo de autorização de ${orgao.name}: ativo=${termo.ativo}, poderes=[${termo.poderes.join(', ')}] por ${(session.user as any).email}`
    );

    return NextResponse.json(termo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Erro ao salvar termo de autorização:', error);
    return NextResponse.json({ error: 'Erro ao salvar o termo' }, { status: 500 });
  }
}
