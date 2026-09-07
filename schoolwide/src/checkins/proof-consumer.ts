import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { hashOpaqueValue } from '../student-credentials/crypto.js';
import { CheckInError } from './types.js';

export interface CheckInProofState extends QueryResultRow {
  id: string;
  organization_id: string;
  school_id: string;
  student_id: string;
  action_type: string;
  context_section_id: string | null;
  credential_version: number;
  expires_at: Date;
  consumed_at: Date | null;
  current_credential_version: number | null;
}

export function checkInProofHash(proof: string): string {
  if (!proof.trim()) throw new CheckInError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
  return hashOpaqueValue(proof);
}

export async function loadCheckInProof(
  executor: QueryExecutor,
  tokenHash: string,
): Promise<CheckInProofState> {
  const rows = await executor.query<CheckInProofState>(
    `SELECT ap.id,
            s.organization_id,
            ap.school_id,
            ap.student_id,
            ap.action_type,
            ap.context_section_id,
            ap.credential_version,
            ap.expires_at,
            ap.consumed_at,
            CASE WHEN sc.status = 'ACTIVE' THEN sc.credential_version ELSE NULL END AS current_credential_version
       FROM action_proofs ap
       JOIN schools s ON s.id = ap.school_id AND s.status = 'ACTIVE'
       LEFT JOIN student_credentials sc
         ON sc.school_id = ap.school_id
        AND sc.id = ap.credential_id
        AND sc.student_id = ap.student_id
      WHERE ap.token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) throw new CheckInError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
  return row;
}

export function validateCheckInProof(state: CheckInProofState, sectionId: string, at: Date): void {
  if (state.consumed_at) throw new CheckInError('ACTION_PROOF_USED', 'Action proof has already been used.', 409);
  if (state.expires_at.getTime() <= at.getTime()) {
    throw new CheckInError('ACTION_PROOF_EXPIRED', 'Action proof has expired.', 401);
  }
  if (state.action_type !== 'CHECKIN' || state.context_section_id !== sectionId) {
    throw new CheckInError('ACTION_WRONG_CONTEXT', 'Action proof does not match this Check-In context.', 403);
  }
  if (state.current_credential_version === null || state.current_credential_version !== state.credential_version) {
    throw new CheckInError('ACTION_CREDENTIAL_ROTATED', 'Action proof was invalidated by credential rotation.', 401);
  }
}

export async function consumeCheckInProof(
  executor: QueryExecutor,
  tokenHash: string,
  state: CheckInProofState,
  sectionId: string,
  at: Date,
): Promise<void> {
  const rows = await executor.query<{ id: string } & QueryResultRow>(
    `UPDATE action_proofs ap
        SET consumed_at = $3::timestamptz
       FROM student_credentials sc
      WHERE ap.id = $1
        AND ap.context_section_id = $2
        AND ap.action_type = 'CHECKIN'
        AND ap.consumed_at IS NULL
        AND ap.expires_at > $3::timestamptz
        AND sc.school_id = ap.school_id
        AND sc.id = ap.credential_id
        AND sc.student_id = ap.student_id
        AND sc.status = 'ACTIVE'
        AND sc.credential_version = ap.credential_version
      RETURNING ap.id`,
    [state.id, sectionId, at.toISOString()],
  );
  if (rows[0]) return;

  const refreshed = await loadCheckInProof(executor, tokenHash);
  validateCheckInProof(refreshed, sectionId, at);
  throw new CheckInError('ACTION_PROOF_USED', 'Action proof could not be consumed.', 409, true);
}
