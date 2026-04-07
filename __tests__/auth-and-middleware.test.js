import { jest } from '@jest/globals';
import request from 'supertest';

await jest.unstable_mockModule("../utils/prisma.js", async () => {
  const mockPrismaInstance = (await import("../__mocks__/prisma.js")).default;
  return { default: mockPrismaInstance };
});

import mockPrisma from "../__mocks__/prisma.js";

const mockBcrypt = {
  hash: jest.fn(async () => 'hashed-password'),
  compare: jest.fn(async () => true),
};
await jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));

const mockJwt = {
  sign: jest.fn(() => 'mock.jwt.token'),
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};
await jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));

await jest.unstable_mockModule('../utils/emailService.js', () => ({
  sendSOSMail: jest.fn(async () => {}),
  sendVerificationMail: jest.fn(async () => {}),
  sendPasswordResetMail: jest.fn(async () => {}),
  sendGuardianInviteMail: jest.fn(async () => {}),
}));

const { default: app } = await import('../app.js');

describe('Auth flows and protected route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
  });

  test('POST /users/register -> creates user and sends verification email', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' });
    mockPrisma.verificationToken.create.mockResolvedValueOnce({ id: 'vt-1' });

    const res = await request(app)
      .post('/users/register')
      .send({ email: 'user@example.com', password: 'Passw0rd!', rememberMe: true });

    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.verificationToken.create).toHaveBeenCalled();
  });

  test('POST /users/login -> logs in verified user and returns tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
      isEmailVerified: true,
    });
    mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-2' });

    const res = await request(app)
      .post('/users/login')
      .send({ email: 'user@example.com', password: 'Passw0rd!', rememberMe: false });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.join(';')).toContain('accessToken');
    expect(res.headers['set-cookie']?.join(';')).toContain('refreshToken');
  });

  test('GET /users/profile -> requires auth cookie and returns profile', async () => {
    mockPrisma.blackListToken.findFirst.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' })
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '1234567890',
        stealthMode: false,
        stealthType: 'calculator',
        safetyTimer: null,
        address: [],
        emergencyContacts: [],
        sosAlerts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    const res = await request(app)
      .get('/users/profile')
      .set('Cookie', ['accessToken=mock.jwt.token']);

    expect(res.status).toBe(200);
    expect(res.body?.user?.email).toBe('user@example.com');
  });
});
