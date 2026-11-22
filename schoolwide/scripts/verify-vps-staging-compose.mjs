// Synthetic-only Compose configuration guard. Reads rendered JSON from stdin;
// never logs the rendered environment because it includes a DB password.
import assert from 'node:assert/strict';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

const compose = JSON.parse(input);
const services = compose.services ?? {};
assert.deepEqual(Object.keys(services).sort(), ['app', 'migrate', 'postgres'], 'Unexpected service set.');
const postgres = services.postgres;
const migrate = services.migrate;
const app = services.app;
for (const service of [postgres, migrate]) {
  assert.ok(!service.ports || service.ports.length === 0, 'Database or migration ports are public.');
}
for (const service of [postgres, migrate, app]) {
  assert.equal(service.logging?.driver, 'json-file', 'Container logs must be bounded.');
  assert.equal(service.logging?.options?.['max-size'], '10m');
  assert.equal(String(service.logging?.options?.['max-file']), '3');
}
assert.equal(app.ports?.length, 1, 'The app must have exactly one loopback port.');
const port = app.ports[0];
assert.equal(port.host_ip, '127.0.0.1', 'The staging app must bind host loopback only.');
assert.equal(Number(port.target), 8787);
assert.equal(String(port.published), '18787');
assert.equal(postgres.depends_on, undefined, 'Database must not depend on the application.');
assert.equal(migrate.depends_on?.postgres?.condition, 'service_healthy');
assert.equal(app.depends_on?.migrate?.condition, 'service_completed_successfully');
assert.ok(postgres.volumes?.length > 0, 'The staging DB must be durable.');
assert.ok(!postgres.volumes.some((v) => String(v.source ?? '').toLowerCase().includes('margin')), 'No Margin volumes.');
for (const service of [postgres, migrate, app]) {
  assert.ok(service.mem_limit, 'Each staging service needs a memory cap.');
  assert.ok(service.cpus, 'Each staging service needs a CPU cap.');
}
assert.equal(app.environment?.DEPLOYMENT_TIER, 'staging');
assert.equal(app.environment?.STAGING_PLATFORM, 'vps');
assert.equal(app.environment?.LEGACY_PRODUCTION_WRITES, 'forbidden');
assert.equal(app.environment?.OPERATIONS_WORKERS_ENABLED, 'false');
assert.match(String(app.environment?.RELEASE_SHA ?? ''), /^[a-f0-9]{40}$/);
assert.equal(migrate.environment?.LEGACY_PRODUCTION_WRITES, 'forbidden');
const uri = new URL(app.environment?.DATABASE_URL ?? '');
assert.equal(uri.hostname, 'postgres');
assert.equal(uri.pathname, '/grantdesk_schoolwide_stage');
assert.equal(uri.username, 'grantdesk_stage');
assert.ok(uri.password, 'DB password must be defined.');
assert.ok(!Object.values(app.networks ?? {}).some((v) => v?.external), 'No external network.');
console.log('SW-172 Compose isolation check PASS (synthetic configuration; no live server verified).');
