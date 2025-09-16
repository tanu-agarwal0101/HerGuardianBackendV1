import { jest } from '@jest/globals';
import request from 'supertest';

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  refreshToken: { create: jest.fn() },
};

await jest.unstable_mockModule('../utils/prisma.js', () => ({ default: mockPrisma }));

const mockBcrypt = { hash: jest.fn(async () => 'hashed'), compare: jest.fn(async () => true) };
await jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));

const mockJwt = { sign: jest.fn(() => 'jwt'), verify: jest.fn(() => ({ userId: 'u', email: 'e' })) };
await jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));

const { default: app } = await import('../app.js');

describe('Cookie flags on auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('register sets httpOnly cookies', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt' });

    const res = await request(app)
      .post('/users/register')
      .send({ email: 'a@b.com', password: 'abcdefgh', rememberMe: false });

    const setCookie = res.headers['set-cookie']?.join(';') || '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('accessToken');
    expect(setCookie).toContain('refreshToken');
  });
});


