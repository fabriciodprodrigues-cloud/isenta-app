import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from './prisma';

/** Janela de validade do link. Curta o bastante para limitar exposicao. */
const VALIDADE_MINUTOS = 60;

/**
 * Convite de primeiro acesso.
 *
 * Prazo maior que o de redefinicao: quem esquece a senha esta ali naquele
 * momento, enquanto o operador convidado pode so abrir o e-mail no dia
 * seguinte. Expirar em uma hora obrigaria o admin a reenviar o tempo todo.
 */
const VALIDADE_CONVITE_HORAS = 72;

/**
 * Gera o token que vai no link e guarda apenas o hash.
 *
 * O valor em claro so existe nesta funcao e no e-mail; nao fica no banco nem
 * em log. Assim um vazamento do banco nao permite redefinir senha de ninguem.
 */
export async function criarTokenDeReset(userId: string) {
  const token = await gerarToken(userId, VALIDADE_MINUTOS * 60_000);
  return { token, validadeMinutos: VALIDADE_MINUTOS };
}

export async function criarTokenDeConvite(userId: string) {
  const token = await gerarToken(userId, VALIDADE_CONVITE_HORAS * 3_600_000);
  return { token, validadeHoras: VALIDADE_CONVITE_HORAS };
}

async function gerarToken(userId: string, duracaoMs: number) {
  const token = randomBytes(32).toString('base64url');

  // Tokens anteriores do mesmo usuario deixam de valer: pedir um novo link
  // deve invalidar o antigo.
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashDoToken(token),
      userId,
      expiresAt: new Date(Date.now() + duracaoMs),
    },
  });

  return token;
}

function hashDoToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export type ResultadoValidacao =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; motivo: string };

export async function validarToken(token: string): Promise<ResultadoValidacao> {
  if (!token) return { ok: false, motivo: 'Link inválido.' };

  const registro = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, tokenHash: true },
  });

  if (!registro) return { ok: false, motivo: 'Link inválido ou já utilizado.' };

  // Comparacao em tempo constante por rigor; a busca acima ja e por hash.
  const iguais = timingSafeEqual(
    Buffer.from(registro.tokenHash),
    Buffer.from(hashDoToken(token))
  );
  if (!iguais) return { ok: false, motivo: 'Link inválido.' };

  if (registro.usedAt) {
    return { ok: false, motivo: 'Este link já foi utilizado. Solicite um novo.' };
  }

  if (registro.expiresAt < new Date()) {
    return { ok: false, motivo: 'Este link expirou. Solicite um novo.' };
  }

  return { ok: true, userId: registro.userId, tokenId: registro.id };
}

export function montarLinkDeReset(token: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
}
