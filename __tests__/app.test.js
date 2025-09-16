import request from 'supertest';
import app from '../app.js';

describe('GET /', () => {
  it('responds with 200 and welcome HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Welcome to HerGuardian');
  });
});
