import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { setOrderAutoCancelScheduler } from './scheduler';
import { cancelIfStillPlaced } from '../services/orderService';

const QUEUE_NAME = 'order-auto-cancel';

type CancelJob = { orderId: string };

function connection() {
  return { url: env.REDIS_URL, maxRetriesPerRequest: null as null };
}

export function registerAutoCancel(): Worker | null {
  if (!env.REDIS_URL) return null;

  const queue = new Queue<CancelJob>(QUEUE_NAME, { connection: connection() });
  const delay = env.AUTO_CANCEL_MINUTES * 60 * 1000;

  setOrderAutoCancelScheduler(async (orderId) => {
    await queue.add('cancel-if-placed', { orderId }, { delay, jobId: orderId, removeOnComplete: true });
  });

  return new Worker<CancelJob>(
    QUEUE_NAME,
    async (job) => {
      await cancelIfStillPlaced(job.data.orderId);
    },
    { connection: connection() },
  );
}
