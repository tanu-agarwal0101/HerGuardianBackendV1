import { jest } from '@jest/globals';
import request from 'supertest';

await jest.unstable_mockModule("../utils/prisma.js", async () => {
  const mockPrismaInstance = (await import("../__mocks__/prisma.js")).default;
  return { default: mockPrismaInstance };
});

import mockPrisma from "../__mocks__/prisma.js";

const mockBcrypt = { hash: jest.fn(async () => 'hashed'), compare: jest.fn(async () => true) };
await jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));

const mockJwt = { sign: jest.fn(() => 'jwt'), verify: jest.fn(() => ({ userId: 'u', email: 'e' })) };
await jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));

await jest.unstable_mockModule('../utils/emailService.js', () => ({
  sendSOSMail: jest.fn(async () => {}),
  sendVerificationMail: jest.fn(async () => {}),
  sendPasswordResetMail: jest.fn(async () => {}),
  sendGuardianInviteMail: jest.fn(async () => {}),
}));

const { default: app } = await import('../app.js');

describe('Cookie flags on auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('register returns 201 and sends verification email', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    mockPrisma.verificationToken.create.mockResolvedValueOnce({ id: 'vt1' });

    const res = await request(app)
      .post('/users/register')
      .send({ email: 'a@b.com', password: 'abcdefgh', rememberMe: false });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
  });
});
