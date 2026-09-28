import { processOneJob, recoverJobs, WorkerMetrics } from './worker';
import { logger } from '../utils/logger';

export interface WorkerLifecycleConfig {
  pollMs: number;
  concurrency: number;
  shutdownTimeoutMs: number;
}

interface WorkerLifecycleDependencies {
  config: WorkerLifecycleConfig;
  metrics: WorkerMetrics;
}

export function createWorker({
  config,
  metrics,
}: WorkerLifecycleDependencies) {
  let isShuttingDown = false;
  const activeJobs = new Set<Promise<void>>();

  const sleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms));

  function trackJob(jobPromise: Promise<boolean>) {
    const tracked = jobPromise.then(
      () => undefined,
      () => undefined
    );

    activeJobs.add(tracked);
    tracked.then(() => activeJobs.delete(tracked));

    return jobPromise;
  }

  async function runWorkerSlot(slot: number) {
    while (!isShuttingDown) {
      try {
        const processed = await trackJob(processOneJob(metrics));

        if (!processed) {
          await sleep(config.pollMs);
        }
      } catch (error) {
        logger.error('Worker slot encountered an unexpected error', error, {
          slot,
        });

        await sleep(config.pollMs);
      }
    }
  }

  async function runRecoveryLoop() {
    while (!isShuttingDown) {
      try {
        await recoverJobs(metrics);
      } catch (error) {
        logger.error('Worker recovery loop failed', error);
      }

      await sleep(config.pollMs);
    }
  }

  function requestShutdown(signal: string) {
    if (isShuttingDown) return;

    logger.info('Worker shutdown requested', { signal });

    isShuttingDown = true;
  }

  async function waitForActiveJobs() {
    if (activeJobs.size === 0) {
      return true;
    }

    const jobs = Promise.all(activeJobs);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<boolean>(resolve => {
      timeoutHandle = setTimeout(
        () => resolve(false),
        config.shutdownTimeoutMs
      );
    });

    const completed = await Promise.race([
      jobs.then(() => true),
      timeout,
    ]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    return completed;
  }

  async function start() {
    logger.info('Worker started', {
      pollMs: config.pollMs,
      concurrency: config.concurrency,
    });

    const slots = Array.from(
      { length: config.concurrency },
      (_, index) => runWorkerSlot(index + 1)
    );

    await Promise.all([...slots, runRecoveryLoop()]);

    logger.info('Waiting for active jobs before shutdown', {
      activeJobs: activeJobs.size,
      timeoutMs: config.shutdownTimeoutMs,
    });

    if (!(await waitForActiveJobs())) {
      logger.error('Worker shutdown timeout reached', undefined, {
        activeJobs: activeJobs.size,
      });

      process.exit(1);
    }

    logger.info('Worker stopped', {
      claimed: metrics.claimed,
      completed: metrics.completed,
      failed: metrics.failed,
      retried: metrics.retried,
      recovered: metrics.recovered,
    });
  }

  return {
    start,
    requestShutdown,
  };
}
