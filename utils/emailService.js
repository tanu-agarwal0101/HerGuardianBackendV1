import nodemailer from "nodemailer";

export const sendSOSMail = async ({ to, userName, locationUrl, triggeredAt }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

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

  const info = await transporter.sendMail(mailOptions);
  console.log("SOS email sent", info.messageId)
};
