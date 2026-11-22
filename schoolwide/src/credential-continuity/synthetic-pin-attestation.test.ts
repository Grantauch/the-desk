import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  issueSyntheticLegacyPinAttestation,
  verifySyntheticLegacyPinAttestation,
  type SyntheticNonceConsumption,
  type LegacyPinAttestationVerification,
} from './synthetic-pin-attestation.js';

const secret = Buffer.alloc(32, 0x55); // Fictional development key only.
const now = 1_800_000_000; // Fixed simulated clock, not a real login time.
const base = {
  issuer: 'legacy-synthetic-hall-pass',
  audience: 'schoolwide-synthetic-bridge',
  schoolId: 'synthetic-school-one',
  studentAlias: 'opaque-student-alpha',
  pin: '001234',
  secret,
  nowEpochSeconds: now,
};

function nonceGuard() {
  const seen = new Set<string>();
  return async ({ nonceDigest, expiresAtEpochSeconds, issuer, schoolId }: SyntheticNonceConsumption) => {
    assert.match(nonceDigest, /^[a-f0-9]{64}$/);
    assert.equal(expiresAtEpochSeconds, now + 60);
    assert.equal(issuer, base.issuer);
    assert.equal(schoolId, base.schoolId);
    if (seen.has(nonceDigest)) return false;
    seen.add(nonceDigest);
    return true;
  };
}

function verify(
  token: string,
  consumeNonceDigest: LegacyPinAttestationVerification['consumeNonceDigest'],
  overrides: Partial<Parameters<typeof verifySyntheticLegacyPinAttestation>[0]> = {},
) {
  return verifySyntheticLegacyPinAttestation({
    token,
    expectedIssuer: base.issuer,
    expectedAudience: base.audience,
    expectedSchoolId: base.schoolId,
    expectedStudentAlias: base.studentAlias,
    pin: base.pin,
    secret,
    nowEpochSeconds: now,
    consumeNonceDigest,
    ...overrides,
  });
}

test('SW-175 exact existing PIN gives short-lived one-use authorization with no clear PIN', async () => {
  for (const pin of ['01234', '001234']) {
    const token = issueSyntheticLegacyPinAttestation({ ...base, pin });
    const payload = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    assert.doesNotMatch(payload, /"pin":/);
    assert.doesNotMatch(payload, /"pinHash":|"PIN_SALT":|"email":/);
    assert.doesNotMatch(payload, new RegExp('"' + pin + '"'));
    assert.doesNotMatch(token, new RegExp(pin));
    const guard = nonceGuard();
    const result = await verify(token, guard, { pin });
    assert.deepEqual(result, {
      schoolId: base.schoolId,
      studentAlias: base.studentAlias,
      issuedAt: now,
      expiresAt: now + 60,
    });
    await assert.rejects(verify(token, guard, { pin }), /Legacy PIN handoff rejected/);
  }
});

test('SW-175 first wrong PIN consumes the attestation; later correct guesses cannot reuse it', async () => {
  const token = issueSyntheticLegacyPinAttestation(base);
  const guard = nonceGuard();
  const wrong = '01234';
  await assert.rejects(verify(token, guard, { pin: wrong }), /Legacy PIN handoff rejected/);
  await assert.rejects(verify(token, guard), /Legacy PIN handoff rejected/);
  await assert.rejects(verify(token, guard, { pin: wrong }), /Legacy PIN handoff rejected/);
});

test('SW-175 different issuer, audience, school and student fail without consuming the nonce', async () => {
  const token = issueSyntheticLegacyPinAttestation(base);
  const guard = nonceGuard();
  for (const override of [
    { expectedIssuer: 'another-legacy-source' },
    { expectedAudience: 'another-target' },
    { expectedSchoolId: 'synthetic-school-two' },
    { expectedStudentAlias: 'opaque-student-beta' },
  ]) await assert.rejects(verify(token, guard, override), /Legacy PIN handoff rejected/);
  // The valid assertion still works, proving mismatched scope never consumed it.
  assert.equal((await verify(token, guard)).studentAlias, base.studentAlias);
});

test('SW-175 TTL and skew fail closed, including a future-dated assertion', async () => {
  const token = issueSyntheticLegacyPinAttestation(base);
  for (const at of [now + 60, now + 61, now - 6]) {
    await assert.rejects(verify(token, nonceGuard(), { nowEpochSeconds: at }), /Legacy PIN handoff rejected/);
  }
  assert.equal((await verify(token, nonceGuard(), { nowEpochSeconds: now - 5 })).studentAlias, base.studentAlias);
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, ttlSeconds: 61 }), /Legacy PIN handoff rejected/);
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, ttlSeconds: 0 }), /Legacy PIN handoff rejected/);
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, nowEpochSeconds: 0.5 }), /Legacy PIN handoff rejected/);
});

test('SW-175 invalid secrets, padded PINs, tampering and malformed envelopes are rejected', async () => {
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, pin: '1234' }), /Legacy PIN handoff rejected/);
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, pin: '1234567' }), /Legacy PIN handoff rejected/);
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, pin: '00 1234' }), /Legacy PIN handoff rejected/);
  assert.throws(() => issueSyntheticLegacyPinAttestation({ ...base, secret: Buffer.alloc(8) }), /Legacy PIN handoff rejected/);

  const token = issueSyntheticLegacyPinAttestation(base);
  const [payload, mac] = token.split('.');
  const json = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as Record<string, unknown>;
  json.schoolId = 'synthetic-school-two';
  const changedPayload = Buffer.from(JSON.stringify(json)).toString('base64url');
  // The old replacement used 'A' unconditionally. Random HMAC signatures
  // occasionally begin with 'A', making the "tampered" MAC unchanged and
  // incorrectly accepting the original token (flaky CI failure).
  const alteredMac = (mac![0] === 'A' ? 'B' : 'A') + mac!.slice(1);
  assert.notEqual(alteredMac, mac);
  for (const invalid of [
    changedPayload + '.' + mac,
    payload + '.' + alteredMac,
    token + '.extra',
    token + '=',
    token.slice(0, 15),
    '',
    'x'.repeat(4100),
  ]) await assert.rejects(verify(invalid, nonceGuard()), /Legacy PIN handoff rejected/);

  const signedExtra = { ...JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')), unused: 'bad' };
  const extraPayload = Buffer.from(JSON.stringify(signedExtra)).toString('base64url');
  const extraMac = createHmac('sha256', secret)
    .update('schoolwide-synthetic-legacy-attestation-v1\0' + extraPayload)
    .digest('base64url');
  await assert.rejects(verify(extraPayload + '.' + extraMac, nonceGuard()), /Legacy PIN handoff rejected/);
});

test('SW-175 35 parallel attempts can consume the single signed nonce only once', async () => {
  const token = issueSyntheticLegacyPinAttestation(base);
  const guard = nonceGuard();
  const results = await Promise.allSettled(
    Array.from({ length: 35 }, () => verify(token, guard)),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 34);
});

test('SW-175 atomic nonce store errors fail closed without leaking credentials', async () => {
  const token = issueSyntheticLegacyPinAttestation(base);
  const unavailable = async () => { throw new Error('synthetic store failure'); };
  const err = await verify(token, unavailable).then(() => 'unexpected success', (reason: Error) => reason.message);
  assert.equal(err, 'Legacy PIN handoff rejected.');
  assert.doesNotMatch(err, /001234|opaque-student|secret|token|synthetic store failure/);
});
