import * as repository from '../infrastructure/database/failed-job.repository';

export const listFailedJobs = repository.listFailedJobs;
export const retryFailedJob = repository.retryFailedJob;
