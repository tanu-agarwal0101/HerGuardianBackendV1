import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z.string().min(1, "add email").email("Invalid email address"),
  password: z.string().min(1, "password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export const onboardSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phoneNumber: z
    .string()
    .regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters"),
});
