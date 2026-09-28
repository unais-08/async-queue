import { Request, Response } from 'express';
import * as jobs from '../../application/job.service';
import * as failedJobs from '../../application/failed-job.service';
import { createJobSchema } from '../validation/job.schema';
import { Job } from '../../domain/job';
import { logger } from "../../utils/logger";

type PublicJob = Omit<Job, 'leaseToken' | 'leaseUntil'>;

type JobIdParams = {
  id: string;
};

const toPublicJob = (job: Job): PublicJob => {
  const { leaseToken: _leaseToken, leaseUntil: _leaseUntil, ...publicJob } = job;
  return publicJob;
};

export async function createJob(req: Request, res: Response) {
  const parsed = createJobSchema.parse(req.body);
  const maxAttempts = parsed.maxAttempts ?? Number(process.env.MAX_ATTEMPTS ?? 3);
  const job = await jobs.createJob(parsed.type, parsed.payload, maxAttempts);

  return res.status(202).json({
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
  });
}

export async function listJobs(req: Request, res: Response) {
  const status =
    typeof req.query.status === 'string' ? req.query.status : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const result = await jobs.listJobs({ status, page, limit });

  return res.json({
    jobs: result.jobs.map(toPublicJob),
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
}

export async function getJob(req: Request<JobIdParams>, res: Response) {
  const job = await jobs.findJobById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.json(toPublicJob(job));
}

export async function retryJob(req: Request<JobIdParams>, res: Response) {
  const job = await failedJobs.retryFailedJob(req.params.id);

  if (job) {
    logger.info('Admin queued failed job for retry', {
      jobId: job.id,
    });

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Failed job queued for retry',
    });
  }

  const existing = await jobs.findJobById(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.status(409).json({
    error: 'Only open failed jobs can be manually retried',
  });
}
