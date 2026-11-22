// One-time HTTP end-to-end PIN + Check-In acceptance with fictional identities.
// This script NEVER enables authentication on the normal staging server.
// It starts a temporary Fastify listener on a randomly assigned loopback port,
// uses only synthetic student records and a deliberately nonproduction pepper,
// and refuses any unexpected stage DB contents.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { performance } from 'node:perf_hooks';
import { buildApp } from '../dist/app.js';
import { PostgresDatabase } from '../dist/db/database.js';
import { StudentCredentialService } from '../dist/student-credentials/service.js';
import { StudentCredentialError } from '../dist/student-credentials/types.js';

const releaseSha = process.env.EXPECTED_RELEASE_SHA;
assert.equal(userInfo().username, 'grantdesk_stage', 'Refused: wrong operating-system identity');
assert.equal(process.env.VPS_SYNTHETIC_PIN_HTTP, 'yes', 'Refused: explicit synthetic PIN approval absent');
assert.match(releaseSha ?? '', /^[a-f0-9]{40}$/, 'Refused: expected release SHA is missing');

const privateBase = 'http://127.0.0.1:18787';
const existingHealth = await fetch(privateBase + '/health/ready', { signal: AbortSignal.timeout(5000) });
assert.equal(existingHealth.status, 200);
const current = await existingHealth.json();
assert.equal(current.releaseSha, releaseSha);
assert.equal(current.deploymentTier, 'staging');

const config = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  databaseUrl: 'postgresql://grantdesk_stage@localhost:55432/grantdesk_schoolwide_stage',
  databaseSocketPath: '/var/run/postgresql',
  dbPoolMax: 6,
  instanceId: 'one-time-synthetic-pin-http',
  deploymentTier: 'staging',
  stagingPlatform: 'vps-host',
  releaseSha,
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
  operationsWorkersEnabled: false,
};
const db = new PostgresDatabase(config);
const pepper = 'test-only-pin-pepper-DO-NOT-USE-FOR-ANY-REAL-STUDENT-2026';
const credentialsOptions = {
  pepper,
  legacyPinSalt: 'test-only-legacy-salt-not-real',
  proofTtlMs: 180000,
  maxFailures: 4,
  attemptWindowMs: 60000,
  throttleBlockMs: 60000,
};
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const ids = {
  org: randomUUID(), school: randomUUID(), year: randomUUID(),
  section: randomUUID(), period: randomUUID(), profile: randomUUID(), policy: randomUUID(),
};
const students = [
  { id: randomUUID(), enrollment: randomUUID(), assertion: `SYNTHETIC-${suffix}-FIVE`, pin: '01234', label: 'five-digit' },
  { id: randomUUID(), enrollment: randomUUID(), assertion: `SYNTHETIC-${suffix}-SIX`, pin: '001234', label: 'six-digit' },
];
const byAssertion = new Map(students.map(s => [s.assertion, s.id]));
const identityProvider = {
  async verify(assertion) {
    const studentId = byAssertion.get(assertion);
    if (!studentId) throw new StudentCredentialError('STUDENT_AUTH_REQUIRED', 'Synthetic identity rejected.', 401);
    return { provider: 'SYNTHETIC', subject: assertion, studentId };
  },
};

function detroit(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:00` };
}
const now = new Date();
const start = detroit(new Date(now.getTime() - 60000));
const mid = detroit(now);
const end = detroit(new Date(now.getTime() + 45 * 60000));
assert.equal(start.date, mid.date, 'Refused: schedule crosses Detroit midnight');
assert.equal(mid.date, end.date, 'Refused: schedule crosses Detroit midnight');
assert.ok(mid.date >= '2026-08-20' && mid.date <= '2027-06-15');

let app;
try {
  // Do NOT run if any school is no longer a synthetic test school or if the
  // migration count differs from the verified isolated Schoolwide stage.
  const state = (await db.query(`SELECT
    current_database() AS db,
    (SELECT count(*)::int FROM grantdesk_schema_migrations) AS migrations,
    (SELECT count(*)::int FROM schools) AS schools,
    (SELECT count(*)::int FROM students) AS students,
    (SELECT count(*)::int FROM checkins) AS checkins,
    (SELECT count(*)::int FROM pass_requests) AS pass_requests,
    (SELECT count(*)::int FROM passes) AS passes,
    (SELECT count(*)::int FROM schools WHERE slug NOT LIKE 'vps-syn-school-%'
      AND slug NOT LIKE 'vps-pass-school-%') AS unexpected_schools`))[0];
  assert.deepEqual(state, {
    db: 'grantdesk_schoolwide_stage', migrations: 19,
    schools: 2, students: 70, checkins: 35, pass_requests: 35,
    passes: 2, unexpected_schools: 0,
  }, 'Refused: staging fixture differs from documented synthetic-only state');

  await db.transaction(async tx => {
    await tx.query('INSERT INTO organizations (id,slug,name) VALUES ($1,$2,$3)',
      [ids.org, `vps-pin-${suffix}`, 'Synthetic PIN HTTP Acceptance']);
    await tx.query(`INSERT INTO schools (id,organization_id,slug,name,primary_domain,timezone)
      VALUES ($1,$2,$3,'Synthetic PIN School',$4,'America/Detroit')`,
      [ids.school, ids.org, `vps-pin-school-${suffix}`, `${suffix}.example.invalid`]);
    await tx.query(`INSERT INTO academic_years (id,school_id,label,starts_on,ends_on)
      VALUES ($1,$2,'2026-27',DATE '2026-08-20',DATE '2027-06-15')`, [ids.year, ids.school]);
    await tx.query(`INSERT INTO sections
      (id,school_id,academic_year_id,name,code,period_code,period_label)
      VALUES ($1,$2,$3,'Synthetic PIN Test Section',$4,'P1','1')`,
      [ids.section, ids.school, ids.year, `PIN-${suffix}`]);
    await tx.query(`INSERT INTO schedule_profiles (id,school_id,name,key,status)
      VALUES ($1,$2,'Synthetic PIN Schedule','SYNTHETIC_PIN','ACTIVE')`, [ids.profile, ids.school]);
    await tx.query(`INSERT INTO schedule_periods
      (id,school_id,schedule_profile_id,period_code,starts_at_local,ends_at_local,ordinal_by_time)
      VALUES ($1,$2,$3,'P1',$4::time,$5::time,1)`,
      [ids.period, ids.school, ids.profile, start.time, end.time]);
    await tx.query(`INSERT INTO school_calendar_days
      (organization_id,school_id,academic_date,is_school_day,schedule_profile_id,label,source)
      VALUES ($1,$2,$3::date,true,$4,'Synthetic Test Day','MANUAL')`,
      [ids.org, ids.school, mid.date, ids.profile]);
    await tx.query(`INSERT INTO school_policy_sets
      (id,organization_id,school_id,academic_year_id,name,effective_from,effective_until,active)
      VALUES ($1,$2,$3,$4,'Synthetic PIN Check-In Policy',DATE '2026-08-20',DATE '2027-06-15',true)`,
      [ids.policy, ids.org, ids.school, ids.year]);
    await tx.query(`INSERT INTO policy_values
      (school_id,policy_set_id,policy_key,typed_value_json,teacher_override_allowed)
      VALUES ($1,$2,'CHECKIN_WINDOW_MINUTES','5'::jsonb,false)`, [ids.school, ids.policy]);
    for (const s of students) {
      await tx.query(`INSERT INTO students (id,school_id,local_student_number,display_name)
        VALUES ($1,$2,$3,$4)`, [s.id, ids.school, `SYN-PIN-${suffix}-${s.label}`, `Synthetic ${s.label} PIN Test`]);
      await tx.query(`INSERT INTO enrollments (id,school_id,section_id,student_id,source)
        VALUES ($1,$2,$3,$4,'MANUAL')`, [s.enrollment, ids.school, ids.section, s.id]);
    }
  });
  const credentialService = new StudentCredentialService(db, identityProvider, credentialsOptions);
  for (const s of students) await credentialService.provisionPin(s.id, s.pin);

  // This listener has NO public route and shuts down before the script exits.
  app = buildApp({ config, database: db, studentIdentityProvider: identityProvider,
    studentCredentialOptions: credentialsOptions });
  const base = await app.listen({ host: '127.0.0.1', port: 0 });

  async function call(path, assertion, payload, extraHeaders = {}) {
    const started = performance.now();
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-student-identity-assertion': assertion, ...extraHeaders },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    return { status: res.status, body: await res.json(), elapsed: Math.round(performance.now() - started) };
  }
  const pinMs = [];
  for (const s of students) {
    const good = await call('/api/v1/student/actions/authorize', s.assertion,
      { pin: s.pin, action: 'CHECKIN', sectionId: ids.section });
    assert.equal(good.status, 201);
    assert.equal(good.body.action, 'CHECKIN');
    assert.ok(good.body.actionProof?.length >= 40);
    pinMs.push(good.elapsed);
    const first = await call('/api/v1/checkins', s.assertion,
      { actionProof: good.body.actionProof, sectionId: ids.section },
      { 'idempotency-key': `test-checkin-${suffix}-${s.label}` });
    assert.equal(first.status, 201);
    assert.equal(first.body.studentId, s.id);
    assert.equal(first.body.pointValue, 1);

    const wrong = await call('/api/v1/student/actions/authorize', s.assertion,
      { pin: s.label === 'five-digit' ? '001234' : '01234', action: 'CHECKIN', sectionId: ids.section });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.code, 'PIN_INVALID');
    assert.ok(!JSON.stringify(wrong.body).includes(s.pin), 'PIN leaked in error response');
  }
  const fakeIdentity = await call('/api/v1/student/actions/authorize', 'SYNTHETIC-NOT-ENROLLED',
    { pin: '01234', action: 'CHECKIN', sectionId: ids.section });
  assert.equal(fakeIdentity.status, 401);
  assert.equal(fakeIdentity.body.code, 'STUDENT_AUTH_REQUIRED');
  const missingIdentity = await call('/api/v1/student/actions/authorize', '',
    { pin: '01234', action: 'CHECKIN', sectionId: ids.section });
  assert.equal(missingIdentity.status, 401);
  const numericPin = await call('/api/v1/student/actions/authorize', students[0].assertion,
    { pin: 12345, action: 'CHECKIN', sectionId: ids.section });
  assert.equal(numericPin.status, 400);
  assert.equal(numericPin.body.code, 'ACTION_AUTHORIZATION_INVALID');

  const counts = (await db.query(`SELECT
    (SELECT count(*)::int FROM students WHERE school_id=$1) AS students,
    (SELECT count(*)::int FROM checkins WHERE school_id=$1) AS checkins,
    (SELECT count(*)::int FROM audit_events WHERE school_id=$1 AND action='CHECKIN_CREATED') AS audits,
    (SELECT count(*)::int FROM transactional_outbox WHERE school_id=$1 AND event_type='CHECKIN_CREATED') AS outbox,
    (SELECT count(*)::int FROM passes WHERE school_id=$1) AS passes`, [ids.school]))[0];
  assert.deepEqual(counts, { students:2, checkins:2, audits:2, outbox:2, passes:0 });
  console.log(JSON.stringify({
    stage: 'vps-local-ephemeral-synthetic-pin-http',
    result: 'PASS', exactFiveDigit: true, exactSixDigitLeadingZero: true,
    wrongLengthVariantDenied: true, unknownAndMissingIdentityDenied: true,
    numericCoercionDenied: true, checkins:2, audits:2, outbox:2,
    authorizationMs: pinMs, listener:'ephemeral-loopback-only',
    note:'Fictional credentials and identity provider only. Does not validate real lunch PINs, Google identity, kiosk or public staging authentication.',
  }));
} finally {
  if (app) await app.close();
  else await db.close();
}
