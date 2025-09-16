import Cron from "node-cron";
import prisma from "../utils/prisma.js";

Cron.schedule("* * * * *", async () => {
  const now = new Date();
  try {
    const expiredTimers = await prisma.safetyTimer.findMany({
      where: {
        isActive: true,
        expiresAt: { lte: now },
      },
      include: {
        user: {
          include: {
            emergencyContacts: true,
          },
        },
      },
    });

    for (const timer of expiredTimers) {
      // Step 1: Mark timer as escalated
      await prisma.safetyTimer.update({
        where: { id: timer.id },
        data: {
          isActive: false,
          status: "escalated", 
        },
      });

      const user = timer.user;
      const contacts = user.emergencyContacts;

      // Step 2: Trigger SOS Alert
      const sos = await prisma.sOSAlert.create({
        data: {
          userId: user.id,
          latitude: timer.latitude || 0,
          longitude: timer.longitude || 0,
          triggeredAt: new Date(),
          resolved: false,
        },
      });

      // Step 3: Notify Contacts (optional)
      for (const contact of contacts) {
        console.log(
          `🚨 Escalated SOS: Notify ${contact.name} at ${contact.email || contact.phoneNumber}`
        );
        // Send email logic if you want
      }
    }
  } catch (e) {
    console.error("Cron Job error", e);
  }
});
