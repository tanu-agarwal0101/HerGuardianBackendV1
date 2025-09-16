import { jest } from '@jest/globals';

const mockPrisma = {
  emergencyContact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  blackListToken: {
    findFirst: jest.fn(),
  },
};

await jest.unstable_mockModule('../utils/prisma.js', () => ({
  default: mockPrisma,
}));

const mockJwt = {
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};
await jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

import request from 'supertest';
const { default: app } = await import('../app.js');

describe('Contacts routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test('POST /contacts/create-contacts -> 400 on empty list', async () => {
    const res = await request(app)
      .post('/contacts/create-contacts')
      .set('Cookie', ['accessToken=mock.jwt'])
      .send({ emergencyContacts: [] });
    expect(res.status).toBe(400);
  });

  test('POST /contacts/create-contacts -> 201 on valid unique list', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockPrisma.emergencyContact.findMany.mockResolvedValueOnce([]);
    mockPrisma.emergencyContact.createMany.mockResolvedValueOnce({ count: 2 });

    const res = await request(app)
      .post('/contacts/create-contacts')
      .set('Cookie', ['accessToken=mock.jwt'])
      .send({ emergencyContacts: [
        { name: 'A', phoneNumber: '1234567890', email: 'a@example.com' },
        { name: 'B', phoneNumber: '0987654321' },
      ]});
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
  });

  test('POST /contacts/add-single-contact -> 400 when missing name/phone', async () => {
    const res = await request(app)
      .post('/contacts/add-single-contact')
      .set('Cookie', ['accessToken=mock.jwt'])
      .send({ name: '', phoneNumber: '' });
    expect(res.status).toBe(400);
  });

  test('POST /contacts/add-single-contact -> 201 when unique', async () => {
    mockPrisma.emergencyContact.findFirst.mockResolvedValueOnce(null);
    mockPrisma.emergencyContact.create.mockResolvedValueOnce({ id: 'c-1' });
    const res = await request(app)
      .post('/contacts/add-single-contact')
      .set('Cookie', ['accessToken=mock.jwt'])
      .send({ name: 'Jane', phoneNumber: '1112223333' });
    expect(res.status).toBe(201);
  });

  test('GET /contacts/get-all-contacts -> 200 returns list', async () => {
    mockPrisma.emergencyContact.findMany.mockResolvedValueOnce([{ id: 'c-1' }]);
    const res = await request(app)
      .get('/contacts/get-all-contacts')
      .set('Cookie', ['accessToken=mock.jwt']);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.contacts)).toBe(true);
  });

  test('PATCH /contacts/update-emergency-contact -> 200 updates existing', async () => {
    mockPrisma.emergencyContact.findUnique.mockResolvedValueOnce({ id: 'c-1', name: 'Old', phoneNumber: '1' });
    mockPrisma.emergencyContact.update.mockResolvedValueOnce({ id: 'c-1', name: 'New' });
    const res = await request(app)
      .patch('/contacts/update-emergency-contact')
      .send({ contactId: 'c-1', name: 'New' });
    expect(res.status).toBe(200);
  });

  test('DELETE /contacts/delete-contact -> 200 deletes existing', async () => {
    mockPrisma.emergencyContact.findUnique.mockResolvedValueOnce({ id: 'c-1' });
    mockPrisma.emergencyContact.delete.mockResolvedValueOnce({ id: 'c-1' });
    const res = await request(app)
      .delete('/contacts/delete-contact')
      .send({ contactId: 'c-1' });
    expect(res.status).toBe(200);
  });
});


