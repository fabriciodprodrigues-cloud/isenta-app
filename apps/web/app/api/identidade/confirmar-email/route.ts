import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

// Le parametros da requisicao, portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/**
 * Confirma a caixa de isenção pelo link enviado a ela.
 *
 * Rota pública de propósito: quem clica é alguém do órgão, que não tem conta
 * no sistema. A prova de posse é o próprio token, que só chegou naquela caixa.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, accountId } = await request.json();

    if (!token || !accountId) {
      return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
    }

    const orgao = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        emailIsencao: true,
        emailVerificado: true,
        emailVerifHash: true,
        emailVerifExpira: true,
      },
    });

    if (!orgao || !orgao.emailVerifHash) {
      return NextResponse.json(
        { error: 'Link inválido ou já utilizado.' },
        { status: 400 }
      );
    }

    if (orgao.emailVerificado) {
      return NextResponse.json({
        success: true,
        jaVerificado: true,
        orgao: orgao.name,
        email: orgao.emailIsencao,
      });
    }

    if (orgao.emailVerifExpira && orgao.emailVerifExpira < new Date()) {
      return NextResponse.json(
        { error: 'Este link expirou. Peça um novo ao administrador.' },
        { status: 400 }
      );
    }

    const hash = createHash('sha256').update(token).digest('hex');
    if (hash !== orgao.emailVerifHash) {
      return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
    }

    await prisma.account.update({
      where: { id: orgao.id },
      data: {
        emailVerificado: true,
        // O token sai depois do uso: um link de confirmação vale uma vez.
        emailVerifHash: null,
        emailVerifExpira: null,
      },
    });

    console.log(`Caixa de isenção verificada: ${orgao.emailIsencao} (${orgao.name})`);

    return NextResponse.json({
      success: true,
      orgao: orgao.name,
      email: orgao.emailIsencao,
    });
  } catch (error) {
    console.error('Erro ao confirmar caixa de isenção:', error);
    return NextResponse.json({ error: 'Erro ao confirmar' }, { status: 500 });
  }
}
