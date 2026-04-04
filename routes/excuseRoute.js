import express from "express";
import { generateExcuse } from "../controllers/excuseController.js";
import {authMiddleware} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, generateExcuse);

export default router;
