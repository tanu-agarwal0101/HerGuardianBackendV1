import { Router } from "express";
import {
  cancelSafetyTimer,
  startSafetyTimer,
} from "../controllers/timerController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/start", authMiddleware, startSafetyTimer);
router.patch("/cancel", authMiddleware, cancelSafetyTimer);

export default router;
