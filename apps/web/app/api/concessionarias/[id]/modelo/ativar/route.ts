import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

function mapeamentoValido(tipo: string, mapeamentoCampos: unknown): boolean {
  if (tipo === 'DOCX') {
    const m = mapeamentoCampos as { campos?: Record<string, string> } | null;
    return Boolean(m?.campos && Object.values(m.campos).some(Boolean));
  }
  if (tipo === 'XLSX') {
    const m = mapeamentoCampos as {
      campos?: Record<string, string>;
      tabelaVeiculos?: { linhaInicial?: number; colunas?: Record<string, string> };
    } | null;
    return Boolean(
      m?.campos &&
        Object.values(m.campos).some(Boolean) &&
        m.tabelaVeiculos?.linhaInicial &&
        m.tabelaVeiculos.colunas &&
        Object.values(m.tabelaVeiculos.colunas).some(Boolean)
    );
  }
  return false;
}

/** Valida pré-requisitos (arquivo + mapeamento mínimo) e ativa -- servidor reforça a mesma regra que já desabilita o botão na UI. */
export async function POST(
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

  if (!modelo || modelo.tipo === 'GENERICO') {
    return NextResponse.json(
      { error: 'Escolha o tipo de documento (DOCX ou XLSX) antes de ativar.' },
      { status: 400 }
    );
  }
  if (!modelo.arquivoUrl) {
    return NextResponse.json({ error: 'Envie o arquivo-modelo antes de ativar.' }, { status: 400 });
  }
  if (!mapeamentoValido(modelo.tipo, modelo.mapeamentoCampos)) {
    return NextResponse.json(
      { error: 'Configure o mapeamento de campos antes de ativar.' },
      { status: 400 }
    );
  }

  const atualizada = await prisma.modeloDocumentoConcessionaria.update({
    where: { concessionariaId: params.id },
    data: { ativo: true, atualizadoPor: (session.user as any)?.email ?? 'desconhecido' },
  });

  return NextResponse.json(atualizada);
}

/** Desativa -- reversível a qualquer momento, sem apagar arquivo/config; volta ao caminho genérico imediatamente. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const atualizada = await prisma.modeloDocumentoConcessionaria.update({
    where: { concessionariaId: params.id },
    data: { ativo: false, atualizadoPor: (session.user as any)?.email ?? 'desconhecido' },
  });

  return NextResponse.json(atualizada);
}
