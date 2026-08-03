import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Listar todas as concessionárias (públicas para todos os usuários)
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
      },
      orderBy: [
        { regulador: 'asc' },
        { name: 'asc' },
      ],
      where: {
        situacao: 'ATIVO',
      },
    });

    return NextResponse.json(concessionaires);
  } catch (error) {
    console.error('Error fetching concessionaires:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
