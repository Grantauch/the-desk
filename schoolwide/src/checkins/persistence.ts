import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { CheckInError, type CheckInRecord } from './types.js';

export interface ActiveEnrollment extends QueryResultRow {
  id: string;
  school_id: string;
  student_id: string;
  section_id: string;
}

interface CheckInRow extends QueryResultRow {
  id: string;
  school_id: string;
  student_id: string;
  section_id: string;
  enrollment_id: string;
  academic_date: string | Date;
  checked_in_at: Date;
  status: 'CHECKED_IN';
  point_value: number;
  authorization_method: 'STUDENT_PIN_PROOF' | 'TEACHER_BACKUP';
}

function databaseDate(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export async function requireActiveEnrollment(
  executor: QueryExecutor,
  schoolId: string,
  studentId: string,
  sectionId: string,
): Promise<ActiveEnrollment> {
  const rows = await executor.query<ActiveEnrollment>(
    `SELECT e.id, e.school_id, e.student_id, e.section_id
       FROM enrollments e
       JOIN students st
         ON st.school_id = e.school_id
        AND st.id = e.student_id
        AND st.status = 'ACTIVE'
       JOIN sections sec
         ON sec.school_id = e.school_id
        AND sec.id = e.section_id
        AND sec.status = 'ACTIVE'
      WHERE e.school_id = $1
        AND e.student_id = $2
        AND e.section_id = $3
        AND e.status = 'ACTIVE'
      LIMIT 1`,
    [schoolId, studentId, sectionId],
  );
  const row = rows[0];
  if (!row) {
    throw new CheckInError('STUDENT_NOT_AVAILABLE_IN_SECTION', 'Student is not available in this section.', 403);
  }
  return row;
}

export async function createOrReadCheckIn(
  executor: QueryExecutor,
  input: {
    organizationId: string;
    schoolId: string;
    studentId: string;
    sectionId: string;
    enrollmentId: string;
    academicDate: string;
    checkedInAt: Date;
    authorizationMethod: 'STUDENT_PIN_PROOF' | 'TEACHER_BACKUP';
    identityMethod: 'STUDENT_IDENTITY_PROVIDER' | 'STAFF_SESSION';
    actorUserId: string | null;
    actionProofId: string | null;
    notePrivate: string | null;
    requestId: string;
  },
): Promise<{ row: CheckInRow; created: boolean }> {
  const inserted = await executor.query<CheckInRow>(
    `INSERT INTO checkins
       (organization_id, school_id, student_id, section_id, enrollment_id,
        academic_date, checked_in_at, authorization_method, identity_method,
        actor_user_id, action_proof_id, note_private, request_id)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::timestamptz, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (enrollment_id, academic_date) DO NOTHING
     RETURNING id, school_id, student_id, section_id, enrollment_id, academic_date,
               checked_in_at, status, point_value, authorization_method`,
    [
      input.organizationId,
      input.schoolId,
      input.studentId,
      input.sectionId,
      input.enrollmentId,
      input.academicDate,
      input.checkedInAt.toISOString(),
      input.authorizationMethod,
      input.identityMethod,
      input.actorUserId,
      input.actionProofId,
      input.notePrivate,
      input.requestId,
    ],
  );
  const created = inserted[0];
  if (created) return { row: created, created: true };

  const existing = await executor.query<CheckInRow>(
    `SELECT id, school_id, student_id, section_id, enrollment_id, academic_date,
            checked_in_at, status, point_value, authorization_method
       FROM checkins
      WHERE enrollment_id = $1 AND academic_date = $2::date
      LIMIT 1`,
    [input.enrollmentId, input.academicDate],
  );
  const row = existing[0];
  if (!row) throw new Error('Check-In uniqueness conflict could not be resolved.');
  return { row, created: false };
}

export async function writeCheckInEvidence(
  executor: QueryExecutor,
  input: {
    organizationId: string;
    schoolId: string;
    studentId: string;
    sectionId: string;
    enrollmentId: string;
    checkInId: string;
    academicDate: string;
    checkedInAt: Date;
    actorKind: 'STUDENT' | 'USER';
    actorUserId: string | null;
    authorizationMethod: 'STUDENT_PIN_PROOF' | 'TEACHER_BACKUP';
    correlationId: string;
  },
): Promise<void> {
  await executor.query(
    `INSERT INTO audit_events
       (organization_id, school_id, actor_user_id, actor_student_id, actor_kind,
        action, target_type, target_id, request_id, correlation_id, source, metadata)
     VALUES ($1, $2, $3, $4, $5, 'CHECKIN_CREATED', 'CHECKIN', $6, $7, $7, 'APPLICATION', $8::jsonb)`,
    [
      input.organizationId,
      input.schoolId,
      input.actorUserId,
      input.actorKind === 'STUDENT' ? input.studentId : null,
      input.actorKind,
      input.checkInId,
      input.correlationId,
      JSON.stringify({
        sectionId: input.sectionId,
        enrollmentId: input.enrollmentId,
        academicDate: input.academicDate,
        authorizationMethod: input.authorizationMethod,
      }),
    ],
  );

  await executor.query(
    `INSERT INTO transactional_outbox
       (organization_id, school_id, topic, event_type, aggregate_type, aggregate_id,
        correlation_id, payload_json_sanitized)
     VALUES ($1, $2, 'schoolwide.checkins', 'CHECKIN_CREATED', 'CHECKIN', $3, $4, $5::jsonb)`,
    [
      input.organizationId,
      input.schoolId,
      input.checkInId,
      input.correlationId,
      JSON.stringify({
        checkInId: input.checkInId,
        studentId: input.studentId,
        sectionId: input.sectionId,
        academicDate: input.academicDate,
        checkedInAt: input.checkedInAt.toISOString(),
      }),
    ],
  );
}

export async function calculateSchoolDayStreak(
  executor: QueryExecutor,
  schoolId: string,
  studentId: string,
  throughAcademicDate: string,
): Promise<number> {
  const days = await executor.query<{ academic_date: string | Date } & QueryResultRow>(
    `SELECT academic_date
       FROM school_calendar_days
      WHERE school_id = $1
        AND is_school_day = true
        AND academic_date <= $2::date
      ORDER BY academic_date DESC
      LIMIT 400`,
    [schoolId, throughAcademicDate],
  );
  if (!days.length) return 0;

  const checked = await executor.query<{ academic_date: string | Date } & QueryResultRow>(
    `SELECT DISTINCT academic_date
       FROM checkins
      WHERE school_id = $1
        AND student_id = $2
        AND status = 'CHECKED_IN'
        AND academic_date <= $3::date
      ORDER BY academic_date DESC
      LIMIT 400`,
    [schoolId, studentId, throughAcademicDate],
  );
  const checkedDates = new Set(checked.map((row) => databaseDate(row.academic_date)));
  let streak = 0;
  for (const day of days) {
    if (!checkedDates.has(databaseDate(day.academic_date))) break;
    streak += 1;
  }
  return streak;
}

export function toCheckInRecord(row: CheckInRow, created: boolean, streak: number): CheckInRecord {
  return {
    checkInId: row.id,
    studentId: row.student_id,
    schoolId: row.school_id,
    sectionId: row.section_id,
    enrollmentId: row.enrollment_id,
    academicDate: databaseDate(row.academic_date),
    checkedInAt: row.checked_in_at.toISOString(),
    status: row.status,
    pointValue: row.point_value,
    authorizationMethod: row.authorization_method,
    created,
    streak,
  };
}
