import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { criarTokenDeConvite, montarLinkDeReset } from '@/lib/password-reset';
import { enviarEmail, EmailNaoConfiguradoError } from '@/lib/email-service';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

async function carregarUsuarioDoOrgao(accountId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, accountId },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Reenvia o convite de definição de senha. */
export async function POST(
  _request: NextRequest,
  { params }: { params: { accountId: string; userId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const usuario = await carregarUsuarioDoOrgao(params.accountId, params.userId);
  if (!usuario) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  try {
    const { token, validadeHoras } = await criarTokenDeConvite(usuario.id);
    const link = montarLinkDeReset(token);

    await enviarEmail({
      para: usuario.email,
      assunto: 'Seu acesso ao Isenta',
      texto: [
        `Olá ${usuario.name},`,
        '',
        `Use o link abaixo para definir sua senha (válido por ${validadeHoras} horas):`,
        link,
        '',
        'Isenta — Plataforma de Gestão de Isenções de Pedágio',
      ].join('\n'),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #2d5f2e;">Seu acesso ao Isenta</h2>
  <p>Olá ${usuario.name},</p>
  <p style="margin: 28px 0;">
    <a href="${link}" style="background: #2d5f2e; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
      Definir minha senha
    </a>
  </p>
  <p style="font-size: 13px; color: #666;">
    O link vale por ${validadeHoras} horas e só pode ser usado uma vez.
  </p>
</div>`.trim(),
    });

    return NextResponse.json({
      success: true,
      message: `Convite reenviado para ${usuario.email}`,
    });
  } catch (error) {
    if (error instanceof EmailNaoConfiguradoError) {
      return NextResponse.json(
        { error: 'O e-mail não está configurado no servidor.' },
        { status: 503 }
      );
    }

    console.error('Erro ao reenviar convite:', error);
    return NextResponse.json({ error: 'Erro ao reenviar convite' }, { status: 500 });
  }
}

/** Remove o usuário do órgão. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { accountId: string; userId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const usuario = await carregarUsuarioDoOrgao(params.accountId, params.userId);
  if (!usuario) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  // Guarda contra o admin remover a si mesmo por engano — embora admin nao
  // tenha accountId e portanto nao caia nesta rota, a checagem custa nada.
  if (usuario.id === (session.user as any)?.id) {
    return NextResponse.json(
      { error: 'Você não pode remover o próprio usuário' },
      { status: 400 }
    );
  }

  try {
    // Os tokens saem junto: um convite pendente de usuario removido nao deve
    // continuar valendo.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: usuario.id } }),
      prisma.session.deleteMany({ where: { userId: usuario.id } }),
      prisma.user.delete({ where: { id: usuario.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    return NextResponse.json({ error: 'Erro ao remover usuário' }, { status: 500 });
  }
}
