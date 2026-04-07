// __mocks__/prisma.js
import { jest } from "@jest/globals";
const mockPrisma = {
  user: {
    findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
  refreshToken: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
  blackListToken: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
    findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
  },
  emergencyContact: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
    delete: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
  address: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
    delete: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
  safetyTimer: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
    updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 0 })),
  },
  sosAlert: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
  verificationToken: {
    create: jest.fn().mockImplementation(() => Promise.resolve({})),
    findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
  },
};

export default mockPrisma;
