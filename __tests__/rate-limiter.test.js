import { jest } from '@jest/globals';
import request from 'supertest';

const { default: app } = await import('../app.js');

describe('Rate limiter basic behavior (smoke)', () => {
  test('does not block single SOS request', async () => {
    const res = await request(app)
      .post('/users/sos-trigger')
      .send({ latitude: 1, longitude: 2 });
    // We cannot assert 429 without deep setup; ensure not blocked by default
    expect([200, 400, 401]).toContain(res.status);
  });
});


