import { jest } from '@jest/globals';

const mockPrisma = {
  safetyTimer: {
    create: jest.fn(),
    updateMany: jest.fn(),
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

const triggerSOS = jest.fn(async () => ({ id: 'sos-1' }));
await jest.unstable_mockModule('../utils/triggerSos.js', () => ({
  triggerSOS,
}));

const mockJwt = {
  verify: jest.fn(() => ({ userId: 'user-1', email: 'user@example.com' })),
};
await jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

import request from 'supertest';
const { default: app } = await import('../app.js');

describe('Timer routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test('POST /timer/start -> creates safety timer for valid user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockPrisma.safetyTimer.create.mockResolvedValueOnce({ id: 'timer-1' });

    const res = await request(app)
      .post('/timer/start')
      .set('Cookie', ['accessToken=mock.jwt.token'])
      .send({ duration: 10, shareLocation: true, latitude: 1.2, longitude: 2.3 });

    expect(res.status).toBe(201);
    expect(mockPrisma.safetyTimer.create).toHaveBeenCalled();
  });

  test('PATCH /timer/cancel -> cancels active timer if exists', async () => {
    mockPrisma.safetyTimer.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await request(app)
      .patch('/timer/cancel')
      .set('Cookie', ['accessToken=mock.jwt.token'])
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/canceled/i);
  });
});

describe('Watch route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /watch/data -> triggers SOS if heart rate high', async () => {
    const res = await request(app)
      .post('/watch/data')
      .send({ userId: 'user-1', heartRate: 200, location: { lat: 1.1, lon: 2.2 }, fallDetected: false });

    expect(res.status).toBe(200);
    expect(triggerSOS).toHaveBeenCalled();
    expect(res.body.message).toMatch(/SOS/i);
  });

  test('POST /watch/data -> 400 on missing fields', async () => {
    const res = await request(app)
      .post('/watch/data')
      .send({ heartRate: 80 });

    expect(res.status).toBe(400);
  });
});


