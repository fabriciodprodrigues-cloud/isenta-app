import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const mapeamentoDocxSchema = z.object({
  campos: z.record(z.string()),
});

const mapeamentoXlsxSchema = z.object({
  campos: z.record(z.string()),
  tabelaVeiculos: z.object({
    linhaInicial: z.number().int().positive(),
    colunas: z.record(z.string()),
  }),
});

const schema = z
  .object({
    tipo: z.enum(['GENERICO', 'DOCX', 'XLSX']),
    mapeamentoCampos: z.unknown().optional(),
    codigoFormulario: z.string().trim().max(100).nullable().optional(),
    formatoSaida: z.enum(['PDF', 'MANTER_ORIGINAL']).optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.mapeamentoCampos === undefined) return;

    // O shape do mapeamento depende do tipo -- validado aqui em vez de no
    // schema do Prisma (Json não tem como forçar isso na tabela).
    if (dados.tipo === 'DOCX') {
      const resultado = mapeamentoDocxSchema.safeParse(dados.mapeamentoCampos);
      if (!resultado.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mapeamento inválido para tipo DOCX: esperado { campos: { chave: tag } }.',
          path: ['mapeamentoCampos'],
        });
      }
    } else if (dados.tipo === 'XLSX') {
      const resultado = mapeamentoXlsxSchema.safeParse(dados.mapeamentoCampos);
      if (!resultado.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mapeamento inválido para tipo XLSX: esperado { campos, tabelaVeiculos: { linhaInicial, colunas } }.',
          path: ['mapeamentoCampos'],
        });
      }
    }
  });

/** Config atual de modelo de documento da concessionária, ou default GENERICO/inativo se nunca configurada. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const modelo = await prisma.modeloDocumentoConcessionaria.findUnique({
    where: { concessionariaId: params.id },
  });

  return NextResponse.json(
    modelo ?? {
      concessionariaId: params.id,
      tipo: 'GENERICO',
      arquivoUrl: null,
      arquivoNome: null,
      codigoFormulario: null,
      mapeamentoCampos: null,
      formatoSaida: 'PDF',
      ativo: false,
    }
  );
}

/**
 * Atualiza tipo/mapeamento/config -- nunca mexe em `ativo` nem `arquivoUrl`
 * (rotas dedicadas: arquivo/route.ts e ativar/route.ts) para forçar a
 * sequência "subir arquivo -> mapear -> pré-visualizar -> ativar" a
 * acontecer em passos auditáveis, nunca um PATCH que ativa sem mapeamento
 * por acidente.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schema.parse(await request.json());

    const concessionaria = await prisma.concessionaire.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!concessionaria) {
      return NextResponse.json({ error: 'Concessionária não encontrada' }, { status: 404 });
    }

    const email = (session.user as any)?.email ?? 'desconhecido';

    // Trocar o tipo zera o mapeamento anterior -- mapeamento de DOCX não faz
    // sentido pra XLSX e vice-versa; a UI já confirma isso com o admin antes
    // de chamar esta rota.
    const existente = await prisma.modeloDocumentoConcessionaria.findUnique({
      where: { concessionariaId: params.id },
      select: { tipo: true },
    });
    const trocouTipo = existente && existente.tipo !== dados.tipo;

    const atualizada = await prisma.modeloDocumentoConcessionaria.upsert({
      where: { concessionariaId: params.id },
      create: {
        concessionariaId: params.id,
        tipo: dados.tipo,
        mapeamentoCampos: (dados.mapeamentoCampos ?? undefined) as any,
        codigoFormulario: dados.codigoFormulario ?? null,
        formatoSaida: dados.formatoSaida ?? 'PDF',
        criadoPor: email,
        atualizadoPor: email,
      },
      update: {
        tipo: dados.tipo,
        mapeamentoCampos: (trocouTipo ? (dados.mapeamentoCampos ?? null) : dados.mapeamentoCampos) as any,
        ...(dados.codigoFormulario !== undefined ? { codigoFormulario: dados.codigoFormulario } : {}),
        ...(dados.formatoSaida !== undefined ? { formatoSaida: dados.formatoSaida } : {}),
        atualizadoPor: email,
      },
    });

    return NextResponse.json(atualizada);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Erro ao atualizar modelo de documento:', error);
    return NextResponse.json({ error: 'Erro ao atualizar modelo de documento' }, { status: 500 });
  }
}
