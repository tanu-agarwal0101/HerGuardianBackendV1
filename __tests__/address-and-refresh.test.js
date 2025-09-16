import { jest } from '@jest/globals';

// Shared mocks
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  address: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  blackListToken: {
    findFirst: jest.fn(),
  },
};

await jest.unstable_mockModule('../utils/prisma.js', () => ({
  default: mockPrisma,
}));

const mockJwt = {
  sign: jest.fn(() => 'new.access.token'),
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};

await jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

import request from 'supertest';
const { default: app } = await import('../app.js');

describe('Address routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test('POST /address/create-address -> creates address when authorized', async () => {
    // auth middleware path
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' }); // checkUserId
    mockPrisma.address.create.mockResolvedValueOnce({ id: 'addr-1', type: 'home' });

    const res = await request(app)
      .post('/address/create-address')
      .set('Cookie', ['accessToken=mock.jwt.token'])
      .send({ type: 'home', latitude: 1.23, longitude: 3.21, radiusMeters: 50 });

    expect(res.status).toBe(201);
    expect(mockPrisma.address.create).toHaveBeenCalled();
  });

  test('GET /address/get-all-addresses -> lists addresses for authorized user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' }); // checkUserId
    mockPrisma.address.findMany.mockResolvedValueOnce([{ id: 'addr-1' }]);

    const res = await request(app)
      .get('/address/get-all-addresses')
      .set('Cookie', ['accessToken=mock.jwt.token']);

    expect(res.status).toBe(200);
    expect(res.body.addresses).toBeDefined();
  });

  test('PATCH /address/update-address -> updates address by id', async () => {
    mockPrisma.address.update.mockResolvedValueOnce({ id: 'addr-1', type: 'work' });

    const res = await request(app)
      .patch('/address/update-address')
      .send({ addressId: 'addr-1', type: 'work' });

    expect(res.status).toBe(200);
    expect(mockPrisma.address.update).toHaveBeenCalled();
  });

  test('DELETE /address/delete-address -> deletes address by id', async () => {
    mockPrisma.address.delete.mockResolvedValueOnce({ id: 'addr-1' });

    const res = await request(app)
      .delete('/address/delete-address')
      .send({ addressId: 'addr-1' });

    expect(res.status).toBe(200);
    expect(mockPrisma.address.delete).toHaveBeenCalled();
  });
});

describe('POST /users/refresh-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
  });

  test('refreshes access token when provided valid cookies', async () => {
    // First verify() call -> access token (middleware)
    // Second verify() call -> refresh token (handler)
    mockJwt.verify
      .mockImplementationOnce(() => ({ userId: 'user-1', email: 'user@example.com' }))
      .mockImplementationOnce(() => ({ userId: 'user-1', email: 'user@example.com' }));

    // verifyAccessToken middleware fetches user by id
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' }) // middleware
      .mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' }); // handler

    const res = await request(app)
      .post('/users/refresh-token')
      .set('Cookie', ['accessToken=valid.access', 'refreshToken=valid.refresh']);

    expect(res.status).toBe(200);
    // new access token cookie should be set
    expect(res.headers['set-cookie']?.join(';')).toContain('accessToken=');
  });
});


