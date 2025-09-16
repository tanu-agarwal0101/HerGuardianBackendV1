import { Router } from "express";
import { getAllUsers, getProfile, updateStealth, sosTrigger, getSOSLogs } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import verifyAccessToken from "../middleware/verifyAccessTokenMiddleware.js";
import { rateLimiterLib } from "../utils/rateLimiter.js";

const router = Router()

router.patch("/update-stealth", authMiddleware,updateStealth)

router.get("/profile", authMiddleware, getProfile)

router.get("/get-all-users", getAllUsers)

router.post("/sos-trigger", rateLimiterLib,authMiddleware, sosTrigger)

router.get("/get-sos-logs", authMiddleware, getSOSLogs)

export default router