import * as jobs from './application/job.service';

export const enqueue = jobs.createJob;
export const claimNextJob = jobs.claimNextJob;
export const renewJobLease = jobs.renewJobLease;
export const recoverStaleJobs = jobs.recoverStaleJobs;
export const completeJob = jobs.completeJob;
export const failOrRetryJob = jobs.failOrRetryJob;