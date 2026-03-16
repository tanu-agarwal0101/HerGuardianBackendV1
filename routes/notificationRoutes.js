import express from "express";
import { getVapidPublic, subscribe, sendTest } from "../controllers/notificationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateSchema } from "../utils/validators.js";
import { subscribeSchema } from "../schemas/notification.js";

const router = express.Router();

router.get("/vapid-public", getVapidPublic);
router.post("/subscribe", authMiddleware, validateSchema(subscribeSchema), subscribe);
router.post("/send", authMiddleware, sendTest);

export default router;
