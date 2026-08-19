import { z } from 'zod';

export const listDlqQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListDlqQuery = z.infer<typeof listDlqQuerySchema>;

export const bulkRetrySchema = z.object({
  deliveryIds: z.array(z.string().min(1)).min(1).max(500),
});
export type BulkRetryDto = z.infer<typeof bulkRetrySchema>;
