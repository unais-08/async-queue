import { JobFilters } from '../domain/job';
import * as repository from '../infrastructure/database/job.repository';

export const createJob = repository.createJob;
export const claimNextJob = repository.claimNextJob;
export const renewJobLease = repository.renewJobLease;
export const completeJob = repository.completeJob;
export const failOrRetryJob = repository.failOrRetryJob;
export const recoverStaleJobs = repository.recoverStaleJobs;
export const findJobById = repository.findJobById;
export const listJobs = (filters: JobFilters) => repository.listJobs(filters);
