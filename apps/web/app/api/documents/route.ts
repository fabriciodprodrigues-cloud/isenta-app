import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarVeiculo, TIPOS_DOCUMENTO, TipoDocumento } from '@/lib/document-access';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10MB
const TIPOS_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

/** Lista os documentos de um veículo. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const vehicleId = new URL(request.url).searchParams.get('vehicleId');
  if (!vehicleId) {
    return NextResponse.json({ error: 'vehicleId é obrigatório' }, { status: 400 });
  }

  const permissao = await podeAcessarVeiculo(session.user as any, vehicleId);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const documentos = await prisma.document.findMany({
    where: { vehicleId },
    orderBy: { uploadedAt: 'desc' },
    // A url do Blob nunca sai daqui: o download passa por /api/documents/[id],
    // que reconfere a permissao. Expor a url tornaria o arquivo acessivel a
    // qualquer um que recebesse o link.
    select: {
      id: true,
      type: true,
      fileName: true,
      fileSize: true,
      uploadedBy: true,
      uploadedAt: true,
    },
  });

  return NextResponse.json(documentos);
}

/** Recebe o arquivo, guarda no Blob e registra o documento. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const arquivo = form.get('file');
    const vehicleId = String(form.get('vehicleId') ?? '');
    const tipo = String(form.get('type') ?? '') as TipoDocumento;

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicleId é obrigatório' }, { status: 400 });
    }

    if (!TIPOS_DOCUMENTO.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo inválido. Use: ${TIPOS_DOCUMENTO.join(', ')}` },
        { status: 400 }
      );
    }

    // Validado no servidor: a checagem equivalente em lib/file-upload.ts roda
    // no navegador e pode ser contornada.
    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande. Máximo 10MB (enviado: ${(arquivo.size / 1024 / 1024).toFixed(2)}MB)`,
        },
        { status: 400 }
      );
    }

    if (!TIPOS_MIME.includes(arquivo.type)) {
      return NextResponse.json(
        { error: 'Formato não suportado. Envie PDF, JPG ou PNG.' },
        { status: 400 }
      );
    }

    const permissao = await podeAcessarVeiculo(session.user as any, vehicleId);
    if (!permissao.ok) {
      return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
    }

    const veiculo = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { plate: true, accountId: true },
    });

    const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'pdf';
    const caminho = `documentos/${veiculo!.accountId}/${veiculo!.plate}/${tipo}.${extensao}`;

    // Store privada: toda leitura exige autenticacao. E o modo adequado para
    // CRLV, que traz dados do veiculo e do orgao.
    const blob = await put(caminho, arquivo, {
      access: 'private',
      // Sufixo aleatorio para que reenviar o mesmo tipo nao sobrescreva o
      // anterior — o Blob leva ate 60s para propagar sobrescrita.
      addRandomSuffix: true,
      contentType: arquivo.type,
    });

    const documento = await prisma.document.create({
      data: {
        vehicleId,
        type: tipo,
        // Guardamos o pathname, nao a url: e o que get() precisa, e mantem o
        // registro independente do dominio da store.
        url: blob.pathname,
        fileName: arquivo.name,
        fileSize: arquivo.size,
        uploadedBy: (session.user as any).email ?? 'desconhecido',
      },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileSize: true,
        uploadedBy: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json(documento, { status: 201 });
  } catch (error) {
    console.error('Erro ao enviar documento:', error);

    // Numa store privada o Vercel autentica por OIDC e injeta VERCEL_OIDC_TOKEN
    // + BLOB_STORE_ID; em outros casos usa BLOB_READ_WRITE_TOKEN. Conferir uma
    // variavel especifica de antemao bloqueava ambientes validos, entao a falta
    // de credencial e reconhecida pelo proprio erro do SDK.
    const mensagem = error instanceof Error ? error.message : String(error);
    const semCredencial =
      /token|credential|unauthorized|not authorized|BLOB_/i.test(mensagem);

    if (semCredencial) {
      return NextResponse.json(
        {
          error:
            'O armazenamento de arquivos não está acessível. Verifique se a store do Blob está conectada a este projeto no Vercel.',
          detalhe: mensagem,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Erro ao enviar documento' }, { status: 500 });
  }
}
