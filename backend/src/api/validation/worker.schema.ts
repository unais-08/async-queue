import { z } from 'zod';

export const leaseSchema = z.object({
  leaseToken: z.string().min(1),
});

export const claimSchema = z.object({
  types: z.array(z.string().min(1)).min(1),
});

export const failJobSchema = leaseSchema.extend({
  error: z.string().min(1),
  retryable: z.boolean().default(true),
});
