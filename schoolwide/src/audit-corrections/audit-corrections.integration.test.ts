import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { buildApp } from '../app.js';
import { FixtureStaffIdentityProvider, ClientTransactionalDatabase } from '../checkins/test-fixtures.js';
import type { AppConfig } from '../config.js';
import { HallPassService } from '../hall-pass/service.js';
import { seedHallPassFixture, type HallPassFixture } from '../hall-pass/test-fixtures.js';
import { StudentCredentialService } from '../student-credentials/service.js';
import type { StudentIdentityProvider, VerifiedStudentIdentity } from '../student-credentials/types.js';
import { AuditCorrectionService } from './service.js';

const databaseUrl = process.env.DATABASE_URL;
const config: AppConfig = {
  nodeEnv: 'test', host: '127.0.0.1', port: 8787, logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide', dbPoolMax: 2, instanceId: 'audit-correction-test',
  legacyReadAdapterMode: 'disabled', legacyProductionWrites: 'forbidden',
};

function detroit(date: string, time: string): Date { return new Date(`${date}T${time}-04:00`); }

class AuditStudentProvider implements StudentIdentityProvider {
  readonly #base: HallPassFixture;
  constructor(base: HallPassFixture) { this.#base = base; }
  async verify(assertion: string): Promise<VerifiedStudentIdentity> {
    const studentId = assertion === 'student-a' ? this.#base.studentA : assertion === 'student-a2' ? this.#base.studentA2 : null;
    if (!studentId) throw new Error('Synthetic student identity rejected.');
    return { provider: 'SYNTHETIC', subject: `synthetic-${assertion}`, studentId };
  }
}

type FixtureContext = {
  client: PoolClient;
  app: ReturnType<typeof buildApp>;
  base: HallPassFixture;
  clock: { now: Date };
  corrections: AuditCorrectionService;
};

async function withFixture(pool: Pool, fn: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect(); await client.query('BEGIN');
  let app: ReturnType<typeof buildApp> | null = null;
  try {
    const base = await seedHallPassFixture(client);
    const database = new ClientTransactionalDatabase(client);
    const clock = { now: detroit('2026-09-08', '08:05:00') };
    const provider = new AuditStudentProvider(base);
    const credentialOptions = { pepper: 'synthetic-sw080-pepper', now: () => clock.now, proofTtlMs: 90_000 };
    const credentials = new StudentCredentialService(database, provider, credentialOptions);
    await credentials.provisionPin(base.studentA, '123456');
    await credentials.provisionPin(base.studentA2, '654321');
    const hallPassOptions = { now: () => clock.now };
    const auditCorrectionOptions = { now: () => clock.now };
    const corrections = new AuditCorrectionService(database, auditCorrectionOptions);
    app = buildApp({
      config, database, identityProvider: new FixtureStaffIdentityProvider(), sessionTtlMs: 30 * 60_000,
      studentIdentityProvider: provider, studentCredentialOptions: credentialOptions, hallPassOptions, auditCorrectionOptions,
    });
    await fn({ client, app, base, clock, corrections });
  } finally {
    if (app) await app.close(); await client.query('ROLLBACK'); client.release();
  }
}

async function authorize(app: ReturnType<typeof buildApp>, action: 'PASS_REQUEST' | 'RETURN', assertion: string, pin: string, sectionId?: string): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/api/v1/student/actions/authorize', headers: { 'x-student-identity-assertion': assertion }, payload: { pin, action, ...(sectionId ? { sectionId } : {}) } });
  assert.equal(response.statusCode, 201, response.body);
  const proof = (response.json() as { actionProof?: string }).actionProof; assert.ok(proof); return proof;
}

async function startPass(app: ReturnType<typeof buildApp>, base: HallPassFixture, sectionId: string, key: string, assertion='student-a', pin='123456') {
  const proof = await authorize(app, 'PASS_REQUEST', assertion, pin, sectionId);
  const response = await app.inject({ method: 'POST', url: '/api/v1/passes/requests', headers: { 'idempotency-key': key }, payload: { actionProof: proof, sectionId, destinationId: base.destination } });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json() as { outcome: string; passId: string | null; evidence: { cooldownRemainingSeconds: number; dailyUsed: number; termUsed: number } };
  assert.equal(body.outcome, 'STARTED'); assert.ok(body.passId); return body;
}

async function returnCurrent(app: ReturnType<typeof buildApp>, key: string, assertion='student-a', pin='123456') {
  const proof = await authorize(app, 'RETURN', assertion, pin);
  const response = await app.inject({ method: 'POST', url: '/api/v1/student/passes/active/return', headers: { 'idempotency-key': key }, payload: { actionProof: proof } });
  assert.equal(response.statusCode, 200, response.body); return response.json() as { passId: string; countability: string; durationMs: number };
}

async function createCountablePass(context: FixtureContext, sectionId = context.base.sectionA1): Promise<string> {
  const started = await startPass(context.app, context.base, sectionId, `start-${randomUUID()}`);
  context.clock.now = new Date(context.clock.now.getTime() + 3_000);
  const returned = await returnCurrent(context.app, `return-${randomUUID()}`);
  assert.equal(returned.countability, 'COUNTABLE'); assert.equal(returned.durationMs, 3000);
  return returned.passId;
}

async function teacherToken(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/auth/session', payload: { assertion: 'teacher-a' } });
  assert.equal(response.statusCode, 201, response.body); const token = (response.json() as { token?: string }).token; assert.ok(token); return token;
}

function teacherCorrect(app: ReturnType<typeof buildApp>, token: string, passId: string, key: string, type: 'VOID_COUNTABILITY' | 'RESTORE_COUNTABILITY'='VOID_COUNTABILITY') {
  return app.inject({ method: 'POST', url: `/api/v1/teacher/passes/${passId}/corrections`, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key }, payload: { type, reason: 'Synthetic teacher correction reason' } });
}

async function expectPgMutationBlocked(client: PoolClient, sql: string, params: unknown[]): Promise<void> {
  const name = `sw080_guard_${randomUUID().replaceAll('-', '')}`; await client.query(`SAVEPOINT ${name}`);
  try { await client.query(sql, params); assert.fail('Expected append-only mutation to fail.'); }
  catch (error) { assert.equal((error as { code?: string }).code, 'P0001'); }
  finally { await client.query(`ROLLBACK TO SAVEPOINT ${name}`); await client.query(`RELEASE SAVEPOINT ${name}`); }
}

test('SW-080 Audit + Corrections', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 8, application_name: 'grantdesk-schoolwide:audit-corrections-test' });
  try {
    await t.test('T-AUD-001/002/003 correction is additive, complete, append-only, and retry-idempotent', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); const token = await teacherToken(context.app);
        const before = await context.client.query(`SELECT status,countability,started_at,returned_at,duration_ms FROM passes WHERE id=$1`, [passId]);
        context.clock.now = new Date(context.clock.now.getTime() + 1_000);
        const first = await teacherCorrect(context.app, token, passId, 'correction-one'); assert.equal(first.statusCode, 201, first.body);
        const firstBody = first.json() as { correctionId: string; priorEffectiveCountability: string; resultingEffectiveCountability: string; originalCountability: string };
        assert.equal(firstBody.originalCountability, 'COUNTABLE'); assert.equal(firstBody.priorEffectiveCountability, 'COUNTABLE'); assert.equal(firstBody.resultingEffectiveCountability, 'NON_COUNTABLE');
        const retry = await teacherCorrect(context.app, token, passId, 'correction-one'); assert.equal(retry.statusCode, 201, retry.body); assert.equal((retry.json() as { correctionId: string }).correctionId, firstBody.correctionId);
        const after = await context.client.query(`SELECT status,countability,started_at,returned_at,duration_ms FROM passes WHERE id=$1`, [passId]); assert.deepEqual(after.rows[0], before.rows[0]);
        const correction = await context.client.query<{ actor_user_id:string; reason_private:string; prior_countability:string; resulting_countability:string }>(`SELECT actor_user_id,reason_private,prior_countability,resulting_countability FROM pass_corrections WHERE id=$1`, [firstBody.correctionId]);
        assert.deepEqual(correction.rows[0], { actor_user_id: context.base.teacherA, reason_private: 'Synthetic teacher correction reason', prior_countability: 'COUNTABLE', resulting_countability: 'NON_COUNTABLE' });
        const counts = await context.client.query<{ corrections:number; actions:number; audits:number; events:number; outbox:number }>(`SELECT (SELECT count(*)::int FROM pass_corrections WHERE pass_id=$1) corrections,(SELECT count(*)::int FROM staff_actions WHERE pass_id=$1 AND action_type='PASS_CORRECTION') actions,(SELECT count(*)::int FROM audit_events WHERE target_id=$1 AND action='PASS_CORRECTED') audits,(SELECT count(*)::int FROM pass_events WHERE resource_id=$1 AND event_type='PASS_CORRECTED') events,(SELECT count(*)::int FROM transactional_outbox WHERE aggregate_id=$1 AND event_type='PASS_CORRECTED') outbox`, [passId]);
        assert.deepEqual(counts.rows[0], { corrections:1, actions:1, audits:1, events:1, outbox:1 });
        await expectPgMutationBlocked(context.client, `UPDATE pass_corrections SET reason_private='changed' WHERE id=$1`, [firstBody.correctionId]);
      });
    });

    await t.test('T-AUD-004 voiding countability immediately removes cooldown and usage consequences', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); context.clock.now = new Date(context.clock.now.getTime() + 1_000);
        const reusableProof = await authorize(context.app, 'PASS_REQUEST', 'student-a', '123456', context.base.sectionA1);
        const blocked = await context.app.inject({ method:'POST', url:'/api/v1/passes/requests', headers:{'idempotency-key':'before-correction'}, payload:{ actionProof:reusableProof, sectionId:context.base.sectionA1, destinationId:context.base.destination } });
        assert.equal(blocked.statusCode, 409, blocked.body); assert.equal((blocked.json() as { code:string }).code, 'COOLDOWN_ACTIVE');
        const token = await teacherToken(context.app); const corrected = await teacherCorrect(context.app, token, passId, 'void-policy'); assert.equal(corrected.statusCode, 201, corrected.body);
        const allowed = await context.app.inject({ method:'POST', url:'/api/v1/passes/requests', headers:{'idempotency-key':'after-correction'}, payload:{ actionProof:reusableProof, sectionId:context.base.sectionA1, destinationId:context.base.destination } });
        assert.equal(allowed.statusCode, 201, allowed.body); const evidence = (allowed.json() as { evidence:{ termUsed:number; dailyUsed:number; cooldownRemainingSeconds:number } }).evidence;
        assert.equal(evidence.termUsed, 1); assert.equal(evidence.dailyUsed, 1); assert.equal(evidence.cooldownRemainingSeconds, 0);
      });
    });

    await t.test('T-AUTH-003 teacher cannot correct a pass outside current section assignment', async () => {
      await withFixture(pool, async (context) => {
        context.clock.now = detroit('2026-09-08','09:00:00'); const passId = await createCountablePass(context, context.base.sectionA2); const token = await teacherToken(context.app);
        const response = await teacherCorrect(context.app, token, passId, 'wrong-section'); assert.equal(response.statusCode, 403, response.body);
        assert.equal((await context.client.query<{ count:number }>(`SELECT count(*)::int count FROM pass_corrections WHERE pass_id=$1`, [passId])).rows[0]?.count, 0);
      });
    });

    await t.test('T-AUTH-005 SECURITY cannot call correction route and T-AUTH-006 ADMIN can with audited actor evidence', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); const token = await teacherToken(context.app);
        await context.client.query(`UPDATE user_roles SET role='SECURITY' WHERE organization_id=$1 AND school_id=$2 AND user_id=$3`, [context.base.orgA, context.base.schoolA, context.base.teacherA]);
        const denied = await teacherCorrect(context.app, token, passId, 'security-denied'); assert.equal(denied.statusCode, 403, denied.body);
        await context.client.query(`UPDATE user_roles SET role='ADMIN' WHERE organization_id=$1 AND school_id=$2 AND user_id=$3`, [context.base.orgA, context.base.schoolA, context.base.teacherA]);
        context.clock.now = new Date(context.clock.now.getTime()+1_000);
        const admin = await context.app.inject({ method:'POST', url:`/api/v1/admin/passes/${passId}/corrections`, headers:{ authorization:`Bearer ${token}`, 'idempotency-key':'admin-correct' }, payload:{ type:'VOID_COUNTABILITY', reason:'Synthetic administrator correction' } });
        assert.equal(admin.statusCode, 201, admin.body);
        const audit = await context.client.query<{ actor_user_id:string; actor_kind:string }>(`SELECT actor_user_id,actor_kind FROM audit_events WHERE target_id=$1 AND action='PASS_CORRECTED'`, [passId]);
        assert.deepEqual(audit.rows[0], { actor_user_id:context.base.teacherA, actor_kind:'USER' });
      });
    });

    await t.test('T-AUD-005 staff override evidence records bypassed restrictions, reason, actor, audit and outbox', async () => {
      await withFixture(pool, async (context) => {
        const result = await context.corrections.recordStaffOverrideEvidence({ organizationId:context.base.orgA, schoolId:context.base.schoolA, actorUserId:context.base.teacherA, studentId:context.base.studentA, sectionId:context.base.sectionA1, actionType:'SYNTHETIC_OVERRIDE_PROOF', restrictionsBypassed:['COOLDOWN','DAILY_LIMIT'], reasonPrivate:'Synthetic documented override', idempotencyKey:'override-evidence', correlationId:randomUUID() });
        const row = await context.client.query<{ restrictions_bypassed_json:string[]; reason_private:string; actor_user_id:string }>(`SELECT restrictions_bypassed_json,reason_private,actor_user_id FROM staff_actions WHERE id=$1`, [result.actionId]);
        assert.deepEqual(row.rows[0], { restrictions_bypassed_json:['COOLDOWN','DAILY_LIMIT'], reason_private:'Synthetic documented override', actor_user_id:context.base.teacherA });
        const counts = await context.client.query<{ audits:number; events:number; outbox:number }>(`SELECT (SELECT count(*)::int FROM audit_events WHERE target_id=$1 AND action='STAFF_OVERRIDE_RECORDED') audits,(SELECT count(*)::int FROM pass_events WHERE resource_id=$1 AND event_type='STAFF_OVERRIDE_RECORDED') events,(SELECT count(*)::int FROM transactional_outbox WHERE aggregate_id=$1 AND event_type='STAFF_OVERRIDE_RECORDED') outbox`, [result.actionId]);
        assert.deepEqual(counts.rows[0], { audits:1, events:1, outbox:1 });
      });
    });

    await t.test('T-AUD-006 outbox failure rolls correction, staff action, event, audit and idempotency back together', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); const token = await teacherToken(context.app); context.clock.now = new Date(context.clock.now.getTime()+1_000);
        await context.client.query(`CREATE FUNCTION sw080_fail_correction_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='PASS_CORRECTED' THEN RAISE EXCEPTION 'synthetic correction outbox failure'; END IF; RETURN NEW; END $$`);
        await context.client.query(`CREATE TRIGGER sw080_fail_correction_outbox BEFORE INSERT ON transactional_outbox FOR EACH ROW EXECUTE FUNCTION sw080_fail_correction_outbox()`);
        const failed = await teacherCorrect(context.app, token, passId, 'atomic-correction'); assert.equal(failed.statusCode, 500, failed.body);
        const none = await context.client.query<{ corrections:number; actions:number; audits:number; events:number; idem:number }>(`SELECT (SELECT count(*)::int FROM pass_corrections WHERE pass_id=$1) corrections,(SELECT count(*)::int FROM staff_actions WHERE pass_id=$1) actions,(SELECT count(*)::int FROM audit_events WHERE target_id=$1 AND action='PASS_CORRECTED') audits,(SELECT count(*)::int FROM pass_events WHERE resource_id=$1 AND event_type='PASS_CORRECTED') events,(SELECT count(*)::int FROM idempotency_keys WHERE school_id=$2 AND key='atomic-correction') idem`, [passId,context.base.schoolA]);
        assert.deepEqual(none.rows[0], { corrections:0, actions:0, audits:0, events:0, idem:0 });
        await context.client.query(`DROP TRIGGER sw080_fail_correction_outbox ON transactional_outbox`); await context.client.query(`DROP FUNCTION sw080_fail_correction_outbox()`);
        const retry = await teacherCorrect(context.app, token, passId, 'atomic-correction'); assert.equal(retry.statusCode, 201, retry.body);
      });
    });

    await t.test('T-AUD-007 downstream publish failure cannot erase committed correction/audit state', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); const token = await teacherToken(context.app); context.clock.now = new Date(context.clock.now.getTime()+1_000);
        const corrected = await teacherCorrect(context.app, token, passId, 'publish-failure-proof'); assert.equal(corrected.statusCode, 201, corrected.body);
        await context.client.query(`UPDATE transactional_outbox SET status='FAILED',attempt_count=1,last_error_sanitized='synthetic publisher unavailable',updated_at=now() WHERE aggregate_id=$1 AND event_type='PASS_CORRECTED'`, [passId]);
        const durable = await context.client.query<{ corrections:number; audits:number; events:number; failed:number }>(`SELECT (SELECT count(*)::int FROM pass_corrections WHERE pass_id=$1) corrections,(SELECT count(*)::int FROM audit_events WHERE target_id=$1 AND action='PASS_CORRECTED') audits,(SELECT count(*)::int FROM pass_events WHERE resource_id=$1 AND event_type='PASS_CORRECTED') events,(SELECT count(*)::int FROM transactional_outbox WHERE aggregate_id=$1 AND event_type='PASS_CORRECTED' AND status='FAILED') failed`, [passId]);
        assert.deepEqual(durable.rows[0], { corrections:1, audits:1, events:1, failed:1 });
      });
    });

    await t.test('T-AUD-008 restoration and active/provisional correction fail closed without explicit governance', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); const token = await teacherToken(context.app); context.clock.now = new Date(context.clock.now.getTime()+1_000);
        assert.equal((await teacherCorrect(context.app, token, passId, 'void-first')).statusCode, 201);
        const restore = await teacherCorrect(context.app, token, passId, 'restore-unconfigured', 'RESTORE_COUNTABILITY'); assert.equal(restore.statusCode, 409, restore.body); assert.equal((restore.json() as { code:string }).code, 'CORRECTION_POLICY_REQUIRED');
        context.clock.now = detroit('2026-09-08','08:10:00'); const active = await startPass(context.app, context.base, context.base.sectionA1, 'active-pass');
        const activeCorrection = await teacherCorrect(context.app, token, active.passId!, 'active-correction'); assert.equal(activeCorrection.statusCode, 409, activeCorrection.body); assert.equal((activeCorrection.json() as { code:string }).code, 'PASS_NOT_CORRECTABLE');
      });
    });

    await t.test('bounded history returns effective state and never exceeds requested limit', async () => {
      await withFixture(pool, async (context) => {
        const passId = await createCountablePass(context); const token = await teacherToken(context.app); context.clock.now = new Date(context.clock.now.getTime()+1_000);
        await teacherCorrect(context.app, token, passId, 'history-correction');
        const history = await context.app.inject({ method:'GET', url:`/api/v1/teacher/passes/${passId}/history?limit=2`, headers:{ authorization:`Bearer ${token}` } });
        assert.equal(history.statusCode, 200, history.body); const body = history.json() as { originalCountability:string; effectiveCountability:string; items:unknown[] };
        assert.equal(body.originalCountability,'COUNTABLE'); assert.equal(body.effectiveCountability,'NON_COUNTABLE'); assert.ok(body.items.length <= 2);
      });
    });
  } finally { await pool.end(); }
});
