import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import prisma from "../utils/prisma.js";

dotenv.config();

const url = process.env.DATABASE_URL;

function maskUrl(u) {
  if (!u) return "";
  try {
    const obj = new URL(u);
    if (obj.password) obj.password = "****";
    return obj.toString();
  } catch {
    return u.replace(/:\w+@/, ":****@");
  }
}

async function testMongoDriver() {
  if (!url) throw new Error("DATABASE_URL not set");
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 8000 });
  const start = Date.now();
  try {
    await client.db().command({ ping: 1 });
    const ms = Date.now() - start;
    console.log(`[mongo-driver] ping ok in ${ms}ms`);
  } finally {
    await client.close().catch(() => {});
  }
}

async function testPrismaPing() {
  const start = Date.now();
  await prisma.$runCommandRaw({ ping: 1 });
  const ms = Date.now() - start;
  console.log(`[prisma] ping ok in ${ms}ms`);
}

async function main() {
  console.log("DATABASE_URL:", maskUrl(url));
  try {
    await testMongoDriver();
  } catch (e) {
    console.error("[mongo-driver] ping failed:", e?.message || e);
  }
  try {
    await testPrismaPing();
  } catch (e) {
    console.error("[prisma] ping failed:", e?.message || e);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error("db-check error", e);
  process.exit(1);
});
