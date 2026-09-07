import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import type { StaffIdentityProvider, VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import { seedTwoSchoolFixture, type TwoSchoolFixture } from '../db/test-fixtures.js';
import { SchedulePolicyService } from './service.js';

const databaseUrl = process.env.DATABASE_URL;

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 8787,
  logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide',
  dbPoolMax: 2,
  instanceId: 'schedule-policy-test',
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
};

class ClientDatabase implements Database {
  readonly #client: PoolClient;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.#client.query<T>(sql, [...parameters]);
    return result.rows;
  }

  async close(): Promise<void> {
    // Transaction fixture owns the client lifecycle.
  }
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  readonly #identities: Readonly<Record<string, VerifiedStaffIdentity>> = {
    'teacher-a': { provider: 'SYNTHETIC', subject: 'google-teacher-alpha' },
    'teacher-b': { provider: 'SYNTHETIC', subject: 'google-teacher-beta' },
  };

  async verify(assertion: string): Promise<VerifiedStaffIdentity> {
    const identity = this.#identities[assertion];
    if (!identity) throw new Error('Synthetic identity rejected.');
    return identity;
  }
}

const ids = {
  normalProfile: '00000000-0000-0000-0000-000000000601',
  reducedProfile: '00000000-0000-0000-0000-000000000602',
  halfProfile: '00000000-0000-0000-0000-000000000603',
  specialProfile: '00000000-0000-0000-0000-000000000604',
  inactiveProfile: '00000000-0000-0000-0000-000000000605',
  normalP1: '00000000-0000-0000-0000-000000000611',
  normalP2: '00000000-0000-0000-0000-000000000612',
  reducedP4: '00000000-0000-0000-0000-000000000613',
  reducedP1: '00000000-0000-0000-0000-000000000614',
  halfP1: '00000000-0000-0000-0000-000000000615',
  specialX: '00000000-0000-0000-0000-000000000616',
  policySet: '00000000-0000-0000-0000-000000000701',
  maxActiveValue: '00000000-0000-0000-0000-000000000711',
  dailyValue: '00000000-0000-0000-0000-000000000712',
  cooldownValue: '00000000-0000-0000-0000-000000000713',
  firstProtectedValue: '00000000-0000-0000-0000-000000000714',
  lastProtectedValue: '00000000-0000-0000-0000-000000000715',
  allowedOverride: '00000000-0000-0000-0000-000000000721',
  disallowedOverride: '00000000-0000-0000-0000-000000000722',
  schoolAccess: '00000000-0000-0000-0000-000000000731',
  sectionAccess: '00000000-0000-0000-0000-000000000732',
} as const;

type Fixture = TwoSchoolFixture;

type FixtureContext = {
  client: PoolClient;
  database: ClientDatabase;
  service: SchedulePolicyService;
  base: Fixture;
};

async function seedSchedulePolicyFixture(client: PoolClient): Promise<Fixture> {
  const base = await seedTwoSchoolFixture(client);

  await client.query(
    `INSERT INTO enrollments (school_id, section_id, student_id, source)
     VALUES ($1, $2, $3, 'MANUAL')`,
    [base.schoolA, base.sectionA1, base.studentA],
  );

  await client.query(
    `INSERT INTO schedule_profiles (id, school_id, name, key, status)
     VALUES
       ($1, $6, 'Normal Day', 'NORMAL', 'ACTIVE'),
       ($2, $6, 'Reduced Day', 'REDUCED', 'ACTIVE'),
       ($3, $6, 'Half Day', 'HALF', 'ACTIVE'),
       ($4, $6, 'Special Day', 'SPECIAL', 'ACTIVE'),
       ($5, $6, 'Retired Schedule', 'RETIRED', 'INACTIVE')`,
    [ids.normalProfile, ids.reducedProfile, ids.halfProfile, ids.specialProfile, ids.inactiveProfile, base.schoolA],
  );

  await client.query(
    `INSERT INTO schedule_periods
       (id, school_id, schedule_profile_id, period_code, starts_at_local, ends_at_local, ordinal_by_time)
     VALUES
       ($1, $8, $7, 'P1', TIME '08:00:00', TIME '08:50:00', 1),
       ($2, $8, $7, 'P2', TIME '08:55:00', TIME '09:45:00', 2),
       ($3, $8, $6, 'P4', TIME '08:00:00', TIME '08:40:00', 1),
       ($4, $8, $6, 'P1', TIME '09:00:00', TIME '09:35:00', 2),
       ($5, $8, $9, 'P1', TIME '08:00:00', TIME '08:30:00', 1),
       ($10, $8, $11, 'X', TIME '08:00:00', TIME '08:45:00', 1)`,
    [
      ids.normalP1,
      ids.normalP2,
      ids.reducedP4,
      ids.reducedP1,
      ids.halfP1,
      ids.reducedProfile,
      ids.normalProfile,
      base.schoolA,
      ids.halfProfile,
      ids.specialX,
      ids.specialProfile,
    ],
  );

  await client.query(
    `INSERT INTO school_calendar_days
       (school_id, academic_date, is_school_day, schedule_profile_id, label, source, source_revision)
     VALUES
       ($1, DATE '2026-09-08', true, $2, 'Normal Tuesday', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-09-09', true, $3, 'Reduced Wednesday', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-09-10', true, $4, 'Half Thursday', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-09-11', false, NULL, 'No School Friday', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-09-14', true, $5, 'Special Monday', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-09-15', true, NULL, 'Schedule Missing', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-09-16', true, $6, 'Inactive Schedule', 'MANUAL', 'fixture-1'),
       ($1, DATE '2026-11-02', true, $2, 'DST Standard Time', 'MANUAL', 'fixture-1')`,
    [base.schoolA, ids.normalProfile, ids.reducedProfile, ids.halfProfile, ids.specialProfile, ids.inactiveProfile],
  );

  await client.query(
    `INSERT INTO school_policy_sets
       (id, school_id, academic_year_id, name, effective_from, effective_until, active)
     VALUES ($1, $2, $3, '2026-27 Baseline', DATE '2026-09-01', DATE '2027-06-15', true)`,
    [ids.policySet, base.schoolA, base.yearA],
  );

  await client.query(
    `INSERT INTO policy_values
       (id, school_id, policy_set_id, policy_key, typed_value_json, teacher_override_allowed)
     VALUES
       ($1, $6, $7, 'MAX_ACTIVE_PER_SECTION', '2'::jsonb, true),
       ($2, $6, $7, 'DAILY_LIMIT', '1'::jsonb, false),
       ($3, $6, $7, 'COOLDOWN_MINUTES', '5'::jsonb, false),
       ($4, $6, $7, 'PROTECTED_FIRST_MINUTES', '5'::jsonb, false),
       ($5, $6, $7, 'PROTECTED_LAST_MINUTES', '5'::jsonb, false)`,
    [
      ids.maxActiveValue,
      ids.dailyValue,
      ids.cooldownValue,
      ids.firstProtectedValue,
      ids.lastProtectedValue,
      base.schoolA,
      ids.policySet,
    ],
  );

  await client.query(
    `INSERT INTO section_policy_overrides
       (id, school_id, section_id, policy_key, typed_value_json, valid_from, valid_until, reason)
     VALUES
       ($1, $3, $4, 'MAX_ACTIVE_PER_SECTION', '3'::jsonb, TIMESTAMPTZ '2026-09-01T00:00:00Z', NULL, 'Synthetic allowed override'),
       ($2, $3, $4, 'DAILY_LIMIT', '99'::jsonb, TIMESTAMPTZ '2026-09-01T00:00:00Z', NULL, 'Synthetic disallowed override')`,
    [ids.allowedOverride, ids.disallowedOverride, base.schoolA, base.sectionA1],
  );

  await client.query(
    `INSERT INTO student_access_rules
       (id, school_id, student_id, section_id, access_mode, reason_private, valid_from, status)
     VALUES
       ($1, $3, $4, NULL, 'STANDARD', 'private school reason', TIMESTAMPTZ '2026-09-01T00:00:00Z', 'ACTIVE'),
       ($2, $3, $4, $5, 'UNLIMITED', 'private section reason', TIMESTAMPTZ '2026-09-01T00:00:00Z', 'ACTIVE')`,
    [ids.schoolAccess, ids.sectionAccess, base.schoolA, base.studentA, base.sectionA1],
  );

  return base;
}

async function withFixture(pool: Pool, fn: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const base = await seedSchedulePolicyFixture(client);
    const database = new ClientDatabase(client);
    await fn({ client, database, service: new SchedulePolicyService(database), base });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

function localDetroitIso(date: string, localHour: number, minute = 0): string {
  // All fixture dates in September are EDT (UTC-04:00).
  return `${date}T${String(localHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`;
}

async function signIn(app: ReturnType<typeof buildApp>, assertion: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/session',
    payload: { assertion },
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json() as { token?: string };
  assert.ok(body.token);
  return body.token;
}

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

test('SW-040 schedule and policy services', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 4,
    application_name: 'grantdesk-schoolwide:schedule-policy-test',
  });

  try {
    await t.test('NORMAL day resolves the section period with explicit calendar provenance', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const result = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-08', 8, 20)));
        assert.equal(result.status, 'IN_SESSION');
        if (result.status !== 'IN_SESSION') return;
        assert.equal(result.calendar.scheduleProfileKey, 'NORMAL');
        assert.equal(result.period.periodCode, 'P1');
        assert.equal(result.period.ordinalByTime, 1);
        assert.equal(result.clock.academicDate, '2026-09-08');
        assert.equal(result.calendar.sourceRevision, 'fixture-1');
      });
    });

    await t.test('REDUCED day uses the selected profile and ordinal_by_time rather than period-code order', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const early = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-09', 8, 20)));
        assert.equal(early.status, 'NO_ACTIVE_SESSION');
        if (early.status === 'NO_ACTIVE_SESSION') assert.equal(early.reason, 'OUTSIDE_SECTION_PERIOD');

        const result = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-09', 9, 10)));
        assert.equal(result.status, 'IN_SESSION');
        if (result.status !== 'IN_SESSION') return;
        assert.equal(result.calendar.scheduleProfileKey, 'REDUCED');
        assert.equal(result.period.periodCode, 'P1');
        assert.equal(result.period.ordinalByTime, 2);
        assert.equal(result.period.startsAtLocal, '09:00:00');
      });
    });

    await t.test('HALF day resolves its shorter explicit period', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const result = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-10', 8, 20)));
        assert.equal(result.status, 'IN_SESSION');
        if (result.status !== 'IN_SESSION') return;
        assert.equal(result.calendar.scheduleProfileKey, 'HALF');
        assert.equal(result.period.endsAtLocal, '08:30:00');
      });
    });

    await t.test('explicit no-school day overrides weekday assumptions', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const result = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-11', 8, 20)));
        assert.equal(result.status, 'NO_ACTIVE_SESSION');
        if (result.status === 'NO_ACTIVE_SESSION') {
          assert.equal(result.reason, 'NO_SCHOOL');
          assert.equal(result.calendar?.label, 'No School Friday');
        }
      });
    });

    await t.test('school day with missing, inactive, or unmatched schedule fails closed', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const special = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-14', 8, 20)));
        assert.equal(special.status, 'NO_ACTIVE_SESSION');
        if (special.status === 'NO_ACTIVE_SESSION') assert.equal(special.reason, 'SECTION_PERIOD_NOT_IN_PROFILE');

        const missing = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-15', 8, 20)));
        assert.equal(missing.status, 'NO_ACTIVE_SESSION');
        if (missing.status === 'NO_ACTIVE_SESSION') assert.equal(missing.reason, 'SCHEDULE_PROFILE_MISSING');

        const inactive = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-16', 8, 20)));
        assert.equal(inactive.status, 'NO_ACTIVE_SESSION');
        if (inactive.status === 'NO_ACTIVE_SESSION') assert.equal(inactive.reason, 'SCHEDULE_PROFILE_INACTIVE');
      });
    });

    await t.test('period start is inclusive and exact period end is outside the active session', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const atStart = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-08', 8, 0)));
        assert.equal(atStart.status, 'IN_SESSION');

        const atEnd = await service.resolveSectionSession(base.sectionA1, new Date(localDetroitIso('2026-09-08', 8, 50)));
        assert.equal(atEnd.status, 'NO_ACTIVE_SESSION');
        if (atEnd.status === 'NO_ACTIVE_SESSION') assert.equal(atEnd.reason, 'OUTSIDE_SECTION_PERIOD');
      });
    });

    await t.test('America/Detroit conversion remains deterministic after the DST fall-back', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const result = await service.resolveSectionSession(base.sectionA1, new Date('2026-11-02T13:00:00.000Z'));
        assert.equal(result.status, 'IN_SESSION');
        if (result.status !== 'IN_SESSION') return;
        assert.equal(result.clock.academicDate, '2026-11-02');
        assert.equal(result.clock.localTime, '08:00:00');
        assert.equal(result.clock.timezone, 'America/Detroit');
      });
    });

    await t.test('database rejects a no-school calendar row that also names a schedule profile', async () => {
      await withFixture(pool, async ({ client, base }) => {
        await assert.rejects(
          client.query(
            `INSERT INTO school_calendar_days
               (school_id, academic_date, is_school_day, schedule_profile_id, label)
             VALUES ($1, DATE '2026-09-18', false, $2, 'Invalid no-school profile')`,
            [base.schoolA, ids.normalProfile],
          ),
          /school_calendar_days_check/,
        );
      });
    });

    await t.test('one effective school policy resolves typed values, provenance, and only permitted override', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const result = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-09-08',
          at: new Date(localDetroitIso('2026-09-08', 8, 20)),
          studentId: base.studentA,
        });
        assert.equal(result.status, 'RESOLVED');
        if (result.status !== 'RESOLVED') return;
        assert.equal(result.values.MAX_ACTIVE_PER_SECTION?.value, 3);
        assert.equal(result.values.MAX_ACTIVE_PER_SECTION?.source, 'SECTION_OVERRIDE');
        assert.equal(result.values.MAX_ACTIVE_PER_SECTION?.overrideId, ids.allowedOverride);
        assert.equal(result.values.DAILY_LIMIT?.value, 1);
        assert.equal(result.values.DAILY_LIMIT?.source, 'SCHOOL_DEFAULT');
        assert.deepEqual(result.rejectedSectionOverrides, [
          {
            overrideId: ids.disallowedOverride,
            policyKey: 'DAILY_LIMIT',
            reason: 'TEACHER_OVERRIDE_NOT_ALLOWED',
          },
        ]);
        assert.deepEqual(result.studentAccess, {
          status: 'RESOLVED',
          mode: 'UNLIMITED',
          source: 'SECTION',
          ruleId: ids.sectionAccess,
        });
        assert.equal(JSON.stringify(result).includes('private section reason'), false);
      });
    });

    await t.test('no effective policy set and overlapping effective sets fail safe', async () => {
      await withFixture(pool, async ({ client, service, base }) => {
        const none = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-08-25',
          at: new Date('2026-08-25T12:00:00.000Z'),
        });
        assert.equal(none.status, 'UNRESOLVED');
        if (none.status === 'UNRESOLVED') assert.equal(none.reason, 'NO_EFFECTIVE_POLICY_SET');

        await client.query(
          `INSERT INTO school_policy_sets
             (school_id, academic_year_id, name, effective_from, effective_until, active)
           VALUES ($1, $2, 'Conflicting Set', DATE '2026-09-05', DATE '2026-09-20', true)`,
          [base.schoolA, base.yearA],
        );
        const conflict = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-09-08',
          at: new Date(localDetroitIso('2026-09-08', 8, 20)),
        });
        assert.equal(conflict.status, 'UNRESOLVED');
        if (conflict.status === 'UNRESOLVED') assert.equal(conflict.reason, 'CONFLICTING_POLICY_SETS');
      });
    });

    await t.test('JSON null policy value is treated as malformed typed policy and fails closed', async () => {
      await withFixture(pool, async ({ client, service, base }) => {
        await client.query(
          `UPDATE policy_values
              SET typed_value_json = 'null'::jsonb
            WHERE id = $1`,
          [ids.cooldownValue],
        );
        const result = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-09-08',
          at: new Date(localDetroitIso('2026-09-08', 8, 20)),
        });
        assert.equal(result.status, 'UNRESOLVED');
        if (result.status === 'UNRESOLVED') assert.equal(result.reason, 'MALFORMED_POLICY_VALUE');
      });
    });

    await t.test('expired or future section overrides do not affect effective policy', async () => {
      await withFixture(pool, async ({ client, service, base }) => {
        await client.query(
          `UPDATE section_policy_overrides
              SET valid_until = TIMESTAMPTZ '2026-09-07T00:00:00Z'
            WHERE id = $1`,
          [ids.allowedOverride],
        );
        await client.query(
          `INSERT INTO section_policy_overrides
             (school_id, section_id, policy_key, typed_value_json, valid_from, reason)
           VALUES ($1, $2, 'MAX_ACTIVE_PER_SECTION', '7'::jsonb, TIMESTAMPTZ '2026-09-20T00:00:00Z', 'Future fixture')`,
          [base.schoolA, base.sectionA1],
        );
        const result = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-09-08',
          at: new Date(localDetroitIso('2026-09-08', 8, 20)),
        });
        assert.equal(result.status, 'RESOLVED');
        if (result.status !== 'RESOLVED') return;
        assert.equal(result.values.MAX_ACTIVE_PER_SECTION?.value, 2);
        assert.equal(result.values.MAX_ACTIVE_PER_SECTION?.source, 'SCHOOL_DEFAULT');
      });
    });

    await t.test('conflicting same-specificity student access rules fail safe instead of merging', async () => {
      await withFixture(pool, async ({ client, service, base }) => {
        await client.query(
          `INSERT INTO student_access_rules
             (school_id, student_id, section_id, access_mode, reason_private, valid_from, status)
           VALUES ($1, $2, $3, 'ESCORT_ONLY', 'second private section reason', TIMESTAMPTZ '2026-09-01T00:00:00Z', 'ACTIVE')`,
          [base.schoolA, base.studentA, base.sectionA1],
        );
        const result = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-09-08',
          at: new Date(localDetroitIso('2026-09-08', 8, 20)),
          studentId: base.studentA,
        });
        assert.equal(result.status, 'RESOLVED');
        if (result.status !== 'RESOLVED') return;
        assert.equal(result.studentAccess.status, 'CONFLICT');
        if (result.studentAccess.status === 'CONFLICT') {
          assert.equal(result.studentAccess.source, 'SECTION');
          assert.equal(result.studentAccess.ruleIds.length, 2);
        }
      });
    });

    await t.test('student access resolution requires active membership in the requested section', async () => {
      await withFixture(pool, async ({ service, base }) => {
        const result = await service.resolvePolicy({
          schoolId: base.schoolA,
          sectionId: base.sectionA1,
          academicYearId: base.yearA,
          academicDate: '2026-09-08',
          at: new Date(localDetroitIso('2026-09-08', 8, 20)),
          studentId: base.studentA2,
        });
        assert.equal(result.status, 'RESOLVED');
        if (result.status !== 'RESOLVED') return;
        assert.deepEqual(result.studentAccess, {
          status: 'UNAVAILABLE',
          reason: 'STUDENT_NOT_AVAILABLE_IN_SECTION',
        });
      });
    });

    await t.test('teacher schedule/policy proof route is authenticated and section-scoped', async () => {
      await withFixture(pool, async ({ database, base }) => {
        const app = buildApp({
          config,
          database,
          identityProvider: new FixtureIdentityProvider(),
          sessionTtlMs: 60_000,
        });
        try {
          const unauthenticated = await app.inject({
            method: 'GET',
            url: `/api/sections/${base.sectionA1}/schedule-policy-context?at=${encodeURIComponent(localDetroitIso('2026-09-08', 8, 20))}`,
          });
          assert.equal(unauthenticated.statusCode, 401);

          const token = await signIn(app, 'teacher-a');
          const allowed = await app.inject({
            method: 'GET',
            url: `/api/sections/${base.sectionA1}/schedule-policy-context?at=${encodeURIComponent(localDetroitIso('2026-09-08', 8, 20))}&studentId=${base.studentA}`,
            headers: bearer(token),
          });
          assert.equal(allowed.statusCode, 200, allowed.body);
          const body = allowed.json() as { session: { status: string }; policy: { status: string } | null };
          assert.equal(body.session.status, 'IN_SESSION');
          assert.equal(body.policy?.status, 'RESOLVED');

          const otherTeacherSection = await app.inject({
            method: 'GET',
            url: `/api/sections/${base.sectionB1}/schedule-policy-context?at=${encodeURIComponent(localDetroitIso('2026-09-08', 8, 20))}`,
            headers: bearer(token),
          });
          assert.equal(otherTeacherSection.statusCode, 403);

          const ownUnassignedSection = await app.inject({
            method: 'GET',
            url: `/api/sections/${base.sectionA2}/schedule-policy-context?at=${encodeURIComponent(localDetroitIso('2026-09-08', 8, 20))}`,
            headers: bearer(token),
          });
          assert.equal(ownUnassignedSection.statusCode, 403);
        } finally {
          await app.close();
        }
      });
    });
  } finally {
    await pool.end();
  }
});
