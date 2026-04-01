import { Router } from "express";
import {
  getProfile,
  updateStealth,
  sosTrigger,
  getSOSLogs,
  getStealth,
  verifyStealthPin,
  updateVoiceSettings,
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { rateLimiterLib } from "../utils/rateLimiter.js";
import { validateSchema } from "../utils/validators.js";
import { updateStealthSchema } from "../schemas/stealth.js";
import { sosTriggerSchema } from "../schemas/sos.js";

const router = Router();

router.patch("/update-stealth", authMiddleware, validateSchema(updateStealthSchema), updateStealth);
router.patch("/update-voice-settings", authMiddleware, updateVoiceSettings);
router.get("/stealth-settings", authMiddleware, getStealth);
router.post("/verify-stealth-pin", rateLimiterLib, authMiddleware, verifyStealthPin);

router.get("/profile", authMiddleware, getProfile);

router.post("/sos-trigger", rateLimiterLib, authMiddleware, validateSchema(sosTriggerSchema), sosTrigger);

router.get("/get-sos-logs", authMiddleware, getSOSLogs);

export default router;
