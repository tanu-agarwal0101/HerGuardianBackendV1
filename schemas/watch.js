import { z } from "zod";

export const watchDataSchema = z.object({
  heartRate: z.number({ required_error: "Heart rate is required" }).positive(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }, { required_error: "Location is required" }),
  fallDetected: z.boolean().optional().default(false),
  triggeredAt: z.string().optional(),
  userId: z.string().optional(),
});
