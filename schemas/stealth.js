import { z } from "zod";

export const updateStealthSchema = z.object({
  stealthMode: z.boolean().optional(),
  stealthType: z.string().min(1).optional(),
  dashboardPass: z.string().optional(),
  sosPass: z.string().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);
