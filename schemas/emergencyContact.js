import { z } from "zod";

export const SingleEmergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z
    .string()
    .regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  relationship: z.string().optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
});

export const EmergencyContactsArraySchema = z.object({
  emergencyContacts: z
    .array(SingleEmergencyContactSchema)
    .min(1, "At least one contact is required"),
});

export const updateContactSchema = SingleEmergencyContactSchema.partial().extend({
  contactId: z.string().min(1, "Contact ID is required"),
});

export const deleteContactSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
});
