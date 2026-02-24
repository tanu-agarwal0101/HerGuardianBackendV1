import axios from "axios";

// Helper to get a fresh Access Token using the Refresh Token
const getAccessToken = async () => {
  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", null, {
      params: {
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        refresh_token: process.env.OAUTH_REFRESH_TOKEN,
        grant_type: "refresh_token",
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data.access_token;
  } catch (err) {
    console.error("Failed to refresh Gmail access token:", err?.response?.data || err.message);
    throw new Error("Email Authentication Failed");
  }
};

const sendGmailRest = async (to, subject, htmlBody) => {
  const accessToken = await getAccessToken();

  const emailLines = [
    `From: "HerGuardian" <${process.env.EMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody
  ];
  
  const rawEmail = Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const response = await axios.post(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      { raw: rawEmail },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error("Failed to send email via Gmail REST API:", err?.response?.data || err.message);
    throw new Error("Failed to send email");
  }
};

export const sendSOSMail = async ({ to, userName, locationUrl, triggeredAt }) => {
  const html = `
    <p><strong>${userName}</strong> has triggered an SOS alert.</p>
    <p>📍 <a href="${locationUrl}">View Location</a></p>
    <p>Please check on them immediately. SOS was triggered at ${triggeredAt},</p>
  `;
  return await sendGmailRest(to, "SOS Alert from HerGuardian", html);
};

export const sendVerificationMail = async ({ to, userName, verificationUrl }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Welcome to HerGuardian!</h2>
      <p>Hi ${userName || "there"},</p>
      <p>Thank you for registering. Please verify your email address to activate your account and access all safety features.</p>
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #6a0dad; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email Address</a>
      <p style="margin-top: 20px; font-size: 0.9em; color: #777;">If you did not create this account, please ignore this email.</p>
    </div>
  `;
  return await sendGmailRest(to, "Verify your email for HerGuardian", html);
};

export const sendPasswordResetMail = async ({ to, userName, resetUrl }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Password Reset Request</h2>
      <p>Hi ${userName || "there"},</p>
      <p>We received a request to reset your HerGuardian password. Click the button below to set a new password.</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #d10000; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      <p style="margin-top: 20px; font-size: 0.9em; color: #777;">This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    </div>
  `;
  return await sendGmailRest(to, "Reset your HerGuardian Password", html);
};

