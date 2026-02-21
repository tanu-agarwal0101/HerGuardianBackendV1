import { Router } from "express";
import {
  cancelSafetyTimer,
  startSafetyTimer,
  getTimerDetails,
} from "../controllers/timerController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateSchema } from "../utils/validators.js";
import { startTimerSchema, cancelTimerSchema } from "../schemas/timer.js";

const router = Router();

router.post("/start", authMiddleware, validateSchema(startTimerSchema), startSafetyTimer);
router.patch("/cancel", authMiddleware, validateSchema(cancelTimerSchema), cancelSafetyTimer);
router.get("/:timerId/details", authMiddleware, getTimerDetails);

export default router;
