import { Router } from "express";
import { logLocation, getRecent } from "../controllers/locationController.js";
import verifyAccessToken from "../middleware/verifyAccessTokenMiddleware.js";

const router = Router();

router.post("/api/locations/log", verifyAccessToken, logLocation);
router.get("/api/locations/recent", verifyAccessToken, getRecent);

export default router;

