import { PoolClient } from 'pg';
import { FailedJob, FailedJobPage } from '../../domain/failed-job';
import { Job } from '../../domain/job';
import { query, withTransaction } from './client';

export async function upsertFailedJob(
  client: PoolClient,
  job: Job
) {
  await client.query(
    `INSERT INTO "FailedJob"
      ("jobId", type, payload, error, attempts, "maxAttempts", status, "failedAt", "updatedAt")
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'OPEN', $7, NOW())
     ON CONFLICT ("jobId") DO UPDATE
     SET type = EXCLUDED.type,
         payload = EXCLUDED.payload,
         error = EXCLUDED.error,
         attempts = EXCLUDED.attempts,
         "maxAttempts" = EXCLUDED."maxAttempts",
         status = 'OPEN',
         "failedAt" = EXCLUDED."failedAt",
         "resolvedAt" = NULL,
         "updatedAt" = NOW()`,
    [
      job.id,
      job.type,
      JSON.stringify(job.payload),
      job.error ?? 'Job failed',
      job.attempts,
      job.maxAttempts,
      job.failedAt ?? new Date(),
    ]
  );
}

export async function resolveFailedJobWithClient(
  client: PoolClient,
  jobId: string
) {
  await client.query(
    `UPDATE "FailedJob"
     SET status = 'RESOLVED',
         "resolvedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "jobId" = $1
       AND status = 'OPEN'`,
    [jobId]
  );
}

export async function resolveFailedJob(jobId: string) {
  await query(
    `UPDATE "FailedJob"
     SET status = 'RESOLVED',
         "resolvedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "jobId" = $1
       AND status = 'OPEN'`,
    [jobId]
  );
}

export async function listFailedJobs(
  status: 'OPEN' | 'RESOLVED' = 'OPEN',
  page = 1,
  limit = 20
): Promise<FailedJobPage> {
  const offset = (page - 1) * limit;

  const [jobsResult, countResult] = await Promise.all([
    query<FailedJob>(
      `SELECT *
       FROM "FailedJob"
       WHERE status = $1
       ORDER BY "failedAt" DESC
       LIMIT $2
       OFFSET $3`,
      [status, limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM "FailedJob"
       WHERE status = $1`,
      [status]
    ),
  ]);

  return {
    jobs: jobsResult.rows,
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}

export async function retryFailedJob(jobId: string) {
  return withTransaction(async client => {
    const failedResult = await client.query<FailedJob>(
      `SELECT *
       FROM "FailedJob"
       WHERE "jobId" = $1
       FOR UPDATE`,
      [jobId]
    );

    const failedJob = failedResult.rows[0];

    if (!failedJob || failedJob.status !== 'OPEN') {
      return null;
    }

    const jobResult = await client.query<Job>(
      `SELECT *
       FROM "Job"
       WHERE id = $1
       FOR UPDATE`,
      [jobId]
    );

    const job = jobResult.rows[0];

    if (!job || job.status !== 'FAILED') {
      return null;
    }

    const updatedJobResult = await client.query<Job>(
      `UPDATE "Job"
       SET status = 'QUEUED',
           attempts = 0,
           error = NULL,
           "failedAt" = NULL,
           "nextRunAt" = NULL,
           "startedAt" = NULL,
           "leaseUntil" = NULL,
           "leaseToken" = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [jobId]
    );

    await client.query(
      `UPDATE "FailedJob"
       SET "lastRetriedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE "jobId" = $1`,
      [jobId]
    );

    return updatedJobResult.rows[0] ?? null;
  });
}
