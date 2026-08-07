import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { criarTokenDeReset, montarLinkDeReset } from '@/lib/password-reset';
import { enviarEmail, EmailNaoConfiguradoError } from '@/lib/email-service';

// Le o corpo da requisicao, portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});

/**
 * Resposta deliberadamente igual exista ou nao o e-mail.
 *
 * Diferenciar transformaria esta rota em um verificador de contas: qualquer
 * pessoa poderia descobrir quem tem acesso ao sistema testando enderecos.
 */
const RESPOSTA_PADRAO = {
  success: true,
  message:
    'Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Verifique também a caixa de spam.',
};

export async function POST(request: NextRequest) {
  try {
    const { email } = schema.parse(await request.json());

    const usuario = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true },
    });

    if (!usuario) {
      console.log(`Redefinição solicitada para e-mail não cadastrado: ${email}`);
      return NextResponse.json(RESPOSTA_PADRAO);
    }

    const { token, validadeMinutos } = await criarTokenDeReset(usuario.id);
    const link = montarLinkDeReset(token);

    await enviarEmail({
      para: usuario.email,
      assunto: 'Redefinição de senha — Isenta',
      texto: [
        `Olá ${usuario.name},`,
        '',
        'Recebemos um pedido para redefinir a senha da sua conta no Isenta.',
        '',
        `Acesse o link abaixo para escolher uma nova senha (válido por ${validadeMinutos} minutos):`,
        link,
        '',
        'Se não foi você quem pediu, ignore esta mensagem. Sua senha atual continua valendo.',
        '',
        'Isenta — Plataforma de Gestão de Isenções de Pedágio',
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2d5f2e;">Redefinição de senha</h2>
    <p>Olá ${usuario.name},</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta no Isenta.</p>
    <p style="margin: 28px 0;">
      <a href="${link}"
         style="background: #2d5f2e; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
        Escolher nova senha
      </a>
    </p>
    <p style="font-size: 13px; color: #666;">
      O link vale por ${validadeMinutos} minutos e só pode ser usado uma vez.
    </p>
    <p style="font-size: 13px; color: #666;">
      Se não foi você quem pediu, ignore esta mensagem — sua senha atual continua valendo.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">
      Isenta — Plataforma de Gestão de Isenções de Pedágio
    </p>
  </div>
</body>
</html>`.trim(),
    });

    return NextResponse.json(RESPOSTA_PADRAO);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    if (error instanceof EmailNaoConfiguradoError) {
      console.error('Recuperação de senha indisponível: SMTP ausente.');
      return NextResponse.json(
        { error: 'O envio de e-mail não está configurado no servidor.' },
        { status: 503 }
      );
    }

    console.error('Erro ao solicitar redefinição de senha:', error);
    // Mesmo em erro interno a resposta nao revela se o e-mail existe.
    return NextResponse.json(RESPOSTA_PADRAO);
  }
}
