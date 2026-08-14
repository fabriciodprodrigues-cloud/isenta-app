import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enviarEmail, EmailNaoConfiguradoError } from '@/lib/email-service';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const VALIDADE_HORAS = 48;

/**
 * Dispara a verificação do e-mail institucional de isenção.
 *
 * A confirmação exige que alguém com acesso à caixa do órgão clique no link.
 * Um botão que apenas marcasse "verificado" no painel não provaria nada — e é
 * justamente essa caixa que vai constar como remetente dos ofícios.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const orgao = await prisma.account.findUnique({
    where: { id: params.accountId },
    select: { id: true, name: true, emailIsencao: true },
  });

  if (!orgao) {
    return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
  }

  if (!orgao.emailIsencao) {
    return NextResponse.json(
      { error: 'Informe o e-mail de isenção antes de verificar.' },
      { status: 400 }
    );
  }

  try {
    const token = randomBytes(32).toString('base64url');

    await prisma.account.update({
      where: { id: orgao.id },
      data: {
        // Guardamos o hash; o valor em claro só existe no e-mail.
        emailVerifHash: createHash('sha256').update(token).digest('hex'),
        emailVerifExpira: new Date(Date.now() + VALIDADE_HORAS * 3_600_000),
        emailVerificado: false,
      },
    });

    const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const link = `${base}/verificar-email-isencao?token=${encodeURIComponent(token)}&orgao=${orgao.id}`;

    await enviarEmail({
      para: orgao.emailIsencao,
      assunto: `Confirmação da caixa de isenção — ${orgao.name}`,
      texto: [
        `Esta caixa foi indicada como o endereço oficial de isenção de pedágio de ${orgao.name}.`,
        '',
        `Para confirmar, acesse o link abaixo (válido por ${VALIDADE_HORAS} horas):`,
        link,
        '',
        'Se você não reconhece esta solicitação, ignore esta mensagem.',
        '',
        'Isenta — Plataforma de Gestão de Isenções de Pedágio',
      ].join('\n'),
      html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;line-height:1.6;">
  <h2 style="color:#2d5f2e;">Confirmação da caixa de isenção</h2>
  <p>
    Esta caixa foi indicada como o endereço oficial de isenção de pedágio de
    <strong>${orgao.name}</strong>.
  </p>
  <p style="margin:28px 0;">
    <a href="${link}" style="background:#2d5f2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
      Confirmar esta caixa
    </a>
  </p>
  <p style="font-size:13px;color:#666;">
    O link vale por ${VALIDADE_HORAS} horas. Se você não reconhece esta
    solicitação, ignore esta mensagem.
  </p>
</div>`.trim(),
    });

    return NextResponse.json({
      success: true,
      message: `Link de confirmação enviado para ${orgao.emailIsencao}. A caixa é verificada quando alguém do órgão clicar nele.`,
    });
  } catch (error) {
    if (error instanceof EmailNaoConfiguradoError) {
      return NextResponse.json(
        { error: 'O envio de e-mail não está configurado no servidor.' },
        { status: 503 }
      );
    }

    console.error('Erro ao enviar verificação:', error);
    return NextResponse.json({ error: 'Erro ao enviar verificação' }, { status: 500 });
  }
}
