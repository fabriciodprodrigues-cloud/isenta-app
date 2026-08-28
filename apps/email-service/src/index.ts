import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createTransport } from 'nodemailer';
import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

// nodemailer não exporta MailComposer no entrypoint principal, só no
// caminho interno lib/mail-composer -- sem tipos publicados que o
// resolver NodeNext (ESM) reconheça nesse subcaminho. require() dinâmico
// contorna a resolução estática do TS; é a única forma de montar o mesmo
// MIME que foi enviado, pra gravar a cópia em Enviados.
const require = createRequire(import.meta.url);
const MailComposer = require('nodemailer/lib/mail-composer');

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

// Uma falha de conexão IMAP (ex: caixa que só tem o IP do VPS autorizado
// para SMTP, não para IMAP) pode emitir um evento 'error' assíncrono no
// socket TLS depois que o try/catch da rota já terminou. Sem um listener
// global, esse erro sobe como exceção não tratada e derruba o processo
// inteiro — tirando do ar também /send-email e /convert-docx-to-pdf, que
// não têm nada a ver com o problema. Loga e segue vivo.
process.on('uncaughtException', erro => {
  console.error('Exceção não tratada (processo continua rodando):', erro);
});
process.on('unhandledRejection', erro => {
  console.error('Rejeição de promise não tratada (processo continua rodando):', erro);
});

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
  /** Opcional -- se vier, tenta gravar uma cópia da mensagem na pasta de
   *  Enviados/Sent depois do envio (ver copiarParaEnviados). Sem isso, o
   *  envio funciona normalmente, só sem a cópia. */
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
}

/**
 * Envio por SMTP puro (não pelo webmail) não deixa cópia em Enviados por
 * conta própria -- nenhum provedor observado até agora faz isso sozinho.
 * Melhor esforço, best-effort: conecta por IMAP, acha a pasta certa (via
 * flag especial \Sent, com nomes comuns como plano B) e grava a mesma
 * mensagem lá. Nunca lança: se falhar, o e-mail já foi enviado de
 * verdade via SMTP, e uma cópia perdida em Enviados não deveria derrubar
 * a resposta de sucesso pra quem chamou.
 */
async function copiarParaEnviados(params: {
  imapHost: string;
  imapPort?: number;
  imapSecure?: boolean;
  user: string;
  password: string;
  raw: Buffer;
}): Promise<boolean> {
  const client = new ImapFlow({
    host: params.imapHost,
    port: Number(params.imapPort) || 993,
    secure: params.imapSecure === undefined ? true : Boolean(params.imapSecure),
    auth: { user: params.user, pass: params.password },
    logger: false,
  });
  client.on('error', erro => console.error('Erro de conexão IMAP (cópia p/ Enviados):', erro));

  try {
    await client.connect();

    const pastas = await client.list();
    const pastaEspecial = pastas.find(p => p.specialUse === '\\Sent');
    const candidatos = [
      pastaEspecial?.path,
      'Sent',
      'Enviados',
      'INBOX.Sent',
      'INBOX/Sent',
      'Sent Items',
      '[Gmail]/Sent Mail',
    ].filter((p): p is string => Boolean(p));

    for (const caminho of candidatos) {
      try {
        await client.append(caminho, params.raw, ['\\Seen']);
        await client.logout();
        return true;
      } catch {
        // Nome não existe nessa caixa -- tenta o próximo candidato.
      }
    }

    console.error('Nenhuma pasta de Enviados encontrada pra gravar cópia.');
    await client.logout();
    return false;
  } catch (erro) {
    console.error('Falha ao gravar cópia em Enviados:', erro);
    try {
      await client.logout();
    } catch {
      // conexão já pode ter caído
    }
    return false;
  }
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
    imapHost,
    imapPort,
    imapSecure,
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

  const opcoesEnvio = {
    from: from || user,
    to,
    replyTo,
    subject,
    text,
    html,
    attachments: anexosValidos.length > 0 ? anexosValidos : undefined,
  };

  try {
    const transportador = createTransport({
      host,
      port: Number(portaSmtp) || 587,
      secure: Boolean(secure),
      auth: { user, pass: password },
    });

    const info = await transportador.sendMail(opcoesEnvio);

    res.status(200).json({
      mensagem: 'E-mail enviado',
      messageId: info.messageId,
      anexosEnviados: anexosValidos.length,
    });

    // Depois de responder: o e-mail já saiu de verdade via SMTP, então a
    // cópia em Enviados não pode acrescentar latência (nem risco de
    // timeout) ao caminho crítico do envio -- roda em segundo plano, só
    // loga o resultado.
    if (imapHost) {
      new Promise<Buffer>((resolve, reject) => {
        new MailComposer(opcoesEnvio).compile().build((erro: Error | null, mensagem: Buffer) => {
          if (erro) reject(erro);
          else resolve(mensagem);
        });
      })
        .then(raw => copiarParaEnviados({ imapHost, imapPort, imapSecure, user, password, raw }))
        .then(ok => {
          if (!ok) console.error(`Cópia em Enviados não gravada para ${user} (mensagem já enviada via SMTP).`);
        })
        .catch(erro => console.error('Falha ao montar/gravar cópia em Enviados:', erro));
    }
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

interface CorpoConversao {
  /** .docx do ofício já com o corpo preenchido, em base64. */
  docxBase64?: string;
}

/** execFile com timeout — soffice trava em vez de sair se o filtro falhar. */
function execFileComTimeout(
  comando: string,
  args: string[],
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const processo = execFile(comando, args, { timeout: timeoutMs }, erro => {
      if (erro) reject(erro);
      else resolve();
    });
    processo.on('error', reject);
  });
}

/**
 * Converte o .docx do ofício (corpo gerado + cabeçalho do órgão) em PDF.
 *
 * Endpoint separado de /send-email de propósito: mantém o envio de e-mail
 * sem saber nada sobre LibreOffice, permite testar a conversão isolada, e dá
 * uma classe de erro própria (falha de conversão é diferente de falha de
 * SMTP).
 *
 * Cada chamada usa um perfil de usuário do LibreOffice isolado
 * (-env:UserInstallation): duas instâncias headless disputando o mesmo
 * perfil em requisições concorrentes travam com "Fatal Error" — dois órgãos
 * enviando ao mesmo tempo bastam para isso acontecer.
 */
app.post('/convert-docx-to-pdf', exigirSegredo, async (req: Request<{}, {}, CorpoConversao>, res: Response) => {
  const { docxBase64 } = req.body ?? {};

  if (!docxBase64) {
    res.status(400).json({ erro: 'Campo obrigatório: docxBase64.' });
    return;
  }

  const dir = path.join(os.tmpdir(), 'isenta-oficio', randomUUID());
  const perfil = path.join(os.tmpdir(), 'isenta-lo-profile', randomUUID());

  try {
    await fs.mkdir(dir, { recursive: true });

    const entrada = path.join(dir, 'oficio.docx');
    await fs.writeFile(entrada, Buffer.from(docxBase64, 'base64'));

    await execFileComTimeout(
      'soffice',
      [
        '--headless',
        '--norestore',
        `-env:UserInstallation=file://${perfil}`,
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        entrada,
      ],
      20_000
    );

    const pdf = await fs.readFile(path.join(dir, 'oficio.pdf'));

    res.status(200).json({ pdfBase64: pdf.toString('base64') });
  } catch (erro) {
    // Falha do LibreOffice (filtro, timeout) não é bug nosso — mesma lógica
    // de 502 usada em /send-email para erro de SMTP remoto.
    console.error('Erro ao converter docx para PDF:', erro);
    res.status(502).json({
      erro: 'Falha ao converter documento',
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(perfil, { recursive: true, force: true }).catch(() => {});
  }
});

interface CorpoLeitura {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  /** Quantas mensagens mais recentes trazer quando não há cursor. Padrão 10. */
  limite?: number;
  /** UID da última mensagem já processada. Se definido, busca só UID maior
   *  que este valor em vez das N mais recentes — leitura incremental. */
  uidInicial?: number;
  /** Bytes máximos a baixar do corpo de cada mensagem. Padrão 20000 — dá
   *  folga pra achar o protocolo mesmo com thread citada longa, sem baixar
   *  anexos pesados nem imagens embutidas em base64. */
  limiteBytesCorpo?: number;
}

interface ParteEncontrada {
  part: string;
  tipo: 'text/plain' | 'text/html';
}

/**
 * Caminha a bodyStructure em busca de uma parte textual, preferindo
 * text/plain — text/html só como plano B, com as tags removidas de forma
 * crua (não é um parser de verdade, só o bastante pra achar protocolo e
 * palavra-chave de aprovação/recusa).
 */
function encontrarParteTexto(struct: any): ParteEncontrada | null {
  if (!struct) return null;

  // Mensagem simples (não multipart): não tem childNodes. O seletor 'TEXT'
  // do IMAP substitui o número de parte nesse caso.
  if (!struct.childNodes) {
    if (struct.type === 'text/plain' || struct.type === 'text/html') {
      return { part: struct.part || 'TEXT', tipo: struct.type };
    }
    return null;
  }

  let candidatoHtml: ParteEncontrada | null = null;
  for (const filho of struct.childNodes) {
    const achado = encontrarParteTexto(filho);
    if (achado?.tipo === 'text/plain') return achado;
    if (achado?.tipo === 'text/html' && !candidatoHtml) candidatoHtml = achado;
  }
  return candidatoHtml;
}

async function streamParaString(stream: NodeJS.ReadableStream): Promise<string> {
  const pedacos: Buffer[] = [];
  for await (const pedaco of stream) {
    pedacos.push(Buffer.isBuffer(pedaco) ? pedaco : Buffer.from(pedaco));
  }
  return Buffer.concat(pedacos).toString('utf8');
}

app.post('/check-emails', exigirSegredo, async (req: Request<{}, {}, CorpoLeitura>, res: Response) => {
  const { host, port: portaImap, secure, user, password, limite, uidInicial, limiteBytesCorpo } =
    req.body ?? {};

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

  // Mesmo com o handler global (ver topo do arquivo), um listener direto no
  // client evita depender só da rede de segurança — erro de socket vira log,
  // não exceção não tratada.
  client.on('error', erro => console.error('Erro de conexão IMAP:', erro));

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');

    const total = mailbox.exists;
    const mensagens: Array<{
      uid: number;
      de: string;
      assunto: string;
      data: string | null;
      corpo: string | null;
    }> = [];
    let uidMaisAlto: number | null = null;

    // Leitura incremental (uidInicial definido): busca só UID maior que o
    // cursor, por UID em vez de posição sequencial — a posição muda quando
    // mensagens são apagadas, o UID não. Sem cursor: comportamento antigo,
    // as N mais recentes por posição sequencial.
    const usaCursor = typeof uidInicial === 'number';
    const intervalo = usaCursor
      ? `${uidInicial + 1}:*`
      : (() => {
          const quantos = Math.min(Number(limite) || 10, total);
          return `${Math.max(1, total - quantos + 1)}:${total}`;
        })();

    if (total > 0) {
      // client.fetch() devolve um gerador assíncrono, não um array — atribuir
      // direto a uma variável (como no rascunho anterior) serializava vazio.
      for await (const msg of client.fetch(
        intervalo,
        { envelope: true, uid: true, bodyStructure: true },
        usaCursor ? { uid: true } : undefined
      )) {
        // Defesa contra servidores IMAP que respondem de forma inconsistente
        // quando o range pedido (UID > cursor) não tem mensagem nenhuma —
        // alguns devolvem a última existente em vez de nada.
        if (usaCursor && msg.uid <= uidInicial!) continue;

        if (uidMaisAlto === null || msg.uid > uidMaisAlto) uidMaisAlto = msg.uid;

        let corpo: string | null = null;
        const parte = encontrarParteTexto(msg.bodyStructure);
        if (parte) {
          try {
            const baixado = await client.download(msg.uid, parte.part, {
              uid: true,
              maxBytes: limiteBytesCorpo ?? 20_000,
            });
            const bruto = await streamParaString(baixado.content);
            corpo = parte.tipo === 'text/html' ? bruto.replace(/<[^>]+>/g, ' ') : bruto;
          } catch {
            // parte pode não existir mais / erro de decodificação — segue sem corpo
          }
        }

        mensagens.push({
          uid: msg.uid,
          de: msg.envelope?.from?.[0]?.address ?? '',
          assunto: msg.envelope?.subject ?? '',
          data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          corpo,
        });
      }
    }

    await client.logout();
    // Mais recente primeiro — é o que importa ao procurar um código que
    // acabou de chegar (mantido pra não quebrar quem já consome esta rota
    // sem cursor).
    res.status(200).json({
      mensagens: mensagens.reverse(),
      // BigInt não serializa em JSON — Express lança exceção sem o toString().
      uidValidity: mailbox.uidValidity.toString(),
      uidMaisAlto,
    });
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
