const { createDecipheriv, createHash } = require('crypto');

/**
 * Leitura do cofre — espelho de apps/web/lib/cofre.ts.
 *
 * Duplicado de proposito: o worker roda fora da Vercel, num processo separado,
 * e importar o pacote web traria Next e Prisma Client do app junto. Sao trinta
 * linhas; a alternativa seria um pacote compartilhado so para isto.
 *
 * O worker so decifra. Nao ha caminho de escrita aqui.
 */

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;

function obterChave() {
  const bruta = process.env.ENCRYPTION_KEY;
  if (!bruta) {
    throw new Error('ENCRYPTION_KEY ausente: o worker nao consegue ler credenciais.');
  }

  const decodificada = Buffer.from(bruta, 'base64');
  if (decodificada.length === 32) return decodificada;

  return createHash('sha256').update(bruta).digest();
}

function abrir(cifrado) {
  const chave = obterChave();
  const bruto = Buffer.from(cifrado, 'base64');

  const iv = bruto.subarray(0, TAMANHO_IV);
  const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const conteudo = bruto.subarray(TAMANHO_IV + TAMANHO_TAG);

  const decipher = createDecipheriv(ALGORITMO, chave, iv);
  decipher.setAuthTag(tag);

  const aberto = Buffer.concat([decipher.update(conteudo), decipher.final()]);
  return JSON.parse(aberto.toString('utf8'));
}

module.exports = { abrir };
