import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function upsertUser({ email, password, firstName, lastName, phoneNumber }) {
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashed,
      firstName,
      lastName,
      phoneNumber,
    },
  });
  return user;
}

async function seed() {
  console.log('Seeding database...');

  const usersData = [
    {
      email: 'alice@example.com',
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Anderson',
      phoneNumber: '1112223333',
    },
    {
      email: 'bob@example.com',
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Brown',
      phoneNumber: '4445556666',
    },
  ];

  const users = [];
  for (const u of usersData) {
    const created = await upsertUser(u);
    users.push(created);
  }

  
  for (const user of users) {
    // Addresses
    await prisma.address.createMany({
      data: [
        {
          userId: user.id,
          type: 'home',
          city: 'Metropolis',
          country: 'Wonderland',
          latitude: 12.9716,
          longitude: 77.5946,
          radiusMeters: 200,
        },
        {
          userId: user.id,
          type: 'work',
          city: 'Gotham',
          country: 'Wonderland',
          latitude: 40.7128,
          longitude: -74.006,
          radiusMeters: 300,
        },
      ],
      skipDuplicates: true,
    });

    // Emergency contacts
    await prisma.emergencyContact.createMany({
      data: [
        {
          userId: user.id,
          name: 'Primary Contact',
          phoneNumber: '9998887777',
          relationship: 'Friend',
          email: 'primary@example.com',
        },
        {
          userId: user.id,
          name: 'Secondary Contact',
          phoneNumber: '9990001111',
          relationship: 'Sibling',
          email: 'secondary@example.com',
        },
      ],
      skipDuplicates: true,
    });

    // Example timer (inactive)
    await prisma.safetyTimer.create({
      data: {
        userId: user.id,
        duration: 30,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: false,
        sharedLocation: true,
        status: 'cancelled',
      },
    });

    // Example SOS log
    await prisma.sOSAlert.create({
      data: {
        userId: user.id,
        latitude: 12.34,
        longitude: 56.78,
        resolved: true,
      },
    });
  }

  console.log('Seeding completed.');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


