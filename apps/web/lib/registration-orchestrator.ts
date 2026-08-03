import { prisma } from './prisma';
import { getConcessionaireConfig } from './concessionaire-config';
import { sendExemptionRequestEmail } from './email-service';
import { sendViaPortal } from './rpa-service';

export async function processRegistration(registrationId: string) {
  try {
    const registration = await prisma.concesssionaireRegistration.findUnique({
      where: { id: registrationId },
      include: {
        vehicle: { include: { account: true } },
        concessionaire: true,
      },
    });

    if (!registration) {
      throw new Error(`Solicitação ${registrationId} não encontrada`);
    }

    if (registration.status !== 'rascunho') {
      console.log(`⚠️  Solicitação ${registrationId} não está em rascunho`);
      return;
    }

    const config = getConcessionaireConfig(registration.concessionaireId);
    if (!config) {
      console.error(`❌ Configuração não encontrada para concessionária ${registration.concessionaireId}`);
      return;
    }

    console.log(`🔄 Processando solicitação ${registrationId} via ${config.channel}`);

    if (config.channel === 'email' && config.email) {
      await sendExemptionRequestEmail({
        registrationId,
        vehiclePlate: registration.vehicle.plate,
        concessionaireEmail: config.email,
        concessionaireName: config.name,
        accountName: registration.vehicle.account.name,
        cnpj: registration.vehicle.account.cnpj,
        crlvUrl: registration.vehicle.crlvUrl || undefined,
      });
      console.log(`✅ Solicitação ${registrationId} enviada via e-mail`);
    } else if (config.channel === 'portal' && config.portalUrl) {
      await sendViaPortal({
        registrationId,
        vehiclePlate: registration.vehicle.plate,
        concessionaireEmail: config.email || '',
        concessionaireName: config.name,
        accountName: registration.vehicle.account.name,
        cnpj: registration.vehicle.account.cnpj,
        portalUrl: config.portalUrl,
      });
      console.log(`✅ Solicitação ${registrationId} enviada via portal RPA`);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar solicitação ${registrationId}:`, error);
    throw error;
  }
}

export async function processPendingRegistrations() {
  const pending = await prisma.concesssionaireRegistration.findMany({
    where: { status: 'rascunho' },
  });

  console.log(`📦 Processando ${pending.length} solicitações pendentes`);

  for (const reg of pending) {
    try {
      await processRegistration(reg.id);
    } catch (error) {
      console.error(`Erro na solicitação ${reg.id}:`, error);
    }
  }
}
