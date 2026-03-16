import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import logger from "./utils/logger.js";
import {
  authRoute,
  addressRoute,
  contactRoute,
  timerRoute,
  userRoute,
  watchRoute,
  locationRoute,
  notificationRoutes,
} from "./routes/index.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import { globalRateLimiter } from "./utils/rateLimiter.js";

const app = express();
app.disable("x-powered-by");
app.use(globalRateLimiter);
app.use(pinoHttp({ logger }));

const isDev = process.env.NODE_ENV !== "production";
const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: isDev
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : (origin, callback) => {
          if (!origin) return callback(null, true);
          if (corsOrigins.length === 0) return callback(null, true);
          
          const cleanOrigin = origin.replace(/\/$/, "");
          const isAllowed = corsOrigins.some((o) => o.replace(/\/$/, "") === cleanOrigin);
          
          if (isAllowed) return callback(null, true);
          return callback(new Error(`Not allowed by CORS: ${origin}`));
        },
    credentials: true,
  })
);

app.use(helmet());
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("<h1>Welcome to HerGuardian</h1>");
});

app.get("/health", async (req, res) => {
  try {
    const { default: prisma } = await import("./utils/prisma.js");
    await prisma.$runCommandRaw({ ping: 1 });
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (_e) {
    res.status(503).json({ status: "degraded", db: "disconnected" });
  }
});

app.use(cookieParser());

app.use("/users", authRoute);
app.use("/contacts", contactRoute);
app.use("/address", addressRoute);
app.use("/timer", timerRoute);
app.use("/users", userRoute);
app.use("/watch", watchRoute);
app.use("/api/notifications", notificationRoutes);
app.use("/", locationRoute);
// Global error handler

app.use(errorHandler);

export default app;
