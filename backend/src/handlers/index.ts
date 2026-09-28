import { logger } from '../utils/logger';

export type JobHandler = (payload: any) => Promise<void>;

const sleep = (ms: number) =>
  new Promise(r => setTimeout(r, ms));

export const handlers: Record<string, JobHandler> = {
  SLOW_TASK: async (payload) => {
    const duration = Number(payload?.durationMs ?? 60000);

    logger.info('Starting SLOW_TASK handler', {
      durationMs: duration,
    });

    await sleep(duration);

    logger.info('SLOW_TASK handler completed');
  },

  SEND_EMAIL: async (payload) => {
    logger.info('Starting SEND_EMAIL handler', {
      hasRecipient: Boolean(payload?.to),
    });

    await sleep(1500);

    logger.info('SEND_EMAIL handler completed');
  },

  GENERATE_REPORT: async (payload) => {
    logger.info('Starting GENERATE_REPORT handler', {
      hasReportId: Boolean(payload?.reportId),
    });

    await sleep(4000);

    logger.info('GENERATE_REPORT handler completed');
  },

  FAIL_TASK: async () => {
    throw new Error('Intentional failure for retry demonstration');
  },
};
