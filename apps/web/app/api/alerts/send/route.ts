import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generate_alert_email } from '@/lib/email-templates';
import { days_until_expiry } from '@/lib/utils';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const ALERT_THRESHOLDS = [60, 30, 7];

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { accountId } = await request.json();

    // Buscar veículos que precisam de alerta
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        expiresAt: { not: null },
        status: 'aprovado',
      },
      include: {
        account: true,
        alerts: true,
      },
    });

    const alertsSent: any[] = [];

    for (const vehicle of vehicles) {
      if (!vehicle.expiresAt) continue;

      const daysLeft = days_until_expiry(vehicle.expiresAt);

      // Verificar se deve enviar alerta
      for (const threshold of ALERT_THRESHOLDS) {
        const alreadySent = vehicle.alerts.some(
          (a) =>
            a.daysUntilExpiry === threshold &&
            a.sentAt &&
            new Date(a.sentAt).toDateString() === new Date().toDateString(),
        );

        if (daysLeft === threshold && !alreadySent && daysLeft > 0) {
          // Simular envio (em produção, usar Resend)
          console.log(
            `📧 Enviando alerta para ${vehicle.account.responsibleEmail}`,
          );

          const emailData = {
            accountName: vehicle.account.name,
            responsibleName: vehicle.account.responsibleName,
            plate: vehicle.plate,
            expiresAt: vehicle.expiresAt,
            daysUntilExpiry: daysLeft,
            vehicleLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/vehicles/${vehicle.id}`,
          };

          const email = generate_alert_email(emailData);

          // Criar registro de alerta
          const alert = await prisma.alert.create({
            data: {
              accountId: vehicle.accountId,
              vehicleId: vehicle.id,
              type: daysLeft <= 0 ? 'expired' : 'expiring_soon',
              daysUntilExpiry: daysLeft,
              sentAt: new Date(),
            },
          });

          alertsSent.push({
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            email: vehicle.account.responsibleEmail,
            subject: email.subject,
            alertId: alert.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      alertsSent: alertsSent.length,
      details: alertsSent,
      message: `${alertsSent.length} alerta(s) enviado(s)`,
    });
  } catch (error) {
    console.error('Erro ao enviar alertas:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar alertas' },
      { status: 500 },
    );
  }
}
