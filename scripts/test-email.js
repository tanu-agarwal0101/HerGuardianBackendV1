import { sendVerificationMail } from "../utils/emailService.js";
import logger from "../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

logger.info({ user: process.env.EMAIL_USER }, "Testing email service...");

async function test() {
  try {
    const info = await sendVerificationMail({
      to: "test@example.com",
      userName: "Test User",
      verificationUrl: "http://localhost",
    });
    logger.info({ messageId: info.messageId }, "Email delivery success");
  } catch (err) {
    logger.error({ err: err.message }, "Error sending email");
  }
}
test();
