import 'dotenv/config';

import {
  initializeDatabase,
  pool,
} from './database';
import { logger } from '../utils/logger';

async function resetJobs() {
  try {
    await initializeDatabase();

    await pool.query('TRUNCATE TABLE "Job"');

    logger.info('All jobs deleted successfully');
  } catch (error) {
    logger.error('Failed to delete jobs', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

resetJobs();
