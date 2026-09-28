import { randomUUID } from 'node:crypto';

export const newJobId = () => randomUUID();
export const newLeaseToken = () => randomUUID();