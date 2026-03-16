import Cron from "node-cron";
import prisma from "../utils/prisma.js";
import logger from "../utils/logger.js";

// Clean up blacklisted tokens once a day at midnight.
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
            logger.info({ count: deleted.count }, "Purged expired blacklist tokens");
        }
    } catch (error) {
        logger.error({ err: error }, "Failed to clean up expired blacklist tokens");
    }
});
