import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import routes from './api/routes';
import { errorHandler } from './middlewares/error.middleware';
import { initializeDatabase } from './infrastructure/database/schema';
import { pool } from './infrastructure/database/client';
import { logger } from './utils/logger';

const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);

initializeDatabase()
  .then(() => {
    const server = app.listen(port, () =>
      logger.info('API server started', { port })
    );

    const shutdown = async (signal: string) => {
      logger.info('Shutting down API server', { signal });

      server.close(async () => {
        await pool.end();
        logger.info('Database pool closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch(async error => {
    logger.error('Database initialization failed', error);
    await pool.end();
    process.exit(1);
  });
