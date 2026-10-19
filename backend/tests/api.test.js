'use strict';

/**
 * SecureVault API — Health & Auth Unit Tests
 */

const request = require('supertest');
const app     = require('../src/app');

describe('GET /api/health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('POST /api/auth/register — validation', () => {
  it('should reject registration with missing fields (422)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'notvalid' });
    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should reject weak password (422)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'weak' });
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /api/auth/login — validation', () => {
  it('should reject login with invalid email (422)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notanemail', password: 'somepassword' });
    expect(res.statusCode).toBe(422);
  });
});

describe('Protected Routes — Zero-Trust', () => {
  it('should reject GET /api/files without token (401)', async () => {
    const res = await request(app).get('/api/files');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject GET /api/admin/stats without token (401)', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.statusCode).toBe(401);
  });

  it('should reject with invalid JWT token (401)', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
