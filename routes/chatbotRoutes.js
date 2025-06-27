import { getBotReply } from "../controllers/chatBotController.js";

export default function chatBotSocket(io) {
  io.on("connection", (socket) => {
    console.log("user connected: ", socket.id);

    socket.on("userMessage", async (msg) => {
      try {
        const reply = await getBotReply(msg);
        // console.log("bot reply", reply)
        socket.emit("botReply", reply);
      } catch (error) {
        console.error("Bot Reply Error:", error);
        socket.emit("botReply", "Oops! I faced an issue responding.");
      }
    });

    socket.on("disconnect", () => {
      console.log("user disconnected: ", socket.id);
    });
  });
}
