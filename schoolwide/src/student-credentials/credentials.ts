import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';
import {
  createLegacyCompatibilityHash,
  createStrongPinVerifier,
  LEGACY_VERIFIER_SCHEME,
  STRONG_VERIFIER_SCHEME,
  verifyLegacyCompatibilityHash,
  verifyStrongPin,
} from './crypto.js';
import { StudentCredentialError } from './types.js';

export type CredentialRef = {
  id: string;
  schoolId: string;
  studentId: string;
  version: number;
};

interface CredentialRow extends QueryResultRow {
  id: string;
  school_id: string;
  student_id: string;
  verifier_scheme: typeof STRONG_VERIFIER_SCHEME | typeof LEGACY_VERIFIER_SCHEME;
  secret_hash: string;
  secret_salt: string | null;
  credential_version: number;
}

export class StudentPinCredentialStore {
  readonly #database: Database;
  readonly #pepper: string | null;
  readonly #legacyPinSalt: string | null;

  constructor(database: Database, options: { pepper?: string; legacyPinSalt?: string } = {}) {
    this.#database = database;
    this.#pepper = options.pepper ?? null;
    this.#legacyPinSalt = options.legacyPinSalt ?? null;
    if (this.#pepper !== null && this.#pepper.length < 16) {
      throw new Error('Schoolwide student PIN pepper must be at least 16 characters when configured.');
    }
    if (this.#legacyPinSalt !== null && this.#legacyPinSalt.length < 8) {
      throw new Error('Legacy compatibility salt must be at least 8 characters when configured.');
    }
  }

  async provision(studentId: string, schoolId: string, pin: string): Promise<CredentialRef> {
    const strong = await createStrongPinVerifier(pin, this.#requirePepper());
    const rows = await this.#database.query<{ id: string; credential_version: number } & QueryResultRow>(
      `INSERT INTO student_credentials
         (school_id, student_id, verifier_scheme, secret_hash, secret_salt, verifier_params)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, credential_version`,
      [schoolId, studentId, STRONG_VERIFIER_SCHEME, strong.hash, strong.salt, JSON.stringify(strong.params)],
    );
    const row = rows[0];
    if (!row) throw new Error('Unable to provision student credential.');
    return { id: row.id, schoolId, studentId, version: row.credential_version };
  }

  async provisionLegacyCompatibility(studentId: string, schoolId: string, pin: string): Promise<CredentialRef> {
    const rows = await this.#database.query<{ id: string; credential_version: number } & QueryResultRow>(
      `INSERT INTO student_credentials
         (school_id, student_id, verifier_scheme, secret_hash, verifier_params)
       VALUES ($1, $2, $3, $4, '{"compatibilityOnly":true}'::jsonb)
       RETURNING id, credential_version`,
      [schoolId, studentId, LEGACY_VERIFIER_SCHEME, createLegacyCompatibilityHash(pin, this.#requireLegacySalt())],
    );
    const row = rows[0];
    if (!row) throw new Error('Unable to provision legacy compatibility credential.');
    return { id: row.id, schoolId, studentId, version: row.credential_version };
  }

  async verify(studentId: string, schoolId: string, pin: string, at: Date): Promise<CredentialRef | null> {
    const rows = await this.#database.query<CredentialRow>(
      `SELECT id, school_id, student_id, verifier_scheme, secret_hash, secret_salt, credential_version
         FROM student_credentials
        WHERE school_id = $1 AND student_id = $2 AND credential_type = 'PIN' AND status = 'ACTIVE'`,
      [schoolId, studentId],
    );
    let row = rows[0];
    if (rows.length !== 1 || !row) return null;

    const valid = row.verifier_scheme === STRONG_VERIFIER_SCHEME
      ? row.secret_salt !== null && await verifyStrongPin(pin, this.#requirePepper(), row.secret_salt, row.secret_hash)
      : verifyLegacyCompatibilityHash(pin, this.#requireLegacySalt(), row.secret_hash);
    if (!valid) return null;

    if (row.verifier_scheme === LEGACY_VERIFIER_SCHEME) {
      row = await this.#upgradeLegacy(row, pin, at);
    }
    return { id: row.id, schoolId: row.school_id, studentId: row.student_id, version: row.credential_version };
  }

  async rotate(studentId: string, schoolId: string, pin: string, at: Date): Promise<CredentialRef> {
    const strong = await createStrongPinVerifier(pin, this.#requirePepper());
    const rows = await this.#database.query<{ id: string; credential_version: number } & QueryResultRow>(
      `UPDATE student_credentials
          SET verifier_scheme = $3, secret_hash = $4, secret_salt = $5,
              verifier_params = $6::jsonb, credential_version = credential_version + 1,
              rotated_at = $7::timestamptz
        WHERE school_id = $1 AND student_id = $2 AND credential_type = 'PIN' AND status = 'ACTIVE'
        RETURNING id, credential_version`,
      [schoolId, studentId, STRONG_VERIFIER_SCHEME, strong.hash, strong.salt, JSON.stringify(strong.params), at.toISOString()],
    );
    const row = rows[0];
    if (rows.length !== 1 || !row) throw new StudentCredentialError('PIN_INVALID', 'Student credential is unavailable.', 401);
    return { id: row.id, schoolId, studentId, version: row.credential_version };
  }

  async #upgradeLegacy(row: CredentialRow, pin: string, at: Date): Promise<CredentialRow> {
    const strong = await createStrongPinVerifier(pin, this.#requirePepper());
    const upgraded = await this.#database.query<CredentialRow>(
      `UPDATE student_credentials
          SET verifier_scheme = $4, secret_hash = $5, secret_salt = $6,
              verifier_params = $7::jsonb, credential_version = credential_version + 1,
              rotated_at = $8::timestamptz
        WHERE school_id = $1 AND id = $2 AND student_id = $3
          AND credential_version = $9 AND verifier_scheme = $10 AND status = 'ACTIVE'
        RETURNING id, school_id, student_id, verifier_scheme, secret_hash, secret_salt, credential_version`,
      [row.school_id, row.id, row.student_id, STRONG_VERIFIER_SCHEME, strong.hash, strong.salt,
        JSON.stringify(strong.params), at.toISOString(), row.credential_version, LEGACY_VERIFIER_SCHEME],
    );
    if (upgraded[0]) return upgraded[0];
    const current = await this.#database.query<CredentialRow>(
      `SELECT id, school_id, student_id, verifier_scheme, secret_hash, secret_salt, credential_version
         FROM student_credentials WHERE school_id = $1 AND id = $2 AND student_id = $3 AND status = 'ACTIVE'`,
      [row.school_id, row.id, row.student_id],
    );
    if (!current[0] || current[0].verifier_scheme !== STRONG_VERIFIER_SCHEME) {
      throw new StudentCredentialError('CREDENTIAL_SERVICE_UNAVAILABLE', 'Credential upgrade could not be completed.', 503, true);
    }
    return current[0];
  }

  #requirePepper(): string {
    if (!this.#pepper) throw new StudentCredentialError('CREDENTIAL_SERVICE_UNAVAILABLE', 'Student credential service is not configured.', 503, true);
    return this.#pepper;
  }

  #requireLegacySalt(): string {
    if (!this.#legacyPinSalt) throw new StudentCredentialError('CREDENTIAL_SERVICE_UNAVAILABLE', 'Legacy credential compatibility is not configured.', 503, true);
    return this.#legacyPinSalt;
  }
}
