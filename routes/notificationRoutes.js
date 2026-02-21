import express from "express";
import { getVapidPublic, subscribe, sendTest } from "../controllers/notificationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/vapid-public", getVapidPublic);
router.post("/subscribe", authMiddleware, subscribe);
router.post("/send", authMiddleware, sendTest);

export default router;
