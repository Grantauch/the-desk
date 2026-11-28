import { randomBytes } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';
import { hashOpaqueValue } from './crypto.js';
import { StudentCredentialError, type ConsumedActionProof, type CreatedActionProof, type StudentAction } from './types.js';
import type { CredentialRef } from './credentials.js';

interface ProofStateRow extends QueryResultRow {
  id: string;
  school_id: string;
  student_id: string;
  action_type: StudentAction;
  context_section_id: string | null;
  credential_version: number;
  expires_at: Date;
  consumed_at: Date | null;
  current_credential_version: number | null;
}

interface ConsumedProofRow extends QueryResultRow {
  id: string;
  school_id: string;
  student_id: string;
  action_type: StudentAction;
  context_section_id: string | null;
  credential_version: number;
  consumed_at: Date;
}

export class ActionProofService {
  readonly #database: Database;
  readonly #ttlMs: number;

  constructor(database: Database, ttlMs = 90_000) {
    if (!Number.isInteger(ttlMs) || ttlMs < 100 || ttlMs > 5 * 60_000) throw new Error('Action proof TTL is invalid.');
    this.#database = database;
    this.#ttlMs = ttlMs;
  }

  async issue(
    credential: CredentialRef,
    action: StudentAction,
    sectionId: string | null,
    issuedAt: Date,
    requestId: string,
  ): Promise<CreatedActionProof> {
    const proof = randomBytes(32).toString('base64url');
    const expiresAt = new Date(issuedAt.getTime() + this.#ttlMs);
    const rows = await this.#database.query<{ id: string } & QueryResultRow>(
      `INSERT INTO action_proofs
         (school_id, student_id, action_type, context_section_id, credential_id,
          credential_version, token_hash, issued_at, expires_at, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10)
       RETURNING id`,
      [credential.schoolId, credential.studentId, action, sectionId, credential.id, credential.version,
        hashOpaqueValue(proof), issuedAt.toISOString(), expiresAt.toISOString(), requestId],
    );
    const row = rows[0];
    if (!row) throw new Error('Unable to create action proof.');
    return {
      proofId: row.id,
      proof,
      studentId: credential.studentId,
      schoolId: credential.schoolId,
      action,
      sectionId,
      credentialVersion: credential.version,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async consume(input: {
    proof: string;
    studentId: string;
    action: StudentAction;
    sectionId?: string;
    at: Date;
  }): Promise<ConsumedActionProof> {
    if (!input.proof.trim()) throw new StudentCredentialError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
    const tokenHash = hashOpaqueValue(input.proof);
    const sectionId = input.sectionId ?? null;
    const rows = await this.#database.query<ConsumedProofRow>(
      `UPDATE action_proofs ap
          SET consumed_at = $5::timestamptz
         FROM student_credentials sc
        WHERE ap.token_hash = $1
          AND ap.student_id = $2
          AND ap.action_type = $3
          AND ap.context_section_id IS NOT DISTINCT FROM $4::uuid
          AND ap.consumed_at IS NULL
          AND ap.expires_at > $5::timestamptz
          AND sc.school_id = ap.school_id
          AND sc.id = ap.credential_id
          AND sc.student_id = ap.student_id
          AND sc.status = 'ACTIVE'
          AND sc.credential_version = ap.credential_version
        RETURNING ap.id, ap.school_id, ap.student_id, ap.action_type,
                  ap.context_section_id, ap.credential_version, ap.consumed_at`,
      [tokenHash, input.studentId, input.action, sectionId, input.at.toISOString()],
    );
    const row = rows[0];
    if (row) {
      return {
        proofId: row.id,
        studentId: row.student_id,
        schoolId: row.school_id,
        action: row.action_type,
        sectionId: row.context_section_id,
        credentialVersion: row.credential_version,
        consumedAt: row.consumed_at.toISOString(),
      };
    }
    return this.#throwFailure(tokenHash, input.studentId, input.action, sectionId, input.at);
  }

  async #throwFailure(tokenHash: string, studentId: string, action: StudentAction, sectionId: string | null, at: Date): Promise<never> {
    const rows = await this.#database.query<ProofStateRow>(
      `SELECT ap.id, ap.school_id, ap.student_id, ap.action_type, ap.context_section_id,
              ap.credential_version, ap.expires_at, ap.consumed_at,
              sc.credential_version AS current_credential_version
         FROM action_proofs ap
         LEFT JOIN student_credentials sc
           ON sc.school_id = ap.school_id AND sc.id = ap.credential_id
          AND sc.student_id = ap.student_id AND sc.status = 'ACTIVE'
        WHERE ap.token_hash = $1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) throw new StudentCredentialError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
    if (row.consumed_at) throw new StudentCredentialError('ACTION_PROOF_USED', 'Action proof has already been used.', 409);
    if (row.expires_at.getTime() <= at.getTime()) throw new StudentCredentialError('ACTION_PROOF_EXPIRED', 'Action proof has expired.', 401);
    if (row.student_id !== studentId || row.action_type !== action || row.context_section_id !== sectionId) {
      throw new StudentCredentialError('ACTION_WRONG_CONTEXT', 'Action proof does not match this action context.', 403);
    }
    if (row.current_credential_version === null || row.current_credential_version !== row.credential_version) {
      throw new StudentCredentialError('ACTION_CREDENTIAL_ROTATED', 'Action proof was invalidated by credential rotation.', 401);
    }
    throw new StudentCredentialError('ACTION_PROOF_INVALID', 'Action proof is invalid.', 401);
  }
}
