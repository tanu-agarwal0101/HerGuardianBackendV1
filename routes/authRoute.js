import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
    loginUser, logoutUser, registerUser, onboardUser
} from "../controllers/authController.js";
import { validateSchema } from "../utils/validators.js";
import { registerSchema, loginSchema, onboardSchema } from "../schemas/auth.js";

const router = Router();
router.post("/register", validateSchema(registerSchema), registerUser)
router.post("/login", validateSchema(loginSchema), loginUser)
router.post("/logout", authMiddleware, logoutUser)
// router.route("/logout").post(logoutUser);
router.patch("/onboard", authMiddleware, validateSchema(onboardSchema), onboardUser)

export default router;