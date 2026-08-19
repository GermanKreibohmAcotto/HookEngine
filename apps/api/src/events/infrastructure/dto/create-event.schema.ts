import { z } from 'zod';

export const createEventSchema = z.object({
  eventType: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
});
export type CreateEventDto = z.infer<typeof createEventSchema>;
