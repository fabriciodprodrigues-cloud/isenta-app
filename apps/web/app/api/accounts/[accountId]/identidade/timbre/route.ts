import { NextRequest, NextResponse } from 'next/server';
import { put, get, del } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// Papel timbrado é imagem de cabeçalho, não digitalização de página inteira.
// 4 MB cabe no limite de corpo das funções da Vercel, então este envio pode
// passar pela API — diferente do CRLV, que exige upload direto.
const TAMANHO_MAXIMO = 4 * 1024 * 1024;
// Só imagem: o timbre vai embutido como <img> no HTML do ofício (ver
// carregarTimbre em lib/registration-orchestrator.ts). PDF ou DOCX aqui
// aceitavam o upload mas viravam um data URI com o mimetype errado,
// corrompendo o e-mail inteiro na hora do envio.
const TIPOS_MIME = ['image/png', 'image/jpeg'];

export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const arquivo = form.get('file');

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande: ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é 4 MB.`,
        },
        { status: 400 }
      );
    }

    if (!TIPOS_MIME.includes(arquivo.type)) {
      return NextResponse.json(
        { error: 'Envie o timbre em PNG ou JPG. PDF não pode ser embutido no e-mail.' },
        { status: 400 }
      );
    }

    const orgao = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, timbreUrl: true },
    });

    if (!orgao) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    const extensao = arquivo.type === 'image/png' ? 'png' : 'jpg';
    const blob = await put(`timbres/${orgao.id}/timbre.${extensao}`, arquivo, {
      access: 'private',
      addRandomSuffix: true,
      contentType: arquivo.type,
    });

    // Remove o anterior para não acumular timbres órfãos a cada substituição.
    if (orgao.timbreUrl) {
      await del(orgao.timbreUrl).catch(erro =>
        console.error('Falha ao remover o timbre anterior:', erro)
      );
    }

    await prisma.account.update({
      where: { id: orgao.id },
      data: { timbreUrl: blob.pathname },
    });

    return NextResponse.json({ success: true, timbreUrl: blob.pathname });
  } catch (error) {
    console.error('Erro ao enviar timbre:', error);
    return NextResponse.json({ error: 'Erro ao enviar o timbre' }, { status: 500 });
  }
}

/** Devolve o timbre para pré-visualização na tela do admin. */
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
    select: { timbreUrl: true },
  });

  if (!orgao?.timbreUrl) {
    return NextResponse.json({ error: 'Timbre não enviado' }, { status: 404 });
  }

  const resultado = await get(orgao.timbreUrl, { access: 'private' });

  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    return NextResponse.json({ error: 'Timbre indisponível' }, { status: 502 });
  }

  return new NextResponse(resultado.stream, {
    headers: {
      'Content-Type': resultado.blob.contentType ?? 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
