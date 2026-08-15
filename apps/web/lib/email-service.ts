import nodemailer from 'nodemailer';
import { get } from '@vercel/blob';
import {
  montarOficio,
  assuntoDoOficio,
  type DadosDoOficio,
} from './oficio-isencao';
import type { CredencialSmtp } from './cofre';

export interface AnexoDocumento {
  fileName: string;
  /** Pathname do blob na store privada, nao uma url publica. */
  url: string;
}

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
 */
export async function enviarOficioDeIsencao({
  destino,
  dados,
  anexos,
  remetente,
}: {
  destino: string;
  dados: DadosDoOficio;
  anexos: AnexoDocumento[];
  remetente: CredencialSmtp | null;
}) {
  if (!remetente) {
    throw new RemetenteDoOrgaoAusenteError(dados.orgao.name);
  }

  const transporter = nodemailer.createTransport({
    host: remetente.host,
    port: remetente.port,
    secure: remetente.secure,
    auth: { user: remetente.user, pass: remetente.pass },
  });

  const { texto, html } = montarOficio(dados);
  const attachments = await baixarAnexos(anexos);

  const razao = dados.orgao.razaoSocial || dados.orgao.name;

  await transporter.sendMail({
    // O remetente é a própria caixa autenticada. Divergir daqui costuma ser
    // rejeitado pelo servidor ou marcado como falsificação.
    from: `"${razao}" <${remetente.user}>`,
    to: destino,
    replyTo: dados.orgao.responsibleEmail,
    subject: assuntoDoOficio(dados.orgao.name),
    text: texto,
    html,
    attachments,
  });

  return { anexosEnviados: attachments.length, remetenteUsado: remetente.user };
}

