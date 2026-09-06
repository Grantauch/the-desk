import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from './config.js';

test('configuration defaults keep legacy production writes forbidden', () => {
  const config = readConfig({ DATABASE_URL: 'postgresql://example.invalid/schoolwide' });
  assert.equal(config.legacyProductionWrites, 'forbidden');
  assert.equal(config.legacyReadAdapterMode, 'disabled');
  assert.equal(config.port, 8787);
});

test('configuration rejects any attempt to enable legacy production writes', () => {
  assert.throws(() => readConfig({
    DATABASE_URL: 'postgresql://example.invalid/schoolwide',
    LEGACY_PRODUCTION_WRITES: 'allowed',
  }));
});
