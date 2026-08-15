import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * Cofre de segredos da aplicação.
 *
 * Guarda credenciais de terceiros — hoje, o acesso SMTP à caixa institucional
 * de cada órgão. São senhas de órgão público: gravá-las em texto plano no banco
 * significaria que qualquer vazamento, backup mal guardado ou consulta ao
 * Postgres entrega acesso à caixa oficial de uma prefeitura ou câmara.
 *
 * AES-256-GCM foi escolhido por ser autenticado: além de cifrar, detecta
 * adulteração do texto cifrado. Um modo sem autenticação permitiria alterar o
 * conteúdo sem que a decifragem acusasse.
 */

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12; // recomendado para GCM
const TAMANHO_TAG = 16;

export class CofreNaoConfiguradoError extends Error {
  constructor() {
    super(
      'Cofre não configurado: defina ENCRYPTION_KEY (32 bytes em base64) no servidor.'
    );
    this.name = 'CofreNaoConfiguradoError';
  }
}

function obterChave(): Buffer {
  const bruta = process.env.ENCRYPTION_KEY;
  if (!bruta) throw new CofreNaoConfiguradoError();

  // Aceita base64 de 32 bytes; qualquer outro formato é derivado por SHA-256
  // para garantir o comprimento exato que o AES-256 exige.
  const decodificada = Buffer.from(bruta, 'base64');
  if (decodificada.length === 32) return decodificada;

  return createHash('sha256').update(bruta).digest();
}

export function cofreConfigurado(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY);
}

/** Cifra um objeto e devolve uma string única, pronta para gravar. */
export function guardar(valor: unknown): string {
  const chave = obterChave();
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave, iv);

  const conteudo = Buffer.concat([
    cipher.update(JSON.stringify(valor), 'utf8'),
    cipher.final(),
  ]);

  // iv + tag + conteúdo, tudo num campo só, para não espalhar partes do
  // segredo por colunas diferentes.
  return Buffer.concat([iv, cipher.getAuthTag(), conteudo]).toString('base64');
}

/** Decifra o que `guardar` produziu. Lança se o conteúdo foi adulterado. */
export function abrir<T>(cifrado: string): T {
  const chave = obterChave();
  const bruto = Buffer.from(cifrado, 'base64');

  const iv = bruto.subarray(0, TAMANHO_IV);
  const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const conteudo = bruto.subarray(TAMANHO_IV + TAMANHO_TAG);

  const decipher = createDecipheriv(ALGORITMO, chave, iv);
  decipher.setAuthTag(tag);

  const aberto = Buffer.concat([decipher.update(conteudo), decipher.final()]);
  return JSON.parse(aberto.toString('utf8')) as T;
}

/** Credenciais SMTP da caixa institucional do órgão. */
export interface CredencialSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/**
 * Versão segura para exibir na tela: nunca inclui a senha.
 *
 * A senha entra uma vez e não sai mais — nem para o admin que a cadastrou.
 */
export function resumoDaCredencial(credencial: CredencialSmtp) {
  return {
    host: credencial.host,
    port: credencial.port,
    secure: credencial.secure,
    user: credencial.user,
    senhaDefinida: Boolean(credencial.pass),
  };
}
