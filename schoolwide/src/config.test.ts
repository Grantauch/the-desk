import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from './config.js';

test('configuration defaults keep legacy production writes forbidden', () => {
  const config = readConfig({ DATABASE_URL: 'postgresql://example.invalid/schoolwide' });
  assert.equal(config.legacyProductionWrites, 'forbidden');
  assert.equal(config.legacyReadAdapterMode, 'disabled');
  assert.equal(config.deploymentTier, 'local');
  assert.equal(config.releaseSha, 'local');
  assert.equal(config.databaseSocketPath, undefined);
  assert.equal(config.port, 8787);
});

test('configuration rejects any attempt to enable legacy production writes', () => {
  assert.throws(() => readConfig({
    DATABASE_URL: 'postgresql://example.invalid/schoolwide',
    LEGACY_PRODUCTION_WRITES: 'allowed',
  }));
});

test('staging cannot start without an exact release SHA', () => {
  assert.throws(() => readConfig({
    DATABASE_URL: 'postgresql://example.invalid/schoolwide',
    DATABASE_SOCKET_PATH: '/cloudsql/grantdesk-deployment:us-central1:schoolwide-staging',
    DEPLOYMENT_TIER: 'staging',
  }), /exact RELEASE_SHA/);
});

test('staging cannot use a public or arbitrary database path', () => {
  assert.throws(() => readConfig({
    DATABASE_URL: 'postgresql://example.invalid/schoolwide',
    DATABASE_SOCKET_PATH: '203.0.113.10',
    DEPLOYMENT_TIER: 'staging',
    RELEASE_SHA: 'a'.repeat(40),
  }), /Cloud SQL Unix socket/);
});

test('staging accepts an exact release SHA and Cloud SQL Unix socket', () => {
  const releaseSha = 'a'.repeat(40);
  const socketPath = '/cloudsql/grantdesk-deployment:us-central1:schoolwide-staging';
  const config = readConfig({
    DATABASE_URL: 'postgresql://example.invalid/schoolwide',
    DATABASE_SOCKET_PATH: socketPath,
    DEPLOYMENT_TIER: 'staging',
    RELEASE_SHA: releaseSha,
  });
  assert.equal(config.deploymentTier, 'staging');
  assert.equal(config.releaseSha, releaseSha);
  assert.equal(config.databaseSocketPath, socketPath);
});

test('VPS staging accepts only an internal dedicated PostgreSQL database', () => {
  const config = readConfig({
    DATABASE_URL: 'postgresql://grantdesk_stage:synthetic-secret@postgres:5432/grantdesk_schoolwide_stage',
    DEPLOYMENT_TIER: 'staging',
    STAGING_PLATFORM: 'vps',
    RELEASE_SHA: 'b'.repeat(40),
  });
  assert.equal(config.stagingPlatform, 'vps');
  assert.equal(config.databaseSocketPath, undefined);
});

test('VPS staging refuses public database hosts and shared production databases', () => {
  const staging = {
    DEPLOYMENT_TIER: 'staging',
    STAGING_PLATFORM: 'vps',
    RELEASE_SHA: 'b'.repeat(40),
  };
  assert.throws(() => readConfig({
    ...staging,
    DATABASE_URL: 'postgresql://grantdesk_stage:synthetic-secret@203.0.113.10:5432/grantdesk_schoolwide_stage',
  }), /dedicated internal postgres service/);
  assert.throws(() => readConfig({
    ...staging,
    DATABASE_URL: 'postgresql://grantdesk_stage:synthetic-secret@postgres:5432/margin',
  }), /dedicated internal postgres service/);
  assert.throws(() => readConfig({
    ...staging,
    DATABASE_URL: 'postgresql://grantdesk_stage:synthetic-secret@postgres:5432/grantdesk_schoolwide_stage',
    DATABASE_SOCKET_PATH: '/cloudsql/unexpected',
  }), /must not set DATABASE_SOCKET_PATH/);
  assert.throws(() => readConfig({
    ...staging,
    DATABASE_URL: 'postgresql://grantdesk_stage@postgres:5432/grantdesk_schoolwide_stage',
  }), /dedicated internal postgres service/);
});

test('VPS staging cannot silently become a production configuration', () => {
  assert.throws(() => readConfig({
    DATABASE_URL: 'postgresql://grantdesk_stage:synthetic-secret@postgres:5432/grantdesk_schoolwide_stage',
    DEPLOYMENT_TIER: 'production',
    STAGING_PLATFORM: 'vps',
    RELEASE_SHA: 'b'.repeat(40),
  }), /cannot be used as a production cutover flag/);
});

test('VPS host staging accepts the isolated local PostgreSQL 18 cluster with peer auth', () => {
  const config = readConfig({
    DATABASE_URL: 'postgresql://grantdesk_stage@localhost:55432/grantdesk_schoolwide_stage',
    DATABASE_SOCKET_PATH: '/var/run/postgresql',
    DEPLOYMENT_TIER: 'staging',
    STAGING_PLATFORM: 'vps-host',
    RELEASE_SHA: 'c'.repeat(40),
  });
  assert.equal(config.stagingPlatform, 'vps-host');
  assert.equal(config.databaseSocketPath, '/var/run/postgresql');
  assert.equal(config.legacyProductionWrites, 'forbidden');
});

test('VPS host staging fails closed for Margin DB, alternate role, port, socket, or password', () => {
  const safe = {
    DATABASE_URL: 'postgresql://grantdesk_stage@localhost:55432/grantdesk_schoolwide_stage',
    DATABASE_SOCKET_PATH: '/var/run/postgresql',
    DEPLOYMENT_TIER: 'staging',
    STAGING_PLATFORM: 'vps-host',
    RELEASE_SHA: 'c'.repeat(40),
  };
  for (const databaseUrl of [
    'postgresql://margin@localhost:5432/margin',
    'postgresql://margin@localhost:55432/grantdesk_schoolwide_stage',
    'postgresql://grantdesk_stage@localhost:5432/grantdesk_schoolwide_stage',
    'postgresql://grantdesk_stage@203.0.113.3:55432/grantdesk_schoolwide_stage',
    'postgresql://grantdesk_stage:guess@localhost:55432/grantdesk_schoolwide_stage',
    'postgresql://grantdesk_stage@localhost:55432/margin',
    'postgresql://grantdesk_stage@localhost:55432/grantdesk_schoolwide_stage?sslmode=disable',
  ]) {
    assert.throws(() => readConfig({ ...safe, DATABASE_URL: databaseUrl }), /dedicated PostgreSQL cluster/);
  }
  assert.throws(() => readConfig({ ...safe, DATABASE_SOCKET_PATH: '/tmp' }), /local PostgreSQL Unix socket/);
  assert.throws(() => readConfig({ ...safe, DEPLOYMENT_TIER: 'production' }), /production cutover flag/);
});
