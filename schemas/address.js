import { z } from "zod";

export const createAddressSchema = z.object({
  type: z.string().min(1, "Address type is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  radiusMeters: z.number().int().min(0).optional(),
});

export const updateAddressSchema = z.object({
  addressId: z.string().min(1, "Address ID is required"),
  type: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  radiusMeters: z.number().int().min(0).optional(),
});

export const deleteAddressSchema = z.object({
  addressId: z.string().min(1, "Address ID is required"),
});