import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { hashOpaqueValue } from '../student-credentials/crypto.js';
import { HallPassError } from './types.js';

export interface ActionProofState extends QueryResultRow {
  id: string;
  organization_id: string;
  school_id: string;
  student_id: string;
  action_type: 'PASS_REQUEST' | 'RETURN' | string;
  context_section_id: string | null;
  credential_version: number;
  expires_at: Date;
  consumed_at: Date | null;
  current_credential_version: number | null;
}

export function proofHash(proof: string): string {
  if (!proof.trim()) throw new HallPassError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
  return hashOpaqueValue(proof);
}

export async function loadActionProof(executor: QueryExecutor, tokenHash: string): Promise<ActionProofState> {
  const rows = await executor.query<ActionProofState>(
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
  if (!row) throw new HallPassError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
  return row;
}

export function validateActionProof(
  state: ActionProofState,
  action: 'PASS_REQUEST' | 'RETURN',
  at: Date,
  sectionId?: string,
): void {
  if (state.consumed_at) throw new HallPassError('ACTION_PROOF_USED', 'Action proof has already been used.', 409);
  if (state.expires_at.getTime() <= at.getTime()) throw new HallPassError('ACTION_PROOF_EXPIRED', 'Action proof has expired.', 401);
  if (state.action_type !== action) throw new HallPassError('ACTION_WRONG_CONTEXT', 'Action proof does not match this protected action.', 403);
  if (action === 'PASS_REQUEST') {
    if (!sectionId || state.context_section_id !== sectionId) {
      throw new HallPassError('ACTION_WRONG_CONTEXT', 'Action proof does not match this pass-request section.', 403);
    }
  } else if (sectionId && state.context_section_id !== null && state.context_section_id !== sectionId) {
    throw new HallPassError('ACTION_WRONG_CONTEXT', 'Action proof does not match the active pass section.', 403);
  }
  if (state.current_credential_version === null || state.current_credential_version !== state.credential_version) {
    throw new HallPassError('ACTION_CREDENTIAL_ROTATED', 'Action proof was invalidated by credential rotation.', 401);
  }
}

export async function consumeActionProof(
  executor: QueryExecutor,
  tokenHash: string,
  state: ActionProofState,
  action: 'PASS_REQUEST' | 'RETURN',
  at: Date,
  sectionId?: string,
): Promise<void> {
  const rows = await executor.query<{ id: string } & QueryResultRow>(
    `UPDATE action_proofs ap
        SET consumed_at = $4::timestamptz
       FROM student_credentials sc
      WHERE ap.id = $1
        AND ap.action_type = $2
        AND ($3::uuid IS NULL OR ap.context_section_id IS NULL OR ap.context_section_id = $3::uuid)
        AND ap.consumed_at IS NULL
        AND ap.expires_at > $4::timestamptz
        AND sc.school_id = ap.school_id
        AND sc.id = ap.credential_id
        AND sc.student_id = ap.student_id
        AND sc.status = 'ACTIVE'
        AND sc.credential_version = ap.credential_version
      RETURNING ap.id`,
    [state.id, action, sectionId ?? null, at.toISOString()],
  );
  if (rows[0]) return;
  const refreshed = await loadActionProof(executor, tokenHash);
  validateActionProof(refreshed, action, at, sectionId);
  throw new HallPassError('ACTION_PROOF_USED', 'Action proof could not be consumed.', 409, true);
}
