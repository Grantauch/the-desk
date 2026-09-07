import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedHallPassFixture, hallPassFixtureIds, type HallPassFixture } from '../hall-pass/test-fixtures.js';
import { securityConsoleHtml } from './ui.js';

const databaseUrl = process.env.DATABASE_URL;
const NOW = new Date('2026-09-08T12:10:00.000Z');
const securityA = '00000000-0000-0000-0000-000000000351';
const securityB = '00000000-0000-0000-0000-000000000352';
const destinationB = '00000000-0000-0000-0000-000000000932';

const config: AppConfig = {
  nodeEnv: 'test', host: '127.0.0.1', port: 8787, logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide', dbPoolMax: 2,
  instanceId: 'security-console-test', legacyReadAdapterMode: 'disabled', legacyProductionWrites: 'forbidden',
};

class SavepointDatabase implements TransactionalDatabase {
  readonly #client: PoolClient;
  #counter = 0;
  constructor(client: PoolClient) { this.#client = client; }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    return (await this.#client.query<T>(sql, [...parameters])).rows;
  }
  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const savepoint = `sw110_tx_${++this.#counter}`;
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
    if (assertion === 'security-north') return { provider: 'SYNTHETIC', subject: 'google-security-north' };
    if (assertion === 'security-south') return { provider: 'SYNTHETIC', subject: 'google-security-south' };
    if (assertion === 'teacher-alpha') return { provider: 'SYNTHETIC', subject: 'google-teacher-alpha' };
    throw new AuthenticationError('Synthetic identity assertion rejected.');
  }
}

async function withSavepoint(client: PoolClient, label: string, work: () => Promise<void>): Promise<void> {
  const savepoint = `sw110_case_${label.replaceAll(/[^a-z0-9]/gi, '_')}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try { await work(); }
  finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

async function signIn(app: ReturnType<typeof buildApp>, assertion = 'security-north'): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/auth/session', payload: { assertion } });
  assert.equal(response.statusCode, 201, response.body);
  const token = response.json<{ token: string }>().token;
  assert.ok(token);
  return token;
}

function auth(token: string): Record<string, string> { return { authorization: `Bearer ${token}` }; }
function actionHeaders(token: string, key = randomUUID()): Record<string, string> {
  return { ...auth(token), 'idempotency-key': key, 'content-type': 'application/json' };
}
function tokenHash(seed: string): string { return createHash('sha256').update(seed).digest('hex'); }

async function seedSecurityStaff(client: PoolClient, fixture: HallPassFixture): Promise<void> {
  await client.query(
    `INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id)
     VALUES ($1,$2,'security@north.example.invalid','Security North','google-security-north'),
            ($3,$4,'security@south.example.invalid','Security South','google-security-south')`,
    [securityA, fixture.orgA, securityB, fixture.orgB],
  );
  await client.query(
    `INSERT INTO staff_profiles (user_id,organization_id,title)
     VALUES ($1,$2,'Security'),($3,$4,'Security')`,
    [securityA, fixture.orgA, securityB, fixture.orgB],
  );
  await client.query(
    `INSERT INTO user_roles (organization_id,school_id,user_id,role)
     VALUES ($1,$2,$3,'SECURITY'),($4,$5,$6,'SECURITY')`,
    [fixture.orgA, fixture.schoolA, securityA, fixture.orgB, fixture.schoolB, securityB],
  );
  await client.query(
    `INSERT INTO enrollments (school_id,section_id,student_id,source)
     VALUES ($1,$2,$3,'MANUAL')`,
    [fixture.schoolB, fixture.sectionB1, fixture.studentB],
  );
  await client.query(
    `INSERT INTO destinations (id,school_id,name,category,active,security_visible,student_selectable)
     VALUES ($1,$2,'South Restroom','RESTROOM',true,true,true)`,
    [destinationB, fixture.schoolB],
  );
  await client.query(
    `INSERT INTO policy_values (school_id,policy_set_id,policy_key,typed_value_json,teacher_override_allowed)
     VALUES ($1,$2,'SECURITY_LATE_WARNING_MINUTES','3'::jsonb,false),
            ($1,$2,'SECURITY_STALE_WARNING_MINUTES','8'::jsonb,false)`,
    [fixture.schoolA, hallPassFixtureIds.policySet],
  );
}

async function activeEnrollmentId(client: PoolClient, schoolId: string, sectionId: string, studentId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM enrollments WHERE school_id=$1 AND section_id=$2 AND student_id=$3 AND status='ACTIVE' LIMIT 1`,
    [schoolId, sectionId, studentId],
  );
  const id = result.rows[0]?.id; assert.ok(id); return id;
}

async function insertActivePass(client: PoolClient, input: {
  organizationId: string; schoolId: string; sectionId: string; studentId: string; destinationId: string; startedAt: string;
}): Promise<string> {
  const enrollmentId = await activeEnrollmentId(client, input.schoolId, input.sectionId, input.studentId);
  const seed = randomUUID();
  const credential = await client.query<{ id: string }>(
    `INSERT INTO student_credentials (school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params)
     VALUES ($1,$2,'SCRYPT_PEPPER_V1',$3,$4,'{}'::jsonb) RETURNING id`,
    [input.schoolId, input.studentId, tokenHash('secret-'+seed), tokenHash('salt-'+seed).slice(0, 16)],
  );
  const proof = await client.query<{ id: string }>(
    `INSERT INTO action_proofs (school_id,student_id,action_type,context_section_id,credential_id,credential_version,token_hash,issued_at,expires_at,consumed_at,request_id)
     VALUES ($1,$2,'PASS_REQUEST',$3,$4,1,$5,$6::timestamptz,$7::timestamptz,$6::timestamptz,$8) RETURNING id`,
    [input.schoolId,input.studentId,input.sectionId,credential.rows[0]?.id,tokenHash('proof-'+seed),'2026-09-08T11:45:00Z','2026-09-08T12:45:00Z',randomUUID()],
  );
  const request = await client.query<{ id: string }>(
    `INSERT INTO pass_requests (organization_id,school_id,student_id,section_id,enrollment_id,destination_id,action_proof_id,requested_at,class_end_at,queue_expires_at,status,resolved_at,resolution_code,request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,'2026-09-08T13:00:00Z','2026-09-08T12:40:00Z','STARTED',$8::timestamptz,'CAPACITY_AVAILABLE',$9) RETURNING id`,
    [input.organizationId,input.schoolId,input.studentId,input.sectionId,enrollmentId,input.destinationId,proof.rows[0]?.id,input.startedAt,randomUUID()],
  );
  const pass = await client.query<{ id: string }>(
    `INSERT INTO passes (organization_id,school_id,pass_request_id,student_id,section_id,enrollment_id,destination_id,started_at,start_action_proof_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9) RETURNING id`,
    [input.organizationId,input.schoolId,request.rows[0]?.id,input.studentId,input.sectionId,enrollmentId,input.destinationId,input.startedAt,proof.rows[0]?.id],
  );
  const passId = pass.rows[0]?.id; assert.ok(passId); return passId;
}

async function insertWaiting(client: PoolClient, fixture: HallPassFixture): Promise<string> {
  const enrollmentId = await activeEnrollmentId(client, fixture.schoolA, fixture.sectionA1, fixture.studentA2);
  const seed = randomUUID();
  const credential = await client.query<{ id: string }>(
    `INSERT INTO student_credentials (school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params)
     VALUES ($1,$2,'SCRYPT_PEPPER_V1',$3,$4,'{}'::jsonb) RETURNING id`,
    [fixture.schoolA,fixture.studentA2,tokenHash('qsecret-'+seed),tokenHash('qsalt-'+seed).slice(0,16)],
  );
  const proof = await client.query<{ id: string }>(
    `INSERT INTO action_proofs (school_id,student_id,action_type,context_section_id,credential_id,credential_version,token_hash,issued_at,expires_at,consumed_at,request_id)
     VALUES ($1,$2,'PASS_REQUEST',$3,$4,1,$5,'2026-09-08T12:05:00Z','2026-09-08T12:30:00Z','2026-09-08T12:05:00Z',$6) RETURNING id`,
    [fixture.schoolA,fixture.studentA2,fixture.sectionA1,credential.rows[0]?.id,tokenHash('qproof-'+seed),randomUUID()],
  );
  const request = await client.query<{ id: string }>(
    `INSERT INTO pass_requests (organization_id,school_id,student_id,section_id,enrollment_id,destination_id,action_proof_id,requested_at,class_end_at,queue_expires_at,status,request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-09-08T12:06:00Z','2026-09-08T13:00:00Z','2026-09-08T12:26:00Z','QUEUED',$8) RETURNING id`,
    [fixture.orgA,fixture.schoolA,fixture.studentA2,fixture.sectionA1,enrollmentId,fixture.destination,proof.rows[0]?.id,randomUUID()],
  );
  const queue = await client.query<{ id: string }>(
    `INSERT INTO queue_entries (organization_id,school_id,pass_request_id,student_id,section_id,joined_at,status)
     VALUES ($1,$2,$3,$4,$5,'2026-09-08T12:06:00Z','WAITING') RETURNING id`,
    [fixture.orgA,fixture.schoolA,request.rows[0]?.id,fixture.studentA2,fixture.sectionA1],
  );
  const id = queue.rows[0]?.id; assert.ok(id); return id;
}

test('SW-110 Security Console', { skip: !databaseUrl }, async (t) => {
  await t.test('T-AX-001/002/003/004/005/006 shell is keyboard/focus/live-region/mobile safe and exposes no force-close control', () => {
    const html = securityConsoleHtml();
    assert.match(html, /<main class="wrap">/);
    assert.match(html, /<dialog id="actionDialog"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /:focus-visible/);
    assert.match(html, /min-height:44px/);
    assert.match(html, /Threshold unavailable/);
    assert.match(html, /@media\(max-width:520px\)/);
    assert.match(html, /els\.movement\.contains\(active\)/);
    assert.match(html, /POLLING_FALLBACK|pollAfterMs/);
    assert.match(html, /sessionStorage/);
    assert.doesNotMatch(html, /force[ -]?close/i);
  });

  const pool = new Pool({ connectionString: databaseUrl, max: 1, application_name: 'grantdesk-schoolwide:sw110-test' });
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const fixture = await seedHallPassFixture(client);
    await seedSecurityStaff(client, fixture);
    const database = new SavepointDatabase(client);
    const app = buildApp({
      config,
      database,
      identityProvider: new FixtureIdentityProvider(),
      securityConsoleOptions: { now: () => NOW, pollAfterMs: 5_000, liveLimit: 100, waitingLimit: 100 },
      hallPassOptions: { now: () => NOW },
      auditCorrectionOptions: { now: () => NOW },
      teacherApplicationOptions: { now: () => NOW },
      checkInOptions: { now: () => NOW },
    });

    await t.test('T-AUTH-004/T-RT-002 school Security sees only its live movement and minimal payload', async () => withSavepoint(client, 'scope', async () => {
      const northPass = await insertActivePass(client, { organizationId:fixture.orgA,schoolId:fixture.schoolA,sectionId:fixture.sectionA1,studentId:fixture.studentA,destinationId:fixture.destination,startedAt:'2026-09-08T12:05:00Z' });
      const southPass = await insertActivePass(client, { organizationId:fixture.orgB,schoolId:fixture.schoolB,sectionId:fixture.sectionB1,studentId:fixture.studentB,destinationId:destinationB,startedAt:'2026-09-08T12:04:00Z' });
      await insertWaiting(client, fixture);
      const token = await signIn(app);
      const response = await app.inject({ method:'GET', url:'/api/v1/security/live-passes', headers:auth(token) });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json<{ schoolId:string; passes:Array<Record<string,unknown>>; waiting:Array<Record<string,unknown>>; summary:{out:number;waiting:number}; transport:{mode:string;schoolChannel:string}; warningPolicy:{status:string} }>();
      assert.equal(body.schoolId, fixture.schoolA);
      assert.equal(body.passes.length, 1);
      assert.equal(body.passes[0]?.passId, northPass);
      assert.notEqual(body.passes[0]?.passId, southPass);
      assert.equal(body.waiting.length, 1);
      assert.equal(body.summary.out, 1);
      assert.equal(body.summary.waiting, 1);
      assert.equal(body.transport.mode, 'POLLING_FALLBACK');
      assert.equal(body.transport.schoolChannel, `school:${fixture.schoolA}:security-live`);
      const serialized = JSON.stringify(body);
      for (const forbidden of ['primary_email','reason_private','secret_hash','token_hash','credential','action_proof','classroom_connection','attendance','policy_values']) assert.equal(serialized.includes(forbidden), false, forbidden);
    }));

    await t.test('T-AUTH-010 revoked Security role loses live access immediately without session expiry', async () => withSavepoint(client, 'revoke', async () => {
      const token = await signIn(app);
      const before = await app.inject({ method:'GET', url:'/api/v1/security/live-passes', headers:auth(token) });
      assert.equal(before.statusCode, 200, before.body);
      await client.query(`UPDATE user_roles SET revoked_at=$1::timestamptz WHERE school_id=$2 AND user_id=$3 AND role='SECURITY'`, [NOW.toISOString(),fixture.schoolA,securityA]);
      const after = await app.inject({ method:'GET', url:'/api/v1/security/live-passes', headers:auth(token) });
      assert.equal(after.statusCode, 403, after.body);
      assert.equal(after.json<{code:string}>().code, 'SECURITY_SCHOOL_SCOPE_DENIED');
    }));

    await t.test('T-PERF-002/003 live board is bounded and configured warning state is derived from school policy', async () => withSavepoint(client, 'bounded', async () => {
      await insertActivePass(client, { organizationId:fixture.orgA,schoolId:fixture.schoolA,sectionId:fixture.sectionA1,studentId:fixture.studentA,destinationId:fixture.destination,startedAt:'2026-09-08T12:05:00Z' });
      const token = await signIn(app);
      const response = await app.inject({ method:'GET', url:'/api/v1/security/live-passes?warning=LATE', headers:auth(token) });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json<{passes:Array<{warningState:string;elapsedMs:number}>;warningPolicy:{status:string;lateMinutes:number;staleMinutes:number};truncated:boolean}>();
      assert.equal(body.passes.length, 1);
      assert.equal(body.passes[0]?.warningState, 'LATE');
      assert.equal(body.passes[0]?.elapsedMs, 300000);
      assert.deepEqual(body.warningPolicy, { status:'CONFIGURED', lateMinutes:3, staleMinutes:8 });
      assert.equal(body.truncated, false);
    }));

    await t.test('bounded student lookup returns current operational state only and no private history', async () => withSavepoint(client, 'search', async () => {
      const passId = await insertActivePass(client, { organizationId:fixture.orgA,schoolId:fixture.schoolA,sectionId:fixture.sectionA1,studentId:fixture.studentA,destinationId:fixture.destination,startedAt:'2026-09-08T12:05:00Z' });
      const token = await signIn(app);
      const response = await app.inject({ method:'GET', url:'/api/v1/security/students/search?q=N-1001&limit=5', headers:auth(token) });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json<{schoolId:string;results:Array<{studentId:string;currentState:{kind:string;passId?:string}}>}>();
      assert.equal(body.schoolId, fixture.schoolA);
      assert.equal(body.results.length, 1);
      assert.equal(body.results[0]?.studentId, fixture.studentA);
      assert.equal(body.results[0]?.currentState.kind, 'OUT');
      assert.equal(body.results[0]?.currentState.passId, passId);
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes('history'), false);
      assert.equal(serialized.includes('reason'), false);
      assert.equal(serialized.includes('credential'), false);
    }));

    await t.test('Mark Located is idempotent/audited and does not close or reclassify the active pass', async () => withSavepoint(client, 'located', async () => {
      const passId = await insertActivePass(client, { organizationId:fixture.orgA,schoolId:fixture.schoolA,sectionId:fixture.sectionA1,studentId:fixture.studentA,destinationId:fixture.destination,startedAt:'2026-09-08T12:05:00Z' });
      const token = await signIn(app); const key=randomUUID(); const headers=actionHeaders(token,key);
      const first = await app.inject({ method:'POST',url:`/api/v1/security/passes/${passId}/located`,headers,payload:{reason:'Located near the north stairwell'} });
      assert.equal(first.statusCode,201,first.body);
      const retry = await app.inject({ method:'POST',url:`/api/v1/security/passes/${passId}/located`,headers,payload:{reason:'Located near the north stairwell'} });
      assert.equal(retry.statusCode,201,retry.body);
      assert.equal(retry.json<{actionId:string}>().actionId, first.json<{actionId:string}>().actionId);
      const pass = await client.query<{status:string;returned_at:Date|null;countability:string}>(`SELECT status,returned_at,countability FROM passes WHERE id=$1`,[passId]);
      assert.deepEqual(pass.rows[0], { status:'OUT', returned_at:null, countability:'PROVISIONAL' });
      const counts = await client.query<{actions:string;events:string;audits:string;outbox:string}>(`SELECT
        (SELECT count(*) FROM staff_actions WHERE pass_id=$1 AND action_type='SECURITY_MARK_LOCATED')::text AS actions,
        (SELECT count(*) FROM pass_events WHERE resource_id=$1 AND event_type='SECURITY_PASS_MARKED_LOCATED')::text AS events,
        (SELECT count(*) FROM audit_events WHERE target_id=$1::text AND action='SECURITY_PASS_MARKED_LOCATED')::text AS audits,
        (SELECT count(*) FROM transactional_outbox WHERE aggregate_id=$1 AND event_type='SECURITY_PASS_MARKED_LOCATED')::text AS outbox`,[passId]);
      assert.deepEqual(counts.rows[0], {actions:'1',events:'1',audits:'1',outbox:'1'});
      const leaked = await client.query<{metadata:string;payload:string}>(`SELECT pe.metadata_json_sanitized::text AS metadata,o.payload_json_sanitized::text AS payload FROM pass_events pe JOIN transactional_outbox o ON o.aggregate_id=pe.resource_id AND o.event_type='SECURITY_PASS_MARKED_LOCATED' WHERE pe.resource_id=$1 LIMIT 1`,[passId]);
      assert.equal((leaked.rows[0]?.metadata||'').includes('stairwell'),false);
      assert.equal((leaked.rows[0]?.payload||'').includes('stairwell'),false);
    }));

    await t.test('Request Return is idempotent/audited and leaves authoritative return to student/teacher Hall Pass paths', async () => withSavepoint(client, 'request_return', async () => {
      const passId = await insertActivePass(client, { organizationId:fixture.orgA,schoolId:fixture.schoolA,sectionId:fixture.sectionA1,studentId:fixture.studentA,destinationId:fixture.destination,startedAt:'2026-09-08T12:05:00Z' });
      const token = await signIn(app); const key=randomUUID(); const headers=actionHeaders(token,key);
      const first = await app.inject({ method:'POST',url:`/api/v1/security/passes/${passId}/request-return`,headers,payload:{reason:'Please return to class'} });
      assert.equal(first.statusCode,201,first.body);
      const retry = await app.inject({ method:'POST',url:`/api/v1/security/passes/${passId}/request-return`,headers,payload:{reason:'Please return to class'} });
      assert.equal(retry.statusCode,201,retry.body);
      assert.equal(retry.json<{actionId:string}>().actionId, first.json<{actionId:string}>().actionId);
      const pass = await client.query<{status:string;authorization_method_return:string|null}>(`SELECT status,authorization_method_return FROM passes WHERE id=$1`,[passId]);
      assert.deepEqual(pass.rows[0], {status:'OUT',authorization_method_return:null});
      const actions = await client.query<{count:string}>(`SELECT count(*)::text AS count FROM staff_actions WHERE pass_id=$1 AND action_type='SECURITY_REQUEST_RETURN'`,[passId]);
      assert.equal(actions.rows[0]?.count,'1');
    }));

    await t.test('T-AUTH-005 Security cannot use teacher controls or cross-school pass actions, and force-close is not implemented', async () => withSavepoint(client, 'denials', async () => {
      const southPass = await insertActivePass(client, { organizationId:fixture.orgB,schoolId:fixture.schoolB,sectionId:fixture.sectionB1,studentId:fixture.studentB,destinationId:destinationB,startedAt:'2026-09-08T12:04:00Z' });
      const token = await signIn(app);
      const teacher = await app.inject({ method:'GET',url:`/api/v1/teacher/sections/${fixture.sectionA1}/live`,headers:auth(token) });
      assert.equal(teacher.statusCode,403,teacher.body);
      const foreign = await app.inject({ method:'POST',url:`/api/v1/security/passes/${southPass}/located`,headers:actionHeaders(token),payload:{reason:'Should be denied'} });
      assert.equal(foreign.statusCode,403,foreign.body);
      const noForce = await app.inject({ method:'POST',url:`/api/v1/security/passes/${southPass}/force-close`,headers:actionHeaders(token),payload:{reason:'Not governed'} });
      assert.equal(noForce.statusCode,404,noForce.body);
    }));

    await app.close();
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
