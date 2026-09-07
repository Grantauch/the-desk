import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { Database, QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedHallPassFixture, hallPassFixtureIds, type HallPassFixture } from '../hall-pass/test-fixtures.js';
import { teacherAppHtml } from './ui.js';

const databaseUrl = process.env.DATABASE_URL;
const NOW = new Date('2026-09-08T12:10:00.000Z');

const config: AppConfig = {
  nodeEnv: 'test', host: '127.0.0.1', port: 8787, logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide', dbPoolMax: 2,
  instanceId: 'teacher-app-test', legacyReadAdapterMode: 'disabled', legacyProductionWrites: 'forbidden',
};

class SavepointDatabase implements TransactionalDatabase {
  readonly #client: PoolClient;
  #counter = 0;
  constructor(client: PoolClient) { this.#client = client; }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    return (await this.#client.query<T>(sql, [...parameters])).rows;
  }
  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const savepoint = `sw090_tx_${++this.#counter}`;
    await this.#client.query(`SAVEPOINT ${savepoint}`);
    try {
      const result = await work(this);
      await this.#client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await this.#client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await this.#client.query(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }
  async close(): Promise<void> {}
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  async verify(assertion: string): Promise<VerifiedStaffIdentity> {
    if (assertion === 'teacher-alpha') return { provider: 'SYNTHETIC', subject: 'google-teacher-alpha', email: 'teacher-a@north.example.invalid', displayName: 'Teacher Alpha' };
    if (assertion === 'teacher-beta') return { provider: 'SYNTHETIC', subject: 'google-teacher-beta', email: 'teacher-b@south.example.invalid', displayName: 'Teacher Beta' };
    throw new AuthenticationError('Synthetic identity assertion rejected.');
  }
}

async function withSavepoint(client: PoolClient, label: string, work: () => Promise<void>): Promise<void> {
  const savepoint = `sw090_case_${label.replaceAll(/[^a-z0-9]/gi, '_')}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try { await work(); }
  finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

async function signIn(app: ReturnType<typeof buildApp>, assertion = 'teacher-alpha'): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/auth/session', payload: { assertion } });
  assert.equal(response.statusCode, 201, response.body);
  const token = response.json<{ token: string }>().token;
  assert.ok(token);
  return token;
}

function auth(token: string): Record<string, string> { return { authorization: `Bearer ${token}` }; }
function idem(token: string): Record<string, string> { return { ...auth(token), 'idempotency-key': randomUUID(), 'content-type': 'application/json' }; }

async function activeEnrollmentId(client: PoolClient, fixture: HallPassFixture, studentId: string, sectionId = fixture.sectionA1): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM enrollments WHERE school_id=$1 AND student_id=$2 AND section_id=$3 AND status='ACTIVE' LIMIT 1`,
    [fixture.schoolA, studentId, sectionId],
  );
  const id = result.rows[0]?.id; assert.ok(id); return id;
}

async function insertSyntheticActivePass(client: PoolClient, fixture: HallPassFixture): Promise<string> {
  const enrollmentId = await activeEnrollmentId(client, fixture, fixture.studentA);
  const credential = await client.query<{ id: string }>(
    `INSERT INTO student_credentials (school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params)
     VALUES ($1,$2,'SCRYPT_PEPPER_V1',$3,$4,'{}'::jsonb) RETURNING id`,
    [fixture.schoolA, fixture.studentA, 'a'.repeat(64), 'b'.repeat(16)],
  );
  const proof = await client.query<{ id: string }>(
    `INSERT INTO action_proofs (school_id,student_id,action_type,context_section_id,credential_id,credential_version,token_hash,issued_at,expires_at,consumed_at,request_id)
     VALUES ($1,$2,'PASS_REQUEST',$3,$4,1,$5,$6::timestamptz,$7::timestamptz,$6::timestamptz,$8) RETURNING id`,
    [fixture.schoolA, fixture.studentA, fixture.sectionA1, credential.rows[0]?.id, 'c'.repeat(64), '2026-09-08T12:04:00Z', '2026-09-08T12:14:00Z', randomUUID()],
  );
  const request = await client.query<{ id: string }>(
    `INSERT INTO pass_requests (organization_id,school_id,student_id,section_id,enrollment_id,destination_id,action_proof_id,requested_at,class_end_at,queue_expires_at,status,resolved_at,resolution_code,request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-09-08T12:05:00Z','2026-09-08T12:50:00Z','2026-09-08T12:25:00Z','STARTED','2026-09-08T12:05:00Z','CAPACITY_AVAILABLE',$8) RETURNING id`,
    [fixture.orgA, fixture.schoolA, fixture.studentA, fixture.sectionA1, enrollmentId, fixture.destination, proof.rows[0]?.id, randomUUID()],
  );
  const pass = await client.query<{ id: string }>(
    `INSERT INTO passes (organization_id,school_id,pass_request_id,student_id,section_id,enrollment_id,destination_id,started_at,start_action_proof_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-09-08T12:05:00Z',$8) RETURNING id`,
    [fixture.orgA, fixture.schoolA, request.rows[0]?.id, fixture.studentA, fixture.sectionA1, enrollmentId, fixture.destination, proof.rows[0]?.id],
  );
  const passId = pass.rows[0]?.id; assert.ok(passId); return passId;
}

test('SW-090 Teacher Application', { skip: !databaseUrl }, async (t) => {
  await t.test('T-AX-001/002/003/004/005/006 dashboard shell preserves keyboard, dialog, warning, live-region, responsive and focus-safe refresh affordances', () => {
    const html = teacherAppHtml();
    assert.match(html, /<main class="shell"/);
    assert.match(html, /<dialog id="return-dialog"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /:focus-visible/);
    assert.match(html, /min-height:44px/);
    assert.match(html, /Warning:/);
    assert.match(html, /@media\(max-width:500px\)/);
    assert.match(html, /element\.contains\(document\.activeElement\)/);
    assert.match(html, /POLLING_FALLBACK|polling fallback/i);
    assert.match(html, /sessionStorage/);
  });

  const pool = new Pool({ connectionString: databaseUrl, max: 1, application_name: 'grantdesk-schoolwide:sw090-test' });
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const fixture = await seedHallPassFixture(client);
    const database: Database = new SavepointDatabase(client);
    const app = buildApp({
      config, database, identityProvider: new FixtureIdentityProvider(),
      hallPassOptions: { now: () => NOW }, auditCorrectionOptions: { now: () => NOW },
      teacherApplicationOptions: { now: () => NOW, pollAfterMs: 5_000 }, checkInOptions: { now: () => NOW },
    });

    await t.test('T-AUTH-001/002 assigned section is listed and URL-forged unassigned section is denied server-side', async () => withSavepoint(client, 'scope', async () => {
      const token = await signIn(app);
      const listed = await app.inject({ method: 'GET', url: '/api/v1/teacher/sections', headers: auth(token) });
      assert.equal(listed.statusCode, 200, listed.body);
      const sections = listed.json<{ sections: Array<{ sectionId: string }> }>().sections;
      assert.deepEqual(sections.map((item) => item.sectionId), [fixture.sectionA1]);
      const own = await app.inject({ method: 'GET', url: `/api/v1/teacher/sections/${fixture.sectionA1}/live`, headers: auth(token) });
      assert.equal(own.statusCode, 200, own.body);
      const forged = await app.inject({ method: 'GET', url: `/api/v1/teacher/sections/${fixture.sectionA2}/live`, headers: auth(token) });
      assert.equal(forged.statusCode, 403, forged.body);
      assert.equal(forged.json<{ code: string }>().code, 'SECTION_SCOPE_DENIED');
    }));

    await t.test('T-AUTH-010 current assignment revocation removes dashboard access without waiting for session expiry', async () => withSavepoint(client, 'revoke', async () => {
      const token = await signIn(app);
      const before = await app.inject({ method: 'GET', url: `/api/v1/teacher/sections/${fixture.sectionA1}/live`, headers: auth(token) });
      assert.equal(before.statusCode, 200, before.body);
      await client.query(`UPDATE section_staff_assignments SET revoked_at=$1::timestamptz WHERE school_id=$2 AND section_id=$3 AND user_id=$4`, [NOW.toISOString(), fixture.schoolA, fixture.sectionA1, fixture.teacherA]);
      const after = await app.inject({ method: 'GET', url: `/api/v1/teacher/sections/${fixture.sectionA1}/live`, headers: auth(token) });
      assert.equal(after.statusCode, 403, after.body);
    }));

    await t.test('T-RT-001/004/006 and T-PERF-002/003 live snapshot is section-scoped, bounded, polling-safe and excludes lifetime evidence', async () => withSavepoint(client, 'live', async () => {
      const token = await signIn(app);
      const response = await app.inject({ method: 'GET', url: `/api/v1/teacher/sections/${fixture.sectionA1}/live`, headers: auth(token) });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json<{
        section: { sectionId: string }; roster: Array<{ studentId: string }>;
        transport: { mode: string; pollAfterMs: number; sectionChannel: string };
        activePasses: unknown[]; queue: unknown[]; checkInSummary: { enrolled: number };
      }>();
      assert.equal(body.section.sectionId, fixture.sectionA1);
      assert.equal(body.transport.mode, 'POLLING_FALLBACK');
      assert.equal(body.transport.pollAfterMs, 5_000);
      assert.equal(body.transport.sectionChannel, `section:${fixture.sectionA1}`);
      assert.ok(body.roster.length <= 500);
      assert.ok(body.activePasses.length <= 100);
      assert.ok(body.queue.length <= 100);
      assert.equal(body.roster.some((student) => student.studentId === fixture.studentB), false);
      assert.equal('history' in (body as object), false);
      assert.equal(body.checkInSummary.enrolled, 3);
    }));

    await t.test('T-PERF-003 pass evidence is current-marking-period only and honors its explicit result bound', async () => withSavepoint(client, 'evidence', async () => {
      const passId = await insertSyntheticActivePass(client, fixture);
      await client.query(`UPDATE passes SET returned_at='2026-09-08T12:09:00Z',status='RETURNED',countability='COUNTABLE',countability_reason='synthetic',classified_at='2026-09-08T12:09:00Z',duration_ms=240000,authorization_method_return='TEACHER_STAFF_ACTION',return_actor_user_id=$2,return_request_id=$3 WHERE id=$1`, [passId, fixture.teacherA, randomUUID()]);
      const token = await signIn(app);
      const response = await app.inject({ method: 'GET', url: `/api/v1/teacher/sections/${fixture.sectionA1}/students/${fixture.studentA}/pass-evidence?limit=1`, headers: auth(token) });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json<{ limit: number; termStartsOn: string; termEndsOn: string; items: Array<{ passId: string }> }>();
      assert.equal(body.limit, 1);
      assert.equal(body.termStartsOn, '2026-08-20');
      assert.equal(body.termEndsOn, '2026-10-30');
      assert.equal(body.items.length, 1);
      assert.equal(body.items[0]?.passId, passId);
    }));

    await t.test('T-POL-002/003 only school-approved teacher policy keys can be overridden and provenance is retained', async () => withSavepoint(client, 'policy', async () => {
      const token = await signIn(app);
      const allowed = await app.inject({
        method: 'POST', url: `/api/v1/teacher/sections/${fixture.sectionA1}/policy-overrides/MAX_ACTIVE_PER_SECTION`,
        headers: idem(token), payload: { value: 2, reason: 'Synthetic classroom capacity adjustment' },
      });
      assert.equal(allowed.statusCode, 201, allowed.body);
      const overrideId = allowed.json<{ id: string }>().id;
      const stored = await client.query<{ set_by_user_id: string; reason: string }>(`SELECT set_by_user_id,reason FROM section_policy_overrides WHERE id=$1`, [overrideId]);
      assert.equal(stored.rows[0]?.set_by_user_id, fixture.teacherA);
      assert.equal(stored.rows[0]?.reason, 'Synthetic classroom capacity adjustment');
      const forbidden = await app.inject({
        method: 'POST', url: `/api/v1/teacher/sections/${fixture.sectionA1}/policy-overrides/DAILY_LIMIT`,
        headers: idem(token), payload: { value: 3, reason: 'Should not be allowed' },
      });
      assert.equal(forbidden.statusCode, 403, forbidden.body);
      assert.equal(forbidden.json<{ code: string }>().code, 'POLICY_OVERRIDE_DENIED');
    }));

    await t.test('teacher return is truthfully attributed, audited, idempotent, and an unassigned teacher cannot mutate it', async () => withSavepoint(client, 'return', async () => {
      const passId = await insertSyntheticActivePass(client, fixture);
      const token = await signIn(app);
      const key = randomUUID();
      const headers = { ...auth(token), 'idempotency-key': key, 'content-type': 'application/json' };
      const first = await app.inject({ method: 'POST', url: `/api/v1/teacher/passes/${passId}/return`, headers, payload: { reason: 'Student returned to class' } });
      assert.equal(first.statusCode, 200, first.body);
      const retry = await app.inject({ method: 'POST', url: `/api/v1/teacher/passes/${passId}/return`, headers, payload: { reason: 'Student returned to class' } });
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(retry.json<{ passId: string }>().passId, passId);
      const pass = await client.query<{ authorization_method_return: string; return_actor_user_id: string; status: string }>(`SELECT authorization_method_return,return_actor_user_id,status FROM passes WHERE id=$1`, [passId]);
      assert.equal(pass.rows[0]?.authorization_method_return, 'TEACHER_STAFF_ACTION');
      assert.equal(pass.rows[0]?.return_actor_user_id, fixture.teacherA);
      assert.equal(pass.rows[0]?.status, 'RETURNED');
      const evidence = await client.query<{ staff_count: number; audit_count: number; outbox_count: number }>(
        `SELECT
           (SELECT count(*)::int FROM staff_actions WHERE pass_id=$1 AND action_type='TEACHER_PASS_RETURN') AS staff_count,
           (SELECT count(*)::int FROM audit_events WHERE target_id=$1::text AND action='PASS_RETURNED_BY_TEACHER') AS audit_count,
           (SELECT count(*)::int FROM transactional_outbox WHERE aggregate_id=$1 AND event_type='PASS_RETURNED_BY_TEACHER') AS outbox_count`, [passId],
      );
      assert.deepEqual(evidence.rows[0], { staff_count: 1, audit_count: 1, outbox_count: 1 });

      const foreignToken = await signIn(app, 'teacher-beta');
      const denied = await app.inject({ method: 'POST', url: `/api/v1/teacher/passes/${passId}/return`, headers: idem(foreignToken), payload: { reason: 'Forged return' } });
      assert.equal(denied.statusCode, 403, denied.body);
    }));

    await t.test('teacher-start and student-access controls fail closed without explicit school governance', async () => withSavepoint(client, 'governance', async () => {
      const token = await signIn(app);
      const start = await app.inject({ method: 'POST', url: `/api/v1/teacher/sections/${fixture.sectionA1}/passes/start-override`, headers: auth(token), payload: {} });
      assert.equal(start.statusCode, 409, start.body);
      assert.equal(start.json<{ code: string }>().code, 'TEACHER_PASS_START_POLICY_UNAVAILABLE');
      const access = await app.inject({
        method: 'POST', url: `/api/v1/teacher/sections/${fixture.sectionA1}/student-access`, headers: idem(token),
        payload: { studentId: fixture.studentA, accessMode: 'UNLIMITED', reason: 'No policy enables this action' },
      });
      assert.equal(access.statusCode, 403, access.body);
      assert.equal(access.json<{ code: string }>().code, 'STUDENT_ACCESS_CHANGE_DENIED');
    }));

    await app.close();
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
