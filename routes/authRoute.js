import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  loginUser,
  logoutUser,
  registerUser,
  onboardUser,
  refreshTokenHandler,
} from "../controllers/authController.js";
import {
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerificationEmail,
} from "../controllers/verificationController.js";
import { validateSchema } from "../utils/validators.js";
import { 
  registerSchema, 
  loginSchema, 
  onboardSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "../schemas/auth.js";
import { authRateLimiter } from "../utils/rateLimiter.js";

const router = Router();
router.post("/register", authRateLimiter, validateSchema(registerSchema), registerUser);
router.post("/login", authRateLimiter, validateSchema(loginSchema), loginUser);
router.post("/logout", logoutUser);
router.patch(
  "/onboard",
  authMiddleware,
  validateSchema(onboardSchema),
  onboardUser
);

router.post("/refresh-token", refreshTokenHandler);

router.post("/verify-email", authRateLimiter, validateSchema(verifyEmailSchema), verifyEmail);
router.post("/forgot-password", authRateLimiter, validateSchema(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authRateLimiter, validateSchema(resetPasswordSchema), resetPassword);
router.post("/resend-verification", authRateLimiter, validateSchema(forgotPasswordSchema), resendVerificationEmail);

export default router;
