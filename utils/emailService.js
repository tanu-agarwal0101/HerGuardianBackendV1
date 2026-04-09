import logger from "./logger.js";
import axios from "axios";

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
    const googleError = err?.response?.data?.error_description || err?.response?.data?.error || err.message;
    logger.error({ err }, "Failed to refresh Gmail access token");
    throw new Error(`Email Authentication Failed: ${googleError}`);
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
    logger.error({ 
      err, 
      response: err?.response?.data 
    }, "Failed to send email via Gmail REST API");
    throw new Error("Failed to send email");
  }
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const escapeAttr = (unsafe) => {
  if (!unsafe) return "";
  return unsafe.toString().replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const isValidUrl = (url) => {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
};

const sanitizeHeaderValue = (value, fallback = "") => {
  if (!value) return fallback;
  return value.toString().replace(/[\r\n]/g, " ").trim();
};

export const sendSOSMail = async ({ to, userName, locationUrl, locationDetail, trackingUrl, triggeredAt }) => {
  const rawUserName = sanitizeHeaderValue(userName, "Someone");
  const safeUserName = escapeHtml(rawUserName);
  const safeLocationDetail = escapeHtml(locationDetail || "Unknown");
  const safeTriggeredAt = escapeHtml(triggeredAt);
  
  const safeTrackingUrl = isValidUrl(trackingUrl) ? escapeAttr(trackingUrl) : null;
  const safeLocationUrl = isValidUrl(locationUrl) ? escapeAttr(locationUrl) : null;

  const trackingSection = safeTrackingUrl
    ? `<p style="margin-top: 15px;">
        <a href="${safeTrackingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d10000; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          📍 Track Live Location
        </a>
       </p>
       <p style="font-size: 0.85em; color: #777;">This link is active for up to 6 hours or until the user marks themselves as safe.</p>`
    : "";

  const locationLink = safeLocationUrl 
    ? `<p>📍 <a href="${safeLocationUrl}" style="color: #d10000; font-weight: bold;">View Last Known Location on Map</a></p>`
    : `<p>📍 <strong>Location:</strong> ${safeLocationDetail}</p>`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #d10000;">🚨 SOS Alert from HerGuardian</h2>
      <p style="font-size: 16px;"><strong>${safeUserName}</strong> has triggered an emergency SOS alert.</p>      ${locationLink}
      ${trackingSection}
      <p style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
        SOS was triggered at: <strong>${safeTriggeredAt}</strong>      </p>
      <p style="color: #c00; font-weight: bold; font-size: 18px; margin-top: 10px;">Please check on them immediately.</p>
    </div>
  `;
  return await sendGmailRest(to, `SOS Alert: ${rawUserName} needs help!`, html);
};

export const sendVerificationMail = async ({ to, userName, otp }) => {
  const rawUserName = sanitizeHeaderValue(userName, "there");
  const safeUserName = escapeHtml(rawUserName);
  const safeOtp = escapeHtml(otp);
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Welcome to HerGuardian!</h2>
      <p>Hi ${safeUserName},</p>
      <p>Thank you for registering. Please enter the verification code below on the website to activate your account and access all safety features:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #6a0dad; margin: 25px 0; background: #f3e8fc; padding: 15px; border-radius: 8px; display: inline-block;">
        ${safeOtp}
      </div>
      <p style="margin-top: 20px; font-size: 0.9em; color: #777;">This code expires in 1 hour. If you did not create this account, please ignore this email.</p>
    </div>
  `;
  return await sendGmailRest(to, "Verify your HerGuardian Email", html);
};

export const sendPasswordResetMail = async ({ to, userName, resetUrl }) => {
  const rawUserName = sanitizeHeaderValue(userName, "there");
  const safeUserName = escapeHtml(rawUserName);
  const safeResetUrl = isValidUrl(resetUrl) ? escapeAttr(resetUrl) : "#";
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Password Reset Request</h2>
      <p>Hi ${safeUserName},</p>
      <p>We received a request to reset your HerGuardian password. Click the button below to set a new password.</p>
      <a href="${safeResetUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #d10000; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      <p style="margin-top: 20px; font-size: 0.9em; color: #777;">This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    </div>
  `;
  return await sendGmailRest(to, "Reset your HerGuardian Password", html);
};

export const sendGuardianInviteMail = async ({ to, inviterName, inviteUrl }) => {
  const rawInviterName = sanitizeHeaderValue(inviterName, "Someone");
  const safeInviterName = escapeHtml(rawInviterName);
  const safeInviteUrl = isValidUrl(inviteUrl) ? escapeAttr(inviteUrl) : "#";
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6a0dad;">Guardian Invitation</h2>
      <p>Hello!</p>
      <p><strong>${safeInviterName}</strong> has invited you to be their trusted Guardian on HerGuardian.</p>
      <p>As their Guardian, you'll be able to receive emergency SOS alerts, check their online status, and view their live location when they need help or start a safety timer.</p>
      <a href="${safeInviteUrl}" style="display: inline-block; padding: 12px 24px; margin-top: 20px; color: white; background-color: #6a0dad; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Accept Invitation</a>
      <p style="margin-top: 25px; font-size: 0.85em; color: #777;">This link is secure and valid for 72 hours. If you do not wish to be their Guardian, you can safely ignore this email.</p>
    </div>
  `;
  return await sendGmailRest(to, `${rawInviterName} invited you to be their Guardian`, html);
};

