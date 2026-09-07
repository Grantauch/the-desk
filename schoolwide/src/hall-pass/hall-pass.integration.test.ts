import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { buildApp } from '../app.js';
import { ClientTransactionalDatabase } from '../checkins/test-fixtures.js';
import type { AppConfig } from '../config.js';
import type { StudentIdentityProvider, VerifiedStudentIdentity } from '../student-credentials/types.js';
import { StudentCredentialService } from '../student-credentials/service.js';
import { HallPassService } from './service.js';
import { hallPassFixtureIds, seedHallPassFixture, type HallPassFixture } from './test-fixtures.js';

const databaseUrl = process.env.DATABASE_URL;
const config: AppConfig = {
  nodeEnv: 'test', host: '127.0.0.1', port: 8787, logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide', dbPoolMax: 2,
  instanceId: 'hall-pass-test', legacyReadAdapterMode: 'disabled', legacyProductionWrites: 'forbidden',
};

function detroit(date: string, time: string): Date { return new Date(`${date}T${time}-04:00`); }

class HallPassStudentProvider implements StudentIdentityProvider {
  readonly #base: HallPassFixture;
  constructor(base: HallPassFixture) { this.#base = base; }
  async verify(assertion: string): Promise<VerifiedStudentIdentity> {
    const map: Record<string, string> = {
      'student-a': this.#base.studentA,
      'student-a2': this.#base.studentA2,
      'student-a3': this.#base.studentA3,
    };
    const studentId = map[assertion];
    if (!studentId) throw new Error('Synthetic student identity rejected.');
    return { provider: 'SYNTHETIC', subject: `synthetic-${assertion}`, studentId };
  }
}

type FixtureContext = {
  client: PoolClient;
  app: ReturnType<typeof buildApp>;
  service: HallPassService;
  base: HallPassFixture;
  clock: { now: Date };
};

async function withFixture(pool: Pool, fn: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  let app: ReturnType<typeof buildApp> | null = null;
  try {
    const base = await seedHallPassFixture(client);
    const database = new ClientTransactionalDatabase(client);
    const clock = { now: detroit('2026-09-08', '08:05:00') };
    const provider = new HallPassStudentProvider(base);
    const credentials = new StudentCredentialService(database, provider, { pepper: 'synthetic-sw070-pepper', now: () => clock.now, proofTtlMs: 90_000 });
    await credentials.provisionPin(base.studentA, '123456');
    await credentials.provisionPin(base.studentA2, '654321');
    await credentials.provisionPin(base.studentA3, '111222');
    const hallPassOptions = { now: () => clock.now };
    const service = new HallPassService(database, hallPassOptions);
    app = buildApp({ config, database, studentIdentityProvider: provider, studentCredentialOptions: { pepper: 'synthetic-sw070-pepper', now: () => clock.now, proofTtlMs: 90_000 }, hallPassOptions });
    await fn({ client, app, service, base, clock });
  } finally {
    if (app) await app.close();
    await client.query('ROLLBACK');
    client.release();
  }
}

async function authorize(app: ReturnType<typeof buildApp>, action: 'PASS_REQUEST' | 'RETURN', assertion: string, pin: string, sectionId?: string): Promise<string> {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/student/actions/authorize', headers: { 'x-student-identity-assertion': assertion },
    payload: { pin, action, ...(sectionId ? { sectionId } : {}) },
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json() as { actionProof?: string };
  assert.ok(body.actionProof);
  return body.actionProof;
}

async function requestPass(app: ReturnType<typeof buildApp>, sectionId: string, destinationId: string, proof: string, key: string) {
  return app.inject({ method: 'POST', url: '/api/v1/passes/requests', headers: { 'idempotency-key': key }, payload: { actionProof: proof, sectionId, destinationId } });
}

async function returnPass(app: ReturnType<typeof buildApp>, proof: string, key: string) {
  return app.inject({ method: 'POST', url: '/api/v1/student/passes/active/return', headers: { 'idempotency-key': key }, payload: { actionProof: proof } });
}

async function proofConsumedAt(client: PoolClient, proof: string): Promise<Date | null> {
  const tokenHash = createHash('sha256').update(proof, 'utf8').digest('hex');
  const result = await client.query<{ consumed_at: Date | null }>('SELECT consumed_at FROM action_proofs WHERE token_hash=$1', [tokenHash]);
  return result.rows[0]?.consumed_at ?? null;
}

async function startFor(app: ReturnType<typeof buildApp>, base: HallPassFixture, assertion: string, pin: string, key: string) {
  const proof = await authorize(app, 'PASS_REQUEST', assertion, pin, base.sectionA1);
  const response = await requestPass(app, base.sectionA1, base.destination, proof, key);
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { outcome: 'STARTED' | 'QUEUED'; passRequestId: string; passId: string | null; queueEntryId: string | null };
}

async function setPolicy(client: PoolClient, key: string, value: number): Promise<void> {
  await client.query(`UPDATE policy_values SET typed_value_json=$1::jsonb WHERE policy_set_id=$2 AND policy_key=$3`, [JSON.stringify(value), hallPassFixtureIds.policySet, key]);
}

test('SW-070 Hall Pass core', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 8, application_name: 'grantdesk-schoolwide:hall-pass-test' });
  try {
    await t.test('T-PASS-001/002/003 capacity starts one, queues next, and return promotes same verified request without second PIN', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        const first = await startFor(app, base, 'student-a', '123456', 'pass-first');
        assert.equal(first.outcome, 'STARTED');
        const secondProof = await authorize(app, 'PASS_REQUEST', 'student-a2', '654321', base.sectionA1);
        const secondResponse = await requestPass(app, base.sectionA1, base.destination, secondProof, 'pass-second');
        assert.equal(secondResponse.statusCode, 201, secondResponse.body);
        const second = secondResponse.json() as { outcome: string; passRequestId: string; queueEntryId: string };
        assert.equal(second.outcome, 'QUEUED');
        assert.ok(second.queueEntryId);
        assert.ok(await proofConsumedAt(client, secondProof));

        clock.now = detroit('2026-09-08', '08:10:00');
        const returnProof = await authorize(app, 'RETURN', 'student-a', '123456');
        const returned = await returnPass(app, returnProof, 'return-first');
        assert.equal(returned.statusCode, 200, returned.body);
        assert.equal((returned.json() as { promotedRequestId: string }).promotedRequestId, second.passRequestId);
        const promoted = await client.query<{ status: string; pass_request_id: string }>(`SELECT status, pass_request_id FROM passes WHERE student_id=$1 ORDER BY started_at DESC LIMIT 1`, [base.studentA2]);
        assert.deepEqual(promoted.rows[0], { status: 'OUT', pass_request_id: second.passRequestId });
        const proofCount = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM action_proofs WHERE student_id=$1 AND action_type='PASS_REQUEST'`, [base.studentA2]);
        assert.equal(proofCount.rows[0]?.count, '1');
      });
    });

    await t.test('T-PASS-004 idempotent retry returns the same logical request and creates no duplicate pass', async () => {
      await withFixture(pool, async ({ client, app, base }) => {
        const proof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA1);
        const first = await requestPass(app, base.sectionA1, base.destination, proof, 'same-key');
        assert.equal(first.statusCode, 201, first.body);
        const retry = await requestPass(app, base.sectionA1, base.destination, proof, 'same-key');
        assert.equal(retry.statusCode, 201, retry.body);
        assert.equal((retry.json() as { passRequestId: string }).passRequestId, (first.json() as { passRequestId: string }).passRequestId);
        const counts = await client.query<{ requests: string; passes: string }>(`SELECT (SELECT count(*)::text FROM pass_requests) requests, (SELECT count(*)::text FROM passes) passes`);
        assert.deepEqual(counts.rows[0], { requests: '1', passes: '1' });
      });
    });

    await t.test('T-PASS-006/007 FIFO settlement skips newly ineligible front student and promotes the next eligible request', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        await startFor(app, base, 'student-a', '123456', 'fifo-active');
        const q1 = await startFor(app, base, 'student-a2', '654321', 'fifo-q1');
        const q2 = await startFor(app, base, 'student-a3', '111222', 'fifo-q2');
        assert.equal(q1.outcome, 'QUEUED'); assert.equal(q2.outcome, 'QUEUED');
        await client.query(
          `INSERT INTO student_access_rules (organization_id, school_id, student_id, section_id, access_mode, reason_private, valid_from, status)
           VALUES ($1,$2,$3,$4,'ESCORT_ONLY','synthetic private reason',$5::timestamptz,'ACTIVE')`,
          [base.orgA, base.schoolA, base.studentA2, base.sectionA1, clock.now.toISOString()],
        );
        clock.now = detroit('2026-09-08', '08:10:00');
        const returnProof = await authorize(app, 'RETURN', 'student-a', '123456');
        const returned = await returnPass(app, returnProof, 'fifo-return');
        assert.equal(returned.statusCode, 200, returned.body);
        assert.equal((returned.json() as { promotedRequestId: string }).promotedRequestId, q2.passRequestId);
        const requests = await client.query<{ id: string; status: string; resolution_code: string | null }>(`SELECT id,status,resolution_code FROM pass_requests WHERE id IN ($1,$2) ORDER BY id`, [q1.passRequestId, q2.passRequestId]);
        const byId = new Map(requests.rows.map((row) => [row.id, row]));
        assert.equal(byId.get(q1.passRequestId)?.status, 'REJECTED');
        assert.equal(byId.get(q2.passRequestId)?.status, 'STARTED');
      });
    });

    await t.test('T-PASS-008 and T-SCH-009 queued request expires at class end while active pass remains returnable after bell', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        await startFor(app, base, 'student-a', '123456', 'late-active');
        const queued = await startFor(app, base, 'student-a2', '654321', 'late-queued');
        assert.equal(queued.outcome, 'QUEUED');
        clock.now = detroit('2026-09-08', '08:51:00');
        const proof = await authorize(app, 'RETURN', 'student-a', '123456');
        const returned = await returnPass(app, proof, 'after-bell-return');
        assert.equal(returned.statusCode, 200, returned.body);
        assert.equal((returned.json() as { promotedRequestId: string | null }).promotedRequestId, null);
        const request = await client.query<{ status: string }>('SELECT status FROM pass_requests WHERE id=$1', [queued.passRequestId]);
        assert.equal(request.rows[0]?.status, 'EXPIRED');
      });
    });

    await t.test('T-PASS-009 queue cancel is owned by canonical student identity and forged ownership is denied', async () => {
      await withFixture(pool, async ({ client, app, base }) => {
        await startFor(app, base, 'student-a', '123456', 'cancel-active');
        const queued = await startFor(app, base, 'student-a2', '654321', 'cancel-q');
        const forged = await app.inject({ method: 'POST', url: `/api/v1/passes/requests/${queued.passRequestId}/cancel`, headers: { 'idempotency-key': 'cancel-forged', 'x-student-identity-assertion': 'student-a' }, payload: {} });
        assert.equal(forged.statusCode, 404, forged.body);
        const cancelled = await app.inject({ method: 'POST', url: `/api/v1/passes/requests/${queued.passRequestId}/cancel`, headers: { 'idempotency-key': 'cancel-owned', 'x-student-identity-assertion': 'student-a2' }, payload: {} });
        assert.equal(cancelled.statusCode, 200, cancelled.body);
        const row = await client.query<{ status: string }>('SELECT status FROM queue_entries WHERE pass_request_id=$1', [queued.passRequestId]);
        assert.equal(row.rows[0]?.status, 'CANCELLED');
      });
    });

    await t.test('T-PASS-010 active pass prevents conflicting second active request', async () => {
      await withFixture(pool, async ({ app, base }) => {
        await startFor(app, base, 'student-a', '123456', 'conflict-first');
        const proof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA1);
        const response = await requestPass(app, base.sectionA1, base.destination, proof, 'conflict-second');
        assert.equal(response.statusCode, 409, response.body);
        assert.equal((response.json() as { code: string }).code, 'CONFLICT_ACTIVE_PASS');
      });
    });

    await t.test('T-SCH-004/005/007/008 no-school and unknown schedule fail closed; exact opening allowed and exact closing blocked', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:04:59');
        const openingProof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA1);
        clock.now = detroit('2026-09-08', '08:05:00');
        const opening = await requestPass(app, base.sectionA1, base.destination, openingProof, 'boundary-open');
        assert.equal(opening.statusCode, 201, opening.body);

        await client.query(`DELETE FROM passes; DELETE FROM pass_requests; DELETE FROM idempotency_keys WHERE operation='STUDENT_PASS_REQUEST'`);
        clock.now = detroit('2026-09-08', '08:44:59');
        const closingProof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA1);
        clock.now = detroit('2026-09-08', '08:45:00');
        const closing = await requestPass(app, base.sectionA1, base.destination, closingProof, 'boundary-close');
        assert.equal(closing.statusCode, 409, closing.body);
        assert.equal((closing.json() as { code: string }).code, 'PASS_WINDOW_CLOSED');

        clock.now = detroit('2026-09-09', '08:10:00');
        const noSchoolProof = await authorize(app, 'PASS_REQUEST', 'student-a2', '654321', base.sectionA1);
        const noSchool = await requestPass(app, base.sectionA1, base.destination, noSchoolProof, 'no-school');
        assert.equal(noSchool.statusCode, 409, noSchool.body);
        assert.equal((noSchool.json() as { code: string }).code, 'CLASS_NOT_IN_SESSION');

        clock.now = detroit('2026-09-11', '08:10:00');
        const missingProof = await authorize(app, 'PASS_REQUEST', 'student-a3', '111222', base.sectionA1);
        const missing = await requestPass(app, base.sectionA1, base.destination, missingProof, 'missing-schedule');
        assert.equal(missing.statusCode, 409, missing.body);
        assert.equal((missing.json() as { code: string }).code, 'CLASS_NOT_IN_SESSION');
      });
    });

    await t.test('T-RET-001/002/004/006/008/009 sub-3-second return is exact, idempotent, non-countable, explicit, and creates no cooldown/daily consequence', async () => {
      await withFixture(pool, async ({ app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:05:00');
        const started = await startFor(app, base, 'student-a', '123456', 'short-start');
        assert.equal(started.outcome, 'STARTED');
        clock.now = new Date(detroit('2026-09-08', '08:05:00').getTime() + 2_999);
        const returnProof = await authorize(app, 'RETURN', 'student-a', '123456');
        const first = await returnPass(app, returnProof, 'short-return');
        assert.equal(first.statusCode, 200, first.body);
        const body = first.json() as { durationMs: number; countability: string; counted: boolean; message: string; passId: string };
        assert.equal(body.durationMs, 2_999);
        assert.equal(body.countability, 'NON_COUNTABLE');
        assert.equal(body.counted, false);
        assert.match(body.message, /did not count/i);
        const retry = await returnPass(app, returnProof, 'short-return');
        assert.equal(retry.statusCode, 200, retry.body);
        assert.equal((retry.json() as { passId: string }).passId, body.passId);

        clock.now = detroit('2026-09-08', '08:05:04');
        const nextProof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA1);
        const next = await requestPass(app, base.sectionA1, base.destination, nextProof, 'after-short');
        assert.equal(next.statusCode, 201, next.body);
        const evidence = (next.json() as { evidence: { dailyUsed: number; cooldownRemainingSeconds: number } }).evidence;
        assert.equal(evidence.dailyUsed, 1);
        assert.equal(evidence.cooldownRemainingSeconds, 0);
      });
    });

    await t.test('T-RET-005 exact 3.0-second return is countable and activates student-wide cooldown', async () => {
      await withFixture(pool, async ({ app, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:05:00');
        await startFor(app, base, 'student-a', '123456', 'exact-start');
        clock.now = new Date(detroit('2026-09-08', '08:05:00').getTime() + 3_000);
        const proof = await authorize(app, 'RETURN', 'student-a', '123456');
        const returned = await returnPass(app, proof, 'exact-return');
        assert.equal(returned.statusCode, 200, returned.body);
        const body = returned.json() as { durationMs: number; countability: string; counted: boolean };
        assert.equal(body.durationMs, 3_000); assert.equal(body.countability, 'COUNTABLE'); assert.equal(body.counted, true);
        clock.now = detroit('2026-09-08', '09:00:00');
        const p2Proof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA2);
        const blocked = await requestPass(app, base.sectionA2, base.destination, p2Proof, 'cooldown-cross-section');
        assert.equal(blocked.statusCode, 409, blocked.body);
        assert.equal((blocked.json() as { code: string }).code, 'COOLDOWN_ACTIVE');
      });
    });

    await t.test('T-POL-006/007/008 access and usage scopes preserve section marking-period count but student-wide daily/cooldown; UNLIMITED bypasses limits', async () => {
      await withFixture(pool, async ({ client, app, base, clock }) => {
        await setPolicy(client, 'COOLDOWN_MINUTES', 0);
        await setPolicy(client, 'DAILY_LIMIT', 1);
        clock.now = detroit('2026-09-08', '08:05:00');
        await startFor(app, base, 'student-a', '123456', 'scope-start');
        clock.now = detroit('2026-09-08', '08:10:00');
        const ret = await authorize(app, 'RETURN', 'student-a', '123456');
        await returnPass(app, ret, 'scope-return');

        clock.now = detroit('2026-09-08', '09:00:00');
        const blockedProof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA2);
        const blocked = await requestPass(app, base.sectionA2, base.destination, blockedProof, 'daily-cross-section');
        assert.equal(blocked.statusCode, 409, blocked.body);
        assert.equal((blocked.json() as { code: string }).code, 'DAILY_LIMIT_ACTIVE');

        await client.query(
          `INSERT INTO student_access_rules (organization_id,school_id,student_id,section_id,access_mode,reason_private,valid_from,status)
           VALUES ($1,$2,$3,$4,'UNLIMITED','private synthetic',$5::timestamptz,'ACTIVE')`,
          [base.orgA, base.schoolA, base.studentA, base.sectionA2, clock.now.toISOString()],
        );
        const unlimitedProof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA2);
        const unlimited = await requestPass(app, base.sectionA2, base.destination, unlimitedProof, 'unlimited-cross-section');
        assert.equal(unlimited.statusCode, 201, unlimited.body);
        const evidence = (unlimited.json() as { evidence: { termUsed: number; termLimit: number | null; dailyUsed: number; dailyLimit: number | null } }).evidence;
        assert.equal(evidence.termUsed, 1);
        assert.equal(evidence.termLimit, null);
        assert.equal(evidence.dailyUsed, 2);
        assert.equal(evidence.dailyLimit, null);
      });
    });

    await t.test('T-RET-003/010 prior-day OUT state rolls over countably and cannot be closed by a current RETURN proof', async () => {
      await withFixture(pool, async ({ client, app, service, base, clock }) => {
        clock.now = detroit('2026-09-08', '08:05:00');
        const started = await startFor(app, base, 'student-a', '123456', 'roll-start');
        assert.ok(started.passId);
        clock.now = detroit('2026-09-10', '08:05:00');
        const rolled = await service.rollOverPriorDayPasses(base.schoolA, base.orgA, 'America/Detroit', '2026-09-10', randomUUID());
        assert.equal(rolled, 1);
        const row = await client.query<{ status: string; countability: string }>('SELECT status,countability FROM passes WHERE id=$1', [started.passId]);
        assert.deepEqual(row.rows[0], { status: 'ROLLED_OVER', countability: 'COUNTABLE' });
        const returnProof = await authorize(app, 'RETURN', 'student-a', '123456');
        const response = await returnPass(app, returnProof, 'roll-return');
        assert.equal(response.statusCode, 409, response.body);
        assert.equal((response.json() as { code: string }).code, 'ACTIVE_PASS_NOT_FOUND');
      });
    });

    await t.test('T-AUD-006 downstream outbox failure rolls back proof, request/pass, audit, and idempotency together', async () => {
      await withFixture(pool, async ({ client, app, base }) => {
        const proof = await authorize(app, 'PASS_REQUEST', 'student-a', '123456', base.sectionA1);
        await client.query(`CREATE FUNCTION sw070_fail_pass_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='PASS_STARTED' THEN RAISE EXCEPTION 'synthetic pass outbox failure'; END IF; RETURN NEW; END $$`);
        await client.query(`CREATE TRIGGER sw070_fail_pass_outbox BEFORE INSERT ON transactional_outbox FOR EACH ROW EXECUTE FUNCTION sw070_fail_pass_outbox()`);
        const failed = await requestPass(app, base.sectionA1, base.destination, proof, 'atomic-pass');
        assert.equal(failed.statusCode, 500, failed.body);
        const counts = await client.query<{ requests: string; passes: string; audits: string; idem: string }>(`SELECT (SELECT count(*)::text FROM pass_requests) requests,(SELECT count(*)::text FROM passes) passes,(SELECT count(*)::text FROM audit_events WHERE action='PASS_STARTED') audits,(SELECT count(*)::text FROM idempotency_keys WHERE operation='STUDENT_PASS_REQUEST') idem`);
        assert.deepEqual(counts.rows[0], { requests: '0', passes: '0', audits: '0', idem: '0' });
        assert.equal(await proofConsumedAt(client, proof), null);
        await client.query('DROP TRIGGER sw070_fail_pass_outbox ON transactional_outbox');
        await client.query('DROP FUNCTION sw070_fail_pass_outbox()');
        const retry = await requestPass(app, base.sectionA1, base.destination, proof, 'atomic-pass');
        assert.equal(retry.statusCode, 201, retry.body);
      });
    });
  } finally {
    await pool.end();
  }
});
