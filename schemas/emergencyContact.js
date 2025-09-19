import { z } from "zod";

export const SingleEmergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z
    .string()
    .regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  relationship: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
});

export const EmergencyContactsArraySchema = z.object({
  emergencyContacts: z
    .array(SingleEmergencyContactSchema)
    .min(1, "At least one contact is required"),
});

// userId: z.string().length(24),
