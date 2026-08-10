import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarVeiculo, TIPOS_DOCUMENTO, TipoDocumento } from '@/lib/document-access';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const TIPOS_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Emite o token para o navegador enviar o arquivo direto ao Blob.
 *
 * Existe porque funcao serverless na Vercel aceita no maximo ~4,5 MB de corpo:
 * enviar o arquivo pela nossa API devolvia 413 antes mesmo de chegar ao codigo,
 * e um CRLV escaneado passa disso com facilidade. No upload direto o arquivo
 * nao trafega pela funcao.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const resposta = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user) {
          throw new Error('Não autorizado');
        }

        // A autorizacao se apoia no clientPayload, nao no pathname: o pathname
        // e escolhido pelo navegador e nao serve como prova de nada.
        const dados = JSON.parse(clientPayload ?? '{}') as {
          vehicleId?: string;
          type?: TipoDocumento;
          fileName?: string;
        };

        if (!dados.vehicleId) throw new Error('Veículo não informado');

        if (!dados.type || !TIPOS_DOCUMENTO.includes(dados.type)) {
          throw new Error('Tipo de documento inválido');
        }

        const permissao = await podeAcessarVeiculo(session.user as any, dados.vehicleId);
        if (!permissao.ok) throw new Error(permissao.erro);

        return {
          access: 'private' as const,
          allowedContentTypes: TIPOS_MIME,
          addRandomSuffix: true,
          maximumSizeInBytes: 20 * 1024 * 1024,
          // Vai assinado pela Vercel e volta intacto em onUploadCompleted,
          // por isso serve de base para gravar o registro.
          tokenPayload: JSON.stringify({
            vehicleId: dados.vehicleId,
            type: dados.type,
            fileName: dados.fileName ?? 'documento',
            uploadedBy: (session.user as any).email ?? 'desconhecido',
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Chamado pela Vercel apos o envio concluir. E servidor-para-servidor,
        // entao o tokenPayload e confiavel.
        const dados = JSON.parse(tokenPayload ?? '{}');

        await prisma.document.create({
          data: {
            vehicleId: dados.vehicleId,
            type: dados.type,
            url: blob.pathname,
            fileName: dados.fileName,
            fileSize: (blob as any).size ?? 0,
            uploadedBy: dados.uploadedBy,
          },
        });
      },
    });

    return NextResponse.json(resposta);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro no upload';
    console.error('Erro no upload direto:', mensagem);
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
