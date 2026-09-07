import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import type { AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import { seedTwoSchoolFixture, type TwoSchoolFixture } from '../db/test-fixtures.js';
import { StudentCredentialService } from './service.js';
import { StudentCredentialError, type StudentIdentityProvider, type VerifiedStudentIdentity } from './types.js';

const databaseUrl = process.env.DATABASE_URL;
const TEST_PEPPER = 'synthetic-sw050-pepper-not-a-real-secret';
const TEST_LEGACY_SALT = 'synthetic-legacy-salt';
const PIN_A = '123456';
const PIN_A2 = '654321';

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 8787,
  logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide',
  dbPoolMax: 2,
  instanceId: 'student-credential-test',
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
};

class ClientDatabase implements Database {
  readonly #client: PoolClient;
  constructor(client: PoolClient) { this.#client = client; }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    const result = await this.#client.query<T>(sql, [...parameters]);
    return result.rows;
  }
  async close(): Promise<void> {}
}

class FixtureStudentIdentityProvider implements StudentIdentityProvider {
  readonly #mapping: Readonly<Record<string, VerifiedStudentIdentity>>;
  constructor(base: TwoSchoolFixture) {
    this.#mapping = {
      'student-a': { provider: 'SYNTHETIC', subject: 'student-subject-a', studentId: base.studentA },
      'student-a2': { provider: 'SYNTHETIC', subject: 'student-subject-a2', studentId: base.studentA2 },
      'student-b': { provider: 'SYNTHETIC', subject: 'student-subject-b', studentId: base.studentB },
    };
  }
  async verify(assertion: string): Promise<VerifiedStudentIdentity> {
    const identity = this.#mapping[assertion];
    if (!identity) throw new StudentCredentialError('STUDENT_AUTH_REQUIRED', 'Synthetic student identity rejected.', 401);
    return identity;
  }
}

class MutableClock {
  #milliseconds = Date.parse('2026-09-08T12:00:00.000Z');
  now = (): Date => new Date(this.#milliseconds);
  advance(milliseconds: number): void { this.#milliseconds += milliseconds; }
}

type FixtureContext = {
  client: PoolClient;
  database: ClientDatabase;
  base: TwoSchoolFixture;
  provider: FixtureStudentIdentityProvider;
  clock: MutableClock;
  service: StudentCredentialService;
};

async function withFixture(pool: Pool, fn: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const base = await seedTwoSchoolFixture(client);
    await client.query(
      `INSERT INTO enrollments (school_id, section_id, student_id, source)
       VALUES ($1, $2, $3, 'MANUAL'), ($1, $4, $3, 'MANUAL'),
              ($1, $2, $5, 'MANUAL'), ($6, $7, $8, 'MANUAL')`,
      [base.schoolA, base.sectionA1, base.studentA, base.sectionA2, base.studentA2, base.schoolB, base.sectionB1, base.studentB],
    );
    const database = new ClientDatabase(client);
    const provider = new FixtureStudentIdentityProvider(base);
    const clock = new MutableClock();
    const service = new StudentCredentialService(database, provider, {
      pepper: TEST_PEPPER,
      legacyPinSalt: TEST_LEGACY_SALT,
      proofTtlMs: 1_000,
      maxFailures: 2,
      attemptWindowMs: 60_000,
      throttleBlockMs: 30_000,
      now: clock.now,
    });
    await fn({ client, database, base, provider, clock, service });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<StudentCredentialError> {
  try {
    await promise;
    assert.fail(`Expected ${code}.`);
  } catch (error) {
    assert.ok(error instanceof StudentCredentialError);
    assert.equal(error.code, code);
    return error;
  }
}

test('SW-050 student credential and action proof service', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4, application_name: 'grantdesk-schoolwide:sw050-test' });
  try {
    await t.test('T-PIN-001 correct PIN creates proof only for requested action through the student route', async () => {
      await withFixture(pool, async ({ service, database, provider, clock, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const app = buildApp({
          config,
          database,
          studentIdentityProvider: provider,
          studentCredentialOptions: {
            pepper: TEST_PEPPER, legacyPinSalt: TEST_LEGACY_SALT, proofTtlMs: 1_000,
            maxFailures: 2, attemptWindowMs: 60_000, throttleBlockMs: 30_000, now: clock.now,
          },
        });
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/student/actions/authorize',
          headers: { 'x-student-identity-assertion': 'student-a' },
          payload: { pin: PIN_A, action: 'CHECKIN', sectionId: base.sectionA1, clientAttemptNonce: 'attempt-1' },
        });
        assert.equal(response.statusCode, 201);
        const body = response.json<{ actionProof: string; action: string; sectionId: string }>();
        assert.equal(body.action, 'CHECKIN');
        assert.equal(body.sectionId, base.sectionA1);
        assert.ok(body.actionProof.length >= 40);
        const consumed = await service.consumeActionProof({ proof: body.actionProof, studentId: base.studentA, action: 'CHECKIN', sectionId: base.sectionA1 });
        assert.equal(consumed.studentId, base.studentA);
        await app.close();
      });
    });

    await t.test('T-PIN-002 wrong PIN creates no proof and records a failed attempt', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        await expectCode(service.authorizeAction({ identityAssertion: 'student-a', pin: '000000', action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID() }), 'PIN_INVALID');
        const attempts = await client.query<{ outcome: string }>(
          `SELECT outcome FROM student_credential_attempts WHERE student_id = $1 ORDER BY attempted_at`,
          [base.studentA],
        );
        assert.deepEqual(attempts.rows.map((row) => row.outcome), ['FAILURE']);
        const proofs = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM action_proofs WHERE student_id = $1', [base.studentA]);
        assert.equal(proofs.rows[0]?.count, '0');
      });
    });

    await t.test('T-PIN-003 proof expires at the configured short TTL', async () => {
      await withFixture(pool, async ({ service, clock, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID() });
        clock.advance(1_001);
        await expectCode(service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'CHECKIN', sectionId: base.sectionA1 }), 'ACTION_PROOF_EXPIRED');
      });
    });

    await t.test('T-PIN-004 concurrent replay consumes a proof exactly once', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'RETURN', correlationId: randomUUID() });
        const results = await Promise.allSettled([
          service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'RETURN' }),
          service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'RETURN' }),
        ]);
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
        const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        assert.ok(rejected?.reason instanceof StudentCredentialError);
        assert.equal(rejected.reason.code, 'ACTION_PROOF_USED');
      });
    });

    await t.test('T-PIN-005 CHECKIN proof cannot authorize PASS_REQUEST', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID() });
        await expectCode(service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'PASS_REQUEST', sectionId: base.sectionA1 }), 'ACTION_WRONG_CONTEXT');
      });
    });

    await t.test('T-PIN-006 PASS_REQUEST proof cannot authorize RETURN', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'PASS_REQUEST', sectionId: base.sectionA1, correlationId: randomUUID() });
        await expectCode(service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'RETURN' }), 'ACTION_WRONG_CONTEXT');
      });
    });

    await t.test('T-PIN-007 client cannot select another student and a proof is student-bound', async () => {
      await withFixture(pool, async ({ service, database, provider, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'RETURN', correlationId: randomUUID() });
        await expectCode(service.consumeActionProof({ proof: issued.proof, studentId: base.studentA2, action: 'RETURN' }), 'ACTION_WRONG_CONTEXT');
        const app = buildApp({ config, database, studentIdentityProvider: provider, studentCredentialOptions: { pepper: TEST_PEPPER } });
        const response = await app.inject({
          method: 'POST', url: '/api/v1/student/actions/authorize',
          headers: { 'x-student-identity-assertion': 'student-a' },
          payload: { pin: PIN_A, action: 'RETURN', studentId: base.studentA2 },
        });
        assert.equal(response.statusCode, 400);
        await app.close();
      });
    });

    await t.test('T-PIN-008 section-bound proof and authorization reject wrong membership or school', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID() });
        await expectCode(service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'CHECKIN', sectionId: base.sectionA2 }), 'ACTION_WRONG_CONTEXT');
        await expectCode(service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'CHECKIN', sectionId: base.sectionB1, correlationId: randomUUID() }), 'ACTION_WRONG_CONTEXT');
      });
    });

    await t.test('T-PIN-009 credential rotation invalidates outstanding proof by version', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'RETURN', correlationId: randomUUID() });
        const rotated = await service.rotatePin(base.studentA, '111111');
        assert.equal(rotated.credentialVersion, issued.credentialVersion + 1);
        await expectCode(service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'RETURN' }), 'ACTION_CREDENTIAL_ROTATED');
      });
    });

    await t.test('T-PIN-010 database/error surfaces contain hashes rather than PIN or proof secrets', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'RETURN', clientAttemptNonce: 'nonce-secret', correlationId: randomUUID() });
        const credential = await client.query<{ secret_hash: string; secret_salt: string | null }>(
          'SELECT secret_hash, secret_salt FROM student_credentials WHERE student_id = $1', [base.studentA],
        );
        const proof = await client.query<{ token_hash: string }>('SELECT token_hash FROM action_proofs WHERE id = $1', [issued.proofId]);
        const attempt = await client.query<{ client_attempt_nonce_hash: string | null }>(
          'SELECT client_attempt_nonce_hash FROM student_credential_attempts WHERE student_id = $1 AND outcome = $2', [base.studentA, 'SUCCESS'],
        );
        assert.notEqual(credential.rows[0]?.secret_hash, PIN_A);
        assert.ok((credential.rows[0]?.secret_salt?.length ?? 0) >= 16);
        assert.notEqual(proof.rows[0]?.token_hash, issued.proof);
        assert.notEqual(attempt.rows[0]?.client_attempt_nonce_hash, 'nonce-secret');
        const error = await expectCode(service.authorizeAction({ identityAssertion: 'student-a', pin: '000000', action: 'RETURN', correlationId: randomUUID() }), 'PIN_INVALID');
        assert.equal(JSON.stringify({ code: error.code, message: error.message }).includes('000000'), false);
      });
    });

    await t.test('T-PIN-011 one canonical student can authorize safely in multiple active sections', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const first = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID() });
        const second = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'PASS_REQUEST', sectionId: base.sectionA2, correlationId: randomUUID() });
        assert.equal(first.studentId, base.studentA);
        assert.equal(second.studentId, base.studentA);
        assert.notEqual(first.proof, second.proof);
      });
    });

    await t.test('T-PIN-012 throttling is student-scoped and does not deny an unrelated student', async () => {
      await withFixture(pool, async ({ service, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        await service.provisionPin(base.studentA2, PIN_A2);
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await expectCode(service.authorizeAction({ identityAssertion: 'student-a', pin: '000000', action: 'RETURN', correlationId: randomUUID() }), 'PIN_INVALID');
        }
        await expectCode(service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'RETURN', correlationId: randomUUID() }), 'PIN_THROTTLED');
        const other = await service.authorizeAction({ identityAssertion: 'student-a2', pin: PIN_A2, action: 'RETURN', correlationId: randomUUID() });
        assert.equal(other.studentId, base.studentA2);
      });
    });

    await t.test('legacy compatibility verifier upgrades successful PIN to strong credential before issuing proof', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        await service.provisionLegacyCompatibilityPin(base.studentA, PIN_A);
        const before = await client.query<{ verifier_scheme: string; credential_version: number; secret_salt: string | null }>(
          'SELECT verifier_scheme, credential_version, secret_salt FROM student_credentials WHERE student_id = $1', [base.studentA],
        );
        assert.equal(before.rows[0]?.verifier_scheme, 'LEGACY_SHA256_SALT_V1');
        assert.equal(before.rows[0]?.secret_salt, null);
        const issued = await service.authorizeAction({ identityAssertion: 'student-a', pin: PIN_A, action: 'RETURN', correlationId: randomUUID() });
        const after = await client.query<{ verifier_scheme: string; credential_version: number; secret_salt: string | null }>(
          'SELECT verifier_scheme, credential_version, secret_salt FROM student_credentials WHERE student_id = $1', [base.studentA],
        );
        assert.equal(after.rows[0]?.verifier_scheme, 'SCRYPT_PEPPER_V1');
        assert.equal(after.rows[0]?.credential_version, 2);
        assert.ok((after.rows[0]?.secret_salt?.length ?? 0) >= 16);
        assert.equal(issued.credentialVersion, 2);
        await service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'RETURN' });
      });
    });
  } finally {
    await pool.end();
  }
});
