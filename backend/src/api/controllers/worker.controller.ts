import { Request, Response } from 'express';
import * as jobs from '../../application/job.service';
import { claimSchema, failJobSchema, leaseSchema } from '../validation/worker.schema';

type JobIdParams = { id: string };

export async function claimJob(req: Request, res: Response) {
  const { types } = claimSchema.parse(req.body);
  // Polling is also the recovery trigger for jobs abandoned by a worker.
  await jobs.recoverStaleJobs();
  const job = await jobs.claimNextJob(types);
  if (!job) return res.status(204).end();

  const { leaseToken, leaseUntil, ...publicFields } = job;
  return res.json({ job: publicFields, leaseToken, leaseUntil });
}

export async function heartbeatJob(req: Request<JobIdParams>, res: Response) {
  const { leaseToken } = leaseSchema.parse(req.body);
  const job = await jobs.renewJobLease(req.params.id, leaseToken);
  if (!job) return res.status(409).json({ error: 'Job lease is no longer valid' });
  return res.json({ leaseUntil: job.leaseUntil });
}

export async function completeJob(req: Request<JobIdParams>, res: Response) {
  const { leaseToken } = leaseSchema.parse(req.body);
  const job = await jobs.completeJob(req.params.id, leaseToken);
  if (!job) return res.status(409).json({ error: 'Job lease is no longer valid' });
  return res.json({ id: job.id, status: job.status });
}

export async function failJob(req: Request<JobIdParams>, res: Response) {
  const { leaseToken, error, retryable } = failJobSchema.parse(req.body);
  const job = await jobs.failOrRetryJob(req.params.id, leaseToken, error, retryable);
  if (!job) return res.status(409).json({ error: 'Job lease is no longer valid' });
  return res.json({ id: job.id, status: job.status, nextRunAt: job.nextRunAt });
}
