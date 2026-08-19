import { z } from 'zod';

export const createSubscriberSchema = z.object({
  name: z.string().min(1).max(200),
  targetUrl: z.string().min(1).max(2048),
  eventTypes: z.array(z.string().min(1)).min(1),
  timeoutMs: z.number().int().positive().max(60_000).optional(),
  maxRetries: z.number().int().min(0).max(20).optional(),
  rateLimitPerSec: z.number().int().positive().max(1000).optional(),
});
export type CreateSubscriberDto = z.infer<typeof createSubscriberSchema>;

export const updateSubscriberSchema = createSubscriberSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateSubscriberDto = z.infer<typeof updateSubscriberSchema>;
