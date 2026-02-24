import nodemailer from "nodemailer";

// Create a single, global transporter using OAuth2
const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN,
    },
  });
};

export const sendSOSMail = async ({ to, userName, locationUrl, triggeredAt }) => {
  const mailOptions = {
    from: `"HerGuardian" <${process.env.EMAIL_USER}>`,
    to,
    subject: "SOS Alert from HerGuardian",
    html: `
    <p><strong>${userName}</strong> has triggered an SOS alert.</p>
    <p>📍 <a href="${locationUrl}">View Location</a></p>
    <p>Please check on them immediately. SOS was triggered at ${triggeredAt},</p>
    `,
  };

  return await getTransporter().sendMail(mailOptions);
};

export const sendVerificationMail = async ({ to, userName, verificationUrl }) => {
  const mailOptions = {
    from: `"HerGuardian" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your email for HerGuardian",
    html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Welcome to HerGuardian!</h2>
      <p>Hi ${userName || "there"},</p>
      <p>Thank you for registering. Please verify your email address to activate your account and access all safety features.</p>
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #6a0dad; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email Address</a>
      <p style="margin-top: 20px; font-size: 0.9em; color: #777;">If you did not create this account, please ignore this email.</p>
    </div>
    `,
  };

  return await getTransporter().sendMail(mailOptions);
};

export const sendPasswordResetMail = async ({ to, userName, resetUrl }) => {
  const mailOptions = {
    from: `"HerGuardian" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Reset your HerGuardian Password",
    html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Password Reset Request</h2>
      <p>Hi ${userName || "there"},</p>
      <p>We received a request to reset your HerGuardian password. Click the button below to set a new password.</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #d10000; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      <p style="margin-top: 20px; font-size: 0.9em; color: #777;">This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    </div>
    `,
  };

  return await getTransporter().sendMail(mailOptions);
};
