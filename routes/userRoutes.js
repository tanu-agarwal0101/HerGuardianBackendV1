import { Router } from "express";
import { getAllUsers, getProfile, updateStealth, sosTrigger } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import verifyAccessToken from "../middleware/verifyAccessTokenMiddleware.js";

const router = Router()

router.patch("/update-stealth", authMiddleware,updateStealth)

router.get("/profile", verifyAccessToken, getProfile)

router.get("/get-all-users", getAllUsers)

router.post("/sos-trigger", authMiddleware, sosTrigger)

export default router