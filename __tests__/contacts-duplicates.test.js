import { jest } from '@jest/globals';
import request from 'supertest';

const mockPrisma = {
  emergencyContact: {
    findMany: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  blackListToken: { findFirst: jest.fn() },
};

await jest.unstable_mockModule('../utils/prisma.js', () => ({ default: mockPrisma }));

const mockJwt = {
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};
await jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));

const { default: app } = await import('../app.js');

describe('Contacts duplicates handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test('400 when duplicate numbers in request body', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    const res = await request(app)
      .post('/contacts/create-contacts')
      .set('Cookie', ['accessToken=jwt'])
      .send({ emergencyContacts: [
        { name: 'A', phoneNumber: '1111111111' },
        { name: 'B', phoneNumber: '1111111111' },
      ]});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Duplicate contacts/i);
  });

  test('400 when numbers already exist in DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockPrisma.emergencyContact.findMany.mockResolvedValueOnce([{ id: 'c-1', phoneNumber: '1111111111' }]);
    const res = await request(app)
      .post('/contacts/create-contacts')
      .set('Cookie', ['accessToken=jwt'])
      .send({ emergencyContacts: [
        { name: 'A', phoneNumber: '1111111111' },
      ]});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exist/i);
  });
});


