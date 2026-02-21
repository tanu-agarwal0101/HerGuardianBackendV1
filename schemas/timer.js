import { z } from "zod";

export const startTimerSchema = z.object({
  duration: z.number().int().positive("Duration must be a positive integer (minutes)"),
  shareLocation: z.boolean().optional().default(true),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const cancelTimerSchema = z.object({
  status: z.enum(["cancelled", "completed"], {
    required_error: "Status is required",
    invalid_type_error: "Status must be 'cancelled' or 'completed'",
  }),
});
