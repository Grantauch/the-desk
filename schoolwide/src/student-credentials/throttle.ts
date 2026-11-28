import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';
import { StudentCredentialError } from './types.js';

interface AttemptStateRow extends QueryResultRow {
  blocked_until: Date | null;
}

export type AttemptControlOptions = {
  maxFailures?: number;
  attemptWindowMs?: number;
  throttleBlockMs?: number;
};

export class StudentPinAttemptControl {
  readonly #database: Database;
  readonly #maxFailures: number;
  readonly #attemptWindowMs: number;
  readonly #throttleBlockMs: number;

  constructor(database: Database, options: AttemptControlOptions = {}) {
    this.#database = database;
    this.#maxFailures = options.maxFailures ?? 5;
    this.#attemptWindowMs = options.attemptWindowMs ?? 5 * 60_000;
    this.#throttleBlockMs = options.throttleBlockMs ?? 60_000;
    if (!Number.isInteger(this.#maxFailures) || this.#maxFailures < 1 || this.#maxFailures > 20) throw new Error('Maximum PIN failures must be 1-20.');
    if (!Number.isInteger(this.#attemptWindowMs) || this.#attemptWindowMs < 1_000 || this.#attemptWindowMs > 60 * 60_000) throw new Error('PIN attempt window is invalid.');
    if (!Number.isInteger(this.#throttleBlockMs) || this.#throttleBlockMs < 1_000 || this.#throttleBlockMs > 60 * 60_000) throw new Error('PIN throttle block is invalid.');
  }

  async enforce(schoolId: string, studentId: string, at: Date, requestId: string, nonceHash: string | null): Promise<void> {
    const rows = await this.#database.query<AttemptStateRow>(
      `SELECT blocked_until FROM student_credential_attempt_state WHERE school_id = $1 AND student_id = $2`,
      [schoolId, studentId],
    );
    const blockedUntil = rows[0]?.blocked_until ?? null;
    if (!blockedUntil || blockedUntil.getTime() <= at.getTime()) return;
    await this.#recordAttempt(schoolId, studentId, 'THROTTLED', at, requestId, nonceHash);
    const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil.getTime() - at.getTime()) / 1000));
    throw new StudentCredentialError('PIN_THROTTLED', 'PIN attempts are temporarily limited.', 429, true, retryAfterSeconds);
  }

  async failure(schoolId: string, studentId: string, at: Date, requestId: string, nonceHash: string | null): Promise<void> {
    const cutoff = new Date(at.getTime() - this.#attemptWindowMs);
    const blockUntil = new Date(at.getTime() + this.#throttleBlockMs);
    await this.#database.query(
      `INSERT INTO student_credential_attempt_state
         (school_id, student_id, window_started_at, failed_attempts, blocked_until, updated_at)
       VALUES ($1, $2, $3::timestamptz, 1,
               CASE WHEN $5::integer <= 1 THEN $6::timestamptz ELSE NULL END,
               $3::timestamptz)
       ON CONFLICT (school_id, student_id) DO UPDATE
       SET window_started_at = CASE
             WHEN student_credential_attempt_state.window_started_at < $4::timestamptz THEN $3::timestamptz
             ELSE student_credential_attempt_state.window_started_at END,
           failed_attempts = CASE
             WHEN student_credential_attempt_state.window_started_at < $4::timestamptz THEN 1
             ELSE student_credential_attempt_state.failed_attempts + 1 END,
           blocked_until = CASE
             WHEN (CASE
                     WHEN student_credential_attempt_state.window_started_at < $4::timestamptz THEN 1
                     ELSE student_credential_attempt_state.failed_attempts + 1 END) >= $5::integer
               THEN $6::timestamptz
             ELSE NULL END,
           updated_at = $3::timestamptz`,
      [schoolId, studentId, at.toISOString(), cutoff.toISOString(), this.#maxFailures, blockUntil.toISOString()],
    );
    await this.#recordAttempt(schoolId, studentId, 'FAILURE', at, requestId, nonceHash);
  }

  async success(schoolId: string, studentId: string, at: Date, requestId: string, nonceHash: string | null): Promise<void> {
    await this.#recordAttempt(schoolId, studentId, 'SUCCESS', at, requestId, nonceHash);
    await this.#database.query(
      `DELETE FROM student_credential_attempt_state WHERE school_id = $1 AND student_id = $2`,
      [schoolId, studentId],
    );
  }

  async #recordAttempt(
    schoolId: string,
    studentId: string,
    outcome: 'SUCCESS' | 'FAILURE' | 'THROTTLED',
    at: Date,
    requestId: string,
    nonceHash: string | null,
  ): Promise<void> {
    await this.#database.query(
      `INSERT INTO student_credential_attempts
         (school_id, student_id, outcome, attempted_at, request_id, client_attempt_nonce_hash)
       VALUES ($1, $2, $3, $4::timestamptz, $5, $6)`,
      [schoolId, studentId, outcome, at.toISOString(), requestId, nonceHash],
    );
  }
}
