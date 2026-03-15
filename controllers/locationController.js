import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {statusCode} from "../utils/statusCode.js";

export const logLocation = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });

  const { latitude, longitude, timerId, event } = req.body || {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(statusCode.BadRequest400).json({ message: "latitude and longitude are required" });
  }
  const validEvents = ["started", "expired", "cancelled", "snapshot"];
  const eventName = event || "snapshot";
  if (!validEvents.includes(eventName)) {
     return res.status(statusCode.BadRequest400).json({ message: "Invalid event type" });
  }

  const data = {
    userId,
    latitude,
    longitude,
    event: eventName,
  };
  if (timerId) {
    const timer = await prisma.safetyTimer.findFirst({
      where: { id: timerId, userId }
    });
    if (!timer) {
      return res.status(statusCode.NotFound404).json({ message: "Timer not found or not owned by user" });
    }
    data.timerId = timerId;
  }

  const created = await prisma.locationLog.create({ data });
  return res.status(statusCode.Created201).json({ location: created });
});

export const getRecent = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.locationLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.locationLog.count({ where: { userId } }),
  ]);

  return res.status(statusCode.Ok200).json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});


