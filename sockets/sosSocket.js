import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import prisma from "../utils/prisma.js";

const lastUpdateTs = new Map(); 
const RATE_LIMIT_MS = 3000;    

export function registerSOSSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        socket.user = decoded;
        logger.debug({ socketId: socket.id, userId: decoded.userId }, "Authenticated socket connection");
      } catch (err) {
        logger.debug({ socketId: socket.id }, "Socket connection has invalid token");
      }
    } else {
      logger.debug({ socketId: socket.id }, "Anonymous socket connection");
    }
    next();
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

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
          select: { status: true, expiresAt: true, userId: true },
        });

        if (!session || session.status !== "active" || new Date() > session.expiresAt) {
          socket.emit("track_error", { message: "Session is no longer active" });
          return;
        }

        if (!socket.user || socket.user.userId !== session.userId) {
          socket.emit("track_error", { message: "Unauthorized: Only the session owner can broadcast location updates." });
          logger.warn({ socketId: socket.id, sessionId, userId: socket.user?.userId }, "Unauthorized location update attempt");
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

    socket.on("resolve_sos", async ({ sessionId } = {}) => {
      if (!sessionId) {
        socket.emit("track_error", { message: "sessionId is required" });
        return;
      }

      try {
        const session = await prisma.sOSTrackingSession.findUnique({
          where: { id: sessionId },
          select: { userId: true }
        });

        if (!session) {
          socket.emit("track_error", { message: "Session not found" });
          return;
        }

        if (!socket.user || socket.user.userId !== session.userId) {
          socket.emit("track_error", { message: "Unauthorized: Only the session owner can resolve the SOS." });
          return;
        }

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

    socket.on("location_error", async ({ sessionId, type, message } = {}) => {
      if (!sessionId) return;
      
      try {
        const session = await prisma.sOSTrackingSession.findUnique({
          where: { id: sessionId },
          select: { status: true, expiresAt: true, userId: true },
        });

        if (!session || session.status !== "active" || new Date() > session.expiresAt) {
          logger.warn({ sessionId, type }, "Blocked location error broadcast for inactive session");
          return;
        }

        if (!socket.user || socket.user.userId !== session.userId) {
          logger.warn({ socketId: socket.id, sessionId, userId: socket.user?.userId }, "Unauthorized location error broadcast attempt");
          return;
        }

        const room = `sos-session-${sessionId}`;
        io.to(room).emit("location_error", { type, message });
        logger.warn({ sessionId, type }, "SOS location error reported and broadcast");
      } catch (err) {
        logger.error({ err, sessionId }, "Error validating session for location error broadcast");
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });
}
