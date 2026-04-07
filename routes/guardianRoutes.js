import express from "express";
import { authMiddleware} from "../middleware/authMiddleware.js";
import {
  inviteGuardian,
  checkInviteToken,
  acceptInvite,
  rejectInvite,
  revokeLink,
  getGuardianDashboardUsers,
  getSentInvites
} from "../controllers/guardianController.js";

const router = express.Router();

router.post("/invite", authMiddleware, inviteGuardian);
router.get("/invites/sent", authMiddleware, getSentInvites);
router.delete("/link/:id", authMiddleware, revokeLink);
router.get("/invite/check", checkInviteToken); 
router.patch("/reject", rejectInvite); 
router.patch("/accept", authMiddleware, acceptInvite); 
router.get("/dashboard", authMiddleware, getGuardianDashboardUsers);

export default router;
