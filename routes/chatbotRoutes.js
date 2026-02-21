import { getBotReply } from "../controllers/chatBotController.js";
import jwt from "jsonwebtoken";

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) cookies[name.trim()] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

export default function chatBotSocket(io) {
  // Authenticate socket connections via JWT in cookies
  io.use((socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers?.cookie);
      const token = cookies.accessToken;
      if (!token) {
        return next(new Error("Authentication required"));
      }
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (_err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    // Basic in-memory rate limiting per socket connection
    const rateLimit = {
        messages: 0,
        startTime: Date.now(),
        windowMs: 30 * 1000, // 30 seconds
        maxMessages: 5,
        warned: false
    };

    socket.on("userMessage", async (msg) => {
      const now = Date.now();
      if (now - rateLimit.startTime > rateLimit.windowMs) {
          rateLimit.startTime = now;
          rateLimit.messages = 0;
          rateLimit.warned = false;
      }

      rateLimit.messages++;

      if (rateLimit.messages > rateLimit.maxMessages) {
          if (!rateLimit.warned) {
              socket.emit("botReply", "Too many messages. Please slow down.");
              rateLimit.warned = true;
          }
          return;
      }

      try {
        const reply = await getBotReply(msg);
        socket.emit("botReply", reply);
      } catch (_error) {
        socket.emit("botReply", "Oops! I faced an issue responding.");
      }
    });

    socket.on("disconnect", () => {});
  });
}
