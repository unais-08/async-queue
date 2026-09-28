import { WorkerMetrics } from './worker';

export function createWorkerMetrics(): WorkerMetrics {
  return {
    claimed: 0,
    completed: 0,
    failed: 0,
    retried: 0,
    recovered: 0,
  };
}