import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { guardar, cofreConfigurado, CofreNaoConfiguradoError } from '@/lib/cofre';
import { PORTAIS } from '@/lib/portais';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const schema = z.object({
  portal: z.string().refine(v => v in PORTAIS, 'Portal desconhecido'),
  usuario: z.string().email('Informe o e-mail da conta no portal'),
  // Em branco na edição mantém a senha guardada.
  senha: z.string().optional(),
});

/** Lista os portais cadastrados. Nunca devolve senha. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const credenciais = await prisma.portalCredencial.findMany({
    where: { accountId: params.accountId },
    select: { id: true, portal: true, usuario: true, updatedAt: true },
  });

  return NextResponse.json({
    cofre: cofreConfigurado(),
    portais: Object.values(PORTAIS),
    credenciais,
  });
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

    const existente = await prisma.portalCredencial.findUnique({
      where: {
        accountId_portal: { accountId: params.accountId, portal: dados.portal },
      },
      select: { id: true, senhaCifrada: true },
    });

    if (!dados.senha && !existente) {
      return NextResponse.json(
        { error: 'Informe a senha da conta no portal.' },
        { status: 400 }
      );
    }

    const senhaCifrada = dados.senha
      ? guardar(dados.senha)
      : existente!.senhaCifrada;

    const credencial = await prisma.portalCredencial.upsert({
      where: {
        accountId_portal: { accountId: params.accountId, portal: dados.portal },
      },
      create: {
        accountId: params.accountId,
        portal: dados.portal,
        usuario: dados.usuario.trim().toLowerCase(),
        senhaCifrada,
      },
      update: {
        usuario: dados.usuario.trim().toLowerCase(),
        senhaCifrada,
      },
      select: { id: true, portal: true, usuario: true, updatedAt: true },
    });

    console.log(
      `Credencial de portal ${dados.portal} salva para a conta ${params.accountId} por ${(session.user as any).email}`
    );

    // Diferente do SMTP, aqui não há teste de conexão: validar exigiria fazer
    // login de verdade no portal, e uma senha errada repetida pode bloquear a
    // conta do órgão. O robô reporta a falha na primeira execução.
    return NextResponse.json({
      success: true,
      credencial,
      aviso:
        'Credencial guardada. Ela só é validada na primeira execução do robô — não fazemos login de teste para não arriscar bloqueio da conta por tentativas.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    if (error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error('Erro ao salvar credencial de portal:', error);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const portal = new URL(request.url).searchParams.get('portal');
  if (!portal) {
    return NextResponse.json({ error: 'Portal não informado' }, { status: 400 });
  }

  await prisma.portalCredencial.deleteMany({
    where: { accountId: params.accountId, portal },
  });

  return NextResponse.json({ success: true });
}
