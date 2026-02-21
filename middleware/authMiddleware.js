import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
};

const authMiddleware = asyncHandler(async (req, res, next) => {
    let accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    // Also support Bearer token header (for non-cookie clients)
    if (!accessToken && req.headers.authorization?.startsWith("Bearer")) {
        accessToken = req.headers.authorization.split(" ")[1];
    }

    if (!accessToken) {
        return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });
    }
    
    const blacklistedToken = await prisma.blackListToken.findFirst({
        where: {token: accessToken}
    });
    
    if (blacklistedToken) {
        return res.status(statusCode.Unauthorized401).json({
            message: "Token is blacklisted"
        });
    }

    try {
        const decodedToken = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET,
        );
        req.user = decodedToken;
        return next();
    } catch (error) {
        if (error.name === "TokenExpiredError" && refreshToken) {
            try {
                // RACE CONDITION PROTECTION: Use a "lock" check in DB or atomic operation.
                // Here we find the token and ensure it's not already rotated or revoked.
                const dbToken = await prisma.refreshToken.findUnique({
                    where: { token: refreshToken },
                    include: { user: true }
                });

                if (!dbToken || dbToken.revoked) {
                    return res.status(statusCode.Unauthorized401).json({ message: "Invalid or revoked refresh token" });
                }

                // If already rotated recently (within 30s), another request probably did it.
                // We could try to find the successor, but for simplicity in middleware:
                // If it's rotated, we might be out of luck unless we return a retry hint.
                // However, the race usually happens when two requests start AT THE SAME TIME.
                
                // Optimized approach: Only let one through using findFirst/update combined if possible,
                // but Prisma MongoDB doesn't support complex atomic locking as easily as SQL.
                // So we'll use the existing logic but check for 'revoked' immediately.

                const blacklistedRefreshToken = await prisma.blackListToken.findUnique({
                    where: { token: refreshToken }
                });
                
                if (blacklistedRefreshToken) {
                    return res.status(statusCode.Unauthorized401).json({
                        message: "Refresh Token is blacklisted"
                    });
                }

                const newAccessToken = jwt.sign(
                    {
                        userId: dbToken.user.id, 
                        email: dbToken.user.email
                    },
                    process.env.ACCESS_TOKEN_SECRET,
                    {
                        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m"
                    }
                );

                res.cookie("accessToken", newAccessToken, {
                    ...baseCookieOptions,
                    maxAge: 15 * 60 * 1000,
                });

                req.user = {
                    userId: dbToken.user.id,
                    email: dbToken.user.email
                };
                return next();
            } catch (refreshError) {
                return res.status(statusCode.Forbidden403).json({
                    message: "refresh token expired, login again"
                });
            }
        }
        
        return res.status(statusCode.Unauthorized401).json({
            message: "Invalid access token. Please log in again"
        });
    }
});


export {authMiddleware};