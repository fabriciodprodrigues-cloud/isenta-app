import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  guardar,
  abrir,
  resumoDaCredencial,
  cofreConfigurado,
  CofreNaoConfiguradoError,
  type CredencialSmtp,
} from '@/lib/cofre';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const schema = z.object({
  host: z.string().min(3, 'Informe o servidor SMTP'),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(3, 'Informe o usuário'),
  // Opcional na edição: em branco mantém a senha já guardada, para que ajustar
  // a porta não obrigue a redigitar a senha.
  pass: z.string().optional(),
});

/** Situação da credencial, sem jamais devolver a senha. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const orgao = await prisma.account.findUnique({
    where: { id: params.accountId },
    select: { emailCredencialCifrada: true },
  });

  if (!orgao?.emailCredencialCifrada) {
    return NextResponse.json({ configurada: false, cofre: cofreConfigurado() });
  }

  try {
    const credencial = abrir<CredencialSmtp>(orgao.emailCredencialCifrada);
    return NextResponse.json({
      configurada: true,
      cofre: true,
      credencial: resumoDaCredencial(credencial),
    });
  } catch {
    // Chave trocada ou conteúdo adulterado: melhor dizer que precisa recadastrar
    // do que fingir que a credencial está lá.
    return NextResponse.json({
      configurada: false,
      cofre: cofreConfigurado(),
      erro: 'A credencial guardada não pôde ser lida. Cadastre novamente.',
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schema.parse(await request.json());

    const orgao = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, name: true, emailIsencao: true, emailCredencialCifrada: true },
    });

    if (!orgao) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    let senha = dados.pass;

    if (!senha) {
      if (!orgao.emailCredencialCifrada) {
        return NextResponse.json(
          { error: 'Informe a senha da caixa.' },
          { status: 400 }
        );
      }
      senha = abrir<CredencialSmtp>(orgao.emailCredencialCifrada).pass;
    }

    const credencial: CredencialSmtp = {
      host: dados.host.trim(),
      port: dados.port,
      secure: dados.secure,
      user: dados.user.trim(),
      pass: senha,
    };

    // Testa antes de guardar. Aceitar sem verificar significaria descobrir que
    // a senha está errada só quando um ofício falhasse — e o operador acharia
    // que a solicitação saiu.
    const transporter = nodemailer.createTransport({
      host: credencial.host,
      port: credencial.port,
      secure: credencial.secure,
      auth: { user: credencial.user, pass: credencial.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    });

    try {
      await transporter.verify();
    } catch (erroSmtp) {
      const mensagem = erroSmtp instanceof Error ? erroSmtp.message : String(erroSmtp);
      return NextResponse.json(
        {
          error: 'Não foi possível conectar ao servidor com essas credenciais.',
          detalhe: mensagem,
        },
        { status: 400 }
      );
    }

    await prisma.account.update({
      where: { id: orgao.id },
      data: { emailCredencialCifrada: guardar(credencial) },
    });

    console.log(
      `Credencial SMTP do órgão ${orgao.name} atualizada por ${(session.user as any).email}`
    );

    return NextResponse.json({
      success: true,
      message: 'Conexão testada e credencial guardada.',
      credencial: resumoDaCredencial(credencial),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    if (error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error('Erro ao salvar credencial SMTP:', error);
    return NextResponse.json({ error: 'Erro ao salvar a credencial' }, { status: 500 });
  }
}

/** Remove a credencial guardada. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  await prisma.account.update({
    where: { id: params.accountId },
    data: { emailCredencialCifrada: null },
  });

  return NextResponse.json({ success: true });
}
