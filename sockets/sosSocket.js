import logger from "../utils/logger.js";
import prisma from "../utils/prisma.js";

const lastUpdateTs = new Map(); 
const RATE_LIMIT_MS = 3000;    

export function registerSOSSocketHandlers(io) {
  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

    /**
     * Guardian joins a tracking session room.
     * Event: join_track
     * Payload: { token }
     */
    socket.on("join_track", async ({ token } = {}) => {
      if (!token) {
        socket.emit("track_error", { message: "Token is required" });
        return;
      }

      try {
        const session = await prisma.sOSTrackingSession.findUnique({
          where: { token },
          select: { id: true, status: true, expiresAt: true, userId: true },
        });

        if (!session) {
          socket.emit("track_error", { message: "Tracking session not found" });
          return;
        }

        if (session.status !== "active" || new Date() > session.expiresAt) {
          socket.emit("track_error", { message: "Tracking session has ended" });
          return;
        }

        const room = `sos-session-${session.id}`;
        socket.join(room);
        socket.emit("track_joined", { sessionId: session.id, room });
        logger.info({ socketId: socket.id, room }, "Guardian joined SOS tracking room");
      } catch (err) {
        logger.error({ err, token }, "Error joining SOS tracking room");
        socket.emit("track_error", { message: "Internal error" });
      }
    });

    /**
     * SOS user sends a location update.
     * Event: location_update
     * Payload: { sessionId, latitude, longitude, accuracy?, speed? }
     */
    socket.on("location_update", async (payload = {}) => {
      const { sessionId, latitude, longitude, accuracy, speed } = payload;

      if (!sessionId || latitude == null || longitude == null) {
        socket.emit("track_error", { message: "sessionId, latitude, and longitude are required" });
        return;
      }

      const now = Date.now();
      const last = lastUpdateTs.get(sessionId) || 0;
      if (now - last < RATE_LIMIT_MS) {
        return;
      }
      lastUpdateTs.set(sessionId, now);

      try {
        
        const session = await prisma.sOSTrackingSession.findUnique({
          where: { id: sessionId },
          select: { status: true, expiresAt: true },
        });

        if (!session || session.status !== "active" || new Date() > session.expiresAt) {
          socket.emit("track_error", { message: "Session is no longer active" });
          return;
        }

        const [location] = await prisma.$transaction([
          prisma.sOSLocation.create({
            data: {
              sessionId,
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              accuracy: accuracy != null ? parseFloat(accuracy) : undefined,
              speed: speed != null ? parseFloat(speed) : undefined,
            },
          }),
          prisma.sOSTrackingSession.update({
            where: { id: sessionId },
            data: { lastUpdateAt: new Date() },
          }),
        ]);

        const room = `sos-session-${sessionId}`;
        io.to(room).emit("location_updated", {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          timestamp: location.timestamp,
        });

        logger.debug({ sessionId, latitude, longitude }, "SOS location update broadcast");
      } catch (err) {
        logger.error({ err, sessionId }, "Error processing SOS location update");
        socket.emit("track_error", { message: "Failed to save location" });
      }
    });

    /**
     * SOS user resolves the session ("I am safe").
     * Event: resolve_sos
     * Payload: { sessionId }
     */
    socket.on("resolve_sos", async ({ sessionId } = {}) => {
      if (!sessionId) {
        socket.emit("track_error", { message: "sessionId is required" });
        return;
      }

      try {
        await prisma.sOSTrackingSession.update({
          where: { id: sessionId },
          data: { status: "resolved" },
        });

        const room = `sos-session-${sessionId}`;
        io.to(room).emit("sos_resolved", { sessionId, message: "The user has marked themselves safe." });
        lastUpdateTs.delete(sessionId);
        logger.info({ sessionId }, "SOS session resolved via socket");
      } catch (err) {
        logger.error({ err, sessionId }, "Error resolving SOS session via socket");
        socket.emit("track_error", { message: "Failed to resolve session" });
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });
}
