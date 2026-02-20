import express from "express";
import { getVapidPublic, subscribe, sendTest } from "../controllers/notificationController.js";
import  verifyAccessToken  from "../middleware/verifyAccessTokenMiddleware.js";

const router = express.Router();

router.get("/api/notifications/vapid-public", getVapidPublic);
router.post("/api/notifications/subscribe", verifyAccessToken, subscribe);
router.post("/api/notifications/send", verifyAccessToken, sendTest);

export default router;


