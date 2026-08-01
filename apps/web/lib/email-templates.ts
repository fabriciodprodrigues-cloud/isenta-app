interface AlertEmailData {
  accountName: string;
  responsibleName: string;
  plate: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  vehicleLink: string;
}

export function generate_alert_email(data: AlertEmailData) {
  const daysText =
    data.daysUntilExpiry === 1
      ? 'amanhã'
      : `em ${data.daysUntilExpiry} dias`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Vencimento de Isenção</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0B1622; color: #fff; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .header p { margin: 8px 0 0 0; color: #B9C6D1; }
    .content { background: #f5f5f5; padding: 24px; border-radius: 0 0 8px 8px; }
    .alert-box { background: #fff3cd; border-left: 4px solid #FFB238; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .alert-box strong { color: #4A3311; }
    .vehicle-info { background: #fff; padding: 16px; margin: 20px 0; border-radius: 4px; border: 1px solid #e0e0e0; }
    .vehicle-info p { margin: 8px 0; }
    .label { color: #7C8FA6; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
    .value { color: #0B1622; font-weight: 500; }
    .cta { background: #21C58A; color: #0B1622; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px; font-weight: 600; }
    .footer { text-align: center; color: #7C8FA6; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; }
    .mono { font-family: 'Monaco', 'Menlo', monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Alerta de Vencimento</h1>
      <p>Isenção de Pedágio - Isenta</p>
    </div>

    <div class="content">
      <p>Olá <strong>${data.responsibleName}</strong>,</p>

      <p>A isenção de pedágio do veículo <strong class="mono">${data.plate}</strong> vence <strong>${daysText}</strong>.</p>

      <div class="alert-box">
        <strong>Ação necessária:</strong> Renove o cadastro na concessionária antes do vencimento para evitar multas e bloqueios.
      </div>

      <div class="vehicle-info">
        <div class="label">Órgão Público</div>
        <p class="value">${data.accountName}</p>

        <div class="label" style="margin-top: 12px;">Placa do Veículo</div>
        <p class="value mono">${data.plate}</p>

        <div class="label" style="margin-top: 12px;">Data de Vencimento</div>
        <p class="value">${data.expiresAt.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })}</p>
      </div>

      <p>
        <a href="${data.vehicleLink}" class="cta">
          Renovar Agora →
        </a>
      </p>

      <div class="footer">
        <p>Isenta — Gestão de Isenção de Pedágio</p>
        <p>Este é um e-mail automático. Não responda este endereço.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    subject: `⚠️ Alerta: Isenção de ${data.plate} vence ${daysText}`,
    html,
    text: `
Alerta de Vencimento de Isenção
==============================

Olá ${data.responsibleName},

A isenção de pedágio do veículo ${data.plate} vence ${daysText}.

Órgão: ${data.accountName}
Placa: ${data.plate}
Vencimento: ${data.expiresAt.toLocaleDateString('pt-BR')}

Renove o cadastro na concessionária antes do vencimento para evitar multas.

Acesse: ${data.vehicleLink}

---
Isenta — Gestão de Isenção de Pedágio
    `.trim(),
  };
}

export function generate_confirmation_email(data: {
  accountName: string;
  vehiclesCount: number;
  alertsSentAt: Date;
}) {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alertas Enviados</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0B1622; color: #fff; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { background: #f5f5f5; padding: 24px; border-radius: 0 0 8px 8px; }
    .success-box { background: #d4edda; border-left: 4px solid #21C58A; padding: 16px; margin: 20px 0; border-radius: 4px; color: #155724; }
    .footer { text-align: center; color: #7C8FA6; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Alertas Enviados</h1>
    </div>

    <div class="content">
      <div class="success-box">
        <strong>Sucesso!</strong> ${data.vehiclesCount} alerta(s) enviado(s) para ${data.accountName}.
      </div>

      <p>Os responsáveis foram notificados sobre vencimentos próximos.</p>

      <div class="footer">
        <p>Isenta — Gestão de Isenção de Pedágio</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject: '✓ Alertas Enviados com Sucesso', html };
}
