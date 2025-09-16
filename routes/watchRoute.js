import { Router } from "express";

import { watchPullData } from "../controllers/watchController.js";

const router = Router();

router.post("/data", watchPullData);

export default router;
