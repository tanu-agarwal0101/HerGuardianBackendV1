import Cron from "node-cron";
import prisma from "../utils/prisma.js";

Cron.schedule("* * * * *", async () => {
    const now = new Date();
    try{
        const expiredTimers = await prisma.safetyTimer.findMany({
            where:{
                isActive: true,
                expiresAt: {
                    lte: now,
                }
            },
            include:{
                user:{
                    user: {
                        include:{
                            emergencyContacts: true
                        }
                    }
                }
            }
        })
        
        for (const timer of expiredTimers){
            // 1. mark timer inactive
            await prisma.safetyTimer.update({
                where: {id: timer.id},
                data: {isActive: false}
            })

            // 2. get emergency contacts
            const contacts = timer.user.emergencyContacts;

            // 3. send alert
            console.log(`Safety Alert for ${timer.user.email}`)
            for(const contact of contacts){
                console.log(`Notify ${contact.name} with ${contact.phoneNumber} that user hasnt checked in`)
            }
        }
    } catch (e){
        console.error("Cron Job error", e)
    }
})