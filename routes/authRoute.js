import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
    loginUser, logoutUser, registerUser, onboardUser,
    refreshTokenHandler
} from "../controllers/authController.js";
import { validateSchema } from "../utils/validators.js";
import { registerSchema, loginSchema, onboardSchema } from "../schemas/auth.js";
import verifyAccessToken from "../middleware/verifyAccessTokenMiddleware.js";

const router = Router();
router.post("/register", validateSchema(registerSchema), registerUser)
router.post("/login", validateSchema(loginSchema), loginUser)
router.post("/logout", authMiddleware, logoutUser)
// router.route("/logout").post(logoutUser);
router.patch("/onboard", authMiddleware, validateSchema(onboardSchema), onboardUser)

router.post("/refresh-token", verifyAccessToken, refreshTokenHandler)

export default router;