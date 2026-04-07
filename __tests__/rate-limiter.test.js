import { jest } from '@jest/globals';
jest.mock("../utils/prisma.js");
import request from 'supertest';

await jest.unstable_mockModule("../utils/prisma.js", async () => {
  const mockPrisma = {
  user: {
    findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
    update: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
  blackListToken: {
    findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
  },
};
  return { default: mockPrisma };
});


await jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn(() => "new.access"),
    verify: jest.fn((token) => {
      if (token === "bad") throw new Error("invalid");
      return { userId: "user-1", email: "user@example.com" };
    }),
  },
}));

const { default: app } = await import("../app.js");

import mockPrisma from "../__mocks__/prisma.js";


describe('Rate limiter basic behavior (smoke)', () => {
  test('does not block single SOS request', async () => {
    const res = await request(app)
      .post('/users/sos-trigger')
      .send({ latitude: 1, longitude: 2 });
    expect([200, 400, 401]).toContain(res.status);
  });
});


