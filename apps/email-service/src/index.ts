import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createTransport } from 'nodemailer';
import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Relay de SMTP/IMAP com IP fixo, para caixas (como a da UOL Host) que
 * exigem autorizar o IP de origem — algo que a Vercel não oferece em
 * funções normais.
 *
 * Propositalmente sem estado: não guarda nenhuma credencial de órgão.
 * Quem já decifra a credencial (via lib/cofre.ts) é a aplicação web; aqui
 * ela chega pronta a cada chamada, é usada uma vez e descartada. Isso evita
 * duplicar a ENCRYPTION_KEY numa terceira máquina — quanto menos lugares
 * guardam a chave mestra, menor a superfície se algum deles vazar.
 */

const app = express();
// Limite maior que o padrão (100kb): o ofício de isenção anexa o CRLV de
// cada veículo da frota em base64, que infla o tamanho em cerca de um terço.
app.use(express.json({ limit: '40mb' }));

const porta = Number(process.env.PORT) || 3000;

function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

const SEGREDO_INTERNO = variavelObrigatoria('INTERNAL_SECRET');

/**
 * Sem IP fixo do lado da Vercel para checar a origem, a única defesa é este
 * segredo. Sem ele, qualquer pessoa que descobrisse o endereço do VPS
 * poderia mandar e-mail em nome de um órgão ou ler a caixa de entrada dele.
 */
function exigirSegredo(req: Request, res: Response, next: NextFunction): void {
  const recebido = req.header('x-internal-secret');
  if (recebido !== SEGREDO_INTERNO) {
    res.status(401).json({ erro: 'Não autorizado' });
    return;
  }
  next();
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

interface AnexoEnvio {
  /** Nome do arquivo como deve aparecer no e-mail — não é validado contra o
   *  conteúdo, então quem chama é responsável por mandar o nome certo. */
  filename?: string;
  /** Conteúdo em base64. */
  content?: string;
}

interface CorpoEnvio {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from?: string;
  to?: string;
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: AnexoEnvio[];
}

app.post('/send-email', exigirSegredo, async (req: Request<{}, {}, CorpoEnvio>, res: Response) => {
  const {
    host,
    port: portaSmtp,
    secure,
    user,
    password,
    from,
    to,
    replyTo,
    subject,
    text,
    html,
    attachments,
  } = req.body ?? {};

  if (!host || !user || !password || !to || !subject) {
    res.status(400).json({ erro: 'Campos obrigatórios: host, user, password, to, subject.' });
    return;
  }

  // Anexo sem nome ou sem conteúdo não é um erro do chamador que vale a pena
  // travar o envio inteiro — mas também não pode virar um arquivo mudo no
  // e-mail. Descarta e segue, e quem chama vê no messageId que o envio
  // aconteceu mesmo sem aquele anexo específico.
  const anexosValidos = (attachments ?? [])
    .filter((a): a is Required<AnexoEnvio> => Boolean(a.filename && a.content))
    .map(a => ({ filename: a.filename, content: Buffer.from(a.content, 'base64') }));

  try {
    const transportador = createTransport({
      host,
      port: Number(portaSmtp) || 587,
      secure: Boolean(secure),
      auth: { user, pass: password },
    });

    const info = await transportador.sendMail({
      from: from || user,
      to,
      replyTo,
      subject,
      text,
      html,
      attachments: anexosValidos.length > 0 ? anexosValidos : undefined,
    });

    res.status(200).json({
      mensagem: 'E-mail enviado',
      messageId: info.messageId,
      anexosEnviados: anexosValidos.length,
    });
  } catch (erro) {
    // Erro de SMTP (autenticação, IP bloqueado, etc.) não é bug nosso — é
    // resposta do servidor remoto. 502 (bad gateway) sinaliza isso melhor
    // que 500, que sugeriria falha deste serviço.
    console.error('Erro ao enviar e-mail:', erro);
    res.status(502).json({
      erro: 'Falha ao enviar e-mail',
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  }
});

interface CorpoLeitura {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  /** Quantas mensagens mais recentes trazer. Padrão 10. */
  limite?: number;
}

app.post('/check-emails', exigirSegredo, async (req: Request<{}, {}, CorpoLeitura>, res: Response) => {
  const { host, port: portaImap, secure, user, password, limite } = req.body ?? {};

  if (!host || !user || !password) {
    res.status(400).json({ erro: 'Campos obrigatórios: host, user, password.' });
    return;
  }

  const client = new ImapFlow({
    host,
    port: Number(portaImap) || 993,
    secure: secure === undefined ? true : Boolean(secure),
    auth: { user, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');

    const total = mailbox.exists;
    const quantos = Math.min(Number(limite) || 10, total);
    const mensagens: Array<{ uid: number; de: string; assunto: string; data: string | null }> = [];

    if (total > 0) {
      // client.fetch() devolve um gerador assíncrono, não um array — atribuir
      // direto a uma variável (como no rascunho anterior) serializava vazio.
      const intervalo = `${Math.max(1, total - quantos + 1)}:${total}`;
      for await (const msg of client.fetch(intervalo, { envelope: true, uid: true })) {
        mensagens.push({
          uid: msg.uid,
          de: msg.envelope?.from?.[0]?.address ?? '',
          assunto: msg.envelope?.subject ?? '',
          data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
        });
      }
    }

    await client.logout();
    // Mais recente primeiro — é o que importa ao procurar um código que
    // acabou de chegar.
    res.status(200).json({ mensagens: mensagens.reverse() });
  } catch (erro) {
    console.error('Erro ao verificar e-mails:', erro);
    res.status(502).json({
      erro: 'Falha ao ler a caixa',
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
    try {
      await client.logout();
    } catch {
      // conexão já pode ter caído — nada a fazer
    }
  }
});

// Só em loopback: quem fala com este serviço é o nginx local, que faz proxy
// reverso com TLS. Escutar em 0.0.0.0 exporia a porta 3000 sem certificado
// para qualquer um na internet, mesmo com o firewall ligado por engano tarde.
app.listen(porta, '127.0.0.1', () => {
  console.log(`Serviço de e-mail (Isenta) rodando em 127.0.0.1:${porta}`);
});
