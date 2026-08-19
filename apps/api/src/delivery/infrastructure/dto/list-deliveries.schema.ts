import { z } from 'zod';

export const listDeliveriesQuerySchema = z.object({
  status: z.enum(['pending', 'delivering', 'succeeded', 'failed', 'dead']).optional(),
  subscriberId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
