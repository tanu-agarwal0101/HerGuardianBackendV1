import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { sendVerificationMail, sendPasswordResetMail } from "../utils/emailService.js";
import { generateTokens, baseCookieOptions, ACCESS_EXP_MS, LONG_REFRESH_MS } from "./authController.js";

const generateToken = async (userId, type) => {
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      type,
      expiresAt,
    },
  });

  return token;
};

// 1. Verify Email Endpoint
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(statusCode.BadRequest400).json({ message: "Email and OTP are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const targetUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!targetUser) {
    return res.status(statusCode.NotFound404).json({ message: "User not found" });
  }

  const verificationToken = await prisma.verificationToken.findFirst({
    where: { 
      userId: targetUser.id,
      token: otp,
      type: "EMAIL_VERIFICATION"
    },
  });

  if (!verificationToken) {
    return res.status(statusCode.BadRequest400).json({ message: "Invalid verification code" });
  }

  if (new Date() > verificationToken.expiresAt) {
    return res.status(statusCode.BadRequest400).json({ message: "Verification code has expired" });
  }

  // Update user
  const user = await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { isEmailVerified: true },
  });

  // Delete token
  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  // Auto-login the user so they can jump straight to onboarding
  let accessToken, refreshToken, refreshWindowMs;
  try {
    const toks = await generateTokens(user, false, req.headers["user-agent"], req.ip || req.connection?.remoteAddress);
    accessToken = toks.accessToken;
    refreshToken = toks.refreshToken;
    refreshWindowMs = toks.refreshWindowMs;
  } catch (e) {
    if (e?.code === "P2010" || /Server selection timeout/i.test(String(e?.meta?.message || e?.message))) {
      return res.status(503).json({ message: "Database unreachable. Please try again shortly." });
    }
    throw e;
  }

  res
    .cookie("accessToken", accessToken, { ...baseCookieOptions, maxAge: ACCESS_EXP_MS })
    .cookie("refreshToken", refreshToken, { ...baseCookieOptions, maxAge: refreshWindowMs })
    .cookie("rememberMe", "false", { ...baseCookieOptions, httpOnly: false, maxAge: refreshWindowMs })
    .cookie("isAuthenticated", "true", { ...baseCookieOptions, httpOnly: false, maxAge: refreshWindowMs });

  return res.status(statusCode.Ok200).json({ 
    message: "Email verified successfully",
    user: {
      email: user.email,
      firstName: user.firstName,
      stealthMode: user.stealthMode,
      stealthType: user.stealthType,
    },
    expiresIn: ACCESS_EXP_MS / 1000,
  });
});

// 2. Forgot Password Endpoint
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(statusCode.BadRequest400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // For security, don't reveal if user exists or not
  if (!user) {
    return res.status(statusCode.Ok200).json({ message: "If an account with that email exists, a password reset link has been sent." });
  }

  // Generate token and send email
  const token = await generateToken(user.id, "PASSWORD_RESET");
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  await sendPasswordResetMail({ to: user.email, userName: user.firstName, resetUrl });

  return res.status(statusCode.Ok200).json({ message: "If an account with that email exists, a password reset link has been sent." });
});

// 3. Reset Password Endpoint
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(statusCode.BadRequest400).json({ message: "Token and new password are required" });
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.type !== "PASSWORD_RESET") {
    return res.status(statusCode.BadRequest400).json({ message: "Invalid token" });
  }

  if (new Date() > verificationToken.expiresAt) {
    return res.status(statusCode.BadRequest400).json({ message: "Token has expired" });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user
  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { password: hashedPassword },
  });

  // Delete token
  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  // Optionally: Delete all active sessions/refresh tokens for security
  await prisma.refreshToken.updateMany({
    where: { userId: verificationToken.userId, revoked: false },
    data: { revoked: true, revokedAt: new Date() }
  });

  return res.status(statusCode.Ok200).json({ message: "Password reset successfully" });
});

// 4. Resend Verification Link (Optional but helpful)
export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(statusCode.BadRequest400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
      return res.status(statusCode.NotFound404).json({ message: "User not found" });
  }

  if (user.isEmailVerified) {
      return res.status(statusCode.BadRequest400).json({ message: "Email is already verified" });
  }

  const otp = await generateToken(user.id, "EMAIL_VERIFICATION");
  
  await sendVerificationMail({ to: user.email, userName: user.firstName, otp });

  return res.status(statusCode.Ok200).json({ message: "Verification email resent." });
});
