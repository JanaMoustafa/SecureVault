'use strict';

/**
 * SecureVault — Integration Offline Test Suite
 * Runs against the Express app in-process using supertest + mongodb-memory-server.
 *
 * No Docker required.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Ensure test setup is deterministic
process.env.MONGOMS_VERSION = '4.4.18';
process.env.JWT_SECRET = 'test-secret-key-minimum-32chars!!1';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32chars!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '10';

const uploadDir = path.join(os.tmpdir(), 'securevault_integration_uploads');
process.env.STORAGE_PATH = uploadDir;
fs.mkdirSync(uploadDir, { recursive: true });

// Load the app AFTER setting env vars
const app = require('../src/app');

let mongod;
let tokenA;
let tokenB;
let fileId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'securevault_test' });
  const cols = mongoose.connection.collections;
  for (const key in cols) await cols[key].deleteMany({});
}, 600000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  // Best-effort cleanup
  try { fs.rmSync(uploadDir, { recursive: true, force: true }); } catch { /* ignore */ }
}, 300000);

describe('Offline end-to-end API flow', () => {
  it('GET /api/health returns 200 and status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('Security headers: X-Frame-Options DENY, nosniff, CSP set, X-Powered-By missing', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(String(res.headers['x-frame-options']).toUpperCase()).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('POST /api/auth/register succeeds for user A', async () => {
    const USER_A = { username: 'userA_offline', email: 'usera_offline@test.com', password: 'SecureTest@123' };
    const res = await request(app).post('/api/auth/register').send(USER_A);
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/login returns accessToken for user A', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usera_offline@test.com', password: 'SecureTest@123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    tokenA = res.body.data.accessToken;

    // Validate JWT expiry is exactly 15 minutes (exp - iat = 900s)
    const decoded = jwt.decode(tokenA);
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('login response does NOT send accessToken in Set-Cookie header', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usera_offline@test.com', password: 'SecureTest@123' });
    const setCookie = res.headers['set-cookie'] || [];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    const leaksToken = /(?:access_token|accessToken|token)=/i.test(cookieStr);
    expect(leaksToken).toBe(false);
  });

  it('POST /api/files/upload returns 201 with file metadata', async () => {
    expect(tokenA).toBeDefined();

    const encryptedContent = crypto.randomBytes(256);
    const sha256Hash = crypto.createHash('sha256').update(encryptedContent).digest('hex');

    const iv = crypto.randomBytes(16).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');

    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('originalName', 'test-document.txt')
      .field('sha256Hash', sha256Hash)
      .field('iv', iv)
      .field('salt', salt)
      .attach('encryptedFile', encryptedContent, { filename: 'test.enc', contentType: 'application/octet-stream' });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    fileId = res.body.data?.file?._id || res.body.data?._id;
    expect(fileId).toBeDefined();
  });

  it('GET /api/files returns at least 1 file for user A', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const files = res.body.data?.files ?? res.body.data ?? [];
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('Cross-user isolation: user B cannot list/download/delete user A file', async () => {
    // Register B
    const userB = { username: 'userB_offline', email: 'userb_offline@test.com', password: 'SecureTest@456' };
    const registerRes = await request(app).post('/api/auth/register').send(userB);
    expect([200, 201]).toContain(registerRes.status);
    expect(registerRes.body.success).toBe(true);

    // Login B
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: userB.email, password: userB.password });
    expect(loginRes.status).toBe(200);
    tokenB = loginRes.body.data.accessToken;

    // List: should NOT contain user A's file
    const listRes = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listRes.status).toBe(200);
    const files = listRes.body.data?.files ?? listRes.body.data ?? [];
    const leaks = files.some((f) => String(f._id) === String(fileId));
    expect(leaks).toBe(false);

    // Download: should 403/404
    const dlRes = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect([403, 404]).toContain(dlRes.status);

    // Delete: should 403/404
    const delRes = await request(app)
      .delete(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ password: userB.password });
    expect([403, 404]).toContain(delRes.status);
  });

  it('Rate limiting: returns 429 with a rate-limit header after 11 failed login attempts', async () => {
    const email = `ratelimit_offline_${Date.now()}@test.com`;
    let lastRes;

    for (let i = 0; i < 11; i++) {
      lastRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: `WrongPass${i}!` });
    }

    expect(lastRes.status).toBe(429);
    const retryAfter = lastRes.headers['retry-after'];
    const rlReset = lastRes.headers['ratelimit-reset'];
    const xRlReset = lastRes.headers['x-ratelimit-reset'];
    expect(retryAfter || rlReset || xRlReset).toBeTruthy();
  }, 60000);

  it('Passwords are hashed (bcrypt) — sanity check', async () => {
    const plainPassword = 'SecureTest@123';
    const USER = { username: 'hashcheck_offline', email: 'hashcheck_offline@test.com', password: plainPassword };

    await request(app).post('/api/auth/register').send(USER);

    const UserModel = mongoose.model('User');
    const user = await UserModel.findOne({ email: USER.email }).select('+password');
    expect(user).toBeTruthy();
    expect(user.password).not.toBe(plainPassword);
    expect(await bcrypt.compare(plainPassword, user.password)).toBe(true);
  });
});

