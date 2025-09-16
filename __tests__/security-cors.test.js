import { jest } from '@jest/globals';
import request from 'supertest';

// Ensure FRONTEND_URL is set for the app's CORS middleware
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const { default: app } = await import('../app.js');

describe('CORS preflight handling', () => {
  test('responds to OPTIONS with correct CORS headers for allowed origin', async () => {
    const origin = process.env.FRONTEND_URL;
    const res = await request(app)
      .options('/users/profile')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Content-Type');

    // default status for preflight is 204
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});


