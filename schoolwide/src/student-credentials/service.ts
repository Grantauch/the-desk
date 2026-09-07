import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';
import { hashOpaqueValue } from './crypto.js';
import { StudentPinCredentialStore } from './credentials.js';
import { ActionProofService } from './proofs.js';
import { StudentPinAttemptControl, type AttemptControlOptions } from './throttle.js';
import { StudentCredentialError, type ConsumedActionProof, type CreatedActionProof, type StudentAction, type StudentIdentityProvider } from './types.js';

const PIN_PATTERN = /^\d{6}$/;

interface StudentRow extends QueryResultRow {
  id: string;
  school_id: string;
}

export type StudentCredentialServiceOptions = AttemptControlOptions & {
  pepper?: string;
  legacyPinSalt?: string;
  proofTtlMs?: number;
  now?: () => Date;
};

export class StudentCredentialService {
  readonly #database: Database;
  readonly #identityProvider: StudentIdentityProvider;
  readonly #credentials: StudentPinCredentialStore;
  readonly #attempts: StudentPinAttemptControl;
  readonly #proofs: ActionProofService;
  readonly #now: () => Date;

  constructor(database: Database, identityProvider: StudentIdentityProvider, options: StudentCredentialServiceOptions = {}) {
    this.#database = database;
    this.#identityProvider = identityProvider;
    this.#credentials = new StudentPinCredentialStore(database, {
      ...(options.pepper === undefined ? {} : { pepper: options.pepper }),
      ...(options.legacyPinSalt === undefined ? {} : { legacyPinSalt: options.legacyPinSalt }),
    });
    this.#attempts = new StudentPinAttemptControl(database, {
      ...(options.maxFailures === undefined ? {} : { maxFailures: options.maxFailures }),
      ...(options.attemptWindowMs === undefined ? {} : { attemptWindowMs: options.attemptWindowMs }),
      ...(options.throttleBlockMs === undefined ? {} : { throttleBlockMs: options.throttleBlockMs }),
    });
    this.#proofs = new ActionProofService(database, options.proofTtlMs);
    this.#now = options.now ?? (() => new Date());
  }

  async provisionPin(studentId: string, pin: string): Promise<{ credentialId: string; credentialVersion: number }> {
    this.#assertPin(pin);
    const student = await this.#requireActiveStudent(studentId);
    const credential = await this.#credentials.provision(student.id, student.school_id, pin);
    return { credentialId: credential.id, credentialVersion: credential.version };
  }

  async provisionLegacyCompatibilityPin(studentId: string, pin: string): Promise<{ credentialId: string; credentialVersion: number }> {
    this.#assertPin(pin);
    const student = await this.#requireActiveStudent(studentId);
    const credential = await this.#credentials.provisionLegacyCompatibility(student.id, student.school_id, pin);
    return { credentialId: credential.id, credentialVersion: credential.version };
  }

  async rotatePin(studentId: string, newPin: string): Promise<{ credentialId: string; credentialVersion: number }> {
    this.#assertPin(newPin);
    const student = await this.#requireActiveStudent(studentId);
    const credential = await this.#credentials.rotate(student.id, student.school_id, newPin, this.#now());
    await this.#database.query(
      'DELETE FROM student_credential_attempt_state WHERE school_id = $1 AND student_id = $2',
      [student.school_id, student.id],
    );
    return { credentialId: credential.id, credentialVersion: credential.version };
  }

  async authorizeAction(input: {
    identityAssertion: string;
    pin: string;
    action: StudentAction;
    sectionId?: string;
    clientAttemptNonce?: string;
    correlationId: string;
  }): Promise<CreatedActionProof> {
    if (!input.identityAssertion.trim()) throw new StudentCredentialError('STUDENT_AUTH_REQUIRED', 'Student identity is required.', 401);
    this.#assertPin(input.pin);
    const identity = await this.#identityProvider.verify(input.identityAssertion);
    if (!identity.studentId.trim() || !identity.subject.trim()) throw new StudentCredentialError('STUDENT_AUTH_REQUIRED', 'Student identity is invalid.', 401);

    const student = await this.#requireActiveStudent(identity.studentId);
    const at = this.#now();
    const nonceHash = input.clientAttemptNonce ? hashOpaqueValue(input.clientAttemptNonce) : null;
    await this.#attempts.enforce(student.school_id, student.id, at, input.correlationId, nonceHash);

    if (input.sectionId !== undefined) await this.#requireActiveMembership(student, input.sectionId);

    const credential = await this.#credentials.verify(student.id, student.school_id, input.pin, at);
    if (!credential) {
      await this.#attempts.failure(student.school_id, student.id, at, input.correlationId, nonceHash);
      throw new StudentCredentialError('PIN_INVALID', 'PIN is invalid.', 401);
    }

    await this.#attempts.success(student.school_id, student.id, at, input.correlationId, nonceHash);
    return this.#proofs.issue(credential, input.action, input.sectionId ?? null, at, input.correlationId);
  }

  async consumeActionProof(input: {
    proof: string;
    studentId: string;
    action: StudentAction;
    sectionId?: string;
  }): Promise<ConsumedActionProof> {
    return this.#proofs.consume({ ...input, at: this.#now() });
  }

  async #requireActiveStudent(studentId: string): Promise<StudentRow> {
    const rows = await this.#database.query<StudentRow>(
      `SELECT id, school_id FROM students WHERE id = $1 AND status = 'ACTIVE'`,
      [studentId],
    );
    const row = rows[0];
    if (rows.length !== 1 || !row) throw new StudentCredentialError('STUDENT_AUTH_REQUIRED', 'Student identity is not active.', 401);
    return row;
  }

  async #requireActiveMembership(student: StudentRow, sectionId: string): Promise<void> {
    const rows = await this.#database.query<QueryResultRow>(
      `SELECT e.id
         FROM enrollments e
         JOIN sections sec ON sec.school_id = e.school_id AND sec.id = e.section_id AND sec.status = 'ACTIVE'
        WHERE e.school_id = $1 AND e.student_id = $2 AND e.section_id = $3 AND e.status = 'ACTIVE'
        LIMIT 1`,
      [student.school_id, student.id, sectionId],
    );
    if (!rows[0]) throw new StudentCredentialError('ACTION_WRONG_CONTEXT', 'Action context is not available.', 403);
  }

  #assertPin(pin: string): void {
    if (!PIN_PATTERN.test(pin)) throw new StudentCredentialError('PIN_INVALID', 'PIN is invalid.', 401);
  }
}
