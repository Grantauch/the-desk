import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import type { Database } from './db/database.js';

const releaseSha='a'.repeat(40);
const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 8787,
  logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide',
  dbPoolMax: 2,
  instanceId: 'test',
  deploymentTier: 'staging',
  releaseSha,
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
};

class FakeDatabase implements Database {
  fail = false;
  closed = false;

  async query<T>(): Promise<readonly T[]> {
    if (this.fail) throw new Error('fixture database unavailable');
    return [];
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

test('root fingerprint identifies the exact SW-170 staging release', async () => {
  const database = new FakeDatabase();
  const app = buildApp({ config, database });
  const response = await app.inject({ method: 'GET', url: '/' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    service: 'grantdesk-schoolwide',
    version: 'sw-170',
    status: 'staging-release-readiness',
    deploymentTier: 'staging',
    releaseSha,
  });
  await app.close();
});

test('liveness endpoint is independent from database readiness', async () => {
  const database = new FakeDatabase();
  database.fail = true;
  const app = buildApp({ config, database });
  const response = await app.inject({ method: 'GET', url: '/health/live' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'ok');
  assert.equal(response.json().releaseSha, releaseSha);
  await app.close();
  assert.equal(database.closed, true);
});

test('readiness fails closed when the database is unavailable', async () => {
  const database = new FakeDatabase();
  database.fail = true;
  const app = buildApp({ config, database });
  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().status, 'not-ready');
  assert.equal(response.json().releaseSha, releaseSha);
  await app.close();
});

test('readiness succeeds when the database answers', async () => {
  const database = new FakeDatabase();
  const app = buildApp({ config, database });
  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'ready');
  assert.equal(response.json().releaseSha, releaseSha);
  await app.close();
});
