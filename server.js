import app from "./app.js";
import dotenv from "dotenv";
import {Server} from "socket.io"
import http from "http"
import chatBotSocket from "./routes/chatbotRoutes.js"
import prisma from "./utils/prisma.js";
// import "./jobs/safetyTimerChecker.js"


dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app)

// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:3000",     // your React frontend
//       "http://10.0.2.2:5000",      // Android emulator API calls
//       "http://127.0.0.1:5000",     // local loopback
//       "http://10.144.105.90:5000",   // replace with your LAN IP for physical Android on WiFi
//     ],
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE"],
//   }
// });

const io = new Server(server, {
  cors: {
    origin: "*",   // allow everything
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }
});


// process.env.FRONTEND_URL

chatBotSocket(io)

server.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});

const shutdown = async (signal) => {
  try {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log("HTTP server closed.");
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    });
    // Force exit if not closed in time
    setTimeout(async () => {
      await prisma.$disconnect().catch(() => {});
      console.warn("Forcing shutdown.");
      process.exit(1);
    }, 10_000).unref();
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));