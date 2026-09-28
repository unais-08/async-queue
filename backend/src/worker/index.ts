import 'dotenv/config';

import { initializeDatabase } from '../infrastructure/database/schema';
import { pool } from '../infrastructure/database/client';
import { logger } from '../utils/logger';

import { createWorker } from './worker.lifecycle';
import { workerConfig } from './worker.config';
import { createWorkerMetrics } from './worker.metrics';

async function main() {
  await initializeDatabase();

  const metrics = createWorkerMetrics();

  const worker = createWorker({
    config: workerConfig,
    metrics,
  });

  await worker.start();

  await pool.end();
}

main().catch(async error => {
  logger.error('Worker startup failed', error);

  await pool.end();

  process.exit(1);
});
