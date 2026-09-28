import 'dotenv/config';
import { createQueueClient } from '@async-queue/client';

const queue = createQueueClient({
  queueUrl: process.env.QUEUE_URL ?? 'http://localhost:4000',
});

async function main() {
  const text = process.argv.slice(2).join(' ') || 'Hello World';
  const job = await queue.submit('generate_pdf', { text });
  console.info(`Submitted ${job.jobId} with status ${job.status}`);
}

main().catch(error => {
  console.error('Could not submit PDF job', error);
  process.exitCode = 1;
});
