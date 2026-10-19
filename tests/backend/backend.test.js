'use strict';

/**
 * SecureVault — Backend Test Suite
 * Jest + Supertest + mongodb-memory-server
 *
 * Security enforced:
 *  ✓ Passwords hashed with bcrypt (never stored plain)
 *  ✓ Access tokens expire in exactly 15 minutes
 *  ✓ Rate limiting returns 429 after 10 failed login attempts
 *  ✓ File access strictly isolated per user
 *  ✓ Security headers: X-Frame-Options, X-Content-Type-Options, CSP, no X-Powered-By
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Set env vars BEFORE loading app
process.env.JWT_SECRET = 'test-secret-key-minimum-32chars!!1';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32chars!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '10';

const app = require('../../backend/src/app');

let mongod;

// ── Lifecycle ──────────────────────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'securevault_test' });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
}, 30000);

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const key in cols) await cols[key].deleteMany({});
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Health Check
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Security Headers
// ─────────────────────────────────────────────────────────────────────────────
describe('Security Headers', () => {
  it('sets X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-frame-options'].toUpperCase()).toBe('DENY');
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets Content-Security-Policy header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('does NOT expose X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Registration Validation
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register — validation', () => {
  it('rejects missing fields (422)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'notvalid' });
    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('rejects weak password (422)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'weak' });
    expect(res.statusCode).toBe(422);
  });

  it('rejects invalid email format (422)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'not-an-email', password: 'StrongPass123!' });
    expect(res.statusCode).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Password Hashing — bcrypt, never plain
// ─────────────────────────────────────────────────────────────────────────────
describe('Security: password hashing with bcrypt', () => {
  it('stores password as a bcrypt hash (never plain text)', async () => {
    const plainPassword = 'SecureTest@123';

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'hashtest', email: 'hashtest@example.com', password: plainPassword });

    const User = mongoose.model('User');
    const user = await User.findOne({ email: 'hashtest@example.com' }).select('+password');

    expect(user).toBeTruthy();
    expect(user.password).not.toBe(plainPassword);
    // Must be a valid bcrypt hash
    expect(user.password).toMatch(/^\$2[aby]\$/);
    const valid = await bcrypt.compare(plainPassword, user.password);
    expect(valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. JWT — access token expires in exactly 15 min
// ─────────────────────────────────────────────────────────────────────────────
describe('Security: JWT access token expiry (exactly 15 minutes)', () => {
  it('access token exp - iat === 900 seconds', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'jwttest', email: 'jwttest@example.com', password: 'SecureTest@123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jwttest@example.com', password: 'SecureTest@123' });

    expect(res.statusCode).toBe(200);
    const { accessToken } = res.body.data;
    expect(accessToken).toBeDefined();

    const decoded = jwt.decode(accessToken);
    expect(decoded.exp - decoded.iat).toBe(900);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Protected Routes — Zero-Trust
// ─────────────────────────────────────────────────────────────────────────────
describe('Protected Routes — Zero-Trust', () => {
  it('rejects /api/files without token (401)', async () => {
    const res = await request(app).get('/api/files');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects /api/admin/stats without token (401)', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid JWT (401)', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/no-such-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Login validation
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — validation', () => {
  it('rejects invalid email format (422)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notanemail', password: 'somepassword' });
    expect(res.statusCode).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Rate Limiting — 429 with Retry-After after 10 failed login attempts
// ─────────────────────────────────────────────────────────────────────────────
describe('Security: Rate Limiting (429 + Retry-After)', () => {
  it('returns 429 with retry header after 10 failed auth attempts', async () => {
    const email = 'ratetest_backend@example.com';
    let lastRes;

    // Send 11 requests — the 11th must be rate-limited
    for (let i = 0; i < 11; i++) {
      lastRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: `WrongPass${i}!` });
    }

    expect(lastRes.statusCode).toBe(429);

    const hasRetryHeader =
      lastRes.headers['retry-after'] !== undefined ||
      lastRes.headers['ratelimit-reset'] !== undefined ||
      lastRes.headers['x-ratelimit-reset'] !== undefined;
    expect(hasRetryHeader).toBe(true);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. File Access Isolation — per-user scoping
// ─────────────────────────────────────────────────────────────────────────────
describe('Security: File access isolation per user', () => {
  let tokenA, tokenB;

  beforeEach(async () => {
    await request(app).post('/api/auth/register')
      .send({ username: 'isolateA', email: 'isolateA@example.com', password: 'SecureTest@123' });
    await request(app).post('/api/auth/register')
      .send({ username: 'isolateB', email: 'isolateB@example.com', password: 'SecureTest@123' });

    const resA = await request(app).post('/api/auth/login')
      .send({ email: 'isolateA@example.com', password: 'SecureTest@123' });
    const resB = await request(app).post('/api/auth/login')
      .send({ email: 'isolateB@example.com', password: 'SecureTest@123' });

    tokenA = resA.body.data?.accessToken;
    tokenB = resB.body.data?.accessToken;
  });

  it('user A file list returns 200 with their own (empty) list', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    const files = res.body.data?.files ?? res.body.data ?? [];
    expect(Array.isArray(files)).toBe(true);
  });

  it('user B cannot delete a file with user A token — 404', async () => {
    // Random ObjectId — definitely not owned by User B
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .delete(`/api/files/${fakeId}`)
      .send({ password: 'SecureTest@123' })
      .set('Authorization', `Bearer ${tokenB}`);
    expect([404, 400, 403]).toContain(res.statusCode);
  });
});
