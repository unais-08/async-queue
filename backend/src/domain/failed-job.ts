export type FailedJobStatus = 'OPEN' | 'RESOLVED';

export interface FailedJob {
  jobId: string;
  type: string;
  payload: unknown;
  error: string;
  attempts: number;
  maxAttempts: number;
  status: FailedJobStatus;
  failedAt: Date;
  lastRetriedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FailedJobPage = {
  jobs: FailedJob[];
  total: number;
};
