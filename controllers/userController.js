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
      linkedGuardians: {
        include: {
          guardian: {
            select: {
              lastActiveAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return res
      .status(statusCode.NotFound404)
      .json({ message: "User not found" });
  }

  const guardians = user.linkedGuardians || [];

  const activeGuardianCount = guardians.filter(
    (l) => l.status === "accepted"
  ).length;
  const pendingGuardianCount = guardians.filter(
    (l) => l.status === "pending"
  ).length;

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const anyGuardianActiveRecently = guardians.some(
    (l) =>
      l.status === "accepted" &&
      l.guardian &&
      l.guardian.lastActiveAt &&
      new Date(l.guardian.lastActiveAt) > fiveMinutesAgo
  );

  const safeUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    location: user.location,
    bio: user.bio,
    stealthMode: user.stealthMode,
    stealthType: user.stealthType,
    safetyTimer: user.safetyTimer,
    addresses: user.address,
    contacts: user.emergencyContacts,
    sosTriggers: user.sosAlerts,
    safetyTimers: user.safetyTimers,
    profilePicture: user.profilePicture,
    voiceTriggerPhrase: user.voiceTriggerPhrase,
    guardianStatus: {
      activeCount: activeGuardianCount,
      pendingCount: pendingGuardianCount,
      anyActiveRecently: anyGuardianActiveRecently,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.status(statusCode.Ok200).json({ user: safeUser });
});

const sosTrigger = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { latitude, longitude, triggeredAt, timerId } = req.body || {};

  const { sos, notificationResults, trackingSessionId } = await triggerSOS(
    userId,
    { lat: latitude, lon: longitude, timerId },
    triggeredAt
  );

  const allNotificationsSucceeded = notificationResults.email.success && notificationResults.push.success;
  const anyNotificationSucceeded = notificationResults.email.success || notificationResults.push.success;

  if (allNotificationsSucceeded) {
    return res.status(statusCode.Created201).json({ 
      message: "SOS triggered successfully and contacts notified.", 
      sos, 
      notifications: notificationResults,
      trackingSessionId
    });
  } else if (anyNotificationSucceeded) {
    return res.status(statusCode.Ok200).json({ 
      message: "WARNING: SOS logged, but SOME notifications failed. Your contacts might not have been reached via all channels.", 
      sos, 
      notifications: notificationResults,
      warning: true,
      trackingSessionId
    });
  } else {
  
    return res.status(statusCode.Ok200).json({ 
      message: "CRITICAL: SOS logged, but ALL notification attempts failed! Please try other means of contact.", 
      sos, 
      notifications: notificationResults,
      error: true,
      trackingSessionId
    });
  }
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

  if (user.sosPass) {
    const isSos = await bcrypt.compare(pin, user.sosPass);
    if (isSos) {
      return res.status(statusCode.Ok200).json({ success: true, type: "sos" });
    }
  }

  if (user.dashboardPass) {
    const isDashboard = await bcrypt.compare(pin, user.dashboardPass);
    if (isDashboard) {
      return res.status(statusCode.Ok200).json({ success: true, type: "dashboard" });
    }
  }

  return res.status(statusCode.Unauthorized401).json({ success: false, message: "Invalid PIN" });
});

const updateVoiceSettings = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { voiceTriggerPhrase } = req.body;

  if (voiceTriggerPhrase === undefined) {
    return res.status(statusCode.BadRequest400).json({ message: "voiceTriggerPhrase is required" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { voiceTriggerPhrase },
  });

  return res.status(statusCode.Ok200).json({
    message: "Voice SOS settings updated",
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });
  }

  const { firstName, lastName, phoneNumber, location, bio, profilePicture, role } = req.body;

  if (role && !["user", "guardian", "both"].includes(role)) {
    return res.status(statusCode.BadRequest400).json({
      message: "Invalid role selected. Must be 'user', 'guardian', or 'both'.",
    });
  }

  if (phoneNumber !== undefined) {
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(statusCode.BadRequest400).json({
        message: "Invalid phone number format. Must be 10-15 digits.",
      });
    }
  }


  const dataToUpdate = {
    ...(firstName !== undefined && { firstName: firstName.trim() || undefined }),
    ...(lastName !== undefined && { lastName: lastName.trim() || undefined }),
    ...(phoneNumber !== undefined && { phoneNumber }),
    ...(location !== undefined && { location: location.trim() || null }),
    ...(bio !== undefined && { bio: bio.trim() || null }),
    ...(profilePicture !== undefined && { profilePicture: profilePicture.trim() || null }),
  };

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(statusCode.BadRequest400).json({ message: "No fields to update" });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  return res.status(statusCode.Ok200).json({
    message: "Profile updated successfully",
    user: {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phoneNumber: updatedUser.phoneNumber,
      location: updatedUser.location,
      bio: updatedUser.bio,
      profilePicture: updatedUser.profilePicture,
      updatedAt: updatedUser.updatedAt,
    },
  });
});

const updateDeviceStatus = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { batteryLevel, isCharging, isOnline, connectionType } = req.body;

  await prisma.deviceStatus.upsert({
    where: { userId },
    update: {
      batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : undefined,
      isCharging: isCharging !== undefined ? Boolean(isCharging) : undefined,
      isOnline: isOnline !== undefined ? Boolean(isOnline) : undefined,
      connectionType: connectionType || undefined,
    },
    create: {
      userId,
      batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : 0,
      isCharging: isCharging !== undefined ? Boolean(isCharging) : false,
      isOnline: isOnline !== undefined ? Boolean(isOnline) : true,
      connectionType: connectionType || "unknown",
    },
  });

  return res.status(statusCode.Ok200).json({ message: "Device status updated" });
});

export {
  updateStealth,
  getProfile,
  sosTrigger,
  getSOSLogs,
  getStealth,
  verifyStealthPin,
  updateVoiceSettings,
  updateProfile,
  updateDeviceStatus,
};
