import { Job, JobFilters, JobPage } from '../../domain/job';
import { newJobId, newLeaseToken } from './ids';
import { query, withTransaction } from './client';
import {
  resolveFailedJobWithClient,
  upsertFailedJob,
} from './failed-job.repository';

const JOB_LEASE_SECONDS = 30;
const RETRY_BASE_DELAY_SECONDS = 2;
const RETRY_MAX_DELAY_SECONDS = 60;

export async function createJob(
  type: string,
  payload: unknown,
  maxAttempts: number
) {
  const result = await query<Job>(
    `INSERT INTO "Job" (id, type, payload, "maxAttempts")
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING *`,
    [newJobId(), type, JSON.stringify(payload), maxAttempts]
  );

  return result.rows[0];
}

export async function claimNextJob() {
  const leaseToken = newLeaseToken();

  const result = await query<Job>(
    `WITH next_job AS (
       SELECT id
       FROM "Job"
       WHERE status = 'PENDING'
         AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
       ORDER BY "createdAt" ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE "Job"
     SET status = 'PROCESSING',
         "startedAt" = NOW(),
         "leaseUntil" = NOW() + ($1 * INTERVAL '1 second'),
         "leaseToken" = $2,
         attempts = attempts + 1,
         "updatedAt" = NOW()
     FROM next_job
     WHERE "Job".id = next_job.id
     RETURNING "Job".*`,
    [JOB_LEASE_SECONDS, leaseToken]
  );

  return result.rows[0] ?? null;
}

export async function renewJobLease(id: string, leaseToken: string) {
  const result = await query<Job>(
    `UPDATE "Job"
     SET "leaseUntil" = NOW() + ($3 * INTERVAL '1 second'),
         "updatedAt" = NOW()
     WHERE id = $1
       AND status = 'PROCESSING'
       AND "leaseToken" = $2
       AND "leaseUntil" > NOW()
     RETURNING *`,
    [id, leaseToken, JOB_LEASE_SECONDS]
  );

  return result.rows[0] ?? null;
}

export async function recoverStaleJobs() {
  return withTransaction(async client => {
    const result = await client.query<Job>(
      `UPDATE "Job"
       SET status = CASE
             WHEN attempts < "maxAttempts" THEN 'PENDING'
             ELSE 'FAILED'
           END,
           "startedAt" = NULL,
           "leaseUntil" = NULL,
           "leaseToken" = NULL,
           "nextRunAt" = CASE
             WHEN attempts < "maxAttempts"
             THEN NOW() + LEAST($1 * POWER(2, attempts - 1), $2) * INTERVAL '1 second'
             ELSE NULL
           END,
           "failedAt" = CASE
             WHEN attempts < "maxAttempts" THEN NULL
             ELSE NOW()
           END,
           "updatedAt" = NOW()
       WHERE status = 'PROCESSING'
         AND "leaseUntil" IS NOT NULL
         AND "leaseUntil" < NOW()
       RETURNING *`,
      [RETRY_BASE_DELAY_SECONDS, RETRY_MAX_DELAY_SECONDS]
    );

    for (const job of result.rows) {
      if (job.status === 'FAILED') {
        await upsertFailedJob(client, job);
      }
    }

    return result.rows;
  });
}

export async function completeJob(id: string, leaseToken: string) {
  return withTransaction(async client => {
    const result = await client.query<Job>(
      `UPDATE "Job"
       SET status = 'COMPLETED',
           "completedAt" = NOW(),
           error = NULL,
           "leaseUntil" = NULL,
           "leaseToken" = NULL,
           "nextRunAt" = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
         AND status = 'PROCESSING'
         AND "leaseToken" = $2
       RETURNING *`,
      [id, leaseToken]
    );

    const job = result.rows[0];

    if (job) {
      await resolveFailedJobWithClient(client, id);
    }

    return job ?? null;
  });
}

export async function failOrRetryJob(
  id: string,
  leaseToken: string,
  error: string,
  retryable = true
) {
  return withTransaction(async client => {
    const result = await client.query<Job>(
      `UPDATE "Job"
       SET status = CASE
             WHEN $4 AND attempts < "maxAttempts" THEN 'PENDING'
             ELSE 'FAILED'
           END,
           error = $3,
           "nextRunAt" = CASE
             WHEN $4 AND attempts < "maxAttempts"
             THEN NOW() + LEAST($5 * POWER(2, attempts - 1), $6) * INTERVAL '1 second'
             ELSE NULL
           END,
           "failedAt" = CASE
             WHEN $4 AND attempts < "maxAttempts" THEN NULL
             ELSE NOW()
           END,
           "startedAt" = NULL,
           "leaseUntil" = NULL,
           "leaseToken" = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
         AND status = 'PROCESSING'
         AND "leaseToken" = $2
         AND "leaseUntil" > NOW()
       RETURNING *`,
      [
        id,
        leaseToken,
        error,
        retryable,
        RETRY_BASE_DELAY_SECONDS,
        RETRY_MAX_DELAY_SECONDS,
      ]
    );

    const job = result.rows[0];

    if (job?.status === 'FAILED') {
      await upsertFailedJob(client, job);
    }

    return job ?? null;
  });
}

export async function findJobById(id: string) {
  const result = await query<Job>(
    'SELECT * FROM "Job" WHERE id = $1',
    [id]
  );

  return result.rows[0] ?? null;
}

export async function listJobs(filters: JobFilters): Promise<JobPage> {
  const { status, page, limit } = filters;
  const offset = (page - 1) * limit;
  const where = status ? 'WHERE status = $1' : '';
  const values = status ? [status] : [];
  const dataValues = status ? [status, limit, offset] : [limit, offset];

  const [jobsResult, countResult] = await Promise.all([
    query<Job>(
      `SELECT * FROM "Job"
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT $${status ? 2 : 1}
       OFFSET $${status ? 3 : 2}`,
      dataValues
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "Job" ${where}`,
      values
    ),
  ]);

  return {
    jobs: jobsResult.rows,
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}

export async function retryFailedJob(id: string) {
  const result = await query<Job>(
    `UPDATE "Job"
     SET status = 'PENDING',
         attempts = 0,
         error = NULL,
         "failedAt" = NULL,
         "nextRunAt" = NULL,
         "updatedAt" = NOW()
     WHERE id = $1
       AND status = 'FAILED'
     RETURNING *`,
    [id]
  );

  return result.rows[0] ?? null;
}
