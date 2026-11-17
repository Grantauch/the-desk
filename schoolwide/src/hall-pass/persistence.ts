import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { HallPassError } from './types.js';

export interface ActiveEnrollment extends QueryResultRow {
  id: string;
  school_id: string;
  student_id: string;
  section_id: string;
}

export interface PassRow extends QueryResultRow {
  id: string;
  organization_id: string;
  school_id: string;
  pass_request_id: string;
  student_id: string;
  section_id: string;
  enrollment_id: string;
  destination_id: string;
  started_at: Date;
  returned_at: Date | null;
  status: 'OUT' | 'RETURNED' | 'ROLLED_OVER';
  countability: 'PROVISIONAL' | 'COUNTABLE' | 'NON_COUNTABLE' | 'UNKNOWN_REVIEW';
}

export interface PassRequestRow extends QueryResultRow {
  id: string;
  organization_id: string;
  school_id: string;
  student_id: string;
  section_id: string;
  enrollment_id: string;
  destination_id: string;
  action_proof_id: string;
  requested_at: Date;
  class_end_at: Date;
  queue_expires_at: Date;
  status: 'STARTED' | 'QUEUED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';
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
       JOIN students st ON st.school_id = e.school_id AND st.id = e.student_id AND st.status = 'ACTIVE'
       JOIN sections sec ON sec.school_id = e.school_id AND sec.id = e.section_id AND sec.status = 'ACTIVE'
      WHERE e.school_id = $1 AND e.student_id = $2 AND e.section_id = $3 AND e.status = 'ACTIVE'
      LIMIT 1`,
    [schoolId, studentId, sectionId],
  );
  if (!rows[0]) throw new HallPassError('STUDENT_NOT_AVAILABLE_IN_SECTION', 'Student is not available in this section.', 403);
  return rows[0];
}

export async function requireDestination(executor: QueryExecutor, schoolId: string, destinationId: string): Promise<void> {
  const rows = await executor.query<{ id: string } & QueryResultRow>(
    `SELECT id FROM destinations
      WHERE school_id = $1 AND id = $2 AND active = true AND student_selectable = true
      LIMIT 1`,
    [schoolId, destinationId],
  );
  if (!rows[0]) throw new HallPassError('DESTINATION_UNAVAILABLE', 'That destination is unavailable.', 409);
}

export async function lockSection(executor: QueryExecutor, schoolId: string, sectionId: string): Promise<void> {
  const rows = await executor.query<{ id: string } & QueryResultRow>(
    `SELECT id FROM sections WHERE school_id = $1 AND id = $2 AND status = 'ACTIVE' FOR UPDATE`,
    [schoolId, sectionId],
  );
  if (!rows[0]) throw new HallPassError('SECTION_UNAVAILABLE', 'Section is unavailable.', 404);
}

export async function writePassEvidence(
  executor: QueryExecutor,
  input: {
    organizationId: string;
    schoolId: string;
    studentId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    correlationId: string;
    metadata: Record<string, unknown>;
    eventType: string;
    aggregateType: string;
    aggregateId: string | null;
    payload: Record<string, unknown>;
    actorKind?: 'STUDENT' | 'SYSTEM';
  },
): Promise<void> {
  const actorKind = input.actorKind ?? 'STUDENT';
  await executor.query(
    `INSERT INTO audit_events
       (organization_id, school_id, actor_user_id, actor_student_id, actor_kind,
        action, target_type, target_id, request_id, correlation_id, source, metadata)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $8, $9, $10::jsonb)`,
    [
      input.organizationId,
      input.schoolId,
      actorKind === 'STUDENT' ? input.studentId : null,
      actorKind,
      input.action,
      input.targetType,
      input.targetId,
      input.correlationId,
      actorKind === 'SYSTEM' ? 'SYSTEM' : 'APPLICATION',
      JSON.stringify(input.metadata),
    ],
  );
  await executor.query(
    `INSERT INTO pass_events
       (organization_id, school_id, event_type, resource_type, resource_id, student_id,
        actor_kind, actor_user_id, actor_student_id, correlation_id, metadata_json_sanitized)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10::jsonb)`,
    [
      input.organizationId,
      input.schoolId,
      input.eventType,
      input.targetType,
      input.targetId,
      input.studentId,
      actorKind,
      actorKind === 'STUDENT' ? input.studentId : null,
      input.correlationId,
      JSON.stringify(input.metadata),
    ],
  );
  await executor.query(
    `INSERT INTO transactional_outbox
       (organization_id, school_id, topic, event_type, aggregate_type, aggregate_id,
        correlation_id, payload_json_sanitized)
     VALUES ($1, $2, 'schoolwide.passes', $3, $4, $5, $6, $7::jsonb)`,
    [
      input.organizationId,
      input.schoolId,
      input.eventType,
      input.aggregateType,
      input.aggregateId,
      input.correlationId,
      JSON.stringify(input.payload),
    ],
  );
}
