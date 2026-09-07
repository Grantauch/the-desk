import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedHallPassFixture, type HallPassFixture } from '../hall-pass/test-fixtures.js';
import { SecurityConsoleService } from './service.js';
import { securityConsoleHtml } from './ui.js';

const databaseUrl = process.env.DATABASE_URL;
const NOW = new Date('2026-09-08T12:10:00.000Z');
const securityUser = '00000000-0000-0000-0000-000000000359';

class SavepointDatabase implements TransactionalDatabase {
  readonly #client: PoolClient;
  #counter = 0;
  constructor(client: PoolClient) { this.#client = client; }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    return (await this.#client.query<T>(sql, [...parameters])).rows;
  }
  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const savepoint = `sw110_hardening_${++this.#counter}`;
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

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

async function seedSecurityUser(client: PoolClient, fixture: HallPassFixture): Promise<void> {
  await client.query(
    `INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id)
     VALUES ($1,$2,'security-hardening@north.example.invalid','Security Hardening','google-security-hardening')`,
    [securityUser, fixture.orgA],
  );
  await client.query(
    `INSERT INTO staff_profiles (user_id,organization_id,title) VALUES ($1,$2,'Security')`,
    [securityUser, fixture.orgA],
  );
}

async function insertActivePass(client: PoolClient, fixture: HallPassFixture): Promise<string> {
  const enrollment = await client.query<{ id: string }>(
    `SELECT id FROM enrollments WHERE school_id=$1 AND section_id=$2 AND student_id=$3 AND status='ACTIVE' LIMIT 1`,
    [fixture.schoolA, fixture.sectionA1, fixture.studentA],
  );
  const enrollmentId = enrollment.rows[0]?.id;
  assert.ok(enrollmentId);
  const seed = randomUUID();
  const credential = await client.query<{ id: string }>(
    `INSERT INTO student_credentials (school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params)
     VALUES ($1,$2,'SCRYPT_PEPPER_V1',$3,$4,'{}'::jsonb) RETURNING id`,
    [fixture.schoolA, fixture.studentA, hash('secret-'+seed), hash('salt-'+seed).slice(0,16)],
  );
  const credentialId = credential.rows[0]?.id;
  assert.ok(credentialId);
  const proof = await client.query<{ id: string }>(
    `INSERT INTO action_proofs (school_id,student_id,action_type,context_section_id,credential_id,credential_version,token_hash,issued_at,expires_at,consumed_at,request_id)
     VALUES ($1,$2,'PASS_REQUEST',$3,$4,1,$5,'2026-09-08T12:00:00Z','2026-09-08T12:30:00Z','2026-09-08T12:00:00Z',$6) RETURNING id`,
    [fixture.schoolA,fixture.studentA,fixture.sectionA1,credentialId,hash('proof-'+seed),randomUUID()],
  );
  const proofId = proof.rows[0]?.id;
  assert.ok(proofId);
  const request = await client.query<{ id: string }>(
    `INSERT INTO pass_requests (organization_id,school_id,student_id,section_id,enrollment_id,destination_id,action_proof_id,requested_at,class_end_at,queue_expires_at,status,resolved_at,resolution_code,request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-09-08T12:05:00Z','2026-09-08T13:00:00Z','2026-09-08T12:25:00Z','STARTED','2026-09-08T12:05:00Z','CAPACITY_AVAILABLE',$8) RETURNING id`,
    [fixture.orgA,fixture.schoolA,fixture.studentA,fixture.sectionA1,enrollmentId,fixture.destination,proofId,randomUUID()],
  );
  const requestId = request.rows[0]?.id;
  assert.ok(requestId);
  const pass = await client.query<{ id: string }>(
    `INSERT INTO passes (organization_id,school_id,pass_request_id,student_id,section_id,enrollment_id,destination_id,started_at,start_action_proof_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-09-08T12:05:00Z',$8) RETURNING id`,
    [fixture.orgA,fixture.schoolA,requestId,fixture.studentA,fixture.sectionA1,enrollmentId,fixture.destination,proofId],
  );
  const passId = pass.rows[0]?.id;
  assert.ok(passId);
  return passId;
}

test('SW-110 hardening regressions', { skip: !databaseUrl }, async (t) => {
  await t.test('Security shell exposes teacher filtering and never force-close', () => {
    const html = securityConsoleHtml();
    assert.match(html, /id="teacherFilter"/);
    assert.match(html, /teacherUserId/);
    assert.doesNotMatch(html, /force[ -]?close/i);
  });

  await t.test('completed Security action retries replay after the pass later closes elsewhere', async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 1, application_name: 'grantdesk-schoolwide:sw110-hardening' });
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      const fixture = await seedHallPassFixture(client);
      await seedSecurityUser(client, fixture);
      const passId = await insertActivePass(client, fixture);
      const service = new SecurityConsoleService(new SavepointDatabase(client), { now: () => NOW });
      const key = randomUUID();
      const first = await service.markLocated({
        actorUserId: securityUser,
        organizationId: fixture.orgA,
        schoolId: fixture.schoolA,
        passId,
        reasonPrivate: 'Located before external return',
        idempotencyKey: key,
        correlationId: randomUUID(),
      });
      const beforeClose = await client.query<{ status: string }>(`SELECT status FROM passes WHERE id=$1`, [passId]);
      assert.equal(beforeClose.rows[0]?.status, 'OUT');

      await client.query(
        `UPDATE passes
            SET status='RETURNED',returned_at=$2::timestamptz,countability='COUNTABLE',countability_reason='SYNTHETIC_EXTERNAL_RETURN',
                classified_at=$2::timestamptz,duration_ms=300000,authorization_method_return='TEACHER_STAFF_ACTION',
                return_action_proof_id=NULL,return_actor_user_id=$3,return_request_id=$4,updated_at=$2::timestamptz
          WHERE id=$1`,
        [passId, NOW.toISOString(), fixture.teacherA, randomUUID()],
      );

      const retry = await service.markLocated({
        actorUserId: securityUser,
        organizationId: fixture.orgA,
        schoolId: fixture.schoolA,
        passId,
        reasonPrivate: 'Located before external return',
        idempotencyKey: key,
        correlationId: randomUUID(),
      });
      assert.deepEqual(retry, first);
      const actionCount = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM staff_actions WHERE pass_id=$1 AND action_type='SECURITY_MARK_LOCATED'`,
        [passId],
      );
      assert.equal(actionCount.rows[0]?.count, '1');
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });
});
