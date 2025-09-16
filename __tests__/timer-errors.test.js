import { jest } from '@jest/globals';
import request from 'supertest';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  safetyTimer: { updateMany: jest.fn() },
  blackListToken: { findFirst: jest.fn() },
};
await jest.unstable_mockModule('../utils/prisma.js', () => ({ default: mockPrisma }));

const mockJwt = { verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })) };
await jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));

const { default: app } = await import('../app.js');

describe('Timer error cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test('PATCH /timer/cancel -> 404 when no active timers', async () => {
    mockPrisma.safetyTimer.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await request(app)
      .patch('/timer/cancel')
      .set('Cookie', ['accessToken=jwt'])
      .send({ status: 'cancelled' });
    expect(res.status).toBe(404);
  });
});


