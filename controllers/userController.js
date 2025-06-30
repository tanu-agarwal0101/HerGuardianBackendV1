import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../utils/prisma.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";
import { sendSOSMail } from "../utils/emailService.js";

const updateStealth = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { stealthMode, stealthType } = req.body;

  const isUserValid = await checkUserId(userId);
  if (!isUserValid) {
    return res.status(statusCode.NotFound404).json({
      message: "user not found",
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stealthMode,
      stealthType,
    },
  });

  // ✅ Set non-HttpOnly cookies so frontend + middleware can read them
  res.clearCookie("stealthMode", {
    path: "/",
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.clearCookie("stealthType", {
    path: "/",
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.cookie("stealthMode", stealthMode.toString(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
  });

  res.cookie("stealthType", stealthType || "calculator", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
  });

  return res.status(statusCode.Ok200).json({
    message: "Stealth settings updated and cookies set",
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    stealthMode: user.stealthMode,
    stealthType: user.stealthType,
    addresses: user.addresses,
    emergencyContacts: user.emergencyContacts
  });
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

const sosTrigger = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { latitude, longitude, triggeredAt } = req.body;

  if (!(await checkUserId(userId)))
    return res.status(statusCode.Unauthorized401).json({
      message: "invalid user id",
    });

  if (!latitude || !longitude)
    return res.status(statusCode.BadRequest400).json({
      message: "Location is required",
    });

  await prisma.sOSAlert.create({
    data: {
      userId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      emergencyContacts: true,
    },
  });

  if (!user || !user.emergencyContacts.length) {
    return res.status(statusCode.BadRequest400).json({
      message: "no emergency contacts found",
    });
  }

  const emails = user.emergencyContacts
    .map((contact) => contact.email)
    .filter(Boolean);

  const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  await sendSOSMail({
    to: emails,
    userName: `${user.firstName || "A user"}`,
    locationUrl,
    triggeredAt,
  });
  return res.status(statusCode.Created201).json({
    message: "sos triggered successfully",
  });
});

export { updateStealth, getProfile, getAllUsers, sosTrigger };
