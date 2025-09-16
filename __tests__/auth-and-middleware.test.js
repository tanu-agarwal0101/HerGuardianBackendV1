// ESM-friendly Jest mocks must be set up before importing the app
import { jest } from '@jest/globals';
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
  },
  blackListToken: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

await jest.unstable_mockModule('../utils/prisma.js', () => ({
  default: mockPrisma,
}));

const mockBcrypt = {
  hash: jest.fn(async () => 'hashed-password'),
  compare: jest.fn(async () => true),
};

await jest.unstable_mockModule('bcrypt', () => ({
  default: mockBcrypt,
}));

const mockJwt = {
  sign: jest.fn(() => 'mock.jwt.token'),
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};

await jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

import request from 'supertest';
const { default: app } = await import('../app.js');

describe('Auth flows and protected route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
  });

  test('POST /users/register -> creates user and returns tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' });
    mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-1' });

    const res = await request(app)
      .post('/users/register')
      .send({ email: 'user@example.com', password: 'Passw0rd!', rememberMe: true });

    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(res.headers['set-cookie']?.join(';')).toContain('accessToken');
    expect(res.headers['set-cookie']?.join(';')).toContain('refreshToken');
  });

  test('POST /users/login -> logs in and returns tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
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
      .mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' }) // auth middleware lookup
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


