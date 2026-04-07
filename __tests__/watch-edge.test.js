import { jest } from '@jest/globals';
import request from 'supertest';

await jest.unstable_mockModule("../utils/prisma.js", async () => {
  const mockPrismaInstance = (await import("../__mocks__/prisma.js")).default;
  return { default: mockPrismaInstance };
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

import mockPrisma from "../__mocks__/prisma.js";

const triggerSOS = jest.fn(async () => ({ id: 'sos-1' }));
await jest.unstable_mockModule('../utils/triggerSos.js', () => ({ triggerSOS }));

const { default: app } = await import('../app.js');

describe('Watch route edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test('triggers SOS when fallDetected true regardless of heart rate', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    const res = await request(app)
      .post('/watch/data')
      .set('Cookie', ['accessToken=mock.jwt.token'])
      .send({ userId: 'user-1', heartRate: 50, fallDetected: true, location: { lat: 1, lon: 2 } });
    expect(res.status).toBe(200);
    expect(triggerSOS).toHaveBeenCalled();
  });

  test('does not trigger SOS when below threshold and no fall', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    const res = await request(app)
      .post('/watch/data')
      .set('Cookie', ['accessToken=mock.jwt.token'])
      .send({ userId: 'user-1', heartRate: 50, fallDetected: false, location: { lat: 1, lon: 2 } });
    expect(res.status).toBe(200);
  });

  test('400 missing location fields', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    const res = await request(app)
      .post('/watch/data')
      .set('Cookie', ['accessToken=mock.jwt.token'])
      .send({ userId: 'user-1', heartRate: 50 });
    expect(res.status).toBe(400);
  });
});
