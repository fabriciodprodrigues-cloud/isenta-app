// Serviço de envio de e-mail
// Em produção, usar Resend ou SendGrid

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function send_email(options: EmailOptions): Promise<{
  id: string;
  success: boolean;
  error?: string;
}> {
  // Simulação de envio (em produção, integrar com Resend)
  console.log(`📧 Envio simulado para ${options.to}`);
  console.log(`   Assunto: ${options.subject}`);

  // Em produção:
  // const { data, error } = await resend.emails.send({
  //   from: 'alertas@isenta.com.br',
  //   to: options.to,
  //   subject: options.subject,
  //   html: options.html,
  // });

  return {
    id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    success: true,
  };
}

export async function send_bulk_emails(
  emails: EmailOptions[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await send_email(email);
      sent++;
    } catch (error) {
      console.error(`Erro ao enviar para ${email.to}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
