import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";

const verifyAccessToken = asyncHandler(async(req, res, next)=>{
    let token = req.cookies.accessToken;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if(!token){
        return res.status(statusCode.Unauthorized401).json({
            message: "access token missing"
        })
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    const user = await prisma.user.findUnique({
        where: {id: decoded.userId}
    })

    if(!user){
        return res.status(statusCode.NotFound404).json({ message: "User not found" });
    }

    req.user = user;
    next();
})

export default verifyAccessToken;