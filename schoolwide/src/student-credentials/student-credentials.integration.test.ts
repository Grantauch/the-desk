import assert from 'node:assert/strict';
import { createHash, randomUUID, scryptSync } from 'node:crypto';
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

    await t.test('T-PIN-013 exact five-digit lunch PIN including leading zero is accepted, never padded', async () => {
      await withFixture(pool, async ({ service, database, provider, clock, base }) => {
        const fiveDigit = '01234'; // Fictional fixture, NOT an actual student's lunch number.
        await service.provisionPin(base.studentA, fiveDigit);
        const app = buildApp({
          config, database, studentIdentityProvider: provider,
          studentCredentialOptions: {
            pepper: TEST_PEPPER, legacyPinSalt: TEST_LEGACY_SALT, proofTtlMs: 1_000,
            maxFailures: 2, attemptWindowMs: 60_000, throttleBlockMs: 30_000, now: clock.now,
          },
        });
        try {
          const accepted = await app.inject({
            method: 'POST', url: '/api/v1/student/actions/authorize',
            headers: { 'x-student-identity-assertion': 'student-a' },
            payload: { pin: fiveDigit, action: 'CHECKIN', sectionId: base.sectionA1 },
          });
          assert.equal(accepted.statusCode, 201);
          assert.equal(accepted.json().action, 'CHECKIN');

          // The six-digit padded alternative is a DIFFERENT secret and must fail.
          const padded = await app.inject({
            method: 'POST', url: '/api/v1/student/actions/authorize',
            headers: { 'x-student-identity-assertion': 'student-a' },
            payload: { pin: '001234', action: 'CHECKIN', sectionId: base.sectionA1 },
          });
          assert.equal(padded.statusCode, 401);
          assert.equal(padded.json().code, 'PIN_INVALID');
        } finally { await app.close(); }
      });
    });

    await t.test('T-PIN-014 six-digit leading-zero PIN remains a distinct exact string', async () => {
      await withFixture(pool, async ({ service, database, provider, clock, base }) => {
        const sixDigit = '001234'; // Fictional fixture only.
        await service.provisionPin(base.studentA, sixDigit);
        const app = buildApp({
          config, database, studentIdentityProvider: provider,
          studentCredentialOptions: {
            pepper: TEST_PEPPER, legacyPinSalt: TEST_LEGACY_SALT, proofTtlMs: 1_000,
            maxFailures: 2, attemptWindowMs: 60_000, throttleBlockMs: 30_000, now: clock.now,
          },
        });
        try {
          const accepted = await app.inject({
            method: 'POST', url: '/api/v1/student/actions/authorize',
            headers: { 'x-student-identity-assertion': 'student-a' },
            payload: { pin: sixDigit, action: 'PASS_REQUEST', sectionId: base.sectionA1 },
          });
          assert.equal(accepted.statusCode, 201);
          assert.equal(accepted.json().action, 'PASS_REQUEST');

          const truncated = await app.inject({
            method: 'POST', url: '/api/v1/student/actions/authorize',
            headers: { 'x-student-identity-assertion': 'student-a' },
            payload: { pin: '01234', action: 'PASS_REQUEST', sectionId: base.sectionA1 },
          });
          assert.equal(truncated.statusCode, 401);
          assert.equal(truncated.json().code, 'PIN_INVALID');
        } finally { await app.close(); }
      });
    });

    await t.test('T-PIN-015 reject four/seven digits, non-digits, and numeric coercion', async () => {
      await withFixture(pool, async ({ service, database, provider, clock, base }) => {
        for (const invalidPin of ['1234', '1234567', '12a45', ' 12345']) {
          await expectCode(service.provisionPin(base.studentA, invalidPin), 'PIN_INVALID');
        }
        const app = buildApp({
          config, database, studentIdentityProvider: provider,
          studentCredentialOptions: {
            pepper: TEST_PEPPER, legacyPinSalt: TEST_LEGACY_SALT, proofTtlMs: 1_000,
            maxFailures: 2, attemptWindowMs: 60_000, throttleBlockMs: 30_000, now: clock.now,
          },
        });
        try {
          for (const invalidPin of ['1234', '1234567', '12a45', 12345]) {
            const rejected = await app.inject({
              method: 'POST', url: '/api/v1/student/actions/authorize',
              headers: { 'x-student-identity-assertion': 'student-a' },
              payload: { pin: invalidPin, action: 'CHECKIN', sectionId: base.sectionA1 },
            });
            assert.equal(rejected.statusCode, 400);
            assert.equal(rejected.json().code, 'ACTION_AUTHORIZATION_INVALID');
          }
        } finally { await app.close(); }
      });
    });

    await t.test('T-PIN-016 legacy-compatible five-digit PIN upgrades without padding', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        const fiveDigit = '00012'; // Fictional fixture only.
        await service.provisionLegacyCompatibilityPin(base.studentA, fiveDigit);
        const issued = await service.authorizeAction({
          identityAssertion: 'student-a', pin: fiveDigit,
          action: 'RETURN', correlationId: randomUUID(),
        });
        assert.ok(issued.proof.length > 40);
        const credential = await client.query<{ verifier_scheme: string }>(
          'SELECT verifier_scheme FROM student_credentials WHERE student_id=$1 AND status=$2',
          [base.studentA, 'ACTIVE'],
        );
        assert.equal(credential.rows[0]?.verifier_scheme, 'SCRYPT_PEPPER_V1');
        await expectCode(service.authorizeAction({
          identityAssertion: 'student-a', pin: '000012',
          action: 'RETURN', correlationId: randomUUID(),
        }), 'PIN_INVALID');
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

    await t.test('T-PIN-017 unassigned directory student cannot use either kiosk until a section is activated', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        await service.provisionPin(base.studentA2, PIN_A2);
        // Simulate a shared student imported to two classrooms, both pending approval.
        await client.query(
          "INSERT INTO enrollments (school_id,section_id,student_id,source,status) VALUES ($1,$2,$3,'MANUAL','PENDING_REVIEW')",
          [base.schoolA, base.sectionA2, base.studentA2],
        );
        // The directory is not the roster. Pending membership means no kiosk access.
        await client.query(
          "UPDATE enrollments SET status='PENDING_REVIEW' WHERE school_id=$1 AND student_id=$2",
          [base.schoolA, base.studentA2],
        );
        await expectCode(service.authorizeAction({
          identityAssertion: 'student-a2', pin: PIN_A2, action: 'CHECKIN',
          sectionId: base.sectionA1, correlationId: randomUUID(),
        }), 'ACTION_WRONG_CONTEXT');
        await expectCode(service.authorizeAction({
          identityAssertion: 'student-a2', pin: PIN_A2, action: 'PASS_REQUEST',
          sectionId: base.sectionA2, correlationId: randomUUID(),
        }), 'ACTION_WRONG_CONTEXT');
        const denied = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM action_proofs WHERE student_id=$1', [base.studentA2],
        );
        assert.equal(denied.rows[0]?.count, '0');

        // Teacher B activates only their own section, never teacher A's section.
        await client.query(
          "UPDATE enrollments SET status='ACTIVE' WHERE school_id=$1 AND student_id=$2 AND section_id=$3",
          [base.schoolA, base.studentA2, base.sectionA2],
        );
        const secondSection = await service.authorizeAction({
          identityAssertion: 'student-a2', pin: PIN_A2, action: 'PASS_REQUEST',
          sectionId: base.sectionA2, correlationId: randomUUID(),
        });
        assert.equal(secondSection.studentId, base.studentA2);
        assert.equal(secondSection.sectionId, base.sectionA2);
        await expectCode(service.authorizeAction({
          identityAssertion: 'student-a2', pin: PIN_A2, action: 'CHECKIN',
          sectionId: base.sectionA1, correlationId: randomUUID(),
        }), 'ACTION_WRONG_CONTEXT');
      });
    });

    await t.test('T-PIN-018 inactive student is denied despite valid PIN and prior class membership', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        await client.query("UPDATE students SET status='INACTIVE' WHERE id=$1", [base.studentA]);
        for (const sectionId of [base.sectionA1, base.sectionA2]) {
          await expectCode(service.authorizeAction({
            identityAssertion: 'student-a', pin: PIN_A, action: 'PASS_REQUEST',
            sectionId, correlationId: randomUUID(),
          }), 'STUDENT_AUTH_REQUIRED');
        }
        await expectCode(service.rotatePin(base.studentA, '99999'), 'STUDENT_AUTH_REQUIRED');
        const denied = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM action_proofs WHERE student_id=$1', [base.studentA],
        );
        assert.equal(denied.rows[0]?.count, '0');
      });
    });

    await t.test('T-PIN-019 two staff accounts isolate sections while a shared student keeps one PIN', async () => {
      await withFixture(pool, async ({ service, database, provider, client, base }) => {
        const teacherTwo = randomUUID();
        await client.query(
          "INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id) VALUES ($1,$2,'synthetic-second-teacher@example.invalid','Synthetic Teacher Two','synthetic-staff-second')",
          [teacherTwo, base.orgA],
        );
        await client.query(
          "INSERT INTO staff_profiles (user_id,organization_id,title) VALUES ($1,$2,'Teacher')",
          [teacherTwo, base.orgA],
        );
        await client.query(
          "INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'TEACHER')",
          [base.orgA, base.schoolA, teacherTwo],
        );
        await client.query(
          "INSERT INTO section_staff_assignments (organization_id,school_id,section_id,user_id,assignment_role) VALUES ($1,$2,$3,$4,'PRIMARY_TEACHER')",
          [base.orgA, base.schoolA, base.sectionA2, teacherTwo],
        );
        const staffProvider = {
          async verify(assertion: string) {
            if (assertion === 'synthetic-teacher-one') return { provider: 'SYNTHETIC' as const, subject: 'google-teacher-alpha' };
            if (assertion === 'synthetic-teacher-two') return { provider: 'SYNTHETIC' as const, subject: 'synthetic-staff-second' };
            throw new Error('Unknown fictional staff identity');
          },
        };
        const app = buildApp({
          config, database, identityProvider: staffProvider, studentIdentityProvider: provider,
          studentCredentialOptions: { pepper: TEST_PEPPER, legacyPinSalt: TEST_LEGACY_SALT },
        });
        try {
          const firstLogin = await app.inject({
            method: 'POST', url: '/auth/session', payload: { assertion: 'synthetic-teacher-one' },
          });
          const secondLogin = await app.inject({
            method: 'POST', url: '/auth/session', payload: { assertion: 'synthetic-teacher-two' },
          });
          assert.equal(firstLogin.statusCode, 201, firstLogin.body);
          assert.equal(secondLogin.statusCode, 201, secondLogin.body);
          const token1 = firstLogin.json<{ token: string }>().token;
          const token2 = secondLogin.json<{ token: string }>().token;
          for (const [token, allowed, denied] of [
            [token1, base.sectionA1, base.sectionA2],
            [token2, base.sectionA2, base.sectionA1],
          ]) {
            const own = await app.inject({
              method: 'GET', url: '/api/sections/' + allowed + '/teacher-context',
              headers: { authorization: 'Bearer ' + token },
            });
            const other = await app.inject({
              method: 'GET', url: '/api/sections/' + denied + '/teacher-context',
              headers: { authorization: 'Bearer ' + token },
            });
            assert.equal(own.statusCode, 200, own.body);
            assert.equal(other.statusCode, 403, other.body);
          }
          await service.provisionPin(base.studentA, PIN_A);
          const first = await service.authorizeAction({
            identityAssertion: 'student-a', pin: PIN_A, action: 'CHECKIN',
            sectionId: base.sectionA1, correlationId: randomUUID(),
          });
          const second = await service.authorizeAction({
            identityAssertion: 'student-a', pin: PIN_A, action: 'PASS_REQUEST',
            sectionId: base.sectionA2, correlationId: randomUUID(),
          });
          assert.equal(first.studentId, second.studentId);
          assert.notEqual(first.proof, second.proof);
          await expectCode(service.consumeActionProof({
            proof: first.proof, studentId: base.studentA, action: 'CHECKIN',
            sectionId: base.sectionA2,
          }), 'ACTION_WRONG_CONTEXT');
          const correct = await service.consumeActionProof({
            proof: first.proof, studentId: base.studentA, action: 'CHECKIN',
            sectionId: base.sectionA1,
          });
          assert.equal(correct.studentId, base.studentA);
        } finally {
          await app.close();
        }
      });
    });

    await t.test('T-PIN-022 imported fictional Hall Pass PIN hash upgrades on original PIN without resetting it', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        const existingPin = '001234'; // Fictional six-digit lunch-number form.
        // Simulate receiving only the existing Apps Script SHA-256/WebSafe verifier,
        // not the PIN Cards sheet or any real student's secret.
        const existingWebSafeHash = createHash('sha256')
          .update(TEST_LEGACY_SALT + ':' + existingPin, 'utf8')
          .digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
        await client.query(
          `INSERT INTO student_credentials
             (school_id, student_id, verifier_scheme, secret_hash, verifier_params)
           VALUES ($1,$2,'LEGACY_SHA256_SALT_V1',$3,'{"compatibilityOnly":true}'::jsonb)`,
          [base.schoolA, base.studentA, existingWebSafeHash],
        );

        // A numerically similar five-digit PIN must not be silently padded.
        await expectCode(service.authorizeAction({
          identityAssertion: 'student-a', pin: '01234',
          action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID(),
        }), 'PIN_INVALID');

        // The same six-digit PIN used in the existing Hall Pass authorizes the
        // first action. This is a verifier upgrade, NOT an issuance or rotation.
        const first = await service.authorizeAction({
          identityAssertion: 'student-a', pin: existingPin,
          action: 'CHECKIN', sectionId: base.sectionA1, correlationId: randomUUID(),
        });
        assert.equal(first.studentId, base.studentA);
        const after = await client.query<{
          verifier_scheme: string; credential_version: number; secret_hash: string; secret_salt: string | null;
        }>(
          'SELECT verifier_scheme, credential_version, secret_hash, secret_salt FROM student_credentials WHERE student_id=$1',
          [base.studentA],
        );
        assert.equal(after.rows[0]?.verifier_scheme, 'SCRYPT_PEPPER_V1');
        assert.equal(after.rows[0]?.credential_version, 2);
        assert.notEqual(after.rows[0]?.secret_hash, existingWebSafeHash);
        assert.ok((after.rows[0]?.secret_salt?.length ?? 0) >= 16);

        // That *unchanged* original PIN now verifies through strong scrypt,
        // including for another actively enrolled class of the same student.
        const second = await service.authorizeAction({
          identityAssertion: 'student-a', pin: existingPin,
          action: 'PASS_REQUEST', sectionId: base.sectionA2, correlationId: randomUUID(),
        });
        assert.equal(second.studentId, base.studentA);
        assert.notEqual(second.proof, first.proof);
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

    await t.test('new strong credentials use the current OWASP-equivalent scrypt p=5 profile', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        await service.provisionPin(base.studentA, PIN_A);
        const rows = await client.query<{ verifier_params: { N?: number; r?: number; p?: number; keyLength?: number } }>(
          'SELECT verifier_params FROM student_credentials WHERE student_id = $1',
          [base.studentA],
        );
        assert.deepEqual(rows.rows[0]?.verifier_params, { N: 16384, r: 8, p: 5, keyLength: 32 });
      });
    });

    await t.test('successful authentication upgrades an older p=1 scrypt verifier and bumps credential version', async () => {
      await withFixture(pool, async ({ service, client, base }) => {
        const salt = Buffer.alloc(16, 7);
        const hash = scryptSync(
          `${PIN_A}\u0000${TEST_PEPPER}`,
          salt,
          32,
          { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
        ).toString('hex');
        await client.query(
          `INSERT INTO student_credentials
             (school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params,credential_version,status)
           VALUES ($1,$2,'SCRYPT_PEPPER_V1',$3,$4,$5::jsonb,1,'ACTIVE')`,
          [base.schoolA, base.studentA, hash, salt.toString('base64url'), JSON.stringify({ N: 16384, r: 8, p: 1, keyLength: 32 })],
        );

        const issued = await service.authorizeAction({
          identityAssertion: 'student-a',
          pin: PIN_A,
          action: 'RETURN',
          correlationId: randomUUID(),
        });

        const after = await client.query<{ credential_version: number; verifier_params: { p?: number } }>(
          'SELECT credential_version,verifier_params FROM student_credentials WHERE student_id=$1',
          [base.studentA],
        );
        assert.equal(after.rows[0]?.credential_version, 2);
        assert.equal(after.rows[0]?.verifier_params.p, 5);
        assert.equal(issued.credentialVersion, 2);
        await service.consumeActionProof({ proof: issued.proof, studentId: base.studentA, action: 'RETURN' });
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
