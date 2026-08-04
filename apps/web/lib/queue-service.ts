import Bull from 'bull';
import { processRegistration } from './registration-orchestrator';

// Configurar Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

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

// A fila é criada sob demanda, nunca no import. O Bull abre a conexão com o
// Redis assim que instanciado, e o Next importa estes módulos durante o build
// ("Collecting page data"), o que quebraria a compilação em qualquer ambiente
// sem Redis acessível — incluindo o Vercel.
let queue: Bull.Queue | null = null;

function getQueue(): Bull.Queue {
  if (queue) return queue;

  queue = new Bull('registrations', { redis: redisConfig });
  registerProcessor(queue);
  registerEventHandlers(queue);

  return queue;
}

function registerProcessor(q: Bull.Queue) {
  q.process(async (job) => {
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
}

function registerEventHandlers(q: Bull.Queue) {
  q.on('completed', (job) => {
    console.log(`[FILA] 🎉 Job ${job.id} completado`);
  });

  q.on('failed', (job, err) => {
    console.error(`[FILA] 💥 Job ${job.id} falhou permanentemente:`, err.message);
  });

  q.on('error', (error) => {
    console.error('[FILA] Erro na fila:', error);
  });
}

// Funções públicas
export async function enqueueRegistration(registrationId: string) {
  const job = await getQueue().add(
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
  const q = getQueue();

  const waiting = await q.getWaitingCount();
  const active = await q.getActiveCount();
  const completed = await q.getCompletedCount();
  const failed = await q.getFailedCount();
  const delayed = await q.getDelayedCount();

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

export async function getFailedJobs() {
  const jobs = await getQueue().getFailed(0, -1);
  return jobs.map((job) => ({
    id: job.id,
    registrationId: job.data.registrationId,
    attempts: job.attemptsMade,
    maxAttempts: RETRY_CONFIG.maxAttempts,
    error: job.failedReason,
    // Em bull v4 o timestamp de término (inclusive falha) é finishedOn;
    // failedOn só existe no BullMQ.
    failedAt: job.finishedOn,
  }));
}

export async function retryFailedJob(jobId: string) {
  const job = await getQueue().getJob(jobId);
  if (job) {
    await job.retry();
    console.log(`[FILA] 🔄 Job ${jobId} enfileirado para retry`);
  }
}

export async function clearQueue() {
  const q = getQueue();

  await q.clean(0, 'failed');
  await q.clean(0, 'completed');
  console.log('[FILA] ✅ Fila limpa');
}
