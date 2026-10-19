'use strict';

/**
 * SecureVault — Integration Test Suite (9 sequential steps)
 * Jest + node-fetch + form-data
 *
 * Requires: docker compose up --build -d
 * Hits the full live stack on http://localhost:80 via Nginx.
 */

const fetch    = require('node-fetch');
const FormData = require('form-data');
const crypto   = require('crypto');

const BASE = 'http://localhost:80';
const API  = `${BASE}/api`;

// Unique identifiers per run
const ts    = Date.now();
const USER_A = { username: `userA${ts}`, email: `usera${ts}@test.com`, password: 'SecureTest@123' };
const USER_B = { username: `userB${ts}`, email: `userb${ts}@test.com`, password: 'SecureTest@456' };

// Shared state between steps
let tokenA;
let fileId;

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Health check via Nginx
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 1 — Health check via Nginx', () => {
  it('GET /api/health returns 200 and status ok', async () => {
    const res  = await fetch(`${API}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Security headers via Nginx
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 2 — Security headers via Nginx', () => {
  let headers;

  beforeAll(async () => {
    const res = await fetch(`${API}/health`);
    headers   = res.headers;
  }, 30000);

  it('X-Frame-Options header is set', () => {
    expect(headers.get('x-frame-options')).toBeTruthy();
  });

  it('X-Content-Type-Options is nosniff', () => {
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('Content-Security-Policy is set', () => {
    expect(headers.get('content-security-policy')).toBeTruthy();
  });

  it('X-Powered-By is NOT present', () => {
    expect(headers.get('x-powered-by')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Register user A
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 3 — Register user A', () => {
  it('POST /api/auth/register succeeds', async () => {
    const res  = await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(USER_A),
    });
    const body = await res.json();
    expect([200, 201]).toContain(res.status);
    expect(body.success).toBe(true);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Login user A — obtain JWT
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 4 — Login user A and obtain JWT', () => {
  it('POST /api/auth/login returns accessToken', async () => {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: USER_A.email, password: USER_A.password }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    tokenA = body.data.accessToken;
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: JWT token NOT set as a plain cookie (memory-only intent)
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 5 — JWT token storage: never in a raw Set-Cookie header', () => {
  it('login response does NOT send accessToken in a Set-Cookie header', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: USER_A.email, password: USER_A.password }),
    });
    const setCookie = res.headers.get('set-cookie') || '';
    const leaksToken = /(?:access_token|accessToken|token)=/i.test(setCookie);
    expect(leaksToken).toBe(false);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Upload encrypted file as user A
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 6 — Upload encrypted file (user A)', () => {
  it('POST /api/files/upload returns 201 with file metadata', async () => {
    expect(tokenA).toBeDefined();

    // Build a valid encrypted blob with proper metadata
    const encryptedContent = crypto.randomBytes(256);
    const sha256Hash = crypto.createHash('sha256').update(encryptedContent).digest('hex');

    const form = new FormData();
    form.append('encryptedFile', encryptedContent, {
      filename:    'test.enc',
      contentType: 'application/octet-stream',
    });
    form.append('originalName', 'test-document.txt');
    form.append('sha256Hash', sha256Hash);
    form.append('iv',   crypto.randomBytes(16).toString('hex'));
    form.append('salt', crypto.randomBytes(16).toString('hex'));

    const res  = await fetch(`${API}/files/upload`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${tokenA}`, ...form.getHeaders() },
      body:    form,
    });
    const body = await res.json();
    expect([200, 201]).toContain(res.status);
    expect(body.success).toBe(true);
    fileId = body.data?.file?._id || body.data?._id;
    expect(fileId).toBeDefined();
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 7: User A sees their file
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 7 — File listing: user A sees uploaded file', () => {
  it('GET /api/files returns at least 1 file for user A', async () => {
    const res  = await fetch(`${API}/files`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    const files = body.data?.files ?? body.data ?? [];
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(1);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 8: Cross-user isolation — user B cannot access user A's file
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 8 — Cross-user file access isolation', () => {
  let tokenB;

  beforeAll(async () => {
    await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(USER_B),
    });
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: USER_B.email, password: USER_B.password }),
    });
    const body = await res.json();
    tokenB = body.data?.accessToken;
  }, 30000);

  it("user B file list does NOT contain user A's file", async () => {
    const res  = await fetch(`${API}/files`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    const files = body.data?.files ?? body.data ?? [];
    const leaks = files.some((f) => f._id === fileId);
    expect(leaks).toBe(false);
  }, 30000);

  it("user B gets 404 downloading user A's file by ID", async () => {
    if (!fileId) { console.warn('No fileId — skipping download isolation test'); return; }
    const res = await fetch(`${API}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect([403, 404]).toContain(res.status);
  }, 30000);

  it("user B gets 404 deleting user A's file", async () => {
    if (!fileId) { console.warn('No fileId — skipping delete isolation test'); return; }
    const res = await fetch(`${API}/files/${fileId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: USER_B.password }),
    });
    expect([403, 404]).toContain(res.status);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 9: Rate limiting — 429 + Retry-After after 10+ failed logins
// ─────────────────────────────────────────────────────────────────────────────
describe('Step 9 — Rate limiting (429 + Retry-After)', () => {
  it('returns 429 with a rate-limit header after 11 failed login attempts', async () => {
    const email = `ratelimit${ts}@test.com`;
    let lastRes;

    for (let i = 0; i < 11; i++) {
      lastRes = await fetch(`${API}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password: `WrongPass${i}!` }),
      });
    }

    expect(lastRes.status).toBe(429);
    const retryAfter = lastRes.headers.get('retry-after');
    const rlReset    = lastRes.headers.get('ratelimit-reset');
    const xRlReset   = lastRes.headers.get('x-ratelimit-reset');
    expect(retryAfter !== null || rlReset !== null || xRlReset !== null).toBe(true);
  }, 60000);
});
