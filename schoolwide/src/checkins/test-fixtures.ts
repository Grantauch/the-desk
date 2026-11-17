import type { PoolClient, QueryResultRow } from 'pg';
import type { StaffIdentityProvider, VerifiedStaffIdentity } from '../auth/types.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedTwoSchoolFixture, type TwoSchoolFixture } from '../db/test-fixtures.js';
import type { StudentIdentityProvider, VerifiedStudentIdentity } from '../student-credentials/types.js';

export const checkInFixtureIds = {
  normalProfile: '00000000-0000-0000-0000-000000000801',
  normalP1: '00000000-0000-0000-0000-000000000811',
  normalP2: '00000000-0000-0000-0000-000000000812',
  policySet: '00000000-0000-0000-0000-000000000821',
  checkInWindowValue: '00000000-0000-0000-0000-000000000822',
} as const;

export class ClientTransactionalDatabase implements TransactionalDatabase {
  readonly #client: PoolClient;
  #savepoint = 0;

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

  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const name = `sw060_${++this.#savepoint}`;
    await this.#client.query(`SAVEPOINT ${name}`);
    try {
      const result = await work(this);
      await this.#client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      await this.#client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      await this.#client.query(`RELEASE SAVEPOINT ${name}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Outer fixture owns the client lifecycle.
  }
}

export class FixtureStaffIdentityProvider implements StaffIdentityProvider {
  async verify(assertion: string): Promise<VerifiedStaffIdentity> {
    if (assertion !== 'teacher-a') throw new Error('Synthetic staff identity rejected.');
    return { provider: 'SYNTHETIC', subject: 'google-teacher-alpha' };
  }
}

export class FixtureStudentIdentityProvider implements StudentIdentityProvider {
  readonly #base: TwoSchoolFixture;

  constructor(base: TwoSchoolFixture) {
    this.#base = base;
  }

  async verify(assertion: string): Promise<VerifiedStudentIdentity> {
    if (assertion === 'student-a') {
      return { provider: 'SYNTHETIC', subject: 'synthetic-student-a', studentId: this.#base.studentA };
    }
    if (assertion === 'student-a2') {
      return { provider: 'SYNTHETIC', subject: 'synthetic-student-a2', studentId: this.#base.studentA2 };
    }
    throw new Error('Synthetic student identity rejected.');
  }
}

export async function seedCheckInFixture(client: PoolClient): Promise<TwoSchoolFixture> {
  const base = await seedTwoSchoolFixture(client);

  await client.query(
    `INSERT INTO enrollments (school_id, section_id, student_id, source)
     VALUES
       ($1, $2, $3, 'MANUAL'),
       ($1, $2, $4, 'MANUAL'),
       ($1, $5, $3, 'MANUAL')`,
    [base.schoolA, base.sectionA1, base.studentA, base.studentA2, base.sectionA2],
  );

  await client.query(
    `INSERT INTO schedule_profiles (id, school_id, name, key, status)
     VALUES ($1, $2, 'Normal Day', 'NORMAL', 'ACTIVE')`,
    [checkInFixtureIds.normalProfile, base.schoolA],
  );

  await client.query(
    `INSERT INTO schedule_periods
       (id, school_id, schedule_profile_id, period_code, starts_at_local, ends_at_local, ordinal_by_time)
     VALUES
       ($1, $3, $4, 'P1', TIME '08:00:00', TIME '08:50:00', 1),
       ($2, $3, $4, 'P2', TIME '08:55:00', TIME '09:45:00', 2)`,
    [checkInFixtureIds.normalP1, checkInFixtureIds.normalP2, base.schoolA, checkInFixtureIds.normalProfile],
  );

  await client.query(
    `INSERT INTO school_calendar_days
       (organization_id, school_id, academic_date, is_school_day, schedule_profile_id, label, source, source_revision)
     VALUES
       ($1, $2, DATE '2026-09-08', true, $3, 'Normal Tuesday', 'MANUAL', 'sw060-fixture'),
       ($1, $2, DATE '2026-09-09', false, NULL, 'No School Wednesday', 'MANUAL', 'sw060-fixture'),
       ($1, $2, DATE '2026-09-10', true, $3, 'Normal Thursday', 'MANUAL', 'sw060-fixture'),
       ($1, $2, DATE '2026-09-11', true, NULL, 'Schedule Needs Teacher Update', 'MANUAL', 'sw060-fixture')`,
    [base.orgA, base.schoolA, checkInFixtureIds.normalProfile],
  );

  await client.query(
    `INSERT INTO school_policy_sets
       (id, organization_id, school_id, academic_year_id, name, effective_from, effective_until, active)
     VALUES ($1, $2, $3, $4, 'SW-060 Check-In Policy', DATE '2026-09-01', DATE '2027-06-15', true)`,
    [checkInFixtureIds.policySet, base.orgA, base.schoolA, base.yearA],
  );
  await client.query(
    `INSERT INTO policy_values
       (id, school_id, policy_set_id, policy_key, typed_value_json, teacher_override_allowed)
     VALUES ($1, $2, $3, 'CHECKIN_WINDOW_MINUTES', '5'::jsonb, false)`,
    [checkInFixtureIds.checkInWindowValue, base.schoolA, checkInFixtureIds.policySet],
  );

  return base;
}
