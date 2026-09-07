import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type QueryResultRow } from 'pg';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { HallPassService } from './service.js';

const databaseUrl = process.env.DATABASE_URL;

class PoolTransactionalDatabase implements TransactionalDatabase {
  readonly #pool: Pool;
  constructor(pool: Pool) { this.#pool = pool; }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    return (await this.#pool.query<T>(sql, [...parameters])).rows;
  }
  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      const executor: QueryExecutor = { query: async <R extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []) => (await client.query<R>(sql, [...parameters])).rows };
      const result = await work(executor);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async close(): Promise<void> {}
}

function tokenHash(token: string): string { return createHash('sha256').update(token, 'utf8').digest('hex'); }

async function seedConcurrentFixture(pool: Pool) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const ids = {
    org: randomUUID(), school: randomUUID(), year: randomUUID(), section: randomUUID(), profile: randomUUID(), period: randomUUID(),
    term: randomUUID(), destination: randomUUID(), policy: randomUUID(), student1: randomUUID(), student2: randomUUID(),
    enrollment1: randomUUID(), enrollment2: randomUUID(), credential1: randomUUID(), credential2: randomUUID(), proof1: randomUUID(), proof2: randomUUID(),
  };
  const proofToken1 = `concurrent-proof-1-${suffix}`;
  const proofToken2 = `concurrent-proof-2-${suffix}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO organizations (id,slug,name) VALUES ($1,$2,$3)`, [ids.org, `sw070-${suffix}`, `SW070 ${suffix}`]);
    await client.query(`INSERT INTO schools (id,organization_id,slug,name,primary_domain,timezone) VALUES ($1,$2,$3,$4,$5,'America/Detroit')`, [ids.school, ids.org, `sw070-school-${suffix}`, `SW070 School ${suffix}`, `${suffix}.example.invalid`]);
    await client.query(`INSERT INTO academic_years (id,school_id,label,starts_on,ends_on) VALUES ($1,$2,'2026-27',DATE '2026-08-20',DATE '2027-06-15')`, [ids.year, ids.school]);
    await client.query(`INSERT INTO students (id,school_id,local_student_number,display_name) VALUES ($1,$3,$4,'Concurrent One'),($2,$3,$5,'Concurrent Two')`, [ids.student1, ids.student2, ids.school, `C1-${suffix}`, `C2-${suffix}`]);
    await client.query(`INSERT INTO sections (id,school_id,academic_year_id,name,code,period_code,period_label) VALUES ($1,$2,$3,'Concurrent Section',$4,'P1','1')`, [ids.section, ids.school, ids.year, `SEC-${suffix}`]);
    await client.query(`INSERT INTO enrollments (id,school_id,section_id,student_id,source) VALUES ($1,$3,$4,$5,'MANUAL'),($2,$3,$4,$6,'MANUAL')`, [ids.enrollment1, ids.enrollment2, ids.school, ids.section, ids.student1, ids.student2]);
    await client.query(`INSERT INTO schedule_profiles (id,school_id,name,key,status) VALUES ($1,$2,'Normal','NORMAL','ACTIVE')`, [ids.profile, ids.school]);
    await client.query(`INSERT INTO schedule_periods (id,school_id,schedule_profile_id,period_code,starts_at_local,ends_at_local,ordinal_by_time) VALUES ($1,$2,$3,'P1',TIME '08:00',TIME '08:50',1)`, [ids.period, ids.school, ids.profile]);
    await client.query(`INSERT INTO school_calendar_days (organization_id,school_id,academic_date,is_school_day,schedule_profile_id,label,source) VALUES ($1,$2,DATE '2026-09-08',true,$3,'Concurrent Day','MANUAL')`, [ids.org, ids.school, ids.profile]);
    await client.query(`INSERT INTO academic_terms (id,school_id,academic_year_id,name,ordinal,starts_on,ends_on,type) VALUES ($1,$2,$3,'MP1',1,DATE '2026-08-20',DATE '2026-10-30','MARKING_PERIOD')`, [ids.term, ids.school, ids.year]);
    await client.query(`INSERT INTO destinations (id,school_id,name,category,active,student_selectable) VALUES ($1,$2,'Restroom','RESTROOM',true,true)`, [ids.destination, ids.school]);
    await client.query(`INSERT INTO school_policy_sets (id,organization_id,school_id,academic_year_id,name,effective_from,effective_until,active) VALUES ($1,$2,$3,$4,'Concurrent Policy',DATE '2026-09-01',DATE '2027-06-15',true)`, [ids.policy, ids.org, ids.school, ids.year]);
    for (const [key, value] of [['MAX_ACTIVE_PER_SECTION',1],['MARKING_PERIOD_LIMIT',0],['DAILY_LIMIT',0],['COOLDOWN_MINUTES',0],['PROTECTED_FIRST_MINUTES',5],['PROTECTED_LAST_MINUTES',5],['QUEUE_MAX_WAIT_MINUTES',20]] as const) {
      await client.query(`INSERT INTO policy_values (school_id,policy_set_id,policy_key,typed_value_json,teacher_override_allowed) VALUES ($1,$2,$3,$4::jsonb,false)`, [ids.school, ids.policy, key, JSON.stringify(value)]);
    }
    await client.query(`INSERT INTO student_credentials (id,school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params,credential_version,status) VALUES ($1,$3,$4,'SCRYPT_PEPPER_V1',$5,$6,'{}'::jsonb,1,'ACTIVE'),($2,$3,$7,'SCRYPT_PEPPER_V1',$5,$6,'{}'::jsonb,1,'ACTIVE')`, [ids.credential1, ids.credential2, ids.school, ids.student1, 'a'.repeat(64), 'synthetic-salt-0001', ids.student2]);
    await client.query(`INSERT INTO action_proofs (id,school_id,student_id,action_type,context_section_id,credential_id,credential_version,token_hash,issued_at,expires_at,request_id) VALUES ($1,$3,$4,'PASS_REQUEST',$5,$6,1,$7,TIMESTAMPTZ '2026-09-08 12:04:00Z',TIMESTAMPTZ '2026-09-08 12:20:00Z',$8),($2,$3,$9,'PASS_REQUEST',$5,$10,1,$11,TIMESTAMPTZ '2026-09-08 12:04:00Z',TIMESTAMPTZ '2026-09-08 12:20:00Z',$12)`, [ids.proof1, ids.proof2, ids.school, ids.student1, ids.section, ids.credential1, tokenHash(proofToken1), randomUUID(), ids.student2, ids.credential2, tokenHash(proofToken2), randomUUID()]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { ...ids, proofToken1, proofToken2 };
}

test('T-PASS-005/T-PERF-004 concurrent requests cannot exceed section capacity across real PostgreSQL connections', { skip: !databaseUrl }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 6, application_name: 'grantdesk-schoolwide:hall-pass-concurrency' });
  const ids = await seedConcurrentFixture(pool);
  try {
    const database = new PoolTransactionalDatabase(pool);
    const at = new Date('2026-09-08T12:05:00Z');
    const serviceA = new HallPassService(database, { now: () => at });
    const serviceB = new HallPassService(database, { now: () => at });
    const [one, two] = await Promise.all([
      serviceA.requestPass({ actionProof: ids.proofToken1, sectionId: ids.section, destinationId: ids.destination, idempotencyKey: `concurrent-a-${ids.school}`, correlationId: randomUUID() }),
      serviceB.requestPass({ actionProof: ids.proofToken2, sectionId: ids.section, destinationId: ids.destination, idempotencyKey: `concurrent-b-${ids.school}`, correlationId: randomUUID() }),
    ]);
    assert.deepEqual([one.outcome, two.outcome].sort(), ['QUEUED', 'STARTED']);
    const counts = await pool.query<{ active: number; waiting: number }>(`SELECT (SELECT count(*)::int FROM passes WHERE school_id=$1 AND section_id=$2 AND status='OUT') active,(SELECT count(*)::int FROM queue_entries WHERE school_id=$1 AND section_id=$2 AND status='WAITING') waiting`, [ids.school, ids.section]);
    assert.deepEqual(counts.rows[0], { active: 1, waiting: 1 });
  } finally {
    // The CI database is disposable, and audit_events is deliberately append-only.
    // This committed fixture uses random tenant IDs, so leaving its evidence intact
    // proves the audit contract without colliding with any other test fixture.
    await pool.end();
  }
});
