import { z } from 'zod';

export const metricsQuerySchema = z.object({
  // Cap at one week — this is a live dashboard query, not a reporting warehouse.
  windowMinutes: z.coerce.number().int().positive().max(10_080).default(60),
});
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
