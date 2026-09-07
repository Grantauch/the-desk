import type { QueryResultRow } from 'pg';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import { SchedulePolicyService } from '../schedule-policy/service.js';
import type { SchedulePolicyContext } from '../schedule-policy/types.js';
import { hashOpaqueValue } from '../student-credentials/crypto.js';
import { completeIdempotentCheckIn, startIdempotentCheckIn } from './idempotency.js';
import {
  calculateSchoolDayStreak,
  createOrReadCheckIn,
  requireActiveEnrollment,
  toCheckInRecord,
  writeCheckInEvidence,
} from './persistence.js';
import {
  checkInProofHash,
  consumeCheckInProof,
  loadCheckInProof,
  validateCheckInProof,
} from './proof-consumer.js';
import { CheckInError, type CheckInRecord, type CheckInServiceOptions } from './types.js';

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const CHECKIN_OPERATION = 'STUDENT_CHECKIN';
const TEACHER_OPERATION = 'TEACHER_CHECKIN_BACKUP';

interface BackupSectionRow extends QueryResultRow {
  organization_id: string;
  school_id: string;
  timezone: string;
}

class TransactionReadDatabase implements Database {
  readonly #executor: QueryExecutor;

  constructor(executor: QueryExecutor) {
    this.#executor = executor;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    return this.#executor.query<T>(sql, parameters);
  }

  async close(): Promise<void> {
    // Transaction owner controls the underlying connection.
  }
}

function parseTimeSeconds(value: string): number | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
}

function checkInWindowMinutes(context: SchedulePolicyContext): number {
  if (context.session.status !== 'IN_SESSION') {
    throw new CheckInError('CLASS_NOT_IN_SESSION', 'Check-In is available only during the active class session.', 409);
  }
  if (!context.policy || context.policy.status !== 'RESOLVED') {
    throw new CheckInError('CHECKIN_POLICY_UNAVAILABLE', 'Check-In policy is unavailable.', 503, true);
  }
  const value = context.policy.values.CHECKIN_WINDOW_MINUTES?.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new CheckInError('CHECKIN_POLICY_UNAVAILABLE', 'Check-In window policy is unavailable.', 503, true);
  }
  return value;
}

function assertStudentWindowOpen(context: SchedulePolicyContext): void {
  const windowMinutes = checkInWindowMinutes(context);
  if (context.session.status !== 'IN_SESSION') return;
  const start = parseTimeSeconds(context.session.period.startsAtLocal);
  const end = parseTimeSeconds(context.session.period.endsAtLocal);
  if (start === null || end === null || end <= start) {
    throw new CheckInError('CHECKIN_POLICY_UNAVAILABLE', 'Check-In schedule is unavailable.', 503, true);
  }
  const windowEnd = Math.min(end, start + windowMinutes * 60);
  const now = context.session.clock.localSecondOfDay;
  if (now < start || now >= windowEnd) {
    throw new CheckInError('CHECKIN_WINDOW_CLOSED', 'Check-In window is closed for this class.', 409);
  }
}

function localAcademicDate(at: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const values = new Map(formatter.formatToParts(at).map((part) => [part.type, part.value]));
    const year = values.get('year');
    const month = values.get('month');
    const day = values.get('day');
    if (!year || !month || !day) throw new Error('date unavailable');
    return `${year}-${month}-${day}`;
  } catch {
    throw new CheckInError('TEACHER_BACKUP_UNAVAILABLE', 'School calendar is unavailable for teacher backup.', 503, true);
  }
}

export class CheckInService {
  readonly #database: Database;
  readonly #now: () => Date;
  readonly #idempotencyTtlMs: number;

  constructor(database: Database, options: CheckInServiceOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#idempotencyTtlMs = options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    if (!Number.isInteger(this.#idempotencyTtlMs) || this.#idempotencyTtlMs < 60_000 || this.#idempotencyTtlMs > 7 * 24 * 60 * 60_000) {
      throw new Error('Check-In idempotency TTL is invalid.');
    }
  }

  async studentCheckIn(input: {
    actionProof: string;
    sectionId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<CheckInRecord> {
    const database = this.#transactionalDatabase();
    const at = this.#now();
    const tokenHash = checkInProofHash(input.actionProof);

    return database.transaction(async (transaction) => {
      const proof = await loadCheckInProof(transaction, tokenHash);
      const fingerprint = hashOpaqueValue(`${CHECKIN_OPERATION}\u0000${input.sectionId}\u0000${tokenHash}`);
      const idempotency = await startIdempotentCheckIn(transaction, {
        organizationId: proof.organization_id,
        schoolId: proof.school_id,
        key: input.idempotencyKey,
        operation: CHECKIN_OPERATION,
        fingerprint,
        correlationId: input.correlationId,
        at,
        ttlMs: this.#idempotencyTtlMs,
      });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;

      validateCheckInProof(proof, input.sectionId, at);
      const enrollment = await requireActiveEnrollment(transaction, proof.school_id, proof.student_id, input.sectionId);
      const schedulePolicy = new SchedulePolicyService(new TransactionReadDatabase(transaction));
      const context = await schedulePolicy.resolveContext({ sectionId: input.sectionId, studentId: proof.student_id, at });
      assertStudentWindowOpen(context);
      if (context.session.status !== 'IN_SESSION') {
        throw new CheckInError('CLASS_NOT_IN_SESSION', 'Check-In is available only during the active class session.', 409);
      }
      if (context.session.schoolId !== proof.school_id) {
        throw new CheckInError('ACTION_WRONG_CONTEXT', 'Action proof does not match this school context.', 403);
      }

      await consumeCheckInProof(transaction, tokenHash, proof, input.sectionId, at);
      const result = await createOrReadCheckIn(transaction, {
        organizationId: proof.organization_id,
        schoolId: proof.school_id,
        studentId: proof.student_id,
        sectionId: input.sectionId,
        enrollmentId: enrollment.id,
        academicDate: context.session.clock.academicDate,
        checkedInAt: at,
        authorizationMethod: 'STUDENT_PIN_PROOF',
        identityMethod: 'STUDENT_IDENTITY_PROVIDER',
        actorUserId: null,
        actionProofId: proof.id,
        notePrivate: null,
        requestId: input.correlationId,
      });
      if (result.created) {
        await writeCheckInEvidence(transaction, {
          organizationId: proof.organization_id,
          schoolId: proof.school_id,
          studentId: proof.student_id,
          sectionId: input.sectionId,
          enrollmentId: enrollment.id,
          checkInId: result.row.id,
          academicDate: context.session.clock.academicDate,
          checkedInAt: at,
          actorKind: 'STUDENT',
          actorUserId: null,
          authorizationMethod: 'STUDENT_PIN_PROOF',
          correlationId: input.correlationId,
        });
      }
      const streak = await calculateSchoolDayStreak(transaction, proof.school_id, proof.student_id, context.session.clock.academicDate);
      const response = toCheckInRecord(result.row, result.created, streak);
      await completeIdempotentCheckIn(transaction, idempotency.id, response, at, result.created ? 201 : 200);
      return response;
    });
  }

  async teacherBackupCheckIn(input: {
    actorUserId: string;
    sectionId: string;
    studentId: string;
    note?: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<CheckInRecord> {
    const database = this.#transactionalDatabase();
    const at = this.#now();
    const note = input.note?.trim() ? input.note.trim().slice(0, 1000) : null;

    return database.transaction(async (transaction) => {
      const sections = await transaction.query<BackupSectionRow>(
        `SELECT s.organization_id, sec.school_id, s.timezone
           FROM sections sec
           JOIN schools s ON s.id = sec.school_id AND s.status = 'ACTIVE'
          WHERE sec.id = $1 AND sec.status = 'ACTIVE'`,
        [input.sectionId],
      );
      const section = sections[0];
      if (!section) throw new CheckInError('TEACHER_BACKUP_UNAVAILABLE', 'Section is unavailable.', 404);

      const fingerprint = hashOpaqueValue(`${TEACHER_OPERATION}\u0000${input.sectionId}\u0000${input.studentId}\u0000${hashOpaqueValue(note ?? '')}`);
      const idempotency = await startIdempotentCheckIn(transaction, {
        organizationId: section.organization_id,
        schoolId: section.school_id,
        key: input.idempotencyKey,
        operation: TEACHER_OPERATION,
        fingerprint,
        correlationId: input.correlationId,
        at,
        ttlMs: this.#idempotencyTtlMs,
      });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;

      const enrollment = await requireActiveEnrollment(transaction, section.school_id, input.studentId, input.sectionId);
      const academicDate = localAcademicDate(at, section.timezone);
      const calendar = await transaction.query<{ id: string } & QueryResultRow>(
        `SELECT id FROM school_calendar_days
          WHERE school_id = $1 AND academic_date = $2::date AND is_school_day = true
          LIMIT 1`,
        [section.school_id, academicDate],
      );
      if (!calendar[0]) {
        throw new CheckInError('TEACHER_BACKUP_UNAVAILABLE', 'Teacher backup requires an official school day.', 409);
      }

      const result = await createOrReadCheckIn(transaction, {
        organizationId: section.organization_id,
        schoolId: section.school_id,
        studentId: input.studentId,
        sectionId: input.sectionId,
        enrollmentId: enrollment.id,
        academicDate,
        checkedInAt: at,
        authorizationMethod: 'TEACHER_BACKUP',
        identityMethod: 'STAFF_SESSION',
        actorUserId: input.actorUserId,
        actionProofId: null,
        notePrivate: note,
        requestId: input.correlationId,
      });
      if (result.created) {
        await writeCheckInEvidence(transaction, {
          organizationId: section.organization_id,
          schoolId: section.school_id,
          studentId: input.studentId,
          sectionId: input.sectionId,
          enrollmentId: enrollment.id,
          checkInId: result.row.id,
          academicDate,
          checkedInAt: at,
          actorKind: 'USER',
          actorUserId: input.actorUserId,
          authorizationMethod: 'TEACHER_BACKUP',
          correlationId: input.correlationId,
        });
      }
      const streak = await calculateSchoolDayStreak(transaction, section.school_id, input.studentId, academicDate);
      const response = toCheckInRecord(result.row, result.created, streak);
      await completeIdempotentCheckIn(transaction, idempotency.id, response, at, result.created ? 201 : 200);
      return response;
    });
  }

  async calculateStreak(studentId: string, schoolId: string, throughAcademicDate: string): Promise<number> {
    return calculateSchoolDayStreak(this.#database, schoolId, studentId, throughAcademicDate);
  }

  #transactionalDatabase() {
    if (!supportsTransactions(this.#database)) {
      throw new Error('Check-In mutations require a transactional database implementation.');
    }
    return this.#database;
  }
}
