import { Queue, Worker, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from './lib/prisma';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Filas
const emailQueue = new Queue('email', { connection: redis });
const alertQueue = new Queue('alerts', { connection: redis });

// Schedulers (para jobs recorrentes)
const alertScheduler = new QueueScheduler('alerts', { connection: redis });

console.log('🚀 Worker iniciado');
console.log('📧 Fila de e-mail pronta');
console.log('🔔 Fila de alertas pronta');

// Worker de alertas (executa a cada hora para verificar vencimentos)
const alertWorker = new Worker(
  'alerts',
  async (job) => {
    console.log(`⏰ Processando alertas (job ${job.id})`);

    // Verificar veículos que vencerão em 60, 30 e 7 dias
    const daysThreshold = [60, 30, 7];

    for (const days of daysThreshold) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);

      const vehicles = await prisma.vehicle.findMany({
        where: {
          expiresAt: {
            gte: new Date(targetDate.getTime() - 86400000), // 1 dia antes
            lte: new Date(targetDate.getTime() + 86400000), // 1 dia depois
          },
          lastAlertSentAt: null, // Ainda não enviou alerta para este veículo
        },
        include: {
          account: true,
        },
      });

      for (const vehicle of vehicles) {
        console.log(
          `  📌 Alerta para ${vehicle.plate} (vence em ${days} dias)`,
        );

        // Enviar e-mail
        await emailQueue.add(
          'send-alert',
          {
            vehicleId: vehicle.id,
            accountId: vehicle.accountId,
            email: vehicle.account.responsibleEmail,
            daysUntilExpiry: days,
          },
          { removeOnComplete: true },
        );

        // Marcar que o alerta foi enviado
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { lastAlertSentAt: new Date() },
        });
      }
    }

    return { processed: true };
  },
  { connection: redis },
);

// Worker de e-mail
const emailWorker = new Worker(
  'email',
  async (job) => {
    const { email, daysUntilExpiry, vehicleId } = job.data;

    console.log(`📨 Enviando e-mail para ${email} (${daysUntilExpiry} dias)`);

    // Implementação real de envio virá aqui (Resend)
    // Por enquanto, apenas log

    return { sent: true, email, vehicleId };
  },
  { connection: redis },
);

// Agendar job de alertas a cada hora
alertQueue.add('check-expiring', {}, { repeat: { pattern: '0 * * * *' } });

console.log('✅ Todos os workers iniciados e prontos');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando worker...');
  await alertWorker.close();
  await emailWorker.close();
  await alertScheduler.close();
  await redis.quit();
  process.exit(0);
});
