import { z } from "zod";

export const sosTriggerSchema = z.object({
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  triggeredAt: z.string().datetime({ offset: true }).optional(),
  timerId: z.string().optional(),
});
