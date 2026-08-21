import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { criarTokenDeConvite, montarLinkDeReset } from '@/lib/password-reset';
import { enviarEmail, EmailNaoConfiguradoError } from '@/lib/email-service';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const criar_usuario_schema = z.object({
  name: z.string().min(3, 'Informe o nome completo'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['operator', 'viewer']).default('operator'),
});

/** Lista os usuários vinculados ao órgão. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const usuarios = await prisma.user.findMany({
    where: { accountId: params.accountId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Um convite pendente significa que a pessoa ainda nao definiu a senha —
  // informacao que o admin precisa para saber se deve reenviar.
  const convites = await prisma.passwordResetToken.findMany({
    where: {
      userId: { in: usuarios.map((u: any) => u.id) },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { userId: true, expiresAt: true },
  });

  const pendentes = new Map(convites.map((c: any) => [c.userId, c.expiresAt]));

  return NextResponse.json(
    usuarios.map((u: any) => ({
      ...u,
      convitePendenteAte: pendentes.get(u.id) ?? null,
    }))
  );
}

/** Cria o usuário e envia o convite para ele definir a própria senha. */
export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = criar_usuario_schema.parse(await request.json());
    const email = dados.email.trim().toLowerCase();

    const orgao = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, name: true },
    });

    if (!orgao) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    const jaExiste = await prisma.user.findUnique({ where: { email } });
    if (jaExiste) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este e-mail' },
        { status: 409 }
      );
    }

    // Senha aleatoria e descartada: ninguem a conhece, nem o admin. O acesso
    // so passa a existir quando a pessoa define a propria senha pelo convite.
    // Isso evita a pratica de enviar senha por mensagem.
    const senhaInutilizavel = await bcrypt.hash(
      randomBytes(32).toString('base64url'),
      12
    );

    const usuario = await prisma.user.create({
      data: {
        name: dados.name.trim(),
        email,
        password: senhaInutilizavel,
        role: dados.role,
        accountId: orgao.id,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const { token, validadeHoras } = await criarTokenDeConvite(usuario.id);
    const link = montarLinkDeReset(token);

    try {
      await enviarEmail({
        para: usuario.email,
        assunto: `Seu acesso ao Isenta — ${orgao.name}`,
        texto: [
          `Olá ${usuario.name},`,
          '',
          `Você foi cadastrado no Isenta para gerenciar a isenção de pedágio da frota de ${orgao.name}.`,
          '',
          `Defina sua senha pelo link abaixo (válido por ${validadeHoras} horas):`,
          link,
          '',
          'Isenta — Plataforma de Gestão de Isenções de Pedágio',
        ].join('\n'),
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2d5f2e;">Seu acesso ao Isenta</h2>
    <p>Olá ${usuario.name},</p>
    <p>
      Você foi cadastrado no Isenta para gerenciar a isenção de pedágio da frota
      de <strong>${orgao.name}</strong>.
    </p>
    <p style="margin: 28px 0;">
      <a href="${link}"
         style="background: #2d5f2e; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
        Definir minha senha
      </a>
    </p>
    <p style="font-size: 13px; color: #666;">
      O link vale por ${validadeHoras} horas e só pode ser usado uma vez.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">
      Isenta — Plataforma de Gestão de Isenções de Pedágio
    </p>
  </div>
</body>
</html>`.trim(),
      });
    } catch (erroEmail) {
      if (erroEmail instanceof EmailNaoConfiguradoError) {
        // O usuario ficou criado mas sem meio de acesso. Dizer isso e melhor
        // do que responder sucesso e deixar a pessoa esperando um e-mail que
        // nunca sai.
        return NextResponse.json(
          {
            usuario,
            aviso:
              'Usuário criado, mas o convite não pôde ser enviado: o e-mail não está configurado no servidor.',
          },
          { status: 201 }
        );
      }
      throw erroEmail;
    }

    return NextResponse.json(
      { usuario, message: `Convite enviado para ${usuario.email}` },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Erro ao criar usuário do órgão:', error);
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
  }
}
