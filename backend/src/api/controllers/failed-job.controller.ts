import { Request, Response } from 'express';
import * as failedJobs from '../../application/failed-job.service';

export async function listFailedJobs(req: Request, res: Response) {
  const status =
    req.query.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const result = await failedJobs.listFailedJobs(status, page, limit);

  return res.json({
    jobs: result.jobs.map(job => ({
      jobId: job.jobId,
      type: job.type,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      status: job.status,
      failedAt: job.failedAt,
      lastRetriedAt: job.lastRetriedAt,
      resolvedAt: job.resolvedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })),
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
}
