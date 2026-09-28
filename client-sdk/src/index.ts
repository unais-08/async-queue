export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type QueueJob<TPayload = unknown> = {
  id: string;
  type: string;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void> | void;

export type QueueClientOptions = {
  queueUrl: string;
  workerKey?: string;
};

export type WorkerOptions = QueueClientOptions & {
  concurrency?: number;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
};

type ClaimedJob = {
  job: QueueJob & { leaseUntil: string | null };
  leaseToken: string;
};

const handlers = new Map<string, JobHandler<any>>();

export function registerHandler<TPayload = unknown>(type: string, handler: JobHandler<TPayload>) {
  if (!type.trim()) throw new Error('Job type cannot be empty');
  if (handlers.has(type)) throw new Error(`A handler is already registered for ${type}`);
  handlers.set(type, handler);
}

export class QueueClient {
  private readonly baseUrl: string;

  constructor(private readonly options: QueueClientOptions) {
    this.baseUrl = options.queueUrl.replace(/\/+$/, '');
  }

  async submit<TPayload>(type: string, payload: TPayload, maxAttempts?: number) {
    return this.request<{ jobId: string; status: JobStatus; createdAt: string }>(
      '/jobs',
      { method: 'POST', body: JSON.stringify({ type, payload, maxAttempts }) },
      false,
    );
  }

  async getJob<TPayload = unknown>(id: string) {
    return this.request<QueueJob<TPayload>>(`/jobs/${encodeURIComponent(id)}`, {}, false);
  }

  private async request<T>(path: string, init: RequestInit = {}, worker = true): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set('content-type', 'application/json');
    if (worker && this.options.workerKey) headers.set('x-worker-key', this.options.workerKey);

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
      throw new QueueApiError(response.status, body.error ?? body.message ?? response.statusText);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  claim() {
    const types = [...handlers.keys()];
    if (types.length === 0) throw new Error('Register at least one handler before starting a worker');
    return this.request<ClaimedJob | undefined>('/worker/jobs/claim', {
      method: 'POST', body: JSON.stringify({ types }),
    });
  }

  heartbeat(id: string, leaseToken: string) {
    return this.request(`/worker/jobs/${encodeURIComponent(id)}/heartbeat`, {
      method: 'POST', body: JSON.stringify({ leaseToken }),
    });
  }

  complete(id: string, leaseToken: string) {
    return this.request(`/worker/jobs/${encodeURIComponent(id)}/complete`, {
      method: 'POST', body: JSON.stringify({ leaseToken }),
    });
  }

  fail(id: string, leaseToken: string, error: string, retryable: boolean) {
    return this.request(`/worker/jobs/${encodeURIComponent(id)}/fail`, {
      method: 'POST', body: JSON.stringify({ leaseToken, error, retryable }),
    });
  }
}

export function createQueueClient(options: QueueClientOptions) {
  return new QueueClient(options);
}

export class NonRetryableJobError extends Error {}

class QueueApiError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function executeClaimedJob(client: QueueClient, claimed: ClaimedJob, heartbeatIntervalMs: number) {
  const { job, leaseToken } = claimed;
  const handler = handlers.get(job.type);
  let leaseLost = false;
  let heartbeatInFlight = false;
  let heartbeatRequest: Promise<void> = Promise.resolve();
  const heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight || leaseLost) return;
    heartbeatInFlight = true;
    heartbeatRequest = client.heartbeat(job.id, leaseToken).then(() => undefined).catch(error => {
      if (error instanceof QueueApiError && error.statusCode === 409) leaseLost = true;
      else console.error(`[async-queue] heartbeat failed for ${job.id}`, error);
    }).finally(() => { heartbeatInFlight = false; });
  }, heartbeatIntervalMs);

  try {
    if (!handler) throw new NonRetryableJobError(`No handler registered for job type: ${job.type}`);
    await handler(job.payload);
    if (leaseLost) throw new Error(`Lease lost while processing job ${job.id}`);
    await client.complete(job.id, leaseToken);
    console.info(`[async-queue] completed ${job.type} job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (leaseLost) {
      console.warn(`[async-queue] not reporting ${job.id}; its lease was lost`);
      return;
    }
    try {
      const retryable = !(error instanceof NonRetryableJobError);
      const outcome = await client.fail(job.id, leaseToken, message, retryable) as { status?: JobStatus };
      console.error(`[async-queue] job ${job.id} failed (${outcome.status ?? 'unknown'})`, message);
    } catch (reportError) {
      console.error(`[async-queue] could not report failure for ${job.id}`, reportError);
    }
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeatRequest;
  }
}

export function startWorker(options: WorkerOptions) {
  if (!options.workerKey) throw new Error('workerKey is required to start a worker');
  if (handlers.size === 0) throw new Error('Register at least one handler before starting a worker');
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  const pollIntervalMs = Math.max(100, options.pollIntervalMs ?? 1000);
  const heartbeatIntervalMs = Math.max(1000, options.heartbeatIntervalMs ?? 10_000);
  const client = new QueueClient(options);
  let stopping = false;

  const run = async () => {
    while (!stopping) {
      try {
        const claimed = await client.claim();
        if (claimed) {
          await executeClaimedJob(client, claimed, heartbeatIntervalMs);
          continue;
        }
      } catch (error) {
        console.error('[async-queue] worker poll failed', error);
      }
      await sleep(pollIntervalMs);
    }
  };

  const runners = Array.from({ length: concurrency }, () => run());
  console.info(`[async-queue] worker started with concurrency ${concurrency}`);

  return {
    stop: async () => {
      stopping = true;
      await Promise.all(runners);
      console.info('[async-queue] worker stopped');
    },
  };
}
