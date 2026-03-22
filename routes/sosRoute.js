import express from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getTrackingSession,
  pushSOSLocation,
  resolveSOSSession,
  getActiveSession,
} from "../controllers/sosController.js";

const router = express.Router();

const trackRateLimiter = rateLimit({
  windowMs: 60 * 1000,  
  max: 20,              
  message: "Too many tracking requests. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/track/:token", trackRateLimiter, getTrackingSession);

// Authenticated routes
router.get("/active", authMiddleware, getActiveSession);
router.post("/location", authMiddleware, pushSOSLocation);
router.post("/resolve", authMiddleware, resolveSOSSession);

export default router;
