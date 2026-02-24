import { sendVerificationMail } from "./utils/emailService.js";
import dotenv from "dotenv";
dotenv.config();

console.log("Testing email service...");
console.log("User:", process.env.EMAIL_USER);

async function test() {
  try {
    const info = await sendVerificationMail({
      to: "test@example.com",
      userName: "Test User",
      verificationUrl: "http://localhost",
    });
    console.log("Success:", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}
test();
