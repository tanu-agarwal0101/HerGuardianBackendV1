import prisma from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { randomUUID, randomBytes } from "crypto";
import { sendVerificationMail } from "../utils/emailService.js";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};
const min = (n) => n * 60 * 1000;
const hr = (n) => n * 60 * 60 * 1000;
const day = (n) => n * 24 * 60 * 60 * 1000;
const parseMs = (val, fallback) => {
  const v = (val || "").trim() || fallback;
  const num = parseInt(v);
  if (v.endsWith("m")) return min(num);
  if (v.endsWith("h")) return hr(num);
  if (v.endsWith("d")) return day(num);
  return num; 
};

const ACCESS_EXP_MS = parseMs(process.env.ACCESS_TOKEN_EXPIRY, "15m");
const SHORT_REFRESH_MS = parseMs(process.env.REFRESH_TOKEN_EXPIRY, "24h");
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
      jwtid: randomUUID(),
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
  const { email, password, rememberMe } = req.validateData;
  const normalizedEmail = email.trim().toLowerCase();


  let existingUser;
  try {
    existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  } catch (e) {
    if (
      e?.code === "P2010" ||
      /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
    ) {
      return res
        .status(503)
        .json({ message: "Database unreachable. Please try again shortly." });
    }
    throw e;
  }
  if (existingUser) {
    return res
      .status(409)
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
    if (
      e?.code === "P2010" ||
      /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
    ) {
      return res
        .status(503)
        .json({ message: "Database unreachable. Please try again shortly." });
    }
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ message: "User already exists" });
    }
    throw e;
  }


  const vToken = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token: vToken,
      type: "EMAIL_VERIFICATION",
      expiresAt,
    },
  });

  // Send email
  await sendVerificationMail({
    to: user.email,
    userName: user.firstName,
    otp: vToken,
  });

  return res
    .status(201)
    .json({
      message: "Registration successful. Please check your email to verify your account.",
      user: { id: user.id, email: user.email },
    });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.validateData;
  const normalizedEmail = email?.trim().toLowerCase();
  
  if (!normalizedEmail || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required" });
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  } catch (e) {
    // ... existing error handling
    if (
      e?.code === "P2010" ||
      /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
    ) {
      return res
        .status(503)
        .json({ message: "Database unreachable. Please try again shortly." });
    }
    throw e;
  }

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  if (!user.isEmailVerified) {
    return res.status(403).json({
      message: "Please verify your email address before logging in.",
      isVerified: false
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  const ua = req.headers["user-agent"] || null;
  const ip = req.ip || req.connection?.remoteAddress || null;
  let accessToken, refreshToken, refreshWindowMs;
  
  try {
    const toks = await generateTokens(user, rememberMe, ua, ip);
    accessToken = toks.accessToken;
    refreshToken = toks.refreshToken;
    refreshWindowMs = toks.refreshWindowMs;
  } catch (e) {

      if (
      e?.code === "P2010" ||
      /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
    ) {
      return res
        .status(503)
        .json({ message: "Database unreachable. Please try again shortly." });
    }
    throw e;
  }

  res
    .status(200)
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
      httpOnly: false, // Allow client to read this preference
      maxAge: refreshWindowMs,
    })
    .cookie("isAuthenticated", "true", {
      ...baseCookieOptions,
      httpOnly: false,
      maxAge: refreshWindowMs,
    });

    // --- Hardening: Manage Stealth Cookies ---
    // 1. Clear any old session
    // 1. Clear any old session
    res.cookie("stealthSession", "", { ...baseCookieOptions, maxAge: 0, expires: new Date(0), httpOnly: false });
    // Also clear without SameSite just in case
    res.cookie("stealthSession", "", { ...baseCookieOptions, sameSite: undefined, maxAge: 0, expires: new Date(0), httpOnly: false });

    // 2. Set Stealth Cookies from User object
    if (user.stealthMode !== undefined) { // Check if field exists
         res.cookie("stealthMode", user.stealthMode ? "true" : "false", {
            ...baseCookieOptions,
            httpOnly: false,
            maxAge: LONG_REFRESH_MS, // Persist config
         });
         res.cookie("stealthType", user.stealthType || "calculator", {
            ...baseCookieOptions,
            httpOnly: false,
            maxAge: LONG_REFRESH_MS,
         });
    }

    // Short-lived flag: tells frontend middleware to skip stealth redirect
    // after a fresh login. Expires in 10 seconds (auto-cleanup).
    res.cookie("justLoggedIn", "true", {
      ...baseCookieOptions,
      httpOnly: false,
      maxAge: 10 * 1000,
    });

    return res.json({
      message: "User logged in successfully",
      user: {
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        stealthMode: user.stealthMode,
        stealthType: user.stealthType,
        dashboardPass: user.dashboardPass,
        sosPass: user.sosPass,
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
        expiresAt: new Date(Date.now() + ACCESS_EXP_MS),
      },
    });
  }

  if (refreshToken) {
    await prisma.blackListToken.create({
      data: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + LONG_REFRESH_MS),
      },
    });
  }

  const clearOptions = {
    ...baseCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  };
  
  res.cookie("accessToken", "", clearOptions);
  res.cookie("refreshToken", "", clearOptions);
  res.cookie("rememberMe", "", clearOptions);

  // Clear Strict variants too
  const strictOptions = { ...clearOptions, sameSite: "Strict" };
  res.cookie("accessToken", "", strictOptions);
  res.cookie("refreshToken", "", strictOptions);
  res.cookie("rememberMe", "", strictOptions);

  // Clear frontend-facing stealth cookies
  res.cookie("stealthMode", "", { ...clearOptions, httpOnly: false });
  res.cookie("stealthType", "", { ...clearOptions, httpOnly: false });
  res.cookie("stealthSession", "", { ...clearOptions, httpOnly: false });
  res.cookie("justLoggedIn", "", { ...clearOptions, httpOnly: false });
  res.cookie("isAuthenticated", "", { ...clearOptions, httpOnly: false });
  res.cookie("stealthMode", "", { ...strictOptions, httpOnly: false });
  res.cookie("stealthType", "", { ...strictOptions, httpOnly: false });
  res.cookie("stealthSession", "", { ...strictOptions, httpOnly: false });

  return res.status(200).json({
    message: "user logged out successfully",
  });
});


const onboardUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber } = req.body;
  const userId = req.user?.userId;
  if (!firstName || !lastName || !phoneNumber) {
    return res
      .status(400)
      .json({ message: "All fields are required" });
  }

  const phoneRegex = /^[0-9]{10,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res
      .status(400)
      .json({ message: "Invalid phone number format" });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // where: { id: new ObjectId(userId) },
  if (!user) {
    return res
      .status(404)
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
    .status(200)
    .json({ message: "User updated successfully", user: sanitizedUser });
});

const refreshTokenHandler = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token)
    return res
      .status(401)
      .json({ message: "token not found" });

  let existing;
  try {
    existing = await prisma.refreshToken.findUnique({ where: { token } });
  } catch (e) {
    if (
      e?.code === "P2010" ||
      /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
    ) {
      return res
        .status(503)
        .json({ message: "Database unreachable. Please try again shortly." });
    }
    throw e;
  }
  if (!existing) {
    return res
      .status(403)
      .json({ message: "Invalid or revoked refresh token" });
  }

  if (existing.revoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    return res
      .status(403)
      .json({ message: "Refresh token reuse detected. All sessions revoked." });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
    } catch (e) {
      if (
        e?.code === "P2010" ||
        /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
      ) {
        return res
          .status(503)
          .json({ message: "Database unreachable. Please try again shortly." });
      }
      throw e;
    }
    if (!user)
      return res
        .status(403)
        .json({ message: "Invalid or revoked refresh token" });

    const now = Date.now();
    if (existing.expiresAt.getTime() < now)
      return res
        .status(403)
        .json({ message: "refresh expired" });

    let refreshWindowMs = existing.rememberMe
      ? LONG_REFRESH_MS
      : SHORT_REFRESH_MS;
    let newExpiresAt = new Date(now + refreshWindowMs);
    if (existing.rememberMe) {
      const capAt = existing.initialIssuedAt.getTime() + LONG_REFRESH_CAP_MS;
      if (newExpiresAt.getTime() > capAt) newExpiresAt = new Date(capAt);
    }

    try {
      await prisma.refreshToken.update({
        where: { token },
        data: { revoked: true, revokedAt: new Date() },
      });
    } catch (e) {
      if (
        e?.code === "P2010" ||
        /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
      ) {
        return res
          .status(503)
          .json({ message: "Database unreachable. Please try again shortly." });
      }
      throw e;
    }

    const accessToken = signAccess(user);
    const newRefreshToken = signRefresh(user, newExpiresAt.getTime() - now);
    try {
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
    } catch (e) {
      if (
        e?.code === "P2010" ||
        /Server selection timeout/i.test(String(e?.meta?.message || e?.message))
      ) {
        return res
          .status(503)
          .json({ message: "Database unreachable. Please try again shortly." });
      }
      throw e;
    }

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
        httpOnly: false,
        maxAge: newExpiresAt.getTime() - now,
      })
      .cookie("isAuthenticated", "true", {
        ...baseCookieOptions,
        httpOnly: false,
        maxAge: newExpiresAt.getTime() - now,
      });

    return res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_EXP_MS / 1000,
    });
  } catch (err) {
    return res
      .status(403)
      .json({ message: "Invalid token" });
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  onboardUser,
  refreshTokenHandler,
  generateTokens,
  baseCookieOptions,
  ACCESS_EXP_MS,
  LONG_REFRESH_MS
};
