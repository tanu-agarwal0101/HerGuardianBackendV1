import crypto from "crypto";
import logger from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendGuardianInviteMail } from "../utils/emailService.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const inviteGuardian = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  let { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required to invite a Guardian." });
  }

  email = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.email.toLowerCase() === email) {
    return res.status(400).json({ message: "You cannot invite yourself as a guardian." });
  }
  const existingLink = await prisma.guardianLink.findFirst({
    where: {
      userId,
      OR: [
        { guardianEmail: email },
        { guardian: { email } }
      ]
    }
  });

  if (existingLink) {
    if (existingLink.status === "pending") {
       if (existingLink.expiresAt > new Date()) {
         return res.status(409).json({ message: "An invitation has already been sent to this email." });
       } else {
         await prisma.guardianLink.delete({ where: { id: existingLink.id } });
       }
    } else if (existingLink.status === "accepted") {
      return res.status(409).json({ message: "This person is already your designated guardian." });
    } else {
      await prisma.guardianLink.delete({ where: { id: existingLink.id } });
    }
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); 
  const guardianUser = await prisma.user.findUnique({ where: { email } });

  const guardianLink = await prisma.guardianLink.create({
    data: {
      userId,
      guardianId: guardianUser ? guardianUser.id : null,
      guardianEmail: email,
      token,
      expiresAt,
      status: "pending"
    }
  });

  const inviteUrl = `${FRONTEND_URL}/invite/guardian?token=${token}`;
  const inviterName = user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "A user";

  await sendGuardianInviteMail({ to: email, inviterName, inviteUrl });

  logger.info({ userId, linkId: guardianLink.id }, "Guardian invitation sent");
  return res.status(201).json({ message: "Invitation sent successfully." });
});

export const checkInviteToken = asyncHandler(async (req, res) => {
  const { token } = req.query;
  
  if (!token) return res.status(400).json({ message: "Token is required." });

  const link = await prisma.guardianLink.findUnique({
    where: { token },
    include: {
      user: { select: { firstName: true, lastName: true } }
    }
  });

  if (!link) return res.status(404).json({ message: "Invalid invitation link." });
  if (link.status === "accepted") return res.status(400).json({ message: "This invitation has already been accepted." });
  if (link.status === "rejected") return res.status(400).json({ message: "This invitation was previously rejected." });
  if (new Date() > link.expiresAt) return res.status(400).json({ message: "This invitation has expired." });

  return res.json({
    inviter: {
      firstName: link.user.firstName,
      lastName: link.user.lastName
    }
  });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const guardianUserId = req.user.userId;
  const { token } = req.body;

  if (!token) return res.status(400).json({ message: "Token is required." });

  const link = await prisma.guardianLink.findUnique({ where: { token } });

  if (!link) return res.status(404).json({ message: "Invalid invitation link." });
  if (link.status === "accepted") return res.status(400).json({ message: "Invitation already accepted." });
  if (link.status === "rejected") return res.status(400).json({ message: "Invitation was rejected." });
  if (new Date() > link.expiresAt) return res.status(400).json({ message: "Invitation has expired." });

  const existing = await prisma.guardianLink.findFirst({
    where: {
      userId: link.userId,
      guardianId: guardianUserId,
      status: "accepted"
    }
  });

  if (existing) {
     await prisma.guardianLink.delete({ where: { id: link.id } });
     return res.json({ message: "You are already a guardian for this user." });
  }

  await prisma.$transaction([
    prisma.guardianLink.update({
      where: { id: link.id },
      data: {
        status: "accepted",
        guardianId: guardianUserId
      }
    }),
    prisma.user.update({
      where: { id: guardianUserId },
      data: { role: "guardian" } 
    })
  ]);

  logger.info({ guardianUserId, linkId: link.id }, "Guardian invitation accepted");
  return res.json({ message: "Invitation accepted successfully. You are now a Guardian." });
});

export const rejectInvite = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "Token is required." });

  const link = await prisma.guardianLink.findUnique({ where: { token } });
  if (!link) return res.status(404).json({ message: "Invalid invitation link." });
  if (link.status === "accepted") return res.status(400).json({ message: "Cannot reject an accepted invitation." });
  if (link.status === "rejected") return res.status(400).json({ message: "Invitation already rejected." });

  await prisma.guardianLink.update({
    where: { id: link.id },
    data: { status: "rejected" }
  });

  return res.json({ message: "Invitation rejected." });
});

export const revokeLink = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  const link = await prisma.guardianLink.findUnique({ where: { id } });
  if (!link) return res.status(404).json({ message: "Guardian link not found." });

  if (link.userId !== userId && link.guardianId !== userId) {
    return res.status(403).json({ message: "Forbidden. Cannot revoke this link." });
  }

  await prisma.guardianLink.delete({ where: { id } });

  logger.info({ userId, linkId: id }, "Guardian link revoked");
  return res.json({ message: "Guardian privileges revoked." });
});

export const getGuardianDashboardUsers = asyncHandler(async (req, res) => {
  const guardianId = req.user.userId;

  const links = await prisma.guardianLink.findMany({
    where: {
      guardianId,
      status: "accepted"
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          lastActiveAt: true,
          sosAlerts: {
            where: { resolved: false },
            select: { id: true }
          },
          sosTrackingSessions: {
            where: { status: "active" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { token: true }
          },
          deviceStatus: true
        }
      }
    }
  });

  const dashboardUsers = links.map(link => {
    const u = link.user;
    const hasActiveSOS = u.sosAlerts.length > 0;
    const activeSOSToken = hasActiveSOS && u.sosTrackingSessions.length > 0 ? u.sosTrackingSessions[0].token : null;
    
    let deviceData = null;
    if (u.deviceStatus) {
       const ageInMs = Date.now() - new Date(u.deviceStatus.updatedAt).getTime();
       if (ageInMs < 10 * 60 * 1000) {
         deviceData = {
           batteryLevel: u.deviceStatus.batteryLevel,
           isCharging: u.deviceStatus.isCharging,
           isOnline: u.deviceStatus.isOnline,
           connectionType: u.deviceStatus.connectionType
         };
       }
    }

    return {
      linkId: link.id,
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      profilePicture: u.profilePicture,
      lastActiveAt: u.lastActiveAt,
      hasActiveSOS,
      activeSOSToken,
      deviceStatus: deviceData
    };
  });

  return res.json(dashboardUsers);
});

export const getSentInvites = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const links = await prisma.guardianLink.findMany({
    where: { userId, status: { in: ["pending", "accepted"] } },
    select: {
      id: true,
      guardianEmail: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      guardian: { select: { firstName: true, lastName: true, profilePicture: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(links);
});
