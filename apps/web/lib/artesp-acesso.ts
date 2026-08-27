import { prisma } from './prisma';
import type { ArtespCadastro } from '@prisma/client';

interface Sessao {
  role?: string | null;
  accountId?: string | null;
}

/**
 * Admin acessa qualquer cadastro; operador só o da própria conta. Mesmo
 * padrão de podeAcessarVeiculo (document-access.ts) — centralizado porque
 * a mesma regra vale pra todas as rotas do módulo.
 */
export async function podeAcessarArtespCadastro(
  sessao: Sessao,
  cadastroId: string
): Promise<{ ok: true; cadastro: ArtespCadastro } | { ok: false; status: 403 | 404; erro: string }> {
  const cadastro = await prisma.artespCadastro.findUnique({ where: { id: cadastroId } });

  if (!cadastro) {
    return { ok: false, status: 404, erro: 'Cadastro ARTESP não encontrado' };
  }

  if (sessao.role === 'admin') return { ok: true, cadastro };

  if (!sessao.accountId || cadastro.accountId !== sessao.accountId) {
    return { ok: false, status: 403, erro: 'Acesso negado' };
  }

  return { ok: true, cadastro };
}

/** Mesma checagem, a partir do id de um ArtespDocumento (upload da via assinada). */
export async function podeAcessarArtespDocumento(
  sessao: Sessao,
  documentoId: string
): Promise<
  | { ok: true; documento: { id: string; tipo: string; artespCadastroId: string } }
  | { ok: false; status: 403 | 404; erro: string }
> {
  const documento = await prisma.artespDocumento.findUnique({
    where: { id: documentoId },
    select: { id: true, tipo: true, artespCadastroId: true, artespCadastro: { select: { accountId: true } } },
  });

  if (!documento) {
    return { ok: false, status: 404, erro: 'Documento não encontrado' };
  }

  const liberado =
    sessao.role === 'admin' ||
    (Boolean(sessao.accountId) && documento.artespCadastro.accountId === sessao.accountId);

  if (!liberado) {
    return { ok: false, status: 403, erro: 'Acesso negado' };
  }

  return { ok: true, documento: { id: documento.id, tipo: documento.tipo, artespCadastroId: documento.artespCadastroId } };
}
