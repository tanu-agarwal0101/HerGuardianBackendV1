import { Router } from "express";
import { cancelSafetyTimer, startSafetyTimer } from "../controllers/timerController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();


router.post("/start", startSafetyTimer)
router.patch("/cancel", cancelSafetyTimer)



export default router