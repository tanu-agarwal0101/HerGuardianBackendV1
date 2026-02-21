import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { watchPullData } from "../controllers/watchController.js";
import { validateSchema } from "../utils/validators.js";
import { watchDataSchema } from "../schemas/watch.js";

const router = Router();

router.post("/data", authMiddleware, validateSchema(watchDataSchema), watchPullData);

export default router;
