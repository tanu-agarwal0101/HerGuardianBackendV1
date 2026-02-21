import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";

const startSafetyTimer = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized: No user ID" });
  }
  const { duration, shareLocation, latitude, longitude } = req.body;
  const expiresAt = new Date(Date.now() + duration * 60 * 1000);

  if (!(await checkUserId(userId))) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "invalid user id" });
  }

  // Deactivate any existing active timers for this user
  await prisma.safetyTimer.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false, status: "cancelled" },
  });

  const timer = await prisma.safetyTimer.create({
    data: {
      userId,
      duration,
      expiresAt,
      sharedLocation: shareLocation,
      isActive: true,
      latitude,
      longitude,
    },
  });

  // Log location snapshot when timer starts
  if (latitude && longitude) {
    await prisma.locationLog.create({
      data: {
        userId,
        timerId: timer.id,
        latitude,
        longitude,
        event: "started",
      },
    }).catch(() => {
      // Ignore location log errors; timer creation is more important
    });
  }

  return res.status(statusCode.Created201).json({
    success: true,
    timer,
  });
});

const cancelSafetyTimer = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { status } = req.body;
  const updatedTimer = await prisma.safetyTimer.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false, status },
  });

  if (updatedTimer.count == 0) {
    return res.status(statusCode.NotFound404).json({
      message: "No active timer found",
    });
  }

  return res.status(statusCode.Ok200).json({
    message: "Safety timer canceled successfully",
  });
});

const getTimerDetails = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { timerId } = req.params || {};

  if (!timerId) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "timerId is required" });
  }

  const timer = await prisma.safetyTimer.findFirst({
    where: { id: timerId, userId },
  });

  if (!timer) {
    return res
      .status(statusCode.NotFound404)
      .json({ message: "Timer not found" });
  }

  const [locationLogs, sosLogs] = await Promise.all([
    prisma.locationLog.findMany({
      where: { timerId: timer.id, userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.sOSAlert.findMany({
      where: { timerId: timer.id, userId },
      orderBy: { triggeredAt: "desc" },
    }),
  ]);

  return res.status(statusCode.Ok200).json({
    timer,
    locationLogs,
    sosLogs,
  });
});

export { startSafetyTimer, cancelSafetyTimer, getTimerDetails };
