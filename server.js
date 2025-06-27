import app from "./app.js";
import dotenv from "dotenv";
import {Server} from "socket.io"
import http from "http"
import chatBotSocket from "./routes/chatbotRoutes.js"
// import "./jobs/safetyTimerChecker.js"


dotenv.config();

const PORT = process.env.PORT || 5001;

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", 
    credentials: true, 
    methods: ["GET", "POST"],
  }
});

// process.env.FRONTEND_URL

chatBotSocket(io)

server.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});