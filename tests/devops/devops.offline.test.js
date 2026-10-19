'use strict';

/**
 * SecureVault — DevOps Offline Test Suite
 * Validates infrastructure configuration files WITHOUT requiring Docker runtime.
 *
 * What we check:
 * - `docker-compose.yml` structure for networks/ports/volumes
 * - `infrastructure/nginx/nginx.conf` security headers
 * - `infrastructure/mongo-init.js` presence/contents
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function read(relPath) {
  const full = path.resolve(__dirname, relPath);
  return fs.readFileSync(full, 'utf8');
}

describe('DevOps Offline — Configuration', () => {
  let compose;
  let nginxConf;
  let mongoInit;

  beforeAll(() => {
    const composePath = path.resolve(__dirname, '../../docker-compose.yml');
    compose = yaml.load(fs.readFileSync(composePath, 'utf8'));

    nginxConf = read('../../infrastructure/nginx/nginx.conf');
    mongoInit = read('../../infrastructure/mongo-init.js');
  });

  it('docker-compose defines `securevault_net` network', () => {
    expect(compose.networks).toBeDefined();
    expect(compose.networks.securevault_net).toBeDefined();
  });

  it('docker-compose defines volumes `mongo_data` and `encrypted_storage`', () => {
    expect(compose.volumes).toBeDefined();
    expect(compose.volumes.mongo_data).toBeDefined();
    expect(compose.volumes.encrypted_storage).toBeDefined();
  });

  it('mongo service does NOT expose port 27017 to the host', () => {
    const mongo = compose.services?.mongo;
    expect(mongo).toBeDefined();
    const ports = (mongo.ports || []).map(String);
    expect(ports.some((p) => p.includes('27017'))).toBe(false);
  });

  it('nginx exposes ports 80 and 443', () => {
    const nginx = compose.services?.nginx;
    expect(nginx).toBeDefined();
    const ports = (nginx.ports || []).map(String);
    expect(ports.some((p) => p.includes('80'))).toBe(true);
    expect(ports.some((p) => p.includes('443'))).toBe(true);
  });

  it('backend connects to securevault_net', () => {
    const backend = compose.services?.backend;
    expect(backend).toBeDefined();
    const nets = backend.networks || [];
    const names = Array.isArray(nets) ? nets : Object.keys(nets);
    expect(names).toContain('securevault_net');
  });

  it('mongo connects to securevault_net', () => {
    const mongo = compose.services?.mongo;
    expect(mongo).toBeDefined();
    const nets = mongo.networks || [];
    const names = Array.isArray(nets) ? nets : Object.keys(nets);
    expect(names).toContain('securevault_net');
  });

  it('JWT_EXPIRES_IN is referenced in backend environment', () => {
    const backend = compose.services?.backend;
    const env = backend?.environment;
    const raw = Array.isArray(env) ? env.join('\n') : JSON.stringify(env);
    expect(raw).toContain('JWT_EXPIRES_IN');
  });

  it('nginx.conf sets X-Frame-Options: DENY and X-Content-Type-Options: nosniff', () => {
    expect(nginxConf).toContain('add_header X-Frame-Options');
    expect(nginxConf).toContain('"DENY"');
    expect(nginxConf).toContain('add_header X-Content-Type-Options');
    expect(nginxConf).toContain('"nosniff"');
  });

  it('nginx.conf sets a Content-Security-Policy header', () => {
    expect(nginxConf).toContain('add_header Content-Security-Policy');
  });

  it('mongo-init.js creates `sv_app` user', () => {
    expect(mongoInit).toContain('user: \'sv_app\'');
    expect(mongoInit).toContain("role: 'readWrite'");
  });
});

