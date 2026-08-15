const { ImapFlow } = require('imapflow');

/**
 * Leitura da caixa de isencao do orgao.
 *
 * Os portais confirmam cadastro e solicitacao por codigo de seis digitos ou
 * link enviados por e-mail. Sem isto o robo para no meio do fluxo.
 *
 * A caixa e dedicada a isencao — nao e a caixa institucional principal do
 * orgao. IMAP da acesso de leitura a tudo que estiver na conta, entao o escopo
 * precisa ser estreito por construcao, nao por disciplina.
 */

const ESPERA_PADRAO_MS = 120_000;
const INTERVALO_CONSULTA_MS = 5_000;

/** Codigo de seis digitos isolado — evita casar com CNPJ, CEP ou placa. */
const PADRAO_CODIGO = /(?<![0-9])([0-9]{6})(?![0-9])/;

function abrirCliente(credencial) {
  if (!credencial.imapHost) {
    throw new Error(
      'A caixa deste orgao nao tem leitura configurada (IMAP ausente).'
    );
  }

  return new ImapFlow({
    host: credencial.imapHost,
    port: credencial.imapPort || 993,
    secure: credencial.imapSeguro !== false,
    auth: { user: credencial.user, pass: credencial.pass },
    // O logger padrao despeja o dialogo IMAP inteiro, incluindo o login.
    logger: false,
  });
}

/**
 * Espera uma mensagem nova que satisfaca `combina` e devolve o que `extrair`
 * achar nela.
 *
 * Busca apenas mensagens **recebidas depois de `desde`**. Sem esse corte, um
 * codigo antigo ainda na caixa seria lido como se fosse o da vez — e o robo
 * enviaria um codigo expirado achando que acertou. Por isso quem chama deve
 * marcar `desde` ANTES de disparar a acao que provoca o e-mail.
 */
async function esperarMensagem(credencial, opcoes) {
  const {
    desde,
    combina,
    extrair,
    esperaMs = ESPERA_PADRAO_MS,
    aoRegistrar = () => {},
  } = opcoes;

  const limite = Date.now() + esperaMs;
  const cliente = abrirCliente(credencial);
  await cliente.connect();

  try {
    while (Date.now() < limite) {
      const trava = await cliente.getMailboxLock('INBOX');

      try {
        // `since` do IMAP tem granularidade de dia, entao ele so reduz o volume;
        // o corte fino por horario e feito abaixo, comparando internalDate.
        for await (const msg of cliente.fetch(
          { since: desde },
          { envelope: true, source: true, internalDate: true }
        )) {
          if (msg.internalDate && msg.internalDate < desde) continue;
          if (!combina(msg)) continue;

          const achado = extrair(msg);
          if (achado) {
            aoRegistrar(`mensagem aceita: "${msg.envelope?.subject || 'sem assunto'}"`);
            return achado;
          }
        }
      } finally {
        trava.release();
      }

      await new Promise((r) => setTimeout(r, INTERVALO_CONSULTA_MS));
    }

    return null;
  } finally {
    await cliente.logout().catch(() => {});
  }
}

function corpoDaMensagem(msg) {
  return msg.source ? msg.source.toString('utf8') : '';
}

function remetenteDaMensagem(msg) {
  const de = msg.envelope?.from?.[0];
  if (!de) return '';
  return `${de.mailbox || ''}@${de.host || ''}`.toLowerCase();
}

/**
 * Codigo de verificacao de seis digitos.
 *
 * `dominioRemetente` e obrigatorio: sem filtrar por quem enviou, qualquer
 * mensagem com seis digitos no corpo — uma nota fiscal, um protocolo — viraria
 * candidata a codigo de acesso.
 */
async function lerCodigoDeVerificacao(credencial, opcoes) {
  const { dominioRemetente, desde, esperaMs, aoRegistrar } = opcoes;

  if (!dominioRemetente) {
    throw new Error('dominioRemetente e obrigatorio ao ler codigo de verificacao.');
  }

  return esperarMensagem(credencial, {
    desde,
    esperaMs,
    aoRegistrar,
    combina: (msg) => remetenteDaMensagem(msg).endsWith(dominioRemetente.toLowerCase()),
    extrair: (msg) => {
      const achado = PADRAO_CODIGO.exec(corpoDaMensagem(msg));
      return achado ? achado[1] : null;
    },
  });
}

/** Link de confirmacao — o outro formato que os portais usam. */
async function lerLinkDeConfirmacao(credencial, opcoes) {
  const { dominioRemetente, padraoUrl, desde, esperaMs, aoRegistrar } = opcoes;

  if (!dominioRemetente || !padraoUrl) {
    throw new Error(
      'dominioRemetente e padraoUrl sao obrigatorios ao ler link de confirmacao.'
    );
  }

  return esperarMensagem(credencial, {
    desde,
    esperaMs,
    aoRegistrar,
    combina: (msg) => remetenteDaMensagem(msg).endsWith(dominioRemetente.toLowerCase()),
    extrair: (msg) => {
      const achado = padraoUrl.exec(corpoDaMensagem(msg));
      return achado ? achado[0] : null;
    },
  });
}

module.exports = {
  esperarMensagem,
  lerCodigoDeVerificacao,
  lerLinkDeConfirmacao,
};
