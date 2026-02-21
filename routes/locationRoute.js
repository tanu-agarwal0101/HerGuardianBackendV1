import { Router } from "express";
import { logLocation, getRecent } from "../controllers/locationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/api/locations/log", authMiddleware, logLocation);
router.get("/api/locations/recent", authMiddleware, getRecent);

export default router;
