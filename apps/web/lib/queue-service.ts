import Bull from 'bull';
import Redis from 'redis';
import { processRegistration } from './registration-orchestrator';

// Configurar Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// Criar fila de processamento
export const registrationQueue = new Bull('registrations', {
  redis: redisConfig,
});

// Configurações de retry
const RETRY_CONFIG = {
  maxAttempts: 5,
  backoffDelays: [
    1000 * 60,        // 1 minuto
    1000 * 60 * 5,    // 5 minutos
    1000 * 60 * 30,   // 30 minutos
    1000 * 60 * 120,  // 2 horas
  ],
};

// Processar jobs da fila
registrationQueue.process(async (job) => {
  const { registrationId } = job.data;

  console.log(`[FILA] Processando job ${job.id}: ${registrationId}`);

  try {
    await processRegistration(registrationId);
    console.log(`[FILA] ✅ Job ${job.id} concluído`);
    return { success: true };
  } catch (error) {
    const attempt = job.attemptsMade + 1;
    const maxAttempts = RETRY_CONFIG.maxAttempts;

    console.error(`[FILA] ❌ Job ${job.id} falhou (tentativa ${attempt}/${maxAttempts}):`, error);

    if (attempt < maxAttempts) {
      // Calcular delay de retry exponencial
      const delayIndex = Math.min(attempt - 1, RETRY_CONFIG.backoffDelays.length - 1);
      const delay = RETRY_CONFIG.backoffDelays[delayIndex];

      console.log(`[FILA] ⏳ Agendando retry em ${delay / 1000} segundos`);
      throw new Error(`Retry ${attempt}/${maxAttempts}: ${error}`);
    } else {
      console.error(`[FILA] 🚨 Job ${job.id} falhou após ${maxAttempts} tentativas`);
      throw error;
    }
  }
});

// Event handlers
registrationQueue.on('completed', (job) => {
  console.log(`[FILA] 🎉 Job ${job.id} completado`);
});

registrationQueue.on('failed', (job, err) => {
  console.error(`[FILA] 💥 Job ${job.id} falhou permanentemente:`, err.message);
});

registrationQueue.on('error', (error) => {
  console.error('[FILA] Erro na fila:', error);
});

// Funções públicas
export async function enqueueRegistration(registrationId: string) {
  const job = await registrationQueue.add(
    { registrationId },
    {
      attempts: RETRY_CONFIG.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: RETRY_CONFIG.backoffDelays[0],
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  console.log(`[FILA] 📨 Registração ${registrationId} enfileirada (job ${job.id})`);
  return job;
}

export async function getQueueStats() {
  const counts = await registrationQueue.getCountsPerPriority();
  const waiting = await registrationQueue.getWaitingCount();
  const active = await registrationQueue.getActiveCount();
  const completed = await registrationQueue.getCompletedCount();
  const failed = await registrationQueue.getFailedCount();
  const delayed = await registrationQueue.getDelayedCount();

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    counts,
  };
}

export async function getFailedJobs() {
  const jobs = await registrationQueue.getFailed(0, -1);
  return jobs.map((job) => ({
    id: job.id,
    registrationId: job.data.registrationId,
    attempts: job.attemptsMade,
    maxAttempts: RETRY_CONFIG.maxAttempts,
    error: job.failedReason,
    failedAt: job.failedOn,
  }));
}

export async function retryFailedJob(jobId: string) {
  const job = await registrationQueue.getJob(jobId);
  if (job) {
    await job.retry();
    console.log(`[FILA] 🔄 Job ${jobId} enfileirado para retry`);
  }
}

export async function clearQueue() {
  await registrationQueue.clean(0, 'failed');
  await registrationQueue.clean(0, 'completed');
  console.log('[FILA] ✅ Fila limpa');
}
