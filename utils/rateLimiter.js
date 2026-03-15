import rateLimit from "express-rate-limit";

export const rateLimiterLib = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: "too many alerts triggered. please wait a few minutes"
});

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many authentication attempts. Please wait 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
});

export const refreshRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // Allows normal refresh cycling (15-min access tokens = ~1 refresh/15min); blocks brute-force
    message: "Too many token refresh attempts. Please wait.",
    standardHeaders: true,
    legacyHeaders: false,
});

export const verifyRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: "Too many verification attempts. Please wait 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
});

export const globalRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
});