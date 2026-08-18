import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@/lib/auth';

/**
 * Token para o CRLV que o operador envia **antes** de o veículo existir.
 *
 * A rota de upload de documentos exige `vehicleId` para autorizar, e aqui não
 * há veículo ainda — é justamente o documento que vai preencher o cadastro.
 * Por isso o caminho é isolado: `leitura-crlv/<usuário>/…` não se mistura com
 * `documentos/<veículo>/…`, que é o acervo real do órgão.
 */

export const dynamic = 'force-dynamic';

const TIPOS_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const resposta = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user) throw new Error('Não autorizado');

        return {
          access: 'private' as const,
          allowedContentTypes: TIPOS_MIME,
          addRandomSuffix: true,
          maximumSizeInBytes: 15 * 1024 * 1024,
        };
      },

      // Nada a fazer: o arquivo aqui é insumo de leitura, não acervo. O CRLV
      // definitivo é anexado ao veículo depois que ele existe, pelo fluxo de
      // documentos — que é o que a solicitação de isenção usa.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(resposta);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha no envio.';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
