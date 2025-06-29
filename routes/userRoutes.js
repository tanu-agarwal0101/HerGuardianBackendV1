import { Router } from "express";
import { getAllUsers, getProfile, updateStealth } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import verifyAccessToken from "../middleware/verifyAccessTokenMiddleware.js";

const router = Router()


router.patch("/update-stealth", authMiddleware,updateStealth)

router.post("/profile", verifyAccessToken, getProfile)

router.get("/get-all-users", getAllUsers)



export default router