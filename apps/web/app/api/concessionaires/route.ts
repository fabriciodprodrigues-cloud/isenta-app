import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ?aptas=true devolve apenas as habilitadas para receber solicitação de
    // isenção. O diretório da tela de Concessionárias usa a lista completa;
    // o modal de Solicitar Isenção usa a filtrada.
    const apenasAptas =
      new URL(request.url).searchParams.get('aptas') === 'true';

    const concessionaires = await prisma.concessionaire.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        grupo: true,
        esfera: true,
        regulador: true,
        email: true,
        phone: true,
        website: true,
        cidade: true,
        estados: true,
        rodovias: true,
        extensaoKm: true,
        situacao: true,
        canalIsentos: true,
        tipoCanal: true,
        ativoParaCadastro: true,
        // A tela de admin edita o canal e precisa reexibir a observação; sem
        // ela, salvar uma alteração apagaria a nota já registrada.
        observacoes: true,
      },
      orderBy: [
        { regulador: 'asc' },
        { name: 'asc' },
      ],
      where: {
        situacao: 'ATIVO',
        ...(apenasAptas ? { ativoParaCadastro: true } : {}),
      },
    });

    return NextResponse.json(concessionaires);
  } catch (error) {
    console.error('Error fetching concessionaires:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const schemaCriacao = z.object({
  name: z.string().trim().min(3, 'Nome precisa de ao menos 3 caracteres.'),
  regulador: z.string().trim().min(2, 'Informe o regulador (ex: ANTT, ARTESP, ou "teste").'),
  esfera: z.enum(['FEDERAL', 'ESTADUAL', 'MUNICIPAL']).optional(),
  // Aceita "SP,RJ" digitado; convertido pra array JSON antes de gravar (ver
  // paraJsonDeEstados). O dado real sempre foi JSON.stringify(["SP","RJ"]) —
  // format_estados() tolera as duas formas na EXIBIÇÃO da tela de admin, mas
  // o modal de Solicitar Isenção do operador faz JSON.parse() estrito: uma
  // string solta quebra o parse, cai no catch, e a concessionária some da
  // lista sem erro visível nenhum.
  estados: z.string().trim().max(200).optional(),
  cnpj: z.string().trim().max(20).optional(),
});

/** "SP, rj , sp" -> '["SP","RJ"]'. Vazio -> null. */
function paraJsonDeEstados(bruto: string | undefined): string | null {
  if (!bruto) return null;

  const siglas = Array.from(
    new Set(
      bruto
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  return siglas.length > 0 ? JSON.stringify(siglas) : null;
}

/**
 * Cria uma concessionária avulsa — sobretudo para teste: o operador monta uma
 * concessionária fictícia, mapeia um canal que ele mesmo controla (o próprio
 * e-mail, por exemplo) pela edição já existente, e consegue rodar o fluxo de
 * solicitação de isenção de ponta a ponta sem tocar em nenhuma das
 * concessionárias reais.
 *
 * De propósito não recebe canal nem `ativoParaCadastro` aqui: o valor
 * padrão do schema (false) já barra a concessionária nova de qualquer envio
 * real até que um admin habilite pela tela de edição — a mesma trava que
 * protege as concessionárias reais.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schemaCriacao.parse(await request.json());

    const criada = await prisma.concessionaire.create({
      data: {
        name: dados.name,
        regulador: dados.regulador,
        esfera: dados.esfera ?? 'FEDERAL',
        estados: paraJsonDeEstados(dados.estados),
        cnpj: dados.cnpj || null,
      },
      select: {
        id: true,
        name: true,
        regulador: true,
        esfera: true,
        estados: true,
        situacao: true,
        canalIsentos: true,
        tipoCanal: true,
        ativoParaCadastro: true,
        observacoes: true,
      },
    });

    return NextResponse.json(criada, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe uma concessionária com esse nome.' },
        { status: 409 }
      );
    }

    console.error('Erro ao criar concessionária:', error);
    return NextResponse.json(
      { error: 'Erro ao criar concessionária' },
      { status: 500 }
    );
  }
}
