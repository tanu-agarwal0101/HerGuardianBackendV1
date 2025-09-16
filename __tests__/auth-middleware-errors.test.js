import { jest } from '@jest/globals';
import request from 'supertest';

const mockPrisma = {
  blackListToken: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
  },
};

await jest.unstable_mockModule('../utils/prisma.js', () => ({
  default: mockPrisma,
}));

const mockJwt = {
  sign: jest.fn(() => 'new.jwt'),
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};

await jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

const { default: app } = await import('../app.js');

describe('authMiddleware error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('401 when access token missing', async () => {
    const res = await request(app).get('/users/profile');
    expect(res.status).toBe(401);
  });

  test('401 when access token blacklisted', async () => {
    mockPrisma.blackListToken.findFirst.mockResolvedValueOnce({ id: 'bl-1' });
    const res = await request(app)
      .get('/users/profile')
      .set('Cookie', ['accessToken=bad.token']);
    expect(res.status).toBe(401);
  });

  test('403 when access expired and refresh expired too', async () => {
    mockPrisma.blackListToken.findFirst.mockResolvedValueOnce(null);
    
    mockJwt.verify
      .mockImplementationOnce(() => { const e = new Error('expired'); e.name = 'TokenExpiredError'; throw e; })
      .mockImplementationOnce(() => { const e = new Error('expired'); e.name = 'TokenExpiredError'; throw e; });

    const res = await request(app)
      .get('/users/profile')
      .set('Cookie', ['accessToken=expired', 'refreshToken=expired']);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/login again/i);
  });
});


