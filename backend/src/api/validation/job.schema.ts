import { z } from 'zod';

export const createJobSchema = z.object({
  type: z.string().min(1).max(100),
  payload: z.record(z.string(), z.any()).default({}),
  maxAttempts: z.number().int().min(1).max(10).optional()
});