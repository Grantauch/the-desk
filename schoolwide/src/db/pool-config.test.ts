import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from 'pg';
import { databaseConnectionOptions } from './pool-config.js';

test('explicit Unix socket wins over localhost in staging URL', () => {
  const options = databaseConnectionOptions({
    databaseUrl: 'postgresql://grantdesk_stage@localhost:55432/grantdesk_schoolwide_stage',
    databaseSocketPath: '/var/run/postgresql',
  });
  assert.equal(options.host, '/var/run/postgresql');
  assert.equal(options.port, 55432);
  assert.equal(options.user, 'grantdesk_stage');
  assert.equal(options.database, 'grantdesk_schoolwide_stage');
  assert.equal(options.connectionString, undefined);

  // Regression for node-postgres: a connectionString re-parsed by pg would
  // override the explicit socket host and silently select localhost TCP.
  const client = new Client(options);
  assert.equal(client.connectionParameters.host, '/var/run/postgresql');
  assert.equal(client.connectionParameters.port, 55432);
});

test('Cloud SQL staging also retains its mounted socket', () => {
  const options = databaseConnectionOptions({
    databaseUrl: 'postgresql://clouduser:synthetic@localhost:5432/schoolwide',
    databaseSocketPath: '/cloudsql/synthetic-project:region:instance',
  });
  assert.equal(options.host, '/cloudsql/synthetic-project:region:instance');
  assert.equal(options.connectionString, undefined);
  const client = new Client(options);
  assert.equal(client.connectionParameters.host, '/cloudsql/synthetic-project:region:instance');
});

test('non-socket connections continue to use the original URL', () => {
  const url = 'postgresql://synthetic:password@127.0.0.1:5432/test';
  const options = databaseConnectionOptions({ databaseUrl: url });
  assert.equal(options.connectionString, url);
});
