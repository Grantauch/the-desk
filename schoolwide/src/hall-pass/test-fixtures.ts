import type { PoolClient } from 'pg';
import { seedTwoSchoolFixture, type TwoSchoolFixture } from '../db/test-fixtures.js';

export const hallPassFixtureIds = {
  studentA3: '00000000-0000-0000-0000-000000000404',
  normalProfile: '00000000-0000-0000-0000-000000000901',
  normalP1: '00000000-0000-0000-0000-000000000911',
  normalP2: '00000000-0000-0000-0000-000000000912',
  policySet: '00000000-0000-0000-0000-000000000921',
  destination: '00000000-0000-0000-0000-000000000931',
  term: '00000000-0000-0000-0000-000000000941',
} as const;

export type HallPassFixture = TwoSchoolFixture & { studentA3: string; destination: string };

export async function seedHallPassFixture(client: PoolClient): Promise<HallPassFixture> {
  const base = await seedTwoSchoolFixture(client);
  await client.query(
    `INSERT INTO students (id, school_id, local_student_number, display_name)
     VALUES ($1,$2,'N-1003','Student Third')`,
    [hallPassFixtureIds.studentA3, base.schoolA],
  );
  await client.query(
    `INSERT INTO enrollments (school_id, section_id, student_id, source)
     VALUES ($1,$2,$3,'MANUAL'),($1,$2,$4,'MANUAL'),($1,$2,$5,'MANUAL'),($1,$6,$3,'MANUAL')`,
    [base.schoolA, base.sectionA1, base.studentA, base.studentA2, hallPassFixtureIds.studentA3, base.sectionA2],
  );
  await client.query(
    `INSERT INTO schedule_profiles (id, school_id, name, key, status)
     VALUES ($1,$2,'Normal Day','NORMAL','ACTIVE')`,
    [hallPassFixtureIds.normalProfile, base.schoolA],
  );
  await client.query(
    `INSERT INTO schedule_periods
       (id, school_id, schedule_profile_id, period_code, starts_at_local, ends_at_local, ordinal_by_time)
     VALUES ($1,$3,$4,'P1',TIME '08:00:00',TIME '08:50:00',1),
            ($2,$3,$4,'P2',TIME '08:55:00',TIME '09:45:00',2)`,
    [hallPassFixtureIds.normalP1, hallPassFixtureIds.normalP2, base.schoolA, hallPassFixtureIds.normalProfile],
  );
  await client.query(
    `INSERT INTO school_calendar_days
       (organization_id, school_id, academic_date, is_school_day, schedule_profile_id, label, source, source_revision)
     VALUES ($1,$2,DATE '2026-09-08',true,$3,'Normal Tuesday','MANUAL','sw070-fixture'),
            ($1,$2,DATE '2026-09-09',false,NULL,'No School Wednesday','MANUAL','sw070-fixture'),
            ($1,$2,DATE '2026-09-10',true,$3,'Normal Thursday','MANUAL','sw070-fixture'),
            ($1,$2,DATE '2026-09-11',true,NULL,'Schedule Missing Friday','MANUAL','sw070-fixture')`,
    [base.orgA, base.schoolA, hallPassFixtureIds.normalProfile],
  );
  await client.query(
    `INSERT INTO academic_terms (id, school_id, academic_year_id, name, ordinal, starts_on, ends_on, type)
     VALUES ($1,$2,$3,'Marking Period 1',1,DATE '2026-08-20',DATE '2026-10-30','MARKING_PERIOD')`,
    [hallPassFixtureIds.term, base.schoolA, base.yearA],
  );
  await client.query(
    `INSERT INTO destinations (id, school_id, name, category, active, security_visible, student_selectable)
     VALUES ($1,$2,'Restroom','RESTROOM',true,true,true)`,
    [hallPassFixtureIds.destination, base.schoolA],
  );
  await client.query(
    `INSERT INTO school_policy_sets
       (id, organization_id, school_id, academic_year_id, name, effective_from, effective_until, active)
     VALUES ($1,$2,$3,$4,'SW-070 Hall Pass Policy',DATE '2026-09-01',DATE '2027-06-15',true)`,
    [hallPassFixtureIds.policySet, base.orgA, base.schoolA, base.yearA],
  );
  const policies: Array<[string, number, boolean]> = [
    ['MAX_ACTIVE_PER_SECTION', 1, true],
    ['MARKING_PERIOD_LIMIT', 2, false],
    ['DAILY_LIMIT', 2, false],
    ['COOLDOWN_MINUTES', 5, false],
    ['PROTECTED_FIRST_MINUTES', 5, false],
    ['PROTECTED_LAST_MINUTES', 5, false],
    ['QUEUE_MAX_WAIT_MINUTES', 20, false],
  ];
  for (const [key, value, override] of policies) {
    await client.query(
      `INSERT INTO policy_values (school_id, policy_set_id, policy_key, typed_value_json, teacher_override_allowed)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [base.schoolA, hallPassFixtureIds.policySet, key, JSON.stringify(value), override],
    );
  }
  return { ...base, studentA3: hallPassFixtureIds.studentA3, destination: hallPassFixtureIds.destination };
}
