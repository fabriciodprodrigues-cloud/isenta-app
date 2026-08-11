import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
