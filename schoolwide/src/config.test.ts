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
