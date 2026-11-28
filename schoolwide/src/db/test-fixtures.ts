import type { PoolClient } from 'pg';

export interface TwoSchoolFixture {
  orgA: string;
  orgB: string;
  schoolA: string;
  schoolB: string;
  yearA: string;
  yearB: string;
  teacherA: string;
  teacherB: string;
  studentA: string;
  studentA2: string;
  studentB: string;
  sectionA1: string;
  sectionA2: string;
  sectionB1: string;
}

export const fixtureIds: TwoSchoolFixture = {
  orgA: '00000000-0000-0000-0000-000000000001',
  orgB: '00000000-0000-0000-0000-000000000002',
  schoolA: '00000000-0000-0000-0000-000000000101',
  schoolB: '00000000-0000-0000-0000-000000000102',
  yearA: '00000000-0000-0000-0000-000000000201',
  yearB: '00000000-0000-0000-0000-000000000202',
  teacherA: '00000000-0000-0000-0000-000000000301',
  teacherB: '00000000-0000-0000-0000-000000000302',
  studentA: '00000000-0000-0000-0000-000000000401',
  studentA2: '00000000-0000-0000-0000-000000000402',
  studentB: '00000000-0000-0000-0000-000000000403',
  sectionA1: '00000000-0000-0000-0000-000000000501',
  sectionA2: '00000000-0000-0000-0000-000000000502',
  sectionB1: '00000000-0000-0000-0000-000000000503'
};

export async function seedTwoSchoolFixture(client: PoolClient): Promise<TwoSchoolFixture> {
  const ids = fixtureIds;

  await client.query(
    `INSERT INTO organizations (id, slug, name, google_domain)
     VALUES ($1, 'north-district', 'North District', 'north.example.invalid'),
            ($2, 'south-district', 'South District', 'south.example.invalid')`,
    [ids.orgA, ids.orgB]
  );

  await client.query(
    `INSERT INTO schools (id, organization_id, slug, name, primary_domain, timezone)
     VALUES ($1, $2, 'north-high', 'North High', 'north-high.example.invalid', 'America/Detroit'),
            ($3, $4, 'south-high', 'South High', 'south-high.example.invalid', 'America/Detroit')`,
    [ids.schoolA, ids.orgA, ids.schoolB, ids.orgB]
  );

  await client.query(
    `INSERT INTO academic_years (id, school_id, label, starts_on, ends_on)
     VALUES ($1, $2, '2026-27', DATE '2026-08-20', DATE '2027-06-15'),
            ($3, $4, '2026-27', DATE '2026-08-20', DATE '2027-06-15')`,
    [ids.yearA, ids.schoolA, ids.yearB, ids.schoolB]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, primary_email, display_name, google_subject_id)
     VALUES ($1, $2, 'teacher-a@north.example.invalid', 'Teacher Alpha', 'google-teacher-alpha'),
            ($3, $4, 'teacher-b@south.example.invalid', 'Teacher Beta', 'google-teacher-beta')`,
    [ids.teacherA, ids.orgA, ids.teacherB, ids.orgB]
  );

  await client.query(
    `INSERT INTO staff_profiles (user_id, organization_id, employee_external_id, title)
     VALUES ($1, $2, 'EMP-A', 'Teacher'), ($3, $4, 'EMP-B', 'Teacher')`,
    [ids.teacherA, ids.orgA, ids.teacherB, ids.orgB]
  );

  await client.query(
    `INSERT INTO user_roles (organization_id, school_id, user_id, role)
     VALUES ($1, $2, $3, 'TEACHER'), ($4, $5, $6, 'TEACHER')`,
    [ids.orgA, ids.schoolA, ids.teacherA, ids.orgB, ids.schoolB, ids.teacherB]
  );

  await client.query(
    `INSERT INTO students (id, school_id, local_student_number, display_name)
     VALUES ($1, $2, 'N-1001', 'Student Same'),
            ($3, $2, 'N-1002', 'Student Same'),
            ($4, $5, 'S-1001', 'Student South')`,
    [ids.studentA, ids.schoolA, ids.studentA2, ids.studentB, ids.schoolB]
  );

  await client.query(
    `INSERT INTO sections (id, school_id, academic_year_id, name, code, period_code, period_label, room)
     VALUES ($1, $2, $3, 'North Section One', 'N-SEC-1', 'P1', '1', 'N101'),
            ($4, $2, $3, 'North Section Two', 'N-SEC-2', 'P2', '2', 'N102'),
            ($5, $6, $7, 'South Section One', 'S-SEC-1', 'P1', '1', 'S101')`,
    [ids.sectionA1, ids.schoolA, ids.yearA, ids.sectionA2, ids.sectionB1, ids.schoolB, ids.yearB]
  );

  await client.query(
    `INSERT INTO section_staff_assignments
       (organization_id, school_id, section_id, user_id, assignment_role)
     VALUES ($1, $2, $3, $4, 'PRIMARY_TEACHER'),
            ($5, $6, $7, $8, 'PRIMARY_TEACHER')`,
    [ids.orgA, ids.schoolA, ids.sectionA1, ids.teacherA, ids.orgB, ids.schoolB, ids.sectionB1, ids.teacherB]
  );

  return ids;
}
