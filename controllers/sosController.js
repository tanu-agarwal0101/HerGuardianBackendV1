import logger from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { generateTrackingToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const SESSION_DURATION_HOURS = 6;
const RATE_LIMIT_MS = 3000; 
const lastRestUpdateTs = new Map(); 

/**
 * Creates an SOS tracking session for a user.
 * Called internally by triggerSOS() — not a direct HTTP endpoint.
 *
 * @param {string} userId
 * @returns {Promise<{ session, trackingUrl }>}
 */
export async function createSOSSession(userId) {
  const token = generateTrackingToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  const session = await prisma.sOSTrackingSession.create({
    data: { userId, token, expiresAt },
  });

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const trackingUrl = `${baseUrl}/track/${token}`;

  logger.info({ sessionId: session.id, userId }, "SOS tracking session created");
  return { session, trackingUrl };
}

export const getTrackingSession = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const session = await prisma.sOSTrackingSession.findUnique({
    where: { token },
    include: {
      user: { select: { firstName: true, lastName: true } },
      locations: {
        orderBy: { timestamp: "asc" },
        take: 200, 
      },
    },
  });

  if (!session) {
    return res.status(404).json({ message: "Tracking session not found" });
  }

  if (session.status !== "active" || new Date() > session.expiresAt) {
    return res.status(410).json({
      message: "This tracking session has ended",
      status: session.status,
    });
  }

  logger.info({ sessionId: session.id, ip: req.ip }, "Guardian accessed SOS tracking session");

  return res.json({
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    user: session.user,
    locations: session.locations,
  });
});

export const pushSOSLocation = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { sessionId, latitude, longitude, accuracy, speed } = req.body;

  if (!sessionId || latitude == null || longitude == null) {
    return res.status(400).json({ message: "sessionId, latitude, and longitude are required" });
  }

  const now = Date.now();
  const last = lastRestUpdateTs.get(sessionId) || 0;
  if (now - last < RATE_LIMIT_MS) {
    return res.status(429).json({ message: "Location update rate limit exceeded. Max 1 update per 3 seconds." });
  }
  lastRestUpdateTs.set(sessionId, now);

  const session = await prisma.sOSTrackingSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true, expiresAt: true },
  });

  if (!session) {
    return res.status(404).json({ message: "Tracking session not found" });
  }

  if (session.userId.toString() !== userId) {
    logger.warn({ sessionId, userId, sessionUserId: session.userId.toString() }, "Forbidden: SOS location push attempted by non-owner");
    return res.status(403).json({ message: "Forbidden" });
  }

  if (session.status !== "active" || new Date() > session.expiresAt) {
    return res.status(410).json({ message: "Session is no longer active" });
  }

  await prisma.$transaction([
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

  logger.debug({ sessionId, userId, latitude, longitude }, "SOS location saved via REST fallback");
  return res.status(201).json({ message: "Location saved" });
});

export const resolveSOSSession = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "sessionId is required" });
  }

  const session = await prisma.sOSTrackingSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true },
  });

  if (!session) {
    return res.status(404).json({ message: "Session not found" });
  }

  if (session.userId.toString() !== userId) {
    logger.warn({ sessionId, userId, sessionUserId: session.userId.toString() }, "Forbidden: SOS resolve attempted by non-owner");
    return res.status(403).json({ message: "Forbidden" });
  }

  if (session.status !== "active") {
    return res.status(409).json({ message: "Session is already closed" });
  }

  await prisma.sOSTrackingSession.update({
    where: { id: sessionId },
    data: { status: "resolved" },
  });


  await prisma.sOSAlert.updateMany({
    where: { userId, resolved: false },
    data: { resolved: true }
  });

  lastRestUpdateTs.delete(sessionId);
  logger.info({ sessionId, userId }, "SOS session and alerts resolved via REST");
  return res.json({ message: "Session and alerts resolved. You are marked as safe." });
});


export const getActiveSession = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const session = await prisma.sOSTrackingSession.findFirst({
    where: {
      userId,
      status: "active",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return res.status(200).json({ active: false });
  }

  return res.json({ ...session, active: true });
});
