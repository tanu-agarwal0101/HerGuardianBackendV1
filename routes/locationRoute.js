import { Router } from "express";
import { logLocation, getRecent } from "../controllers/locationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateSchema } from "../utils/validators.js";
import { logLocationSchema } from "../schemas/location.js";

const router = Router();

router.post("/api/locations/log", authMiddleware, validateSchema(logLocationSchema), logLocation);
router.get("/api/locations/recent", authMiddleware, getRecent);

export default router;
