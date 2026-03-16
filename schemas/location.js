import { z } from "zod";

export const logLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timerId: z.string().optional(),
  event: z.enum(["started", "expired", "cancelled", "snapshot"]).optional().default("snapshot"),
});
