import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { HallPassError } from './types.js';

interface IdempotencyRow extends QueryResultRow {
  id: string;
  operation: string;
  request_fingerprint: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_json_sanitized: unknown;
  expires_at: Date;
}

export type IdempotencyStart<T> = { kind: 'NEW'; id: string } | { kind: 'COMPLETED'; response: T };

export async function startIdempotent<T>(
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
    validateResponse: (value: unknown) => value is T;
  },
): Promise<IdempotencyStart<T>> {
  const expiresAt = new Date(input.at.getTime() + input.ttlMs);
  const inserted = await executor.query<{ id: string } & QueryResultRow>(
    `INSERT INTO idempotency_keys
       (organization_id, school_id, key, operation, request_fingerprint, status, expires_at, correlation_id)
     VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', $6::timestamptz, $7)
     ON CONFLICT (school_id, key) DO NOTHING
     RETURNING id`,
    [input.organizationId, input.schoolId, input.key, input.operation, input.fingerprint, expiresAt.toISOString(), input.correlationId],
  );
  if (inserted[0]) return { kind: 'NEW', id: inserted[0].id };

  const rows = await executor.query<IdempotencyRow>(
    `SELECT id, operation, request_fingerprint, status, response_json_sanitized, expires_at
       FROM idempotency_keys
      WHERE school_id = $1 AND key = $2
      FOR UPDATE`,
    [input.schoolId, input.key],
  );
  const row = rows[0];
  if (!row) throw new HallPassError('IDEMPOTENCY_CONFLICT', 'Idempotency state is unavailable.', 409, true);
  if (row.expires_at.getTime() <= input.at.getTime()) {
    await executor.query(
      `UPDATE idempotency_keys
          SET organization_id = $1, operation = $2, request_fingerprint = $3,
              status = 'IN_PROGRESS', response_status = NULL, response_json_sanitized = NULL,
              completed_at = NULL, expires_at = $4::timestamptz, correlation_id = $5
        WHERE id = $6`,
      [input.organizationId, input.operation, input.fingerprint, expiresAt.toISOString(), input.correlationId, row.id],
    );
    return { kind: 'NEW', id: row.id };
  }
  if (row.operation !== input.operation || row.request_fingerprint !== input.fingerprint) {
    throw new HallPassError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different request.', 409);
  }
  if (row.status === 'COMPLETED' && input.validateResponse(row.response_json_sanitized)) {
    return { kind: 'COMPLETED', response: row.response_json_sanitized };
  }
  throw new HallPassError('IDEMPOTENCY_CONFLICT', 'The same protected request is still being resolved.', 409, true);
}

export async function completeIdempotent<T>(
  executor: QueryExecutor,
  id: string,
  response: T,
  at: Date,
  responseStatus: number,
): Promise<void> {
  await executor.query(
    `UPDATE idempotency_keys
        SET status = 'COMPLETED', response_status = $2,
            response_json_sanitized = $3::jsonb, completed_at = $4::timestamptz
      WHERE id = $1 AND status = 'IN_PROGRESS'`,
    [id, responseStatus, JSON.stringify(response), at.toISOString()],
  );
}
