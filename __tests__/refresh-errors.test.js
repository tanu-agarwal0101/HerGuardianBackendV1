import { jest } from '@jest/globals';
import request from 'supertest';

await jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn((token, secret) => {
      if (token === 'bad') throw new Error('invalid');
      return { userId: 'user-1', email: 'user@example.com' };
    }),
    sign: jest.fn(() => 'new.access'),
  },
}));

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
await jest.unstable_mockModule('../utils/prisma.js', () => ({ default: mockPrisma }));

const { default: app } = await import('../app.js');

describe('refresh-token errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('401 when refresh token missing', async () => {
    const res = await request(app).post('/users/refresh-token');
    expect(res.status).toBe(401);
  });

  test('404 when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/users/refresh-token')
      .set('Cookie', ['refreshToken=ok']);
    expect(res.status).toBe(404);
  });

  test('403 when refresh token invalid', async () => {
    const res = await request(app)
      .post('/users/refresh-token')
      .set('Cookie', ['refreshToken=bad']);
    expect(res.status).toBe(403);
  });
});


