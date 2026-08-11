import nodemailer from 'nodemailer';
import { get } from '@vercel/blob';
import {
  montarOficio,
  assuntoDoOficio,
  type DadosDoOficio,
} from './oficio-isencao';

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

/**
 * Envia o ofício de pedido de isenção para uma concessionária.
 *
 * Um ofício cobre toda a frota do órgão naquela concessionária. A resposta da
 * concessionária vai para o responsável do órgão, não para a plataforma — quem
 * tem legitimidade para requerer é o órgão, e é com ele que a tratativa segue.
 */
export async function enviarOficioDeIsencao({
  destino,
  dados,
  anexos,
}: {
  destino: string;
  dados: DadosDoOficio;
  anexos: AnexoDocumento[];
}) {
  const transporter = createEmailTransport();
  if (!transporter) throw new EmailNaoConfiguradoError();

  const { texto, html } = montarOficio(dados);
  const attachments = await baixarAnexos(anexos);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@plataformaisenta.com',
    to: destino,
    replyTo: dados.orgao.responsibleEmail,
    subject: assuntoDoOficio(dados.orgao.name),
    text: texto,
    html,
    attachments,
  });

  return { anexosEnviados: attachments.length };
}

