import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { validarToken } from '@/lib/password-reset';

// Le o corpo da requisicao, portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(1, 'Token ausente'),
  senha: z
    .string()
    .min(12, 'A senha deve ter ao menos 12 caracteres'),
});

/** Confere se o link ainda vale, sem consumi-lo — usado ao abrir a tela. */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const validacao = await validarToken(token);

  if (!validacao.ok) {
    return NextResponse.json({ valido: false, motivo: validacao.motivo }, { status: 400 });
  }

  return NextResponse.json({ valido: true });
}

export async function POST(request: NextRequest) {
  try {
    const { token, senha } = schema.parse(await request.json());

    const validacao = await validarToken(token);
    if (!validacao.ok) {
      return NextResponse.json({ error: validacao.motivo }, { status: 400 });
    }

    const hash = await bcrypt.hash(senha, 12);

    // Marcar o token e trocar a senha na mesma transacao: se a gravacao da
    // senha falhar, o link continua valido; se o token falhar, a senha nao
    // muda. Um link redefine uma unica vez.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: validacao.userId },
        data: { password: hash },
      }),
      prisma.passwordResetToken.update({
        where: { id: validacao.tokenId },
        data: { usedAt: new Date() },
      }),
      // Sessoes abertas do usuario deixam de valer: se a redefinicao veio de
      // um acesso indevido, ela expulsa quem estava dentro.
      prisma.session.deleteMany({ where: { userId: validacao.userId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida. Você já pode entrar com a nova senha.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json({ error: 'Erro ao redefinir senha' }, { status: 500 });
  }
}
