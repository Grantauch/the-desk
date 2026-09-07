import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { buildApp } from '../app.js';
import type { AppConfig } from '../config.js';
import { StudentCredentialService } from '../student-credentials/service.js';
import {
  ClientTransactionalDatabase,
  FixtureStaffIdentityProvider,
  FixtureStudentIdentityProvider,
  seedCheckInFixture,
} from './test-fixtures.js';

const databaseUrl = process.env.DATABASE_URL;

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 8787,
  logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide',
  dbPoolMax: 2,
  instanceId: 'checkin-test',
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
};

type FixtureContext = {
  client: PoolClient;
  app: ReturnType<typeof buildApp>;
  base: Awaited<ReturnType<typeof seedCheckInFixture>>;
  clock: { now: Date };
};

function detroit(date: string, time: string): Date {
  return new Date(`${date}T${time}-04:00`);
}

async function withFixture(pool: Pool, fn: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  let app: ReturnType<typeof buildApp> | null = null;
  try {
    const base = await seedCheckInFixture(client);
    const database = new ClientTransactionalDatabase(client);
    const clock = { now: detroit('2026-09-08', '08:02:00') };
    const studentIdentityProvider = new FixtureStudentIdentityProvider(base);
    const credentialOptions = { pepper: 'synthetic-sw060-pepper', now: () => clock.now, proofTtlMs: 90_000 };
    const credentialService = new StudentCredentialService(database, studentIdentityProvider, credentialOptions);
    await credentialService.provisionPin(base.studentA, '123456');
    await credentialService.provisionPin(base.studentA2, '654321');

    app = buildApp({
      config,
      database,
      identityProvider: new FixtureStaffIdentityProvider(),
      studentIdentityProvider,
      studentCredentialOptions: credentialOptions,
      checkInOptions: { now: () => clock.now },
      sessionTtlMs: 30 * 60_000,
    });
    await fn({ client, app, base, clock });
  } finally {
    if (app) await app.close();
    await client.query('ROLLBACK');
    client.release();
  }
}

async function authorizeCheckIn(
  app: ReturnType<typeof buildApp>,
  sectionId: string,
  assertion = 'student-a',
  pin = '123456',
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/student/actions/authorize',
    headers: { 'x-student-identity-assertion': assertion },
    payload: { pin, action: 'CHECKIN', sectionId },
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json() as { actionProof?: string };
  assert.ok(body.actionProof);
  return body.actionProof;
}

async function studentCheckIn(
  app: ReturnType<typeof buildApp>,
  sectionId: string,
  actionProof: string,
  idempotencyKey: string,
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/checkins',
    headers: { 'idempotency-key': idempotencyKey },
    payload: { actionProof, sectionId },
  });
}

async function teacherToken(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/session',
    payload: { assertion: 'teacher-a' },
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json() as { token?: string };
  assert.ok(body.token);
  return body.token;
}

async function proofConsumedAt(client: PoolClient, proof: string): Promise<Date | null> {
  const { createHash } = await import('node:crypto');
  const tokenHash = createHash('sha256').update(proof, 'utf8').digest('hex');
  const result = await client.query<{ consumed_at: Date | null }>(
    'SELECT consumed_at FROM action_proofs WHERE token_hash = $1',
    [tokenHash],
  );
  return result.rows[0]?.consumed_at ?? null;
}

test('SW-060 Check-In', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4, application_name: 'grantdesk-schoolwide:checkin-test' });

  try {
    await t.test('T-CI-001 fresh CHECKIN proof at exact class start creates one Check-In with audit and outbox', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:00:00');
        const proof = await authorizeCheckIn(app, base.sectionA1);
        const response = await studentCheckIn(app, base.sectionA1, proof, 'ci-001');
        assert.equal(response.statusCode, 201, response.body);
        const body = response.json() as { created: boolean; pointValue: number; streak: number; checkInId: string };
        assert.equal(body.created, true);
        assert.equal(body.pointValue, 1);
        assert.equal(body.streak, 1);
        assert.ok(body.checkInId);

        const counts = await client.query<{ checkins: string; audits: string; outbox: string }>(
          `SELECT
             (SELECT count(*)::text FROM checkins) AS checkins,
             (SELECT count(*)::text FROM audit_events WHERE action = 'CHECKIN_CREATED') AS audits,
             (SELECT count(*)::text FROM transactional_outbox WHERE event_type = 'CHECKIN_CREATED') AS outbox`,
        );
        assert.deepEqual(counts.rows[0], { checkins: '1', audits: '1', outbox: '1' });
        assert.ok(await proofConsumedAt(client, proof));
      });
    });

    await t.test('T-SCH-006 exact five-minute window end is rejected and proof consumption rolls back', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:04:59');
        const proof = await authorizeCheckIn(app, base.sectionA1);
        clock.now = detroit('2026-09-08', '08:05:00');
        const response = await studentCheckIn(app, base.sectionA1, proof, 'ci-window-end');
        assert.equal(response.statusCode, 409, response.body);
        assert.equal((response.json() as { code: string }).code, 'CHECKIN_WINDOW_CLOSED');
        const rows = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM checkins');
        assert.equal(rows.rows[0]?.count, '0');
        assert.equal(await proofConsumedAt(client, proof), null);
      });
    });

    await t.test('T-CI-002 idempotent retry and fresh duplicate never create a second Check-In or point', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:02:00');
        const proof = await authorizeCheckIn(app, base.sectionA1);
        const first = await studentCheckIn(app, base.sectionA1, proof, 'ci-retry');
        assert.equal(first.statusCode, 201, first.body);
        const firstBody = first.json() as { checkInId: string };

        const retry = await studentCheckIn(app, base.sectionA1, proof, 'ci-retry');
        assert.equal(retry.statusCode, 201, retry.body);
        assert.equal((retry.json() as { checkInId: string }).checkInId, firstBody.checkInId);

        const secondProof = await authorizeCheckIn(app, base.sectionA1);
        const duplicate = await studentCheckIn(app, base.sectionA1, secondProof, 'ci-fresh-duplicate');
        assert.equal(duplicate.statusCode, 200, duplicate.body);
        const duplicateBody = duplicate.json() as { checkInId: string; created: boolean };
        assert.equal(duplicateBody.checkInId, firstBody.checkInId);
        assert.equal(duplicateBody.created, false);

        const totals = await client.query<{ count: string; points: string; audits: string; outbox: string }>(
          `SELECT count(*)::text AS count,
                  coalesce(sum(point_value), 0)::text AS points,
                  (SELECT count(*)::text FROM audit_events WHERE action = 'CHECKIN_CREATED') AS audits,
                  (SELECT count(*)::text FROM transactional_outbox WHERE event_type = 'CHECKIN_CREATED') AS outbox
             FROM checkins`,
        );
        assert.deepEqual(totals.rows[0], { count: '1', points: '1', audits: '1', outbox: '1' });
      });
    });

    await t.test('T-CI-003 wrong section or deactivated membership fails with no Check-In and reusable proof', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:02:00');
        const wrongContextProof = await authorizeCheckIn(app, base.sectionA1);
        const wrongContext = await studentCheckIn(app, base.sectionA2, wrongContextProof, 'ci-wrong-section');
        assert.equal(wrongContext.statusCode, 403, wrongContext.body);
        assert.equal((wrongContext.json() as { code: string }).code, 'ACTION_WRONG_CONTEXT');
        assert.equal(await proofConsumedAt(client, wrongContextProof), null);

        const membershipProof = await authorizeCheckIn(app, base.sectionA1);
        await client.query(
          `UPDATE enrollments
              SET status = 'INACTIVE', left_at = $1::timestamptz, updated_at = $1::timestamptz
            WHERE school_id = $2 AND section_id = $3 AND student_id = $4`,
          [clock.now.toISOString(), base.schoolA, base.sectionA1, base.studentA],
        );
        const inactive = await studentCheckIn(app, base.sectionA1, membershipProof, 'ci-inactive-membership');
        assert.equal(inactive.statusCode, 403, inactive.body);
        assert.equal((inactive.json() as { code: string }).code, 'STUDENT_NOT_AVAILABLE_IN_SECTION');
        assert.equal(await proofConsumedAt(client, membershipProof), null);
        const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM checkins');
        assert.equal(count.rows[0]?.count, '0');
      });
    });

    await t.test('T-CI-004 explicit no-school calendar day fails closed with no writes', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-09', '08:02:00');
        const proof = await authorizeCheckIn(app, base.sectionA1);
        const response = await studentCheckIn(app, base.sectionA1, proof, 'ci-no-school');
        assert.equal(response.statusCode, 409, response.body);
        assert.equal((response.json() as { code: string }).code, 'CLASS_NOT_IN_SESSION');
        assert.equal(await proofConsumedAt(client, proof), null);
        const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM checkins');
        assert.equal(count.rows[0]?.count, '0');
      });
    });

    await t.test('T-CI-005 teacher backup is section-scoped, audited, and survives malformed bell configuration', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-11', '13:00:00');
        const token = await teacherToken(app);
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/teacher/sections/${base.sectionA1}/checkins`,
          headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'teacher-backup-1' },
          payload: { studentId: base.studentA2, note: 'Synthetic teacher backup' },
        });
        assert.equal(response.statusCode, 201, response.body);
        assert.equal((response.json() as { authorizationMethod: string }).authorizationMethod, 'TEACHER_BACKUP');

        const evidence = await client.query<{ actor_kind: string; actor_user_id: string | null; authorization_method: string }>(
          `SELECT a.actor_kind, a.actor_user_id, c.authorization_method
             FROM checkins c
             JOIN audit_events a ON a.target_type = 'CHECKIN' AND a.target_id = c.id::text
            WHERE c.student_id = $1`,
          [base.studentA2],
        );
        assert.equal(evidence.rows[0]?.actor_kind, 'USER');
        assert.equal(evidence.rows[0]?.actor_user_id, base.teacherA);
        assert.equal(evidence.rows[0]?.authorization_method, 'TEACHER_BACKUP');

        const denied = await app.inject({
          method: 'POST',
          url: `/api/v1/teacher/sections/${base.sectionA2}/checkins`,
          headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'teacher-forged-section' },
          payload: { studentId: base.studentA },
        });
        assert.equal(denied.statusCode, 403, denied.body);
        const forbiddenCount = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM checkins WHERE section_id = $1',
          [base.sectionA2],
        );
        assert.equal(forbiddenCount.rows[0]?.count, '0');
      });
    });

    await t.test('T-AUD-006 downstream outbox failure rolls back proof, Check-In, audit, and idempotency together', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:02:00');
        const proof = await authorizeCheckIn(app, base.sectionA1);
        await client.query(`
          CREATE FUNCTION sw060_fail_checkin_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.event_type = 'CHECKIN_CREATED' THEN RAISE EXCEPTION 'synthetic outbox failure'; END IF;
            RETURN NEW;
          END;
          $$;
          CREATE TRIGGER sw060_fail_checkin_outbox_trigger
          BEFORE INSERT ON transactional_outbox
          FOR EACH ROW EXECUTE FUNCTION sw060_fail_checkin_outbox();
        `);

        const failed = await studentCheckIn(app, base.sectionA1, proof, 'ci-atomic-failure');
        assert.equal(failed.statusCode, 500, failed.body);
        const counts = await client.query<{ checkins: string; audits: string; idem: string }>(
          `SELECT
             (SELECT count(*)::text FROM checkins) AS checkins,
             (SELECT count(*)::text FROM audit_events WHERE action = 'CHECKIN_CREATED') AS audits,
             (SELECT count(*)::text FROM idempotency_keys WHERE key = 'ci-atomic-failure') AS idem`,
        );
        assert.deepEqual(counts.rows[0], { checkins: '0', audits: '0', idem: '0' });
        assert.equal(await proofConsumedAt(client, proof), null);

        await client.query('DROP TRIGGER sw060_fail_checkin_outbox_trigger ON transactional_outbox');
        await client.query('DROP FUNCTION sw060_fail_checkin_outbox()');
        const retry = await studentCheckIn(app, base.sectionA1, proof, 'ci-atomic-failure');
        assert.equal(retry.statusCode, 201, retry.body);
      });
    });

    await t.test('T-CI-006 Check-In facts are append-only and ordinary action cannot erase history', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:02:00');
        const proof = await authorizeCheckIn(app, base.sectionA1);
        const response = await studentCheckIn(app, base.sectionA1, proof, 'ci-append-only');
        assert.equal(response.statusCode, 201, response.body);
        const id = (response.json() as { checkInId: string }).checkInId;

        await assert.rejects(
          client.query('UPDATE checkins SET note_private = $1 WHERE id = $2', ['erase history', id]),
          (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P0001',
        );
        const row = await client.query<{ status: string; note_private: string | null }>(
          'SELECT status, note_private FROM checkins WHERE id = $1',
          [id],
        );
        assert.deepEqual(row.rows[0], { status: 'CHECKED_IN', note_private: null });
      });
    });

    await t.test('T-CI-007 streak follows official school-calendar days instead of Monday-Friday', async () => {
      await withFixture(pool, async ({ app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:02:00');
        const firstProof = await authorizeCheckIn(app, base.sectionA1);
        const first = await studentCheckIn(app, base.sectionA1, firstProof, `ci-streak-${randomUUID()}`);
        assert.equal(first.statusCode, 201, first.body);
        assert.equal((first.json() as { streak: number }).streak, 1);

        clock.now = detroit('2026-09-10', '08:02:00');
        const secondProof = await authorizeCheckIn(app, base.sectionA1);
        const second = await studentCheckIn(app, base.sectionA1, secondProof, `ci-streak-${randomUUID()}`);
        assert.equal(second.statusCode, 201, second.body);
        assert.equal((second.json() as { streak: number }).streak, 2);
      });
    });
  } finally {
    await pool.end();
  }
});
