import { prisma } from './prisma';
import { generate_alert_email } from './email-templates';
import { days_until_expiry } from './utils';
import { enviarEmail, EmailNaoConfiguradoError } from './email-service';

/** Dias antes do vencimento em que o responsável é avisado. */
export const LIMIARES_ALERTA = [60, 30, 7];

export interface ResumoAlertas {
  enviados: Array<{ plate: string; para: string; diasRestantes: number }>;
  falhas: Array<{ plate: string; motivo: string }>;
}

/**
 * Envia os alertas de vencimento devidos hoje.
 *
 * O registro em Alert só é criado após o e-mail sair de fato — se o envio
 * falhar, nada é gravado e a próxima execução tenta de novo. A versão anterior
 * gravava sentAt sem enviar nada, fazendo o sistema afirmar que o cliente
 * havia sido avisado.
 *
 * Lança EmailNaoConfiguradoError se não houver SMTP: sem transporte não há o
 * que tentar, e seguir o laço só produziria uma falha por veículo.
 */
export async function dispararAlertas(accountId?: string): Promise<ResumoAlertas> {
  const veiculos = await prisma.vehicle.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      expiresAt: { not: null },
      status: 'aprovado',
    },
    include: { account: true, alerts: true },
  });

  const resumo: ResumoAlertas = { enviados: [], falhas: [] };
  const hoje = new Date().toDateString();

  for (const veiculo of veiculos) {
    if (!veiculo.expiresAt) continue;

    const diasRestantes = days_until_expiry(veiculo.expiresAt);
    if (diasRestantes <= 0) continue;

    for (const limiar of LIMIARES_ALERTA) {
      if (diasRestantes !== limiar) continue;

      const jaEnviadoHoje = veiculo.alerts.some(
        a =>
          a.daysUntilExpiry === limiar &&
          a.sentAt &&
          new Date(a.sentAt).toDateString() === hoje
      );
      if (jaEnviadoHoje) continue;

      const destinatario = veiculo.account.responsibleEmail;
      if (!destinatario) {
        resumo.falhas.push({
          plate: veiculo.plate,
          motivo: `${veiculo.account.name} não tem e-mail de responsável cadastrado`,
        });
        continue;
      }

      const email = generate_alert_email({
        accountName: veiculo.account.name,
        responsibleName: veiculo.account.responsibleName,
        plate: veiculo.plate,
        expiresAt: veiculo.expiresAt,
        daysUntilExpiry: diasRestantes,
        vehicleLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/vehicles/${veiculo.id}`,
      });

      try {
        await enviarEmail({
          para: destinatario,
          assunto: email.subject,
          texto: email.text,
          html: email.html,
        });

        await prisma.alert.create({
          data: {
            accountId: veiculo.accountId,
            vehicleId: veiculo.id,
            type: 'expiring_soon',
            daysUntilExpiry: diasRestantes,
            sentAt: new Date(),
          },
        });

        resumo.enviados.push({
          plate: veiculo.plate,
          para: destinatario,
          diasRestantes,
        });
      } catch (erro) {
        if (erro instanceof EmailNaoConfiguradoError) throw erro;

        const motivo = erro instanceof Error ? erro.message : String(erro);
        resumo.falhas.push({ plate: veiculo.plate, motivo });
        console.error(`Falha ao alertar sobre ${veiculo.plate}:`, erro);
      }
    }
  }

  return resumo;
}
