import { z } from "zod";

export const sosTriggerSchema = z.object({
  latitude: z.number({ required_error: "Latitude is required" }).min(-90).max(90),
  longitude: z.number({ required_error: "Longitude is required" }).min(-180).max(180),
  triggeredAt: z.string().datetime({ offset: true }).optional(),
  timerId: z.string().optional(),
});
