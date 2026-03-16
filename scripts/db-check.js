import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

async function main() {
  logger.info('Testing DB connection...');
  const start = Date.now();
  try {
    const count = await prisma.user.count();
    const duration = Date.now() - start;
    logger.info({ count, durationMs: duration }, "Connection successful!");
  } catch (e) {
    logger.error({ err: e }, 'DB Connection failed');
  } finally {
    await prisma.$disconnect();
  }
}

main();
