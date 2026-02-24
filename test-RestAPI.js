import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

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

async function test() {
  try {
    console.log("Testing Gmail REST API...");
    const res = await sendGmailRest(
      "test@example.com", 
      "Verify your email for HerGuardian", 
      "<b>Test Mail</b>"
    );
    console.log("Success:", res);
  } catch(e) {
    console.log("Error:", e);
  }
}
test();
