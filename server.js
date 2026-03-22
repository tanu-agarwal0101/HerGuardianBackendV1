import logger from "./utils/logger.js";
import app from "./app.js";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import chatBotSocket from "./routes/chatbotRoutes.js";
import { registerSOSSocketHandlers } from "./sockets/sosSocket.js";
import prisma from "./utils/prisma.js";
import "./jobs/safetyTimerChecker.js";
import "./jobs/tokenCleanup.js";
import "./jobs/sosSessionExpiry.js";
import { startBlacklistCleanupJob } from "./utils/cleanupBlacklist.js";
import {
  startWatchSimulator,
  stopWatchSimulator,
} from "./jobs/watchSimulator.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== "production";
const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: isDev ? ["http://localhost:3000", "http://127.0.0.1:3000"] : corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

chatBotSocket(io);
registerSOSSocketHandlers(io);

server.listen(PORT, () => {
  logger.info({ port: PORT }, "Server is running");
  startBlacklistCleanupJob();
  if (process.env.SIMULATE_WATCH === "true") {
    startWatchSimulator();
  }
});

const shutdown = async (signal) => {
  try {
    logger.info({ signal }, "Received shutdown signal. Shutting down gracefully...");
    stopWatchSimulator();
    server.close(async () => {
      logger.info("HTTP server closed.");
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    });

    setTimeout(async () => {
      await prisma.$disconnect().catch(() => {});
      logger.warn("Forcing shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
