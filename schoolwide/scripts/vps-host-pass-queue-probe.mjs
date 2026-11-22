// One-time synthetic 35-student HTTP Hall Pass concurrency + FIFO promotion probe.
// Only the local grant-server staging service/database. Never student or PIN data.
// This test is intentionally non-repeatable and leaves synthetic audit evidence.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';

const base = 'http://127.0.0.1:18787';
const releaseSha = process.env.EXPECTED_RELEASE_SHA;
if (userInfo().username !== 'grantdesk_stage'
  || process.env.VPS_SYNTHETIC_PASS_LOAD !== 'yes'
  || !/^[a-f0-9]{40}$/.test(releaseSha ?? '')) {
  throw new Error('Refused: use the staging OS user and explicit synthetic-pass-load approval.');
}
const metadataResponse = await fetch(base, { signal: AbortSignal.timeout(5000) });
assert.equal(metadataResponse.status, 200);
const metadata = await metadataResponse.json();
assert.equal(metadata.service, 'grantdesk-schoolwide');
assert.equal(metadata.deploymentTier, 'staging');
assert.equal(metadata.releaseSha, releaseSha);
const ready = await fetch(base + '/health/ready', { signal: AbortSignal.timeout(5000) });
assert.equal(ready.status, 200);
assert.equal((await ready.json()).releaseSha, releaseSha);

const pool = new Pool({
  host: '/var/run/postgresql', port: 55432, database: 'grantdesk_schoolwide_stage',
  user: 'grantdesk_stage', max: 10, connectionTimeoutMillis: 5000,
  application_name: 'grantdesk-schoolwide:one-shot-synthetic-35-pass-http',
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
function detroit(date) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}:00` };
}
const now = new Date();
const start = detroit(new Date(now.getTime() - 10 * 60_000));
const middle = detroit(now);
const end = detroit(new Date(now.getTime() + 40 * 60_000));
assert.equal(start.date, middle.date, 'Refused: testing crosses Detroit midnight.');
assert.equal(middle.date, end.date, 'Refused: testing crosses Detroit midnight.');
if (middle.date < '2026-08-20' || middle.date > '2027-06-15') throw new Error('Refused: outside synthetic school-year fixture.');

const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const ids = {
  org: randomUUID(), school: randomUUID(), year: randomUUID(),
  section: randomUUID(), profile: randomUUID(), period: randomUUID(),
  term: randomUUID(), policy: randomUUID(), destination: randomUUID(),
};
const students = Array.from({ length: 35 }, (_, i) => ({
  id: randomUUID(), enrollment: randomUUID(), credential: randomUUID(),
  proofId: randomUUID(), returnProofId: randomUUID(),
  proof: `synthetic-pass-proof-${suffix}-${i}`,
  returnProof: `synthetic-return-proof-${suffix}-${i}`,
  key: `synthetic-pass-key-${suffix}-${i}`,
}));

function percentile(values, proportion) {
  const sorted = [...values].sort((a, b) => a - b);
  return +(sorted[Math.max(0, Math.ceil(proportion * sorted.length) - 1)] ?? 0).toFixed(1);
}
async function submit(url, key, body, expectedStatus) {
  const started = performance.now();
  const response = await fetch(base + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const ms = performance.now() - started;
  const payload = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`Synthetic request ${url} returned HTTP ${response.status} code=${payload.code ?? 'unknown'}`);
  }
  return { payload, ms };
}

try {
  // Refuse non-empty/non-synthetic staging or already-attempted pass runs.
  const before = await pool.query(`SELECT current_database() AS db,
    (SELECT count(*)::int FROM grantdesk_schema_migrations) AS migrations,
    (SELECT count(*)::int FROM schools) AS schools,
    (SELECT count(*)::int FROM students) AS students,
    (SELECT count(*)::int FROM checkins) AS checkins,
    (SELECT count(*)::int FROM pass_requests) AS requests,
    (SELECT count(*)::int FROM passes) AS passes,
    (SELECT count(*)::int FROM students st JOIN schools sc ON sc.id=st.school_id
      WHERE st.display_name !~ '^Synthetic Student ' OR sc.slug NOT LIKE 'vps-syn-school-%') AS unexpected_students`);
  assert.deepEqual(before.rows[0], {
    db: 'grantdesk_schoolwide_stage', migrations: 19,
    schools: 1, students: 35, checkins: 35, requests: 0, passes: 0,
    unexpected_students: 0,
  }, 'Refused: staging contains unexpected student data, a schema change or a prior pass run.');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('INSERT INTO organizations (id,slug,name) VALUES ($1,$2,$3)',
      [ids.org, `vps-pass-${suffix}`, 'Synthetic Pass Test']);
    await c.query(`INSERT INTO schools (id,organization_id,slug,name,primary_domain,timezone)
      VALUES ($1,$2,$3,'Synthetic Pass Test School',$4,'America/Detroit')`,
      [ids.school, ids.org, `vps-pass-school-${suffix}`, `${suffix}.example.invalid`]);
    await c.query(`INSERT INTO academic_years (id,school_id,label,starts_on,ends_on)
      VALUES ($1,$2,'2026-27',DATE '2026-08-20',DATE '2027-06-15')`, [ids.year, ids.school]);
    await c.query(`INSERT INTO sections
      (id,school_id,academic_year_id,name,code,period_code,period_label)
      VALUES ($1,$2,$3,'Synthetic Concurrent Hall Pass',$4,'P1','1')`,
      [ids.section, ids.school, ids.year, `SP-${suffix}`]);
    await c.query(`INSERT INTO schedule_profiles (id,school_id,name,key,status)
      VALUES ($1,$2,'Synthetic Hall Pass','SYN_PASS','ACTIVE')`, [ids.profile, ids.school]);
    await c.query(`INSERT INTO schedule_periods
      (id,school_id,schedule_profile_id,period_code,starts_at_local,ends_at_local,ordinal_by_time)
      VALUES ($1,$2,$3,'P1',$4::time,$5::time,1)`,
      [ids.period, ids.school, ids.profile, start.time, end.time]);
    await c.query(`INSERT INTO school_calendar_days
      (organization_id,school_id,academic_date,is_school_day,schedule_profile_id,label,source)
      VALUES ($1,$2,$3::date,true,$4,'Synthetic Pass Day','MANUAL')`,
      [ids.org, ids.school, middle.date, ids.profile]);
    await c.query(`INSERT INTO academic_terms
      (id,school_id,academic_year_id,name,ordinal,starts_on,ends_on,type)
      VALUES ($1,$2,$3,'Synthetic MP1',1,DATE '2026-08-20',DATE '2027-06-15','MARKING_PERIOD')`,
      [ids.term, ids.school, ids.year]);
    await c.query(`INSERT INTO destinations
      (id,school_id,name,category,active,student_selectable)
      VALUES ($1,$2,'Synthetic Restroom','RESTROOM',true,true)`, [ids.destination, ids.school]);
    await c.query(`INSERT INTO school_policy_sets
      (id,organization_id,school_id,academic_year_id,name,effective_from,effective_until,active)
      VALUES ($1,$2,$3,$4,'Synthetic Pass Rules',DATE '2026-08-20',DATE '2027-06-15',true)`,
      [ids.policy, ids.org, ids.school, ids.year]);
    const policy = [
      ['MAX_ACTIVE_PER_SECTION',1], ['MARKING_PERIOD_LIMIT',3],
      ['DAILY_LIMIT',0], ['COOLDOWN_MINUTES',0],
      ['PROTECTED_FIRST_MINUTES',5], ['PROTECTED_LAST_MINUTES',5],
      ['QUEUE_MAX_WAIT_MINUTES',20],
    ];
    for (const [name,value] of policy) {
      await c.query(`INSERT INTO policy_values
        (school_id,policy_set_id,policy_key,typed_value_json,teacher_override_allowed)
        VALUES ($1,$2,$3,$4::jsonb,false)`,[ids.school,ids.policy,name,JSON.stringify(value)]);
    }
    const issued = new Date(now.getTime() - 30_000).toISOString();
    const expires = new Date(now.getTime() + 20 * 60_000).toISOString();
    for (let i = 0; i < students.length; i += 1) {
      const s = students[i];
      await c.query('INSERT INTO students (id,school_id,local_student_number,display_name) VALUES ($1,$2,$3,$4)',
        [s.id, ids.school, `SYN-PASS-${suffix}-${i}`, `Synthetic Pass Student ${i+1}`]);
      await c.query(`INSERT INTO enrollments (id,school_id,section_id,student_id,source)
        VALUES ($1,$2,$3,$4,'MANUAL')`,[s.enrollment,ids.school,ids.section,s.id]);
      await c.query(`INSERT INTO student_credentials
        (id,school_id,student_id,verifier_scheme,secret_hash,secret_salt,verifier_params,credential_version,status)
        VALUES ($1,$2,$3,'SCRYPT_PEPPER_V1',$4,'synthetic-salt-0001','{}'::jsonb,1,'ACTIVE')`,
        [s.credential,ids.school,s.id,'a'.repeat(64)]);
      for(const [proofId,action,proof] of [
        [s.proofId,'PASS_REQUEST',s.proof],
        [s.returnProofId,'RETURN',s.returnProof],
      ]) {
        await c.query(`INSERT INTO action_proofs
          (id,school_id,student_id,action_type,context_section_id,credential_id,credential_version,
           token_hash,issued_at,expires_at,request_id)
          VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8::timestamptz,$9::timestamptz,$10)`,
          [proofId,ids.school,s.id,action,ids.section,s.credential,hash(proof),issued,expires,randomUUID()]);
      }
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally { c.release(); }

  const initial = await Promise.all(students.map(s =>
    submit('/api/v1/passes/requests',s.key,{
      actionProof:s.proof,sectionId:ids.section,destinationId:ids.destination,
    },201)));
  const started = initial.filter(x => x.payload.outcome === 'STARTED');
  const queued = initial.filter(x => x.payload.outcome === 'QUEUED');
  assert.equal(started.length,1,'Section capacity 1 violated.');
  assert.equal(queued.length,34,'Expected 34 queued passes.');
  assert.equal(new Set(initial.map(x => x.payload.passRequestId)).size,35);

  const repeat = await Promise.all(students.map(s =>
    submit('/api/v1/passes/requests',s.key,{
      actionProof:s.proof,sectionId:ids.section,destinationId:ids.destination,
    },201)));
  assert.deepEqual(repeat.map(x=>x.payload.passRequestId),initial.map(x=>x.payload.passRequestId),
    'Retry must not create another pass request.');

  const beforeReturn = await pool.query(`SELECT
    (SELECT count(*)::int FROM pass_requests WHERE school_id=$1) AS requests,
    (SELECT count(*)::int FROM passes WHERE school_id=$1 AND status='OUT') AS active,
    (SELECT count(*)::int FROM queue_entries WHERE school_id=$1 AND status='WAITING') AS waiting`,[ids.school]);
  assert.deepEqual(beforeReturn.rows[0],{requests:35,active:1,waiting:34});

  const firstQueue = await pool.query(`SELECT pass_request_id FROM queue_entries
    WHERE school_id=$1 AND status='WAITING' ORDER BY order_token LIMIT 1`,[ids.school]);
  const firstWaitingId=firstQueue.rows[0].pass_request_id;
  const firstActiveStudentId=started[0].payload.studentId;
  const activeStudent=students.find(s=>s.id===firstActiveStudentId);
  assert.ok(activeStudent);
  // Make the active pass countable and allow a deterministic FIFO promotion.
  await new Promise(resolve => setTimeout(resolve,3200));
  const back=await submit('/api/v1/student/passes/active/return',
    `return-pass-${suffix}`,{actionProof:activeStudent.returnProof},200);
  assert.equal(back.payload.status,'RETURNED');
  assert.equal(back.payload.promotedRequestId,firstWaitingId,
    'The oldest waiting request must be promoted first.');
  assert.equal(back.payload.counted,true,'Return after 3.2 sec should be countable.');

  const after=await pool.query(`SELECT
    (SELECT count(*)::int FROM pass_requests WHERE school_id=$1) AS requests,
    (SELECT count(*)::int FROM passes WHERE school_id=$1 AND status='OUT') AS active,
    (SELECT count(*)::int FROM passes WHERE school_id=$1 AND status='RETURNED') AS returned,
    (SELECT count(*)::int FROM queue_entries WHERE school_id=$1 AND status='WAITING') AS waiting,
    (SELECT count(*)::int FROM queue_entries WHERE school_id=$1 AND status='STARTED') AS promoted,
    (SELECT count(*)::int FROM audit_events WHERE school_id=$1
       AND action IN ('PASS_STARTED','PASS_QUEUED','PASS_RETURNED','PASS_QUEUE_PROMOTED')) AS audits,
    (SELECT count(*)::int FROM transactional_outbox WHERE school_id=$1
       AND event_type IN ('PASS_STARTED','PASS_QUEUED','PASS_RETURNED','PASS_QUEUE_PROMOTED')) AS outbox`,[ids.school]);
  assert.deepEqual(after.rows[0],
    {requests:35,active:1,returned:1,waiting:33,promoted:1,audits:37,outbox:37});
  const latency=initial.map(x=>x.ms);
  console.log(JSON.stringify({
    stage:'vps-local-synthetic-http-hall-pass',result:'PASS',
    concurrentRequests:35,started:1,queued:34,idempotentRetries:35,
    returned:1,firstInFirstOutPromotion:1,remainingWaiting:33,
    audits:37,outbox:37,
    p50_ms:percentile(latency,.5),
    p95_ms:percentile(latency,.95),
    p99_ms:percentile(latency,.99),
    note:'VPS localhost synthetic requests and proof tokens only. No actual PIN, Chromebook, Wi-Fi or production data.',
  }));
} finally {
  await pool.end();
}
