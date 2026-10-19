'use strict';

/**
 * SecureVault — DevOps Test Suite
 * Jest + dockerode + js-yaml
 *
 * Requires: docker compose up --build -d
 * Inspects live running containers, volumes, and docker-compose.yml config.
 */

const Docker = require('dockerode');
const fs     = require('fs');
const path   = require('path');
const yaml   = require('js-yaml');

const docker = new Docker();

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function listRunning() {
  return docker.listContainers(); // only running
}

async function listVolumes() {
  const { Volumes } = await docker.listVolumes();
  return Volumes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. All required containers are running
// ─────────────────────────────────────────────────────────────────────────────
describe('Docker Containers — Running State', () => {
  const required = [
    'securevault_mongo',
    'securevault_backend',
    'securevault_frontend',
    'securevault_nginx',
  ];

  it.each(required)('%s container is running', async (name) => {
    const containers = await listRunning();
    const found = containers.find((c) =>
      c.Names.some((n) => n.replace(/^\//, '') === name)
    );
    expect(found).toBeDefined();
    expect(found.State).toBe('running');
  }, 15000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Security: MongoDB must NOT expose port 27017 to the host
// ─────────────────────────────────────────────────────────────────────────────
describe('Security: MongoDB port isolation', () => {
  it('securevault_mongo does NOT bind port 27017 on the host', async () => {
    const containers = await listRunning();
    const mongo = containers.find((c) =>
      c.Names.some((n) => n.includes('securevault_mongo'))
    );
    expect(mongo).toBeDefined();

    const bound27017 = (mongo.Ports || []).some(
      (p) => p.PublicPort === 27017
    );
    expect(bound27017).toBe(false);
  }, 15000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Named volumes exist
// ─────────────────────────────────────────────────────────────────────────────
describe('Docker Named Volumes', () => {
  it.each(['mongo_data', 'encrypted_storage'])('%s volume exists', async (name) => {
    const volumes = await listVolumes();
    const found = volumes.find((v) => v.Name.includes(name));
    expect(found).toBeDefined();
  }, 15000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. docker-compose.yml structure assertions
// ─────────────────────────────────────────────────────────────────────────────
describe('docker-compose.yml — Configuration', () => {
  let compose;

  beforeAll(() => {
    const composePath = path.resolve(__dirname, '../../docker-compose.yml');
    compose = yaml.load(fs.readFileSync(composePath, 'utf8'));
  });

  it('mongo service has NO host port mappings (27017 NOT exposed)', () => {
    const mongo  = compose.services?.mongo;
    expect(mongo).toBeDefined();
    const ports  = (mongo.ports || []).map(String);
    expect(ports.some((p) => p.includes('27017'))).toBe(false);
  });

  it('nginx exposes port 80', () => {
    const nginx = compose.services?.nginx;
    expect(nginx).toBeDefined();
    const ports = (nginx.ports || []).map(String);
    expect(ports.some((p) => p.includes('80'))).toBe(true);
  });

  it('nginx exposes port 443', () => {
    const nginx = compose.services?.nginx;
    const ports = (nginx.ports || []).map(String);
    expect(ports.some((p) => p.includes('443'))).toBe(true);
  });

  it('backend connects to securevault_net', () => {
    const backend = compose.services?.backend;
    expect(backend).toBeDefined();
    const nets   = backend.networks || [];
    const names  = Array.isArray(nets) ? nets : Object.keys(nets);
    expect(names).toContain('securevault_net');
  });

  it('mongo connects to securevault_net', () => {
    const mongo = compose.services?.mongo;
    const nets  = mongo.networks || [];
    const names = Array.isArray(nets) ? nets : Object.keys(nets);
    expect(names).toContain('securevault_net');
  });

  it('mongo_data volume defined at top level', () => {
    expect(compose.volumes?.mongo_data).toBeDefined();
  });

  it('encrypted_storage volume defined at top level', () => {
    expect(compose.volumes?.encrypted_storage).toBeDefined();
  });

  it('backend depends on mongo', () => {
    const backend    = compose.services?.backend;
    const dependsOn  = backend?.depends_on;
    expect(dependsOn).toBeDefined();
    const deps = Array.isArray(dependsOn) ? dependsOn : Object.keys(dependsOn);
    expect(deps).toContain('mongo');
  });

  it('JWT_EXPIRES_IN is referenced in backend environment', () => {
    const backend = compose.services?.backend;
    const env     = backend?.environment;
    // Could be object or array form
    const raw = Array.isArray(env)
      ? env.join('\n')
      : JSON.stringify(env);
    expect(raw).toContain('JWT_EXPIRES_IN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. All SecureVault containers share the internal network
// ─────────────────────────────────────────────────────────────────────────────
describe('Container Network Isolation', () => {
  it('all running securevault_* containers are on securevault_net', async () => {
    const containers = await listRunning();
    const svContainers = containers.filter((c) =>
      c.Names.some((n) => n.includes('securevault'))
    );
    expect(svContainers.length).toBeGreaterThanOrEqual(4);

    svContainers.forEach((c) => {
      const nets = Object.keys(c.NetworkSettings?.Networks || {});
      const onNet = nets.some((n) => n.includes('securevault'));
      expect(onNet).toBe(true);
    });
  }, 15000);
});
