export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  leaseUntil: Date | null;
  leaseToken: string | null;
  nextRunAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  updatedAt: Date;
}

export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void>;

export type JobFilters = {
  status?: string;
  page: number;
  limit: number;
};

export type JobPage = {
  jobs: Job[];
  total: number;
};
