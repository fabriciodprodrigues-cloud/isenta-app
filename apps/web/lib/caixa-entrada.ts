import { ImapFlow } from 'imapflow';
import type { CredencialSmtp } from './cofre';

/**
 * Leitura da caixa institucional do órgão.
 *
 * Existe porque os portais das concessionárias confirmam cadastro e solicitação
 * por código de seis dígitos ou link enviados por e-mail. Sem ler a caixa, o
 * robô para no meio do fluxo e alguém precisa completar à mão.
 *
 * O acesso é a uma caixa **dedicada à isenção**, não à caixa institucional
 * principal. Credencial de SMTP deixa enviar; credencial de IMAP deixa ler tudo
 * o que está lá dentro. Numa câmara municipal isso incluiria ofícios, dados de
 * servidores e processos administrativos — escopo que este projeto não tem
 * motivo para alcançar.
 */

/** Conecta e desliga, só para provar que a credencial funciona. */
export async function testarLeituraDaCaixa(
  credencial: CredencialSmtp
): Promise<string | null> {
  if (!credencial.imapHost) return 'Servidor IMAP não informado.';

  const cliente = new ImapFlow({
    host: credencial.imapHost,
    port: credencial.imapPort ?? 993,
    secure: credencial.imapSeguro ?? true,
    auth: { user: credencial.user, pass: credencial.pass },
    // O logger padrão despeja o diálogo IMAP inteiro no stdout, incluindo o
    // comando de login.
    logger: false,
  });

  try {
    await cliente.connect();
    // Abrir a INBOX faz parte do teste: há servidores que aceitam o login e
    // negam a pasta, e descobrir isso só na primeira execução do robô seria
    // tarde demais.
    const caixa = await cliente.getMailboxLock('INBOX');
    caixa.release();
    return null;
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  } finally {
    // logout() pode falhar se a conexão já caiu; não é isso que se está testando.
    await cliente.logout().catch(() => {});
  }
}
