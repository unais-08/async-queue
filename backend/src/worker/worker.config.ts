const pollMs = Number(process.env.WORKER_POLL_MS ?? 1000);

const workerConcurrency = Math.max(
  1,
  Math.floor(Number(process.env.WORKER_CONCURRENCY ?? 1)) || 1
);

const shutdownTimeoutMs = Math.max(
  1_000,
  Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? 30_000) || 30_000
);

export const workerConfig = {
  pollMs,
  concurrency: workerConcurrency,
  shutdownTimeoutMs,
};