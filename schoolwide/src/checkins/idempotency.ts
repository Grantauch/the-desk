import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { CheckInError, type CheckInRecord } from './types.js';

interface IdempotencyRow extends QueryResultRow {
  id: string;
  operation: string;
  request_fingerprint: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_json_sanitized: unknown;
  expires_at: Date;
}

export type IdempotencyStart =
  | { kind: 'NEW'; id: string }
  | { kind: 'COMPLETED'; response: CheckInRecord };

function isCheckInRecord(value: unknown): value is CheckInRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.checkInId === 'string'
    && typeof row.studentId === 'string'
    && typeof row.schoolId === 'string'
    && typeof row.sectionId === 'string'
    && typeof row.enrollmentId === 'string'
    && typeof row.academicDate === 'string'
    && typeof row.checkedInAt === 'string'
    && row.status === 'CHECKED_IN'
    && typeof row.pointValue === 'number'
    && (row.authorizationMethod === 'STUDENT_PIN_PROOF' || row.authorizationMethod === 'TEACHER_BACKUP')
    && typeof row.created === 'boolean'
    && typeof row.streak === 'number';
}

export async function startIdempotentCheckIn(
  executor: QueryExecutor,
  input: {
    organizationId: string;
    schoolId: string;
    key: string;
    operation: string;
    fingerprint: string;
    correlationId: string;
    at: Date;
    ttlMs: number;
  },
): Promise<IdempotencyStart> {
  const expiresAt = new Date(input.at.getTime() + input.ttlMs);
  const inserted = await executor.query<{ id: string } & QueryResultRow>(
    `INSERT INTO idempotency_keys
       (organization_id, school_id, key, operation, request_fingerprint,
        status, expires_at, correlation_id)
     VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', $6::timestamptz, $7)
     ON CONFLICT (school_id, key) DO NOTHING
     RETURNING id`,
    [input.organizationId, input.schoolId, input.key, input.operation, input.fingerprint, expiresAt.toISOString(), input.correlationId],
  );
  const created = inserted[0];
  if (created) return { kind: 'NEW', id: created.id };

  const rows = await executor.query<IdempotencyRow>(
    `SELECT id, operation, request_fingerprint, status, response_json_sanitized, expires_at
       FROM idempotency_keys
      WHERE school_id = $1 AND key = $2
      FOR UPDATE`,
    [input.schoolId, input.key],
  );
  const row = rows[0];
  if (!row) throw new CheckInError('IDEMPOTENCY_CONFLICT', 'Idempotency state is unavailable.', 409, true);

  if (row.expires_at.getTime() <= input.at.getTime()) {
    await executor.query(
      `UPDATE idempotency_keys
          SET organization_id = $1,
              operation = $2,
              request_fingerprint = $3,
              status = 'IN_PROGRESS',
              response_status = NULL,
              response_json_sanitized = NULL,
              completed_at = NULL,
              expires_at = $4::timestamptz,
              correlation_id = $5
        WHERE id = $6`,
      [input.organizationId, input.operation, input.fingerprint, expiresAt.toISOString(), input.correlationId, row.id],
    );
    return { kind: 'NEW', id: row.id };
  }

  if (row.operation !== input.operation || row.request_fingerprint !== input.fingerprint) {
    throw new CheckInError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different request.', 409);
  }
  if (row.status === 'COMPLETED' && isCheckInRecord(row.response_json_sanitized)) {
    return { kind: 'COMPLETED', response: row.response_json_sanitized };
  }
  throw new CheckInError('IDEMPOTENCY_CONFLICT', 'The same Check-In request is still being resolved.', 409, true);
}

export async function completeIdempotentCheckIn(
  executor: QueryExecutor,
  id: string,
  response: CheckInRecord,
  at: Date,
  responseStatus: number,
): Promise<void> {
  await executor.query(
    `UPDATE idempotency_keys
        SET status = 'COMPLETED',
            response_status = $2,
            response_json_sanitized = $3::jsonb,
            completed_at = $4::timestamptz
      WHERE id = $1 AND status = 'IN_PROGRESS'`,
    [id, responseStatus, JSON.stringify(response), at.toISOString()],
  );
}
