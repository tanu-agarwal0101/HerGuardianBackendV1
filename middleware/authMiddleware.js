import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";

const authMiddleware = asyncHandler(async (req, res, next) => {
    // console.log("cook", req.cookies)
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;
    // console.log(Object.keys(prisma));

    // console.log("access", accessToken)
    // console.log("refresh", refreshToken)
    if (!accessToken) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const blacklistedToken = await prisma.blackListToken.findFirst({
        where: {token: accessToken}
    })
    
    if(blacklistedToken){
        return res.status(statusCode.Unauthorized401).json({
            message: "Token is blacklisted"
        })
    }
    try {
        
        const decodedToken = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET,
        )
        req.user = decodedToken;
        return next();
    } catch (error) {
        if(error.name === "TokenExpiredError" && refreshToken){
            try {
                const decodedRefreshToken = jwt.verify(
                    refreshToken,
                    process.env.REFRESH_TOKEN_SECRET,
                )
                
                const blacklistedRefreshToken = await  prisma.blackListToken.findUnique({
                    where: {token: refreshToken}
                })
                
                if(blacklistedRefreshToken){
                    return res.status(statusCode.Unauthorized401).json({
                        message: "Refresh Token is blacklisted"
                    })
                }
                const dbToken = await prisma.refreshToken.findUnique({
                    where: {token: refreshToken},
                    include: {user: true}
                })
                if(!dbToken){
                    return res.status(statusCode.Unauthorized401)
                    .json({message: "Invalid refresh token"})
                }
                const newAccessToken = jwt.sign(
                    {
                        userId: dbToken.user.id, 
                        email: dbToken.user.email
                    },
                    process.env.ACCESS_TOKEN_SECRET,
                    {
                        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
                    }
                )

                res.cookie("accessToken",
                    newAccessToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "Strict",
                    }
                )
                req.user = {
                    userId: dbToken.user.id,
                    email: dbToken.user.email
                }
                return next()
            } catch (error) {
                return res.status(statusCode.Forbidden403).json({
                    message: "refresh token expired, login again"
                })
            }
        }
        
        return res.status(statusCode.Unauthorized401).json({
            message: "Invalid access token. Please log in again"
        })
    }

})


export {authMiddleware}