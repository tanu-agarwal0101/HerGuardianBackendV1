import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../utils/prisma.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";
import { sendSOSMail } from "../utils/emailService.js";
import { triggerSOS } from "../utils/triggerSos.js";

const updateStealth = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const {
    stealthMode,
    stealthType,
    dashboardPass,
    sosPass,
  } = req.body;

  const isUserValid = await checkUserId(userId);
  if (!isUserValid) {
    return res.status(statusCode.NotFound404).json({
      message: "user not found",
    });
  }

  // Check if stealthMode is provided before using it or setting cookies
  // If not provided, we might still want to update other fields, but we can't set the cookie to "undefined"
  
  const dataToUpdate = {};
  if (stealthMode !== undefined) dataToUpdate.stealthMode = stealthMode;
  if (stealthType !== undefined) dataToUpdate.stealthType = stealthType;
  if (dashboardPass !== undefined) dataToUpdate.dashboardPass = dashboardPass;
  if (sosPass !== undefined) dataToUpdate.sosPass = sosPass;

  await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  // Base options matching authController
  const cookieOptions = {
    path: "/",
    sameSite: "Lax", // Match authController to avoid port issues
    secure: process.env.NODE_ENV === "production",
  };

  // Only update cookies if the values were provided/changed
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
      dashboardPass: true,
      sosPass: true,
    },
  });
  if (!user)
    return res
      .status(statusCode.NotFound404)
      .json({ message: "user not found" });
  return res.status(statusCode.Ok200).json({ stealth: user });
});

// const getProfile = asyncHandler(async (req, res) => {
//  const userId = req.user?.userId;

//   if (!userId) {
//     return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });
//   }

//   const user = await prisma.user.findUnique({
//     where: { id: userId },
//     include: {
//       password: false,
//       address: true,
//       emergencyContacts: true,
//       safetyTimers: {
//         orderBy: { createdAt: "desc" },
//       },
//       sosAlerts: {
//         orderBy: { triggeredAt: "desc" },
//       },
//       refreshTokens: false,
//       verificationTokens: false,
//     },
//   });

//   if (!user) {
//     return res.status(statusCode.NotFound404).json({ message: "User not found" });
//   }

//   return res.status(statusCode.Ok200).json({ user });
// });

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
    dashboardPass: user.dashboardPass,
    sosPass: user.sosPass,
    safetyTimer: user.safetyTimer,
    addresses: user.address,
    contacts: user.emergencyContacts,
    sosTriggers: user.sosAlerts,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    // profilePicture: null,
  };

  return res.status(statusCode.Ok200).json({ user: safeUser });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      createdAt: true,
    },
  });

  return res.status(statusCode.Ok200).json({ users });
});

// const sosTrigger = asyncHandler(async (req, res) => {
//   const userId = req.user.userId;
//   const { latitude, longitude, triggeredAt } = req.body;

//   if (!(await checkUserId(userId)))
//     return res.status(statusCode.Unauthorized401).json({
//       message: "invalid user id",
//     });

//   if (!latitude || !longitude)
//     return res.status(statusCode.BadRequest400).json({
//       message: "Location is required",
//     });

//   const sos = await prisma.sOSAlert.create({
//     data: {
//       userId,
//       latitude: parseFloat(latitude),
//       longitude: parseFloat(longitude),
//       triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
//     },

//   });

//   const user = await prisma.user.findUnique({
//     where: { id: userId },
//     include: {
//       emergencyContacts: true,
//     },
//   });

//   if (!user || !user.emergencyContacts.length) {
//     return res.status(statusCode.BadRequest400).json({
//       message: "no emergency contacts found",
//     });
//   }

//   const triggeredTime = new Date(triggeredAt).toLocaleString("en-IN", {
//   timeZone: "Asia/Kolkata",
//   weekday: "short",
//   year: "numeric",
//   month: "short",
//   day: "numeric",
//   hour: "2-digit",
//   minute: "2-digit"
// });

//   const emails = user.emergencyContacts
//     .map((contact) => contact.email)
//     .filter(Boolean);

//   const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

//   await sendSOSMail({
//     to: emails,
//     userName: `${user.firstName || "A user"}`,
//     locationUrl,
//     triggeredTime,
//   });

//   await prisma.sOSAlert.update({
//     where: {id: sos.id},
//     data: {resolved: true}
//   })
//   return res.status(statusCode.Created201).json({
//     message: "sos triggered successfully",
//   });
// });

const sosTrigger = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { latitude, longitude, triggeredAt, timerId } = req.body || {};

  const sos = await triggerSOS(
    userId,
    { lat: latitude, lon: longitude, timerId },
    triggeredAt
  );

  res.status(201).json({ message: "sos triggered successfully", sos });
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

// resolved: true immediately
// Right now, the alert is closed the second you create it.
// Better → keep it resolved: false until the user marks themselves safe or an admin resolves it.
// data: { resolved: false }
// and only update it later in a resolveSOS endpoint.

export {
  updateStealth,
  getProfile,
  getAllUsers,
  sosTrigger,
  getSOSLogs,
  getStealth,
};
