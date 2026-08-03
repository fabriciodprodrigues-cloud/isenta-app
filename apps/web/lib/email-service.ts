import nodemailer from 'nodemailer';
import { prisma } from './prisma';

interface SendExemptionRequestEmailProps {
  registrationId: string;
  vehiclePlate: string;
  concessionaireEmail: string;
  concessionaireName: string;
  accountName: string;
  cnpj: string;
  crlvUrl?: string;
}

const createEmailTransport = () => {
  if (process.env.SMTP_HOST) {
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
  }
  return null;
};

export async function sendExemptionRequestEmail({
  registrationId,
  vehiclePlate,
  concessionaireEmail,
  concessionaireName,
  accountName,
  cnpj,
  crlvUrl,
}: SendExemptionRequestEmailProps) {
  try {
    console.log(`📧 Enviando solicitação de isenção para ${concessionaireName} (${concessionaireEmail})`);

    const emailBody = `
Prezados Senhores,

Solicitamos a análise e aprovação de isenção de pedágio para o seguinte veículo:

DADOS DO ÓRGÃO PÚBLICO:
- Nome: ${accountName}
- CNPJ: ${cnpj}

DADOS DO VEÍCULO:
- Placa: ${vehiclePlate}

Protocolo de Referência: ${registrationId}

Aguardamos retorno com a confirmação de recebimento e análise da solicitação.

Atenciosamente,
Sistema Isenta
Plataforma de Gestão de Isenções de Pedágio
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2d5f2e; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 20px; }
    .section { margin: 20px 0; }
    .section h2 { font-size: 14px; font-weight: bold; color: #2d5f2e; margin: 10px 0 5px 0; }
    .section p { margin: 5px 0; }
    .protocol { background-color: #e8f5e9; padding: 10px; border-left: 4px solid #2d5f2e; margin: 20px 0; }
    .protocol strong { color: #2d5f2e; }
    .footer { background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 Solicitação de Isenção de Pedágio</h1>
    </div>
    <div class="content">
      <p>Prezados Senhores,</p>

      <p>Solicitamos a análise e aprovação de isenção de pedágio para o seguinte veículo:</p>

      <div class="section">
        <h2>📋 DADOS DO ÓRGÃO PÚBLICO</h2>
        <p><strong>Nome:</strong> ${accountName}</p>
        <p><strong>CNPJ:</strong> ${cnpj}</p>
      </div>

      <div class="section">
        <h2>🚙 DADOS DO VEÍCULO</h2>
        <p><strong>Placa:</strong> ${vehiclePlate}</p>
      </div>

      <div class="protocol">
        <p><strong>Protocolo de Referência:</strong> ${registrationId}</p>
      </div>

      <p>Aguardamos retorno com a confirmação de recebimento e análise da solicitação.</p>

      <p><strong>Atenciosamente,</strong><br/>
      Sistema Isenta<br/>
      Plataforma de Gestão de Isenções de Pedágio</p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Favor não responder diretamente. Utilize o protocolo acima para referências futuras.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const transporter = createEmailTransport();
    if (!transporter) {
      console.warn('⚠️  Email transporter não configurado - modo desenvolvimento');
      await prisma.concesssionaireRegistration.update({
        where: { id: registrationId },
        data: { status: 'enviado', sentAt: new Date() },
      });
      return true;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@isenta.local',
      to: concessionaireEmail,
      subject: `Solicitação de Isenção - Veículo ${vehiclePlate}`,
      text: emailBody,
      html: `<pre>${emailBody}</pre>`,
    });

    await prisma.concesssionaireRegistration.update({
      where: { id: registrationId },
      data: { status: 'enviado', sentAt: new Date() },
    });

    console.log(`✅ E-mail enviado para ${concessionaireEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail:`, error);
    throw error;
  }
}
