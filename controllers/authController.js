import prisma from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
  path: "/",
};
// import { ObjectId } from "mongodb";

// Helpers for ms parsing
const min = (n) => n * 60 * 1000;
const hr = (n) => n * 60 * 60 * 1000;
const day = (n) => n * 24 * 60 * 60 * 1000;
const parseMs = (val, fallback) => {
  const v = (val || "").trim() || fallback;
  const num = parseInt(v);
  if (v.endsWith("m")) return min(num);
  if (v.endsWith("h")) return hr(num);
  if (v.endsWith("d")) return day(num);
  return num; // assume milliseconds
};

// Configurable (with fallbacks)
const ACCESS_EXP_MS = parseMs(process.env.ACCESS_TOKEN_EXPIRY, "15m");
const SHORT_REFRESH_MS = parseMs(process.env.REFRESH_TOKEN_SHORT_EXPIRY, "2h");
const LONG_REFRESH_MS = parseMs(process.env.REFRESH_TOKEN_LONG_EXPIRY, "30d");
const LONG_REFRESH_CAP_MS = parseMs(process.env.REFRESH_TOKEN_LONG_CAP, "90d");

const signAccess = (user) =>
  jwt.sign(
    { userId: user.id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: Math.floor(ACCESS_EXP_MS / 1000),
    }
  );
const signRefresh = (user, durationMs) =>
  jwt.sign(
    { userId: user.id, email: user.email },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: Math.floor(durationMs / 1000),
    }
  );

const generateTokens = async (
  user,
  rememberMe = false,
  userAgent = null,
  ip = null
) => {
  const refreshWindowMs = rememberMe ? LONG_REFRESH_MS : SHORT_REFRESH_MS;
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user, refreshWindowMs);
  const now = Date.now();
  const expiresAt = new Date(now + refreshWindowMs);
  const initialIssuedAt = new Date();
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      createdAt: new Date(),
      expiresAt,
      initialIssuedAt,
      rememberMe,
      userAgent: userAgent || undefined,
      ip: ip || undefined,
    },
  });
  return {
    accessToken,
    refreshToken,
    refreshWindowMs,
    expiresAt,
    initialIssuedAt,
  };
};

const registerUser = asyncHandler(async (req, res) => {
  // console.log("data", req.body)
  const { email, password, rememberMe } = req.validateData;
  const normalizedEmail = email.trim().toLowerCase();

  console.log("register email", normalizedEmail);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    return res
      .status(statusCode.Conflict409)
      .json({ message: "User already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res
        .status(statusCode.Conflict409)
        .json({ message: "User already exists" });
    }
    throw e;
  }

  const ua = req.headers["user-agent"] || null;
  const ip = req.ip || req.connection?.remoteAddress || null;
  const { accessToken, refreshToken, refreshWindowMs } = await generateTokens(
    user,
    rememberMe,
    ua,
    ip
  );

  return res
    .status(statusCode.Created201)
    .cookie("accessToken", accessToken, {
      ...baseCookieOptions,
      maxAge: ACCESS_EXP_MS,
    })
    .cookie("refreshToken", refreshToken, {
      ...baseCookieOptions,
      maxAge: refreshWindowMs,
    })
    .cookie("rememberMe", rememberMe ? "true" : "false", {
      ...baseCookieOptions,
      maxAge: refreshWindowMs,
    })
    .json({
      message: "User created successfully",
      user: { id: user.id, email: user.email },
      expiresIn: ACCESS_EXP_MS / 1000,
    });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.validateData;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "Email and password are required" });
  }
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user)
    return res.status(statusCode.NotFound404).json({
      message: "user with this mail does not exist",
    });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(statusCode.BadRequest400).json({
      message: "Invalid password",
    });
  }
  const ua = req.headers["user-agent"] || null;
  const ip = req.ip || req.connection?.remoteAddress || null;
  const { accessToken, refreshToken, refreshWindowMs } = await generateTokens(
    user,
    rememberMe,
    ua,
    ip
  );
  //   console.log(generateTokens(user))
  return res
    .status(statusCode.Ok200)
    .cookie("accessToken", accessToken, {
      ...baseCookieOptions,
      maxAge: ACCESS_EXP_MS,
    })
    .cookie("refreshToken", refreshToken, {
      ...baseCookieOptions,
      maxAge: refreshWindowMs,
    })
    .cookie("rememberMe", rememberMe ? "true" : "false", {
      ...baseCookieOptions,
      maxAge: refreshWindowMs,
    })
    .json({
      message: "User logged in successfully",
      user: {
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      expiresIn: ACCESS_EXP_MS / 1000,
    });
});

const logoutUser = asyncHandler(async (req, res) => {
  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;
  if (accessToken) {
    await prisma.blackListToken.create({
      data: {
        token: accessToken,
      },
    });
  }

  if (refreshToken) {
    await prisma.blackListToken.create({
      data: {
        token: refreshToken,
      },
    });
  }

  res.clearCookie("accessToken", baseCookieOptions);
  res.clearCookie("refreshToken", baseCookieOptions);
  res.clearCookie("rememberMe", baseCookieOptions);
  console.log("logged out successfully");
  return res.status(statusCode.Ok200).json({
    message: "user logged out successfully",
  });
});

const onboardUser = asyncHandler(async (req, res) => {
  // console.log("data", req.validateData)
  const { firstName, lastName, phoneNumber } = req.body;
  console.log("req", req.user);
  const userId = req.user?.userId;
  //   console.log("userId before casting:", userId)
  // console.log("isValidObjectId:", ObjectId.isValid(userId))
  if (!firstName || !lastName || !phoneNumber) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "All fields are required" });
  }

  const phoneRegex = /^[0-9]{10,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "Invalid phone number format" });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // where: { id: new ObjectId(userId) },
  if (!user) {
    return res
      .status(statusCode.NotFound404)
      .json({ message: "User not found" });
  }
  //   if (!firstName.trim() || !lastName.trim()) {
  //     return res
  //       .status(statusCode.BadRequest400)
  //       .json({ message: "First name and last name cannot be empty" });
  //   }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber,
    },
  });
  const { password, ...sanitizedUser } = updatedUser;

  return res
    .status(statusCode.Ok200)
    .json({ message: "User updated successfully", user: sanitizedUser });
});

const refreshTokenHandler = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token)
    return res
      .status(statusCode.Unauthorized401)
      .json({ message: "token not found" });

  const existing = await prisma.refreshToken.findUnique({ where: { token } });
  if (!existing || existing.revoked)
    return res
      .status(statusCode.Forbidden403)
      .json({ message: "Invalid or revoked refresh token" });

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user)
      return res
        .status(statusCode.NotFound404)
        .json({ message: "user not found" });

    const now = Date.now();
    if (existing.expiresAt.getTime() < now)
      return res
        .status(statusCode.Forbidden403)
        .json({ message: "refresh expired" });

    // Determine new window (sliding for rememberMe)
    let refreshWindowMs = existing.rememberMe
      ? LONG_REFRESH_MS
      : SHORT_REFRESH_MS;
    let newExpiresAt = new Date(now + refreshWindowMs);
    if (existing.rememberMe) {
      const capAt = existing.initialIssuedAt.getTime() + LONG_REFRESH_CAP_MS;
      if (newExpiresAt.getTime() > capAt) newExpiresAt = new Date(capAt);
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { token },
      data: { revoked: true, revokedAt: new Date() },
    });

    const accessToken = signAccess(user);
    const newRefreshToken = signRefresh(user, newExpiresAt.getTime() - now);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        createdAt: new Date(),
        expiresAt: newExpiresAt,
        initialIssuedAt: existing.initialIssuedAt,
        rotatedFrom: existing.id,
        rememberMe: existing.rememberMe,
        userAgent: req.headers["user-agent"] || undefined,
        ip: req.ip || req.connection?.remoteAddress || undefined,
      },
    });

    res
      .cookie("accessToken", accessToken, {
        ...baseCookieOptions,
        maxAge: ACCESS_EXP_MS,
      })
      .cookie("refreshToken", newRefreshToken, {
        ...baseCookieOptions,
        maxAge: newExpiresAt.getTime() - now,
      })
      .cookie("rememberMe", existing.rememberMe ? "true" : "false", {
        ...baseCookieOptions,
        maxAge: newExpiresAt.getTime() - now,
      });

    return res.status(statusCode.Ok200).json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_EXP_MS / 1000,
    });
  } catch (err) {
    return res
      .status(statusCode.Forbidden403)
      .json({ message: "Invalid token" });
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  onboardUser,
  refreshTokenHandler,
};
