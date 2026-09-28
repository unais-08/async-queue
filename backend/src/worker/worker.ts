import { Job } from '../domain/job';
import {
  claimNextJob,
  completeJob,
  failOrRetryJob,
  recoverStaleJobs,
  renewJobLease,
} from '../application/job.service';
import { handlers } from '../handlers';
import { logger } from '../utils/logger';

const HEARTBEAT_MS = 10_000;

export class NonRetryableJobError extends Error {}

export type WorkerMetrics = {
  claimed: number;
  completed: number;
  failed: number;
  retried: number;
  recovered: number;
};

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

async function startHeartbeat(job: Job) {
  let stopped = false;
  let leaseLost = false;

  const heartbeat = (async () => {
    while (!stopped && !leaseLost) {
      await sleep(HEARTBEAT_MS);

      if (stopped || leaseLost) {
        break;
      }

      try {
        const renewed = await renewJobLease(
          job.id,
          job.leaseToken!
        );

        if (!renewed) {
          leaseLost = true;

          logger.warn('Job lease lost', {
            jobId: job.id,
          });

          break;
        }

        logger.debug('Job lease renewed', {
          jobId: job.id,
          leaseUntil: renewed.leaseUntil?.toISOString(),
        });
      } catch (error) {
        logger.error('Job lease renewal failed', error, {
          jobId: job.id,
        });
      }
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      await heartbeat;
    },

    hasLostLease: () => leaseLost,
  };
}

export async function executeJob(job: Job) {
  const handler = handlers[job.type];

  if (!handler) {
    throw new NonRetryableJobError(
      `Unknown job type: ${job.type}`
    );
  }

  const heartbeat = await startHeartbeat(job);

  try {
    logger.info('Executing job', {
      jobId: job.id,
      type: job.type,
    });

    await handler(job.payload);

    if (heartbeat.hasLostLease()) {
      throw new Error(
        `Lost lease before completing job ${job.id}`
      );
    }

    const completed = await completeJob(
      job.id,
      job.leaseToken!
    );

    if (!completed) {
      throw new Error(
        `Lost lease before completing job ${job.id}`
      );
    }
  } finally {
    await heartbeat.stop();
  }
}

async function handleJobError(
  job: Job,
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const retryable =
    !(error instanceof NonRetryableJobError);

  const updated = await failOrRetryJob(
    job.id,
    job.leaseToken!,
    message,
    retryable
  );

  if (!updated) {
    logger.warn('Could not update failed job because lease ownership was lost', {
      jobId: job.id,
    });

    return;
  }

  if (updated.status === 'PENDING') {
    logger.info('Job retry scheduled', {
      jobId: job.id,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      nextRunAt: updated.nextRunAt?.toISOString(),
    });

    return;
  }

  logger.info('Job marked as failed', {
    jobId: job.id,
    status: updated.status,
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  if (updated.status === 'FAILED') {
    logger.warn('Job moved to dead-letter storage', {
      jobId: job.id,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
    });
  }
}

export async function processOneJob(
  metrics: WorkerMetrics
): Promise<boolean> {
  const job = await claimNextJob();

  if (!job) {
    return false;
  }

  metrics.claimed++;

  logger.info('Job claimed', {
    jobId: job.id,
    type: job.type,
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  try {
    await executeJob(job);

    metrics.completed++;

    logger.info('Job completed', {
      jobId: job.id,
      type: job.type,
    });
  } catch (error) {
    metrics.failed++;

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    logger.error('Job execution failed', error, {
      jobId: job.id,
      type: job.type,
      message,
    });

    await handleJobError(job, error);

    if (job.attempts < job.maxAttempts) {
      metrics.retried++;
    }
  }

  return true;
}

export async function recoverJobs(
  metrics: WorkerMetrics
) {
  const recoveredJobs = await recoverStaleJobs();

  metrics.recovered += recoveredJobs.length;

  for (const job of recoveredJobs) {
    logger.info('Stale job recovered', {
      jobId: job.id,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
  }
}
