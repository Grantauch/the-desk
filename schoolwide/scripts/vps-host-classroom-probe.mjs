// One-shot 35-student HTTP Check-In probe against LOCAL, synthetic-only VPS staging.
// Never use real student identifiers, real PINs, another database, or a public URL.
// Leaves synthetic, auditable records intentionally; will refuse any subsequent run.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const { Pool } = pg;
const base = 'http://127.0.0.1:18787';
const expectedSha = process.env.EXPECTED_RELEASE_SHA;
if (
  userInfo().username !== 'grantdesk_stage'
  || process.env.VPS_SYNTHETIC_LOAD !== 'yes'
  || !/^[a-f0-9]{40}$/.test(expectedSha ?? '')
) {
  throw new Error('Refused: this synthetic test requires the staging OS identity and an exact approved release SHA.');
}

const address = new URL(base);
assert.equal(address.hostname, '127.0.0.1');
assert.equal(address.port, '18787');

const health = await fetch(new URL('/health/ready', base), { signal: AbortSignal.timeout(5000) });
assert.equal(health.status, 200, 'The private staging database is not ready.');
const status = await health.json();
assert.equal(status.service, 'grantdesk-schoolwide');
assert.equal(status.deploymentTier, 'staging');
assert.equal(status.releaseSha, expectedSha);
const meta = await fetch(new URL('/', base), { signal: AbortSignal.timeout(5000) });
assert.equal(meta.status, 200);
assert.equal((await meta.json()).releaseSha, expectedSha);

function easternParts(date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
  );
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}:00` };
}

const now = new Date();
const start = easternParts(new Date(now.getTime() - 60_000));
const middle = easternParts(now);
const end = easternParts(new Date(now.getTime() + 45 * 60_000));
if (start.date !== middle.date || middle.date !== end.date) {
  throw new Error('Refused: the 46-minute synthetic schedule would cross midnight in Detroit.');
}

const pool = new Pool({
  host: '/var/run/postgresql',
  port: 55432,
  user: 'grantdesk_stage',
  database: 'grantdesk_schoolwide_stage',
  max: 6,
  connectionTimeoutMillis: 5000,
  application_name: 'grantdesk-schoolwide:localhost-synthetic-http-probe',
});
function hash(token) { return createHash('sha256').update(token).digest('hex'); }
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const ids = {
  org: randomUUID(), school: randomUUID(), year: randomUUID(), section: randomUUID(),
  profile: randomUUID(), period: randomUUID(), policy: randomUUID(),
};
const students = Array.from({ length: 35 }, (_, i) => ({
  id: randomUUID(), enrollment: randomUUID(), credential: randomUUID(), action: randomUUID(),
  proof: `one-time-synthetic-vps-proof-${suffix}-${i}`, key: `vps-35-${suffix}-${i}`,
}));

try {
  // Explicit no-real-data invariant. Any previous students, even synthetic,
  // prevent another run without a newly reviewed disposable database.
  const existing = await pool.query(`SELECT
    current_database() AS db,
    (SELECT count(*)::int FROM students) AS students,
    (SELECT count(*)::int FROM checkins) AS checkins,
    (SELECT count(*)::int FROM passes) AS passes,
    (SELECT count(*)::int FROM grantdesk_schema_migrations) AS migrations`);
  assert.deepEqual(existing.rows[0], {
    db: 'grantdesk_schoolwide_stage', students: 0, checkins: 0, passes: 0, migrations: 19,
  }, 'Refused: staging contains students or an unexpected schema.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO organizations (id,slug,name) VALUES ($1,$2,$3)',
      [ids.org, `vps-syn-${suffix}`, 'VPS Synthetic Classroom']);
    await client.query(`INSERT INTO schools
      (id,organization_id,slug,name,primary_domain,timezone)
      VALUES ($1,$2,$3,'VPS Synthetic School',$4,'America/Detroit')`,
      [ids.school, ids.org, `vps-syn-school-${suffix}`, `${suffix}.example.invalid`]);
    await client.query(`INSERT INTO academic_years (id,school_id,label,starts_on,ends_on)
      VALUES ($1,$2,'2026-27',DATE '2026-08-20',DATE '2027-06-15')`, [ids.year, ids.school]);
    await client.query(`INSERT INTO sections
      (id,school_id,academic_year_id,name,code,period_code,period_label)
      VALUES ($1,$2,$3,'VPS Synthetic Class',$4,'P1','1')`, [ids.section, ids.school, ids.year, `VPS-${suffix}`]);
    await client.query(`INSERT INTO schedule_profiles (id,school_id,name,key,status)
      VALUES ($1,$2,'Synthetic Schedule','SYNTHETIC','ACTIVE')`, [ids.profile, ids.school]);
    await client.query(`INSERT INTO schedule_periods
      (id,school_id,schedule_profile_id,period_code,starts_at_local,ends_at_local,ordinal_by_time)
      VALUES ($1,$2,$3,'P1',$4::time,$5::time,1)`,
      [ids.period, ids.school, ids.profile, start.time, end.time]);
    await client.query(`INSERT INTO school_calendar_days
      (organization_id,school_id,academic_date,is_school_day,schedule_profile_id,label,source)
      VALUES ($1,$2,$3::date,true,$4,'Synthetic Load Day','MANUAL')`,
      [ids.org, ids.school, middle.date, ids.profile]);
    await client.query(`INSERT INTO school_policy_sets
      (id,organization_id,school_id,academic_year_id,name,effective_from,effective_until,active)
      VALUES ($1,$2,$3,$4,'Synthetic Check-In Policy',DATE '2026-09-01',DATE '2027-06-15',true)`,
      [ids.policy, ids.org, ids.school, ids.year]);
    await client.query(`INSERT INTO policy_values
      (school_id,policy_set_id,policy_key,typed_value_json,teacher_override_allowed)
      VALUES ($1,$2,'CHECKIN_WINDOW_MINUTES','5'::jsonb,false)`, [ids.school, ids.policy]);

    const issued = new Date(now.getTime() - 30_000).toISOString();
    const expiry = new Date(now.getTime() + 15 * 60_000).toISOString();
    for (let i = 0; i < students.length; i += 1) {
      const s = students[i];
      await client.query('INSERT INTO students (id,school_id,local_student_number,display_name) VALUES ($1,$2,$3,$4)',
        [s.id, ids.school, `SYN-VPS-${suffix}-${i}`, `Synthetic Student ${i + 1}`]);
      await client.query(`INSERT INTO enrollments (id,school_id,section_id,student_id,source)
        VALUES ($1,$2,$3,$4,'MANUAL')`, [s.enrollment, ids.school, ids.section, s.id]);
      await client.query(`INSERT INTO student_credentials
        (id,school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params,credential_version,status)
        VALUES ($1,$2,$3,'SCRYPT_PEPPER_V1',$4,'synthetic-salt-0001','{}'::jsonb,1,'ACTIVE')`,
        [s.credential, ids.school, s.id, 'a'.repeat(64)]);
      await client.query(`INSERT INTO action_proofs
        (id,school_id,student_id,action_type,context_section_id,credential_id,credential_version,
         token_hash,issued_at,expires_at,request_id)
        VALUES ($1,$2,$3,'CHECKIN',$4,$5,1,$6,$7::timestamptz,$8::timestamptz,$9)`,
        [s.action, ids.school, s.id, ids.section, s.credential, hash(s.proof), issued, expiry, randomUUID()]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }

  const durations = [];
  async function submit(s, retry = false) {
    const started = performance.now();
    const result = await fetch(new URL('/api/v1/checkins', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': s.key },
      body: JSON.stringify({ actionProof: s.proof, sectionId: ids.section }),
      signal: AbortSignal.timeout(15_000),
    });
    durations.push(performance.now() - started);
    const payload = await result.json();
    if (result.status !== 201) {
      throw new Error(`Synthetic ${retry ? 'retry' : 'first'} Check-In returned HTTP ${result.status}, code ${payload.code ?? 'unknown'}`);
    }
    return payload;
  }

  const first = await Promise.all(students.map(s => submit(s)));
  assert.equal(new Set(first.map(v => v.checkInId)).size, 35);
  first.forEach((record, i) => {
    assert.equal(record.studentId, students[i].id);
    assert.equal(record.pointValue, 1);
    assert.equal(record.created, true);
  });
  const repeat = await Promise.all(students.map(s => submit(s, true)));
  assert.deepEqual(repeat.map(v => v.checkInId), first.map(v => v.checkInId));

  const counted = await pool.query(`SELECT
    (SELECT count(*)::int FROM checkins WHERE school_id=$1) AS checkins,
    (SELECT coalesce(sum(point_value),0)::int FROM checkins WHERE school_id=$1) AS points,
    (SELECT count(*)::int FROM audit_events WHERE school_id=$1 AND action='CHECKIN_CREATED') AS audits,
    (SELECT count(*)::int FROM transactional_outbox WHERE school_id=$1 AND event_type='CHECKIN_CREATED') AS outbox`,
  [ids.school]);
  assert.deepEqual(counted.rows[0], { checkins: 35, points: 35, audits: 35, outbox: 35 });
  const samples = durations.slice(0, 35).sort((a, b) => a - b);
  const percentile = n => +samples[Math.ceil(n * samples.length) - 1].toFixed(1);
  console.log(JSON.stringify({
    stage: 'vps-local-synthetic-http-checkin', result: 'PASS', students: 35,
    checkins: 35, points: 35, idempotentRetries: 35, audits: 35, outbox: 35,
    p50_ms: percentile(0.50), p95_ms: percentile(0.95), p99_ms: percentile(0.99),
    note: 'Synthetic HTTP requests; not real PIN authentication, school Wi-Fi, or device testing.',
  }));
} finally {
  await pool.end();
}
