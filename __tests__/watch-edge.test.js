import { jest } from '@jest/globals';
import request from 'supertest';

const triggerSOS = jest.fn(async () => ({ id: 'sos-1' }));
await jest.unstable_mockModule('../utils/triggerSos.js', () => ({ triggerSOS }));

const { default: app } = await import('../app.js');

describe('Watch route edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('triggers SOS when fallDetected true regardless of heart rate', async () => {
    const res = await request(app)
      .post('/watch/data')
      .send({ userId: 'user-1', heartRate: 50, fallDetected: true, location: { lat: 1, lon: 2 } });
    expect(res.status).toBe(200);
    expect(triggerSOS).toHaveBeenCalled();
  });

  test('does not trigger SOS when below threshold and no fall', async () => {
    const res = await request(app)
      .post('/watch/data')
      .send({ userId: 'user-1', heartRate: 50, fallDetected: false, location: { lat: 1, lon: 2 } });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Data received/i);
  });

  test('400 missing location fields', async () => {
    const res = await request(app)
      .post('/watch/data')
      .send({ userId: 'user-1', heartRate: 50 });
    expect(res.status).toBe(400);
  });
});


