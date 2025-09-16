import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { authRoute, addressRoute, contactRoute, timerRoute, userRoute, watchRoute } from "./routes/index.js";
import { errorHandler } from './middleware/errorMiddleware.js';


const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);


const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "").split(",").map(o => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.length === 0 || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(compression());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log("Request body: ", req.body);
  next();
});

app.get("/", (req, res) => {
    res.send(
      '<h1>Welcome to HerGuardian</h1>',
    );
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(express.static("public"));
app.use(cookieParser());

app.use("/users", authRoute);
app.use("/contacts", contactRoute);
app.use("/address", addressRoute);
app.use("/timer", timerRoute)
app.use("/users", userRoute)
app.use("/watch", watchRoute)
// Global error handler

app.use(errorHandler)
// app.use((err, req, res, next) => {
//     console.error(err.stack);
  
//     const errorResponse = {
//       error: err.name || "Error",
//       message: err.message || "Internal Server Error",
//     };
  
//     switch (err.name) {
//       case "TokenExpiredError":
//         return res.status(401).json({
//           error: "Unauthorized",
//           message: "Token expired, please log in again.",
//         });
  
//       case "JsonWebTokenError":
//         return res
//           .status(401)
//           .json({ error: "Unauthorized", message: "Invalid token" });
  
//       case "ValidationError":
//         return res.status(400).json({
//           error: "Bad Request",
//           message: "Validation error",
//           details: err.errors,
//         });
  
//       case "NotFoundError":
//         return res
//           .status(404)
//           .json({ error: "Not Found", message: "Resource not found" });
  
//       case "UnauthorizedError":
//         return res
//           .status(401)
//           .json({ error: "Unauthorized", message: "Unauthorized access" });
  
//       case "CastError":
//         return res
//           .status(400)
//           .json({ error: "Bad Request", message: "Invalid ID format" });
  
//     //   case "RateLimitExceeded":
//     //     return res.status(429).json({
//     //       error: "Too Many Requests",
//     //       message: "Too many requests. Please try again later.",
//     //     });
  
//       default:
//         return res.status(err.status || 500).json(errorResponse);
//     }
//   });

export default app