import Cron from "node-cron";
import prisma from "../utils/prisma.js";

// Clean up blacklisted tokens once a day at midnight.
// Tokens should stay in blacklist until they would have naturally expired.
// Since we don't store expiry in BlackListToken, we clean tokens older than 90 days.
Cron.schedule("0 0 * * *", async () => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
        const deleted = await prisma.blackListToken.deleteMany({
            where: {
                createdAt: {
                    lt: ninetyDaysAgo,
                },
            },
        });
        if (deleted.count > 0) {
            // Silently log in debug/dev if needed, but keeping it clean for prod.
        }
    } catch (error) {
        // Silent fail for cron tasks
    }
});
