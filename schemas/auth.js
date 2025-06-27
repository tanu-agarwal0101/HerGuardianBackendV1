import {z} from "zod"
import { validatePassword } from "../utils/validators.js"

// const passwordSchema = z.string().min(8)

export const registerSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email")
,
    
  password: z.string({ required_error: "Password is required" }).min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
    email: z.string().min(1, "add email").email("Invalid email address"),
    password: z.string().min(1, "password is required")
})

export const onboardSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
});