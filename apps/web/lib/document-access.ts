import { prisma } from './prisma';

export const TIPOS_DOCUMENTO = ['crlv', 'contract', 'registration', 'other'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ROTULOS_DOCUMENTO: Record<TipoDocumento, string> = {
  crlv: 'CRLV',
  contract: 'Contrato de Locação',
  registration: 'Comprovante de Cadastro',
  other: 'Outro',
};

interface Sessao {
  role?: string | null;
  accountId?: string | null;
  email?: string | null;
}

/**
 * Admin acessa qualquer veiculo; operador so os do proprio orgao.
 *
 * Centralizado porque a mesma regra vale para enviar, listar, baixar e
 * remover — e um documento vazado por uma rota nao checada anula a protecao
 * das outras.
 */
export async function podeAcessarVeiculo(
  sessao: Sessao,
  vehicleId: string
): Promise<{ ok: true } | { ok: false; status: 403 | 404; erro: string }> {
  const veiculo = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { accountId: true },
  });

  if (!veiculo) {
    return { ok: false, status: 404, erro: 'Veículo não encontrado' };
  }

  if (sessao.role === 'admin') return { ok: true };

  if (!sessao.accountId || veiculo.accountId !== sessao.accountId) {
    return { ok: false, status: 403, erro: 'Acesso negado' };
  }

  return { ok: true };
}

export async function podeAcessarDocumento(
  sessao: Sessao,
  documentId: string
): Promise<
  | { ok: true; documento: { id: string; url: string; fileName: string; type: string } }
  | { ok: false; status: 403 | 404; erro: string }
> {
  const documento = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      url: true,
      fileName: true,
      type: true,
      vehicle: { select: { accountId: true } },
    },
  });

  if (!documento) {
    return { ok: false, status: 404, erro: 'Documento não encontrado' };
  }

  const liberado =
    sessao.role === 'admin' ||
    (Boolean(sessao.accountId) && documento.vehicle.accountId === sessao.accountId);

  if (!liberado) {
    return { ok: false, status: 403, erro: 'Acesso negado' };
  }

  return {
    ok: true,
    documento: {
      id: documento.id,
      url: documento.url,
      fileName: documento.fileName,
      type: documento.type,
    },
  };
}
