
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing DB connection...');
  const start = Date.now();
  try {
    const count = await prisma.user.count();
    const duration = Date.now() - start;
    console.log(`Connection successful! Found ${count} users.`);
    console.log(`Query took ${duration}ms`);
  } catch (e) {
    console.error('DB Connection failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
