import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSource, inspectServer, inspectAppDefaults, verifyDisabledPinHandoff } from './verify-disabled-pin-handoff.mjs';

test('SW-178 current runtime keeps the experimental PIN handoff disconnected', async () => {
  assert.match(await verifyDisabledPinHandoff(), /PASS/);
});

test('SW-178 rejects direct and re-exported application imports', () => {
  assert.equal(inspectSource('app.ts', "import { issueSyntheticLegacyPinAttestation } from './credential-continuity/synthetic-pin-attestation.js';").length, 1);
  assert.equal(inspectSource('credential-continuity/routes.ts', "export * from './postgres-synthetic-replay.js';").length, 1);
  assert.equal(inspectSource('student-credentials/routes.ts', "import type { LegacyPinAttestationRequest } from '../credential-continuity/synthetic-pin-attestation.js';").length, 1);
});

test('SW-178 rejects dynamic imports and undeclared module loads', () => {
  assert.equal(inspectSource('app.ts', "await import('./credential-continuity/postgres-synthetic-replay.js');").length, 1);
  assert.equal(inspectSource('app.ts', "require('./credential-continuity/synthetic-pin-attestation.js');").length, 1);
  assert.equal(inspectSource('app.ts', "await import(modulePath);").length, 1);
});

test('SW-178 permits separate synthetic tests and ordinary unrelated application imports', () => {
  assert.deepEqual(inspectSource('credential-continuity/synthetic-pin-attestation.test.ts',
    "import { issueSyntheticLegacyPinAttestation } from './synthetic-pin-attestation.js';"), []);
  assert.deepEqual(inspectSource('app.ts', "import { registerCredentialContinuityRoutes } from './credential-continuity/routes.js';"), []);
});

test('SW-178 protects server identity-provider defaults against accidental activation', () => {
  assert.deepEqual(inspectServer("const app = buildApp({ config, database });"), []);
  assert.equal(inspectServer("const app = buildApp({ config, database, studentIdentityProvider });").length, 1);
  assert.equal(inspectServer("const app = buildApp({ config, database, identityProvider });").length, 1);
  assert.equal(inspectServer("const app = buildApp(options);").length, 1);
});

test('SW-178 application defaults stay disabled even when server supplies no providers', () => {
  const safe = "function buildApp({ identityProvider = new DisabledStaffIdentityProvider(), studentIdentityProvider = new DisabledStudentIdentityProvider(), classroomProvider = new DisabledClassroomProvider() }) {}";
  assert.deepEqual(inspectAppDefaults(safe), []);
  const unsafe = safe.replace('new DisabledStudentIdentityProvider()', 'new LiveStudentIdentityProvider()');
  assert.equal(inspectAppDefaults(unsafe).length, 1);
  assert.equal(inspectAppDefaults('function buildApp(options) {}').length, 1);
});
