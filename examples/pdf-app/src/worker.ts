import 'dotenv/config';
import { registerHandler, startWorker } from '@async-queue/client';
import { generatePdfHandler } from './generate-pdf.handler';

registerHandler('generate_pdf', generatePdfHandler);

const worker = startWorker({
  queueUrl: process.env.QUEUE_URL ?? 'http://localhost:4000',
  workerKey: process.env.WORKER_API_KEY,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
});

async function shutdown(signal: string) {
  console.info(`[pdf-app] received ${signal}; stopping worker`);
  await worker.stop();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
