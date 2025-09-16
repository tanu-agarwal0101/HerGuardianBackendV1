// __mocks__/prisma.js
import { jest } from "@jest/globals";
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  blackListToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  emergencyContact: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  address: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  safetyTimer: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  sosAlert: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  verificationToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

export default mockPrisma;
