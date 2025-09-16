import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authRoute, addressRoute, contactRoute, timerRoute, userRoute, watchRoute } from "./routes/index.js";
import { errorHandler } from './middleware/errorMiddleware.js';


const app = express();


app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }),
  );

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