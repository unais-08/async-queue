import { query, withTransaction } from './client';

export async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS "Job" (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 3,
      error TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "startedAt" TIMESTAMPTZ,
      "leaseUntil" TIMESTAMPTZ,
      "leaseToken" TEXT,
      "nextRunAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "failedAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS "FailedJob" (
      "jobId" TEXT PRIMARY KEY REFERENCES "Job"(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      error TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      "maxAttempts" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'RESOLVED')),
      "failedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastRetriedAt" TIMESTAMPTZ,
      "resolvedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS "Job_status_createdAt_idx"
    ON "Job" (status, "createdAt")
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS "Job_status_leaseUntil_idx"
    ON "Job" (status, "leaseUntil")
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS "FailedJob_status_failedAt_idx"
    ON "FailedJob" (status, "failedAt")
  `);
}
