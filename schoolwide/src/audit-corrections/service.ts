import { createHash } from 'node:crypto';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import { completeIdempotent, startIdempotent } from './idempotency.js';
import { effectiveCountability, loadCorrectablePass, loadPassHistory, writeCorrectionEvidence, writeStaffOverrideEvidence } from './persistence.js';
import { AuditCorrectionError, type AuditCorrectionServiceOptions, type EffectiveCountability, type PassCorrectionResult, type PassHistoryResult } from './types.js';

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const CORRECTION_OPERATION = 'STAFF_PASS_CORRECTION';
const OVERRIDE_EVIDENCE_OPERATION = 'STAFF_OVERRIDE_EVIDENCE';

function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isPassCorrectionResult(value: unknown): value is PassCorrectionResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.correctionId === 'string' && typeof row.passId === 'string' && typeof row.studentId === 'string'
    && typeof row.sectionId === 'string' && (row.correctionType === 'VOID_COUNTABILITY' || row.correctionType === 'RESTORE_COUNTABILITY')
    && typeof row.correctedAt === 'string';
}

function requireCompletedOriginalCountability(value: string): EffectiveCountability {
  if (value === 'COUNTABLE' || value === 'NON_COUNTABLE' || value === 'UNKNOWN_REVIEW') return value;
  throw new AuditCorrectionError('PASS_NOT_CORRECTABLE', 'Only completed pass evidence can be corrected.', 409);
}

export class AuditCorrectionService {
  readonly #database: Database;
  readonly #now: () => Date;
  readonly #idempotencyTtlMs: number;

  constructor(database: Database, options: AuditCorrectionServiceOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#idempotencyTtlMs = options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    if (!Number.isInteger(this.#idempotencyTtlMs) || this.#idempotencyTtlMs < 60_000 || this.#idempotencyTtlMs > 7 * 24 * 60 * 60_000) {
      throw new Error('Audit correction idempotency TTL is invalid.');
    }
  }

  async passScope(passId: string): Promise<{ organizationId: string; schoolId: string; sectionId: string; studentId: string }> {
    const pass = await loadCorrectablePass(this.#database, passId);
    return { organizationId: pass.organization_id, schoolId: pass.school_id, sectionId: pass.section_id, studentId: pass.student_id };
  }

  async correctPass(input: {
    actorUserId: string;
    passId: string;
    correctionType: 'VOID_COUNTABILITY' | 'RESTORE_COUNTABILITY';
    reasonPrivate: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<PassCorrectionResult> {
    const database = this.#transactionalDatabase();
    const at = this.#now();
    return database.transaction(async (transaction) => {
      const pass = await loadCorrectablePass(transaction, input.passId, true);
      const originalCountability = requireCompletedOriginalCountability(pass.countability);
      const currentEffective = await effectiveCountability(transaction, pass);
      if (currentEffective === 'PROVISIONAL') throw new AuditCorrectionError('PASS_NOT_CORRECTABLE', 'Active pass evidence cannot be corrected.', 409);
      const idempotency = await startIdempotent(transaction, {
        organizationId: pass.organization_id,
        schoolId: pass.school_id,
        key: input.idempotencyKey,
        operation: CORRECTION_OPERATION,
        fingerprint: fingerprint(`${CORRECTION_OPERATION}\u0000${input.actorUserId}\u0000${input.passId}\u0000${input.correctionType}\u0000${input.reasonPrivate.trim()}`),
        correlationId: input.correlationId,
        at,
        ttlMs: this.#idempotencyTtlMs,
        validateResponse: isPassCorrectionResult,
      });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;

      if (input.correctionType === 'RESTORE_COUNTABILITY') {
        throw new AuditCorrectionError('CORRECTION_POLICY_REQUIRED', 'Restoring countability requires an explicit school policy that is not configured.', 409);
      }
      if (currentEffective === 'NON_COUNTABLE') {
        throw new AuditCorrectionError('PASS_CORRECTION_NO_CHANGE', 'This pass is already non-countable.', 409);
      }
      const resulting: EffectiveCountability = 'NON_COUNTABLE';
      const correctionId = await writeCorrectionEvidence(transaction, {
        organizationId: pass.organization_id,
        schoolId: pass.school_id,
        actorUserId: input.actorUserId,
        studentId: pass.student_id,
        sectionId: pass.section_id,
        passId: pass.id,
        correctionType: input.correctionType,
        reasonPrivate: input.reasonPrivate.trim(),
        priorCountability: currentEffective,
        resultingCountability: resulting,
        correlationId: input.correlationId,
        occurredAt: at,
      });
      const response: PassCorrectionResult = {
        correctionId,
        passId: pass.id,
        studentId: pass.student_id,
        sectionId: pass.section_id,
        correctionType: input.correctionType,
        originalCountability,
        priorEffectiveCountability: currentEffective,
        resultingEffectiveCountability: resulting,
        correctedAt: at.toISOString(),
      };
      await completeIdempotent(transaction, idempotency.id, response, at, 201);
      return response;
    });
  }

  async recordStaffOverrideEvidence(input: {
    organizationId: string;
    schoolId: string;
    actorUserId: string;
    studentId?: string;
    sectionId?: string;
    passId?: string;
    actionType: string;
    restrictionsBypassed: readonly string[];
    reasonPrivate: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<{ actionId: string; recordedAt: string }> {
    const database = this.#transactionalDatabase(); const at = this.#now();
    return database.transaction(async (transaction: QueryExecutor) => {
      const state = await startIdempotent(transaction, {
        organizationId: input.organizationId, schoolId: input.schoolId, key: input.idempotencyKey,
        operation: OVERRIDE_EVIDENCE_OPERATION,
        fingerprint: fingerprint(`${OVERRIDE_EVIDENCE_OPERATION}\u0000${input.actorUserId}\u0000${input.actionType}\u0000${JSON.stringify(input.restrictionsBypassed)}\u0000${input.reasonPrivate.trim()}`),
        correlationId: input.correlationId, at, ttlMs: this.#idempotencyTtlMs,
        validateResponse: (value): value is { actionId: string; recordedAt: string } => !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).actionId === 'string' && typeof (value as Record<string, unknown>).recordedAt === 'string',
      });
      if (state.kind === 'COMPLETED') return state.response;
      const actionId = await writeStaffOverrideEvidence(transaction, {
        organizationId: input.organizationId, schoolId: input.schoolId, actorUserId: input.actorUserId,
        ...(input.studentId === undefined ? {} : { studentId: input.studentId }),
        ...(input.sectionId === undefined ? {} : { sectionId: input.sectionId }),
        ...(input.passId === undefined ? {} : { passId: input.passId }),
        actionType: input.actionType, restrictionsBypassed: input.restrictionsBypassed,
        reasonPrivate: input.reasonPrivate.trim(), correlationId: input.correlationId, occurredAt: at,
      });
      const response = { actionId, recordedAt: at.toISOString() };
      await completeIdempotent(transaction, state.id, response, at, 201);
      return response;
    });
  }

  async passHistory(passId: string, limit = 50): Promise<PassHistoryResult> {
    const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const pass = await loadCorrectablePass(this.#database, passId);
    const effective = await effectiveCountability(this.#database, pass);
    const original = pass.status === 'OUT' ? 'PROVISIONAL' : requireCompletedOriginalCountability(pass.countability);
    const items = await loadPassHistory(this.#database, pass, boundedLimit);
    return { passId: pass.id, studentId: pass.student_id, sectionId: pass.section_id, originalCountability: original, effectiveCountability: effective, items: [...items] };
  }

  #transactionalDatabase() {
    if (!supportsTransactions(this.#database)) throw new Error('Audit/correction mutations require a transactional database implementation.');
    return this.#database;
  }
}
