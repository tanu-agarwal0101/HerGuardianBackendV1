import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { sendVerificationMail, sendPasswordResetMail } from "../utils/emailService.js";

const generateToken = async (userId, type) => {
  const token = randomBytes(32).toString("hex");
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
  const { token } = req.body;

  if (!token) {
    return res.status(statusCode.BadRequest400).json({ message: "Token is required" });
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.type !== "EMAIL_VERIFICATION") {
    return res.status(statusCode.BadRequest400).json({ message: "Invalid token" });
  }

  if (new Date() > verificationToken.expiresAt) {
    return res.status(statusCode.BadRequest400).json({ message: "Token has expired" });
  }

  // Update user
  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { isEmailVerified: true },
  });

  // Delete token
  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  return res.status(statusCode.Ok200).json({ message: "Email verified successfully" });
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

  const token = await generateToken(user.id, "EMAIL_VERIFICATION");
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  await sendVerificationMail({ to: user.email, userName: user.firstName, verificationUrl });

  return res.status(statusCode.Ok200).json({ message: "Verification email resent." });
});
