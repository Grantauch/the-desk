import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import { PostgresDatabase } from '../db/database.js';
import { CheckInService } from './service.js';

// CI disposable DB only: refuse to run this write-heavy fixture against an
// unrelated, staging, Margin, or potentially real student database.
const databaseUrl = process.env.DATABASE_URL;
function permittedCiDatabase(url?: string): boolean {
  if (process.env.NODE_ENV !== 'test' || !url) return false;
  try {
    const parsed = new URL(url);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname)
      && parsed.port === '5432'
      && parsed.pathname === '/grantdesk_schoolwide_load'
      && parsed.username === 'grantdesk';
  } catch {
    return false;
  }
}

function hash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function seedSyntheticClass(pool: Pool, size: number) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const ids = {
    org: randomUUID(),
    school: randomUUID(),
    year: randomUUID(),
    section: randomUUID(),
    profile: randomUUID(),
    period: randomUUID(),
    policy: randomUUID(),
  };
  const students = Array.from({ length: size }, (_, i) => ({
    id: randomUUID(),
    enrollment: randomUUID(),
    credential: randomUUID(),
    proofId: randomUUID(),
    proof: `synthetic-checkin-${suffix}-${i}`,
    key: `synthetic-class-${suffix}-${i}`,
  }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO organizations (id,slug,name) VALUES ($1,$2,$3)', [ids.org, `ci-load-${suffix}`, 'Synthetic CI Load']);
    await client.query(
      `INSERT INTO schools (id,organization_id,slug,name,primary_domain,timezone)
       VALUES ($1,$2,$3,'Synthetic School',$4,'America/Detroit')`,
      [ids.school, ids.org, `ci-load-school-${suffix}`, `${suffix}.example.invalid`],
    );
    await client.query(
      `INSERT INTO academic_years (id,school_id,label,starts_on,ends_on)
       VALUES ($1,$2,'2026-27',DATE '2026-08-20',DATE '2027-06-15')`,
      [ids.year, ids.school],
    );
    await client.query(
      `INSERT INTO sections (id,school_id,academic_year_id,name,code,period_code,period_label)
       VALUES ($1,$2,$3,'Synthetic Section',$4,'P1','1')`,
      [ids.section, ids.school, ids.year, `CI-${suffix}`],
    );
    await client.query(
      `INSERT INTO schedule_profiles (id,school_id,name,key,status)
       VALUES ($1,$2,'Normal','NORMAL','ACTIVE')`,
      [ids.profile, ids.school],
    );
    await client.query(
      `INSERT INTO schedule_periods (id,school_id,schedule_profile_id,period_code,starts_at_local,ends_at_local,ordinal_by_time)
       VALUES ($1,$2,$3,'P1',TIME '08:00',TIME '08:50',1)`,
      [ids.period, ids.school, ids.profile],
    );
    await client.query(
      `INSERT INTO school_calendar_days
       (organization_id,school_id,academic_date,is_school_day,schedule_profile_id,label,source)
       VALUES ($1,$2,DATE '2026-09-08',true,$3,'Synthetic Day','MANUAL')`,
      [ids.org, ids.school, ids.profile],
    );
    await client.query(
      `INSERT INTO school_policy_sets
       (id,organization_id,school_id,academic_year_id,name,effective_from,effective_until,active)
       VALUES ($1,$2,$3,$4,'Synthetic Policy',DATE '2026-09-01',DATE '2027-06-15',true)`,
      [ids.policy, ids.org, ids.school, ids.year],
    );
    await client.query(
      `INSERT INTO policy_values
       (school_id,policy_set_id,policy_key,typed_value_json,teacher_override_allowed)
       VALUES ($1,$2,'CHECKIN_WINDOW_MINUTES','5'::jsonb,false)`,
      [ids.school, ids.policy],
    );

    for (let i = 0; i < students.length; i += 1) {
      const s = students[i]!;
      await client.query(
        `INSERT INTO students (id,school_id,local_student_number,display_name)
         VALUES ($1,$2,$3,$4)`,
        [s.id, ids.school, `SYN-${suffix}-${i}`, `Synthetic ${i + 1}`],
      );
      await client.query(
        `INSERT INTO enrollments (id,school_id,section_id,student_id,source)
         VALUES ($1,$2,$3,$4,'MANUAL')`,
        [s.enrollment, ids.school, ids.section, s.id],
      );
      await client.query(
        `INSERT INTO student_credentials
         (id,school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params,credential_version,status)
         VALUES ($1,$2,$3,'SCRYPT_PEPPER_V1',$4,'synthetic-salt-0001','{}'::jsonb,1,'ACTIVE')`,
        [s.credential, ids.school, s.id, 'a'.repeat(64)],
      );
      await client.query(
        `INSERT INTO action_proofs
         (id,school_id,student_id,action_type,context_section_id,credential_id,credential_version,token_hash,issued_at,expires_at,request_id)
         VALUES ($1,$2,$3,'CHECKIN',$4,$5,1,$6,TIMESTAMPTZ '2026-09-08 12:00:00Z',
                 TIMESTAMPTZ '2026-09-08 12:10:00Z',$7)`,
        [s.proofId, ids.school, s.id, ids.section, s.credential, hash(s.proof), randomUUID()],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { ...ids, students };
}

test('T-CI-LOAD-035: 35 simultaneous synthetic Check-Ins remain unique and idempotent', {
  skip: !permittedCiDatabase(databaseUrl),
  timeout: 60_000,
}, async () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 6,
    application_name: 'grantdesk-schoolwide:synthetic-checkin-load',
  });
  const config: AppConfig = {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 8787,
    logLevel: 'silent',
    databaseUrl: databaseUrl!,
    dbPoolMax: 12,
    instanceId: 'synthetic-checkin-load',
    legacyReadAdapterMode: 'disabled',
    legacyProductionWrites: 'forbidden',
  };
  const db = new PostgresDatabase(config);
  try {
    const fixture = await seedSyntheticClass(pool, 35);
    const at = new Date('2026-09-08T12:02:00.000Z');
    const service = new CheckInService(db, { now: () => at });
    const started = performance.now();
    const checkins = await Promise.all(fixture.students.map((s) => service.studentCheckIn({
      actionProof: s.proof,
      sectionId: fixture.section,
      idempotencyKey: s.key,
      correlationId: randomUUID(),
    })));
    const elapsed = Math.round(performance.now() - started);
    assert.equal(checkins.length, 35);
    assert.equal(new Set(checkins.map((c) => c.checkInId)).size, 35);
    for (let i = 0; i < checkins.length; i += 1) {
      assert.equal(checkins[i]?.studentId, fixture.students[i]?.id);
      assert.equal(checkins[i]?.created, true);
      assert.equal(checkins[i]?.pointValue, 1);
    }

    // Retry every request with the same idempotency key: no double credits.
    const retry = await Promise.all(fixture.students.map((s) => service.studentCheckIn({
      actionProof: s.proof,
      sectionId: fixture.section,
      idempotencyKey: s.key,
      correlationId: randomUUID(),
    })));
    assert.deepEqual(retry.map((c) => c.checkInId), checkins.map((c) => c.checkInId));

    const counted = await pool.query<{
      checkins: number; points: number; audits: number; outbox: number;
    }>(`SELECT
          (SELECT count(*)::int FROM checkins WHERE school_id=$1) AS checkins,
          (SELECT coalesce(sum(point_value), 0)::int FROM checkins WHERE school_id=$1) AS points,
          (SELECT count(*)::int FROM audit_events WHERE school_id=$1 AND action='CHECKIN_CREATED') AS audits,
          (SELECT count(*)::int FROM transactional_outbox WHERE school_id=$1 AND event_type='CHECKIN_CREATED') AS outbox`,
    [fixture.school]);
    assert.deepEqual(counted.rows[0], { checkins: 35, points: 35, audits: 35, outbox: 35 });
    // Informational only: GitHub CI latency is NOT an OVH VPS performance benchmark.
    console.log(`T-CI-LOAD-035 verified 35 synthetic concurrent Check-Ins and retries in disposable CI PostgreSQL; first batch ${elapsed} ms (CI runner only).`);
  } finally {
    await db.close();
    await pool.end();
  }
});
