import nodemailer from 'nodemailer';
import { prisma } from './prisma';

interface AnexoDocumento {
  fileName: string;
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
      const resposta = await fetch(anexo.url);
      if (!resposta.ok) {
        console.error(`Anexo indisponível (${anexo.fileName}): HTTP ${resposta.status}`);
        continue;
      }
      baixados.push({
        filename: anexo.fileName,
        content: Buffer.from(await resposta.arrayBuffer()),
      });
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

function linhaSeTiver(rotulo: string, valor: string | number | null | undefined) {
  return valor ? `<p><strong>${rotulo}:</strong> ${valor}</p>` : '';
}

function textoSeTiver(rotulo: string, valor: string | number | null | undefined) {
  return valor ? `\n- ${rotulo}: ${valor}` : '';
}

export async function sendExemptionRequestEmail({
  registrationId,
  vehiclePlate,
  concessionaireEmail,
  concessionaireName,
  accountName,
  cnpj,
  renavam,
  marca,
  modelo,
  cor,
  anoFabricacao,
  anoModelo,
  anexos = [],
}: SendExemptionRequestEmailProps) {
  const transporter = createEmailTransport();

  // Sem transporte configurado o envio precisa FALHAR. A versao anterior
  // marcava a solicitacao como "enviado" e retornava true, de modo que o
  // sistema afirmava ter notificado a concessionaria sem nada ter saido.
  if (!transporter) {
    throw new EmailNaoConfiguradoError();
  }

  const emailBody = `
Prezados Senhores,

Solicitamos a análise e aprovação de isenção de pedágio para o seguinte veículo:

DADOS DO ÓRGÃO PÚBLICO:
- Nome: ${accountName}
- CNPJ: ${cnpj}

DADOS DO VEÍCULO:
- Placa: ${vehiclePlate}${textoSeTiver('RENAVAM', renavam)}${textoSeTiver('Marca', marca)}${textoSeTiver('Modelo', modelo)}${textoSeTiver('Cor', cor)}${textoSeTiver('Ano de fabricação', anoFabricacao)}${textoSeTiver('Ano do modelo', anoModelo)}

Protocolo de Referência: ${registrationId}
${anexos.length > 0 ? `\nDocumentação anexada: ${anexos.map(a => a.fileName).join(', ')}\n` : ''}
Aguardamos retorno com a confirmação de recebimento e análise da solicitação.

Atenciosamente,
${accountName}
via Isenta — Plataforma de Gestão de Isenções de Pedágio
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2d5f2e; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background-color: #f9f9f9; padding: 20px; }
    .section { margin: 20px 0; }
    .section h2 { font-size: 14px; font-weight: bold; color: #2d5f2e; margin: 10px 0 5px 0; }
    .section p { margin: 5px 0; }
    .protocol { background-color: #e8f5e9; padding: 10px; border-left: 4px solid #2d5f2e; margin: 20px 0; }
    .footer { background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Solicitação de Isenção de Pedágio</h1>
    </div>
    <div class="content">
      <p>Prezados Senhores,</p>

      <p>Solicitamos a análise e aprovação de isenção de pedágio para o seguinte veículo:</p>

      <div class="section">
        <h2>DADOS DO ÓRGÃO PÚBLICO</h2>
        <p><strong>Nome:</strong> ${accountName}</p>
        <p><strong>CNPJ:</strong> ${cnpj}</p>
      </div>

      <div class="section">
        <h2>DADOS DO VEÍCULO</h2>
        <p><strong>Placa:</strong> ${vehiclePlate}</p>
        ${linhaSeTiver('RENAVAM', renavam)}
        ${linhaSeTiver('Marca', marca)}
        ${linhaSeTiver('Modelo', modelo)}
        ${linhaSeTiver('Cor', cor)}
        ${linhaSeTiver('Ano de fabricação', anoFabricacao)}
        ${linhaSeTiver('Ano do modelo', anoModelo)}
      </div>

      <div class="protocol">
        <p><strong>Protocolo de Referência:</strong> ${registrationId}</p>
      </div>

      ${
        anexos.length > 0
          ? `<div class="section">
        <h2>DOCUMENTAÇÃO ANEXADA</h2>
        ${anexos.map(a => `<p>${a.fileName}</p>`).join('\n        ')}
      </div>`
          : ''
      }

      <p>Aguardamos retorno com a confirmação de recebimento e análise da solicitação.</p>

      <p><strong>Atenciosamente,</strong><br/>
      ${accountName}<br/>
      via Isenta — Plataforma de Gestão de Isenções de Pedágio</p>
    </div>
    <div class="footer">
      <p>Utilize o protocolo acima para referências futuras sobre esta solicitação.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const attachments = await baixarAnexos(anexos);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@plataformaisenta.com',
    to: concessionaireEmail,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    subject: `Solicitação de Isenção de Pedágio - Veículo ${vehiclePlate} - ${accountName}`,
    text: emailBody,
    // Antes ia `<pre>${emailBody}</pre>`: o htmlBody era montado e descartado.
    html: htmlBody,
    attachments,
  });

  // Só depois do envio bem-sucedido. Se sendMail lancar, a solicitacao
  // permanece em rascunho e pode ser reenviada.
  await prisma.concesssionaireRegistration.update({
    where: { id: registrationId },
    data: { status: 'enviado', sentAt: new Date() },
  });

  console.log(`E-mail de isenção enviado para ${concessionaireEmail} (${concessionaireName})`);
  return true;
}
