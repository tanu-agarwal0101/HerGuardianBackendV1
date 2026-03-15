import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";

const authMiddleware = asyncHandler(async (req, res, next) => {
    let accessToken = req.cookies?.accessToken;

    // Also support Bearer token header (for non-cookie clients)
    if (!accessToken && req.headers.authorization?.startsWith("Bearer")) {
        accessToken = req.headers.authorization.split(" ")[1];
    }

    if (!accessToken) {
        return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });
    }
    
    const blacklistedToken = await prisma.blackListToken.findFirst({
        where: { token: accessToken }
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
        // Access token expired or invalid — let the client handle refresh
        // via the dedicated /users/refresh-token endpoint.
        return res.status(statusCode.Unauthorized401).json({
            message: "Access token expired or invalid"
        });
    }
});

export { authMiddleware };