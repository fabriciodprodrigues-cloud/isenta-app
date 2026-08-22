import nodemailer from 'nodemailer';
import { get } from '@vercel/blob';
import {
  montarOficio,
  montarMensagemCurta,
  assuntoDoOficio,
  type DadosDoOficio,
} from './oficio-isencao';
import type { CredencialSmtp } from './cofre';

export type AnexoDocumento =
  | {
      fileName: string;
      /** Pathname do blob na store privada, nao uma url publica. */
      url: string;
    }
  | {
      fileName: string;
      /** Conteúdo já pronto em memória (ex: o PDF do ofício, recém-gerado). */
      content: Buffer;
    };

interface SendExemptionRequestEmailProps {
  registrationId: string;
  vehiclePlate: string;
  concessionaireEmail: string;
  concessionaireName: string;
  accountName: string;
  cnpj: string;
  renavam?: string | null;
  marca?: string | null;
  modelo?: string | null;
  cor?: string | null;
  anoFabricacao?: number | null;
  anoModelo?: number | null;
  anexos?: AnexoDocumento[];
}

/**
 * Baixa os documentos do Blob para anexar ao e-mail.
 *
 * Anexar o arquivo em vez de mandar link importa: a concessionaria precisa do
 * CRLV em maos para analisar, e um link exigiria que ela tivesse acesso ao
 * nosso sistema.
 */
async function baixarAnexos(anexos: AnexoDocumento[]) {
  const baixados = [];

  for (const anexo of anexos) {
    // Já vem pronto em memória (ex: o PDF do ofício) — nada a baixar.
    if ('content' in anexo) {
      baixados.push({ filename: anexo.fileName, content: anexo.content });
      continue;
    }

    try {
      // A store e privada: um fetch direto na url retorna 401. So o SDK
      // autentica a leitura.
      const resultado = await get(anexo.url, { access: 'private' });

      if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
        console.error(`Anexo indisponível no Blob: ${anexo.fileName}`);
        continue;
      }

      const buffer = Buffer.from(
        await new Response(resultado.stream).arrayBuffer()
      );

      baixados.push({ filename: anexo.fileName, content: buffer });
    } catch (erro) {
      console.error(`Falha ao baixar anexo ${anexo.fileName}:`, erro);
    }
  }

  return baixados;
}

export class EmailNaoConfiguradoError extends Error {
  constructor() {
    super(
      'Envio de e-mail não configurado: defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD.'
    );
    this.name = 'EmailNaoConfiguradoError';
  }
}

const createEmailTransport = () => {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  });
};

export function emailEstaConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Envio generico. Lanca EmailNaoConfiguradoError se o SMTP nao estiver
 * definido, para que quem chama nunca registre um envio que nao aconteceu.
 */
export async function enviarEmail({
  para,
  assunto,
  texto,
  html,
}: {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}) {
  const transporter = createEmailTransport();
  if (!transporter) throw new EmailNaoConfiguradoError();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@plataformaisenta.com',
    to: para,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    subject: assunto,
    text: texto,
    html: html ?? undefined,
  });
}

export class RemetenteDoOrgaoAusenteError extends Error {
  constructor(orgao: string) {
    super(
      `${orgao} não tem credencial da caixa institucional configurada. ` +
        'Nenhuma solicitação sai em nome da Isenta.'
    );
    this.name = 'RemetenteDoOrgaoAusenteError';
  }
}

export class RelayDeEmailNaoConfiguradoError extends Error {
  constructor() {
    super(
      'Relay de e-mail não configurado: defina EMAIL_RELAY_URL e ' +
        'EMAIL_RELAY_SECRET.'
    );
    this.name = 'RelayDeEmailNaoConfiguradoError';
  }
}

export class RelayDeEmailFalhouError extends Error {
  constructor(detalhe: string) {
    super(`Falha ao enviar pelo relay de e-mail: ${detalhe}`);
    this.name = 'RelayDeEmailFalhouError';
  }
}

export class ConversaoDocxFalhouError extends Error {
  constructor(detalhe: string) {
    super(`Falha ao converter o ofício em PDF: ${detalhe}`);
    this.name = 'ConversaoDocxFalhouError';
  }
}

/**
 * Converte o .docx do ofício (corpo gerado + cabeçalho do órgão) em PDF,
 * usando o LibreOffice headless que roda no mesmo VPS do relay de e-mail.
 *
 * Quem chama decide o que fazer se isto falhar (registration-orchestrator
 * cai de volta para o HTML completo em vez de bloquear o envio) — por isso
 * este erro nunca é tratado como fatal aqui, só propagado.
 */
export async function converterDocxParaPdf(docxBuffer: Buffer): Promise<Buffer> {
  const relayUrl = process.env.EMAIL_RELAY_URL;
  const relaySecret = process.env.EMAIL_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    throw new RelayDeEmailNaoConfiguradoError();
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${relayUrl}/convert-docx-to-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': relaySecret,
      },
      body: JSON.stringify({ docxBase64: docxBuffer.toString('base64') }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (erro) {
    throw new ConversaoDocxFalhouError(
      erro instanceof Error ? erro.message : String(erro)
    );
  }

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new ConversaoDocxFalhouError(
      corpo?.detalhe || corpo?.erro || `HTTP ${resposta.status}`
    );
  }

  const { pdfBase64 } = await resposta.json();
  return Buffer.from(pdfBase64, 'base64');
}

/**
 * Envia o ofício de pedido de isenção para uma concessionária.
 *
 * O envio usa o SMTP da caixa institucional do órgão, e não o da Isenta. Além
 * de atender à regra de que nada sai em nome da plataforma, isso resolve
 * autenticação de domínio sem nenhuma mudança de DNS: a mensagem parte da
 * infraestrutura do próprio órgão e por isso passa pelo SPF e DKIM dele.
 *
 * Sem credencial do órgão o envio falha — não há caminho alternativo, de
 * propósito.
 *
 * O envio em si não fala com o SMTP direto daqui: passa por um relay num VPS
 * com IP fixo (ver HANDOFF.md, seção 4). Caixas como a da UOL Host exigem
 * autorizar o IP de origem, e a Vercel não oferece IP de saída fixo em
 * funções normais. A credencial é decifrada aqui e vai pronta, uma vez, numa
 * chamada HTTPS autenticada — o relay não guarda nada.
 */
export async function enviarOficioDeIsencao({
  destino,
  dados,
  anexos,
  remetente,
  usarMensagemCurta = false,
}: {
  destino: string;
  dados: DadosDoOficio;
  anexos: AnexoDocumento[];
  remetente: CredencialSmtp | null;
  /**
   * true quando o ofício completo já vai anexado em PDF (modelo próprio do
   * órgão) — o corpo do e-mail vira só uma mensagem de capa em vez do HTML
   * completo, que seria redundante com o PDF.
   */
  usarMensagemCurta?: boolean;
}) {
  if (!remetente) {
    throw new RemetenteDoOrgaoAusenteError(dados.orgao.name);
  }

  const relayUrl = process.env.EMAIL_RELAY_URL;
  const relaySecret = process.env.EMAIL_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    throw new RelayDeEmailNaoConfiguradoError();
  }

  const { texto, html } = usarMensagemCurta ? montarMensagemCurta(dados) : montarOficio(dados);
  const attachments = await baixarAnexos(anexos);
  const razao = dados.orgao.razaoSocial || dados.orgao.name;

  let resposta: Response;
  try {
    resposta = await fetch(`${relayUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': relaySecret,
      },
      body: JSON.stringify({
        host: remetente.host,
        port: remetente.port,
        secure: remetente.secure,
        user: remetente.user,
        password: remetente.pass,
        // O remetente é a própria caixa autenticada. Divergir daqui costuma
        // ser rejeitado pelo servidor ou marcado como falsificação.
        from: `"${razao}" <${remetente.user}>`,
        to: destino,
        replyTo: dados.orgao.responsibleEmail,
        subject: assuntoDoOficio(dados.orgao.name),
        text: texto,
        html,
        attachments: attachments.map(a => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        })),
      }),
      // O relay já tem seu próprio timeout de SMTP; este é só para não
      // deixar a função da Vercel pendurada se o VPS ficar inacessível.
      //
      // Já tentei reduzir para 30s para abrir espaço para converterDocxParaPdf
      // na mesma requisição de 60s (/api/registrations/send) — na prática o
      // envio real para a caixa da Câmara de Chapadão do Sul precisou de mais
      // que 30s e abortou. A conversão em si é rápida (~4s observado em
      // teste real, bem abaixo do teto de 20s dela), então sobra folga de
      // verdade para manter os 45s originais aqui.
      signal: AbortSignal.timeout(45_000),
    });
  } catch (erro) {
    throw new RelayDeEmailFalhouError(
      erro instanceof Error ? erro.message : String(erro)
    );
  }

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new RelayDeEmailFalhouError(
      corpo?.detalhe || corpo?.erro || `HTTP ${resposta.status}`
    );
  }

  return { anexosEnviados: attachments.length, remetenteUsado: remetente.user };
}

