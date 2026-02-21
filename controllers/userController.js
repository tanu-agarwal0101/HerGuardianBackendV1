import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../utils/prisma.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";
import { triggerSOS } from "../utils/triggerSos.js";
import bcrypt from "bcrypt";

const updateStealth = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { stealthMode, stealthType, dashboardPass, sosPass } = req.body;

  const isUserValid = await checkUserId(userId);
  if (!isUserValid) {
    return res.status(statusCode.NotFound404).json({
      message: "user not found",
    });
  }

  const dataToUpdate = {};
  if (stealthMode !== undefined) dataToUpdate.stealthMode = stealthMode;
  if (stealthType !== undefined) dataToUpdate.stealthType = stealthType;
  if (dashboardPass) dataToUpdate.dashboardPass = await bcrypt.hash(dashboardPass, 10);
  if (sosPass) dataToUpdate.sosPass = await bcrypt.hash(sosPass, 10);

  await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  const cookieOptions = {
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
  };

  if (stealthMode !== undefined) {
    res.clearCookie("stealthMode", cookieOptions);
    res.cookie("stealthMode", stealthMode ? "true" : "false", {
      ...cookieOptions,
      httpOnly: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  if (stealthType !== undefined) {
    res.clearCookie("stealthType", cookieOptions);
    res.cookie("stealthType", stealthType || "calculator", {
      ...cookieOptions,
      httpOnly: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  return res.status(statusCode.Ok200).json({
    message: "Stealth settings updated",
  });
});

const getStealth = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stealthMode: true,
      stealthType: true,
    },
  });
  if (!user)
    return res
      .status(statusCode.NotFound404)
      .json({ message: "user not found" });
  return res.status(statusCode.Ok200).json({ stealth: user });
});

const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res
      .status(statusCode.Unauthorized401)
      .json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      address: true,
      emergencyContacts: true,
      safetyTimers: { orderBy: { createdAt: "desc" } },
      sosAlerts: { orderBy: { triggeredAt: "desc" } },
    },
  });

  if (!user) {
    return res
      .status(statusCode.NotFound404)
      .json({ message: "User not found" });
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    stealthMode: user.stealthMode,
    stealthType: user.stealthType,
    safetyTimer: user.safetyTimer,
    addresses: user.address,
    contacts: user.emergencyContacts,
    sosTriggers: user.sosAlerts,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.status(statusCode.Ok200).json({ user: safeUser });
});

const sosTrigger = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { latitude, longitude, triggeredAt, timerId } = req.body || {};

  const sos = await triggerSOS(
    userId,
    { lat: latitude, lon: longitude, timerId },
    triggeredAt
  );

  return res.status(statusCode.Created201).json({ message: "sos triggered successfully", sos });
});

const getSOSLogs = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  if (!(await checkUserId(userId)))
    return res
      .status(statusCode.Unauthorized401)
      .json({ message: "invalid user id" });

  const sosLogs = await prisma.sOSAlert.findMany({
    where: { userId: userId },
    orderBy: { triggeredAt: "desc" },
  });

  if (sosLogs.length === 0)
    return res.status(statusCode.Ok200).json({ message: "no logs found" });

  return res.status(statusCode.Ok200).json({ sosLogs, message: "logs found" });
});

const verifyStealthPin = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { pin } = req.body;

  if (!pin) {
    return res.status(statusCode.BadRequest400).json({ success: false, message: "PIN is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardPass: true, sosPass: true }
  });

  if (!user) {
    return res.status(statusCode.NotFound404).json({ success: false, message: "User not found" });
  }

  // Check SOS Pin First
  if (user.sosPass) {
    const isSos = await bcrypt.compare(pin, user.sosPass);
    if (isSos) {
      return res.status(statusCode.Ok200).json({ success: true, type: "sos" });
    }
  }

  // Check Dashboard Pin
  if (user.dashboardPass) {
    const isDashboard = await bcrypt.compare(pin, user.dashboardPass);
    if (isDashboard) {
      return res.status(statusCode.Ok200).json({ success: true, type: "dashboard" });
    }
  }

  return res.status(statusCode.Unauthorized401).json({ success: false, message: "Invalid PIN" });
});

export {
  updateStealth,
  getProfile,
  sosTrigger,
  getSOSLogs,
  getStealth,
  verifyStealthPin,
};
