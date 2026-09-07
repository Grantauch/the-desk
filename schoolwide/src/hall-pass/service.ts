import type { QueryResultRow } from 'pg';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import { SchedulePolicyService } from '../schedule-policy/service.js';
import type { ResolvedPolicy, ResolvedSession, SchedulePolicyContext } from '../schedule-policy/types.js';
import { hashOpaqueValue } from '../student-credentials/crypto.js';
import { completeIdempotent, startIdempotent } from './idempotency.js';
import { lockSection, requireActiveEnrollment, requireDestination, type PassRequestRow, type PassRow, writePassEvidence } from './persistence.js';
import { consumeActionProof, loadActionProof, proofHash, validateActionProof } from './proof-consumer.js';
import { HallPassError, type HallPassServiceOptions, type PassEvidence, type PassRequestResult, type PassReturnResult, type QueueCancelResult } from './types.js';

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const MIN_COUNTABLE_DURATION_MS = 3_000;
const REQUEST_OPERATION = 'STUDENT_PASS_REQUEST';
const RETURN_OPERATION = 'STUDENT_PASS_RETURN';
const CANCEL_OPERATION = 'STUDENT_PASS_QUEUE_CANCEL';

type ResolvedContext = SchedulePolicyContext & { session: ResolvedSession; policy: ResolvedPolicy };

class TransactionReadDatabase implements Database {
  readonly #executor: QueryExecutor;
  constructor(executor: QueryExecutor) { this.#executor = executor; }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> { return this.#executor.query<T>(sql, parameters); }
  async close(): Promise<void> {}
}

interface MarkingPeriodRow extends QueryResultRow { id: string; starts_on: string | Date; ends_on: string | Date }
interface UsageRow extends QueryResultRow { term_used: number; daily_used: number; last_countable_return: Date | null }
interface QueueCandidateRow extends QueryResultRow {
  queue_id: string; pass_request_id: string; organization_id: string; school_id: string; student_id: string;
  section_id: string; enrollment_id: string; destination_id: string; action_proof_id: string;
  requested_at: Date; class_end_at: Date; queue_expires_at: Date; order_token: string;
}

function resolvedContext(context: SchedulePolicyContext): ResolvedContext {
  if (context.session.status !== 'IN_SESSION') throw new HallPassError('CLASS_NOT_IN_SESSION', 'New Hall Pass requests are available only during the active class session.', 409);
  if (!context.policy || context.policy.status !== 'RESOLVED') throw new HallPassError('PASS_POLICY_UNAVAILABLE', 'Hall Pass policy is unavailable.', 503, true);
  return context as ResolvedContext;
}

function parseTimeSeconds(value: string): number | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]); const second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
}

function numericPolicy(context: ResolvedContext, key: string): number {
  const value = context.policy.values[key]?.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new HallPassError('PASS_POLICY_UNAVAILABLE', `Hall Pass policy ${key} is unavailable.`, 503, true);
  return value;
}

function accessMode(context: ResolvedContext): 'STANDARD' | 'UNLIMITED' | 'ESCORT_ONLY' {
  const access = context.policy.studentAccess;
  if (access.status === 'CONFLICT') throw new HallPassError('PASS_ACCESS_CONFLICT', 'Pass access requires staff review.', 409);
  if (access.status === 'UNAVAILABLE') throw new HallPassError('STUDENT_NOT_AVAILABLE_IN_SECTION', 'Student is not available in this section.', 403);
  return access.status === 'RESOLVED' ? access.mode : 'STANDARD';
}

function assertRequestWindow(context: ResolvedContext): void {
  const start = parseTimeSeconds(context.session.period.startsAtLocal);
  const end = parseTimeSeconds(context.session.period.endsAtLocal);
  if (start === null || end === null || end <= start) throw new HallPassError('PASS_POLICY_UNAVAILABLE', 'Hall Pass schedule is unavailable.', 503, true);
  const now = context.session.clock.localSecondOfDay;
  if (now < start + numericPolicy(context, 'PROTECTED_FIRST_MINUTES') * 60 || now >= end - numericPolicy(context, 'PROTECTED_LAST_MINUTES') * 60) {
    throw new HallPassError('PASS_WINDOW_CLOSED', 'New Hall Pass requests are closed during the protected class window.', 409);
  }
}

function classEndInstant(context: ResolvedContext, at: Date): Date {
  const end = parseTimeSeconds(context.session.period.endsAtLocal);
  if (end === null) throw new HallPassError('PASS_POLICY_UNAVAILABLE', 'Hall Pass schedule is unavailable.', 503, true);
  const remaining = end - context.session.clock.localSecondOfDay;
  if (remaining <= 0) throw new HallPassError('CLASS_NOT_IN_SESSION', 'Class session has ended.', 409);
  return new Date(at.getTime() + Math.round(remaining * 1000));
}

function academicDateAt(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get('year'); const month = values.get('month'); const day = values.get('day');
  if (!year || !month || !day) throw new HallPassError('PASS_SERVICE_UNAVAILABLE', 'School clock is unavailable.', 503, true);
  return `${year}-${month}-${day}`;
}

function isPassRequestResult(value: unknown): value is PassRequestResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (row.outcome === 'STARTED' || row.outcome === 'QUEUED') && typeof row.passRequestId === 'string'
    && (typeof row.passId === 'string' || row.passId === null) && (typeof row.queueEntryId === 'string' || row.queueEntryId === null)
    && typeof row.studentId === 'string' && typeof row.sectionId === 'string' && typeof row.destinationId === 'string';
}
function isPassReturnResult(value: unknown): value is PassReturnResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.passId === 'string' && row.status === 'RETURNED' && typeof row.durationMs === 'number' && (row.countability === 'COUNTABLE' || row.countability === 'NON_COUNTABLE');
}
function isQueueCancelResult(value: unknown): value is QueueCancelResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.passRequestId === 'string' && row.status === 'CANCELLED';
}

export class HallPassService {
  readonly #database: Database;
  readonly #now: () => Date;
  readonly #idempotencyTtlMs: number;

  constructor(database: Database, options: HallPassServiceOptions = {}) {
    this.#database = database; this.#now = options.now ?? (() => new Date()); this.#idempotencyTtlMs = options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    if (!Number.isInteger(this.#idempotencyTtlMs) || this.#idempotencyTtlMs < 60_000 || this.#idempotencyTtlMs > 7 * 24 * 60 * 60_000) throw new Error('Hall Pass idempotency TTL is invalid.');
  }

  async requestPass(input: { actionProof: string; sectionId: string; destinationId: string; idempotencyKey: string; correlationId: string }): Promise<PassRequestResult> {
    const database = this.#transactionalDatabase(); const at = this.#now(); const tokenHash = proofHash(input.actionProof);
    return database.transaction(async (transaction) => {
      const proof = await loadActionProof(transaction, tokenHash);
      const idempotency = await startIdempotent(transaction, {
        organizationId: proof.organization_id, schoolId: proof.school_id, key: input.idempotencyKey, operation: REQUEST_OPERATION,
        fingerprint: hashOpaqueValue(`${REQUEST_OPERATION}\u0000${input.sectionId}\u0000${input.destinationId}\u0000${tokenHash}`),
        correlationId: input.correlationId, at, ttlMs: this.#idempotencyTtlMs, validateResponse: isPassRequestResult,
      });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;
      validateActionProof(proof, 'PASS_REQUEST', at, input.sectionId);
      const enrollment = await requireActiveEnrollment(transaction, proof.school_id, proof.student_id, input.sectionId);
      await requireDestination(transaction, proof.school_id, input.destinationId);
      const context = resolvedContext(await new SchedulePolicyService(new TransactionReadDatabase(transaction)).resolveContext({ sectionId: input.sectionId, studentId: proof.student_id, at }));
      if (context.session.schoolId !== proof.school_id) throw new HallPassError('ACTION_WRONG_CONTEXT', 'Action proof does not match this school context.', 403);
      assertRequestWindow(context);
      if (accessMode(context) === 'ESCORT_ONLY') throw new HallPassError('ALLOWANCE_BLOCKED', 'A staff escort is required for this student.', 409);
      await this.#rollOverStalePasses(transaction, proof.organization_id, proof.school_id, context.session.clock.timezone, context.session.clock.academicDate, at, input.correlationId);
      const evidenceBefore = await this.#policyEvidence(transaction, context, enrollment.id, proof.student_id, at);
      this.#assertAllowance(evidenceBefore);

      await lockSection(transaction, proof.school_id, input.sectionId);
      const active = await transaction.query<{ count: number } & QueryResultRow>(
        `SELECT count(*)::int AS count FROM passes WHERE school_id=$1 AND section_id=$2 AND status='OUT' AND (started_at AT TIME ZONE $3)::date=$4::date`,
        [proof.school_id, input.sectionId, context.session.clock.timezone, context.session.clock.academicDate],
      );
      if ((await transaction.query<{ id: string } & QueryResultRow>(`SELECT id FROM passes WHERE school_id=$1 AND student_id=$2 AND status='OUT' LIMIT 1 FOR UPDATE`, [proof.school_id, proof.student_id]))[0]) {
        throw new HallPassError('CONFLICT_ACTIVE_PASS', 'Student already has an active pass.', 409);
      }
      if ((await transaction.query<{ id: string } & QueryResultRow>(`SELECT id FROM queue_entries WHERE school_id=$1 AND student_id=$2 AND status='WAITING' LIMIT 1 FOR UPDATE`, [proof.school_id, proof.student_id]))[0]) {
        throw new HallPassError('CONFLICT_ACTIVE_REQUEST', 'Student already has a waiting Hall Pass request.', 409);
      }
      await consumeActionProof(transaction, tokenHash, proof, 'PASS_REQUEST', at, input.sectionId);
      const capacity = Math.max(1, Math.floor(numericPolicy(context, 'MAX_ACTIVE_PER_SECTION')));
      const classEnd = classEndInstant(context, at);
      const queueExpiry = new Date(Math.min(classEnd.getTime(), at.getTime() + Math.max(1, numericPolicy(context, 'QUEUE_MAX_WAIT_MINUTES')) * 60_000));
      const startNow = (active[0]?.count ?? 0) < capacity;
      const requests = await transaction.query<PassRequestRow>(
        `INSERT INTO pass_requests (organization_id,school_id,student_id,section_id,enrollment_id,destination_id,action_proof_id,requested_at,class_end_at,queue_expires_at,status,resolved_at,resolution_code,request_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::timestamptz,$11,$12::timestamptz,$13,$14) RETURNING *`,
        [proof.organization_id, proof.school_id, proof.student_id, input.sectionId, enrollment.id, input.destinationId, proof.id, at.toISOString(), classEnd.toISOString(), queueExpiry.toISOString(), startNow ? 'STARTED' : 'QUEUED', startNow ? at.toISOString() : null, startNow ? 'CAPACITY_AVAILABLE' : null, input.correlationId],
      );
      const request = requests[0]; if (!request) throw new Error('Pass request insert failed.');
      let passId: string | null = null; let queueEntryId: string | null = null;
      if (startNow) {
        const passes = await transaction.query<{ id: string } & QueryResultRow>(
          `INSERT INTO passes (organization_id,school_id,pass_request_id,student_id,section_id,enrollment_id,destination_id,started_at,start_action_proof_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9) RETURNING id`,
          [proof.organization_id, proof.school_id, request.id, proof.student_id, input.sectionId, enrollment.id, input.destinationId, at.toISOString(), proof.id],
        );
        const created = passes[0]; if (!created) throw new Error('Pass insert failed.'); passId = created.id;
        await writePassEvidence(transaction, { organizationId: proof.organization_id, schoolId: proof.school_id, studentId: proof.student_id, action: 'PASS_STARTED', targetType: 'PASS', targetId: created.id, correlationId: input.correlationId, metadata: { passRequestId: request.id, sectionId: input.sectionId, destinationId: input.destinationId, authorizationMethod: 'STUDENT_PIN_PROOF' }, eventType: 'PASS_STARTED', aggregateType: 'PASS', aggregateId: created.id, payload: { passId: created.id, passRequestId: request.id, studentId: proof.student_id, sectionId: input.sectionId, destinationId: input.destinationId, startedAt: at.toISOString() } });
      } else {
        const queued = await transaction.query<{ id: string } & QueryResultRow>(`INSERT INTO queue_entries (organization_id,school_id,pass_request_id,student_id,section_id,joined_at) VALUES ($1,$2,$3,$4,$5,$6::timestamptz) RETURNING id`, [proof.organization_id, proof.school_id, request.id, proof.student_id, input.sectionId, at.toISOString()]);
        const created = queued[0]; if (!created) throw new Error('Queue insert failed.'); queueEntryId = created.id;
        await writePassEvidence(transaction, { organizationId: proof.organization_id, schoolId: proof.school_id, studentId: proof.student_id, action: 'PASS_QUEUED', targetType: 'PASS_REQUEST', targetId: request.id, correlationId: input.correlationId, metadata: { queueEntryId: created.id, sectionId: input.sectionId, destinationId: input.destinationId, authorizationMethod: 'STUDENT_PIN_PROOF' }, eventType: 'PASS_QUEUED', aggregateType: 'PASS_REQUEST', aggregateId: request.id, payload: { passRequestId: request.id, queueEntryId: created.id, studentId: proof.student_id, sectionId: input.sectionId, joinedAt: at.toISOString() } });
      }
      const evidence = startNow ? await this.#policyEvidence(transaction, context, enrollment.id, proof.student_id, at) : evidenceBefore;
      const response: PassRequestResult = { outcome: startNow ? 'STARTED' : 'QUEUED', passRequestId: request.id, passId, queueEntryId, sectionId: input.sectionId, destinationId: input.destinationId, studentId: proof.student_id, evidence };
      await completeIdempotent(transaction, idempotency.id, response, at, 201); return response;
    });
  }

  async returnActivePass(input: { actionProof: string; idempotencyKey: string; correlationId: string }): Promise<PassReturnResult> {
    const database = this.#transactionalDatabase(); const at = this.#now(); const tokenHash = proofHash(input.actionProof);
    return database.transaction(async (transaction) => {
      const proof = await loadActionProof(transaction, tokenHash);
      const idempotency = await startIdempotent(transaction, { organizationId: proof.organization_id, schoolId: proof.school_id, key: input.idempotencyKey, operation: RETURN_OPERATION, fingerprint: hashOpaqueValue(`${RETURN_OPERATION}\u0000${tokenHash}`), correlationId: input.correlationId, at, ttlMs: this.#idempotencyTtlMs, validateResponse: isPassReturnResult });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;
      validateActionProof(proof, 'RETURN', at);
      const schoolRows = await transaction.query<{ timezone: string } & QueryResultRow>(`SELECT timezone FROM schools WHERE id=$1 AND status='ACTIVE'`, [proof.school_id]);
      const school = schoolRows[0]; if (!school) throw new HallPassError('PASS_SERVICE_UNAVAILABLE', 'School context is unavailable.', 503, true);
      const academicDate = academicDateAt(at, school.timezone);
      await this.#rollOverStalePasses(transaction, proof.organization_id, proof.school_id, school.timezone, academicDate, at, input.correlationId);
      const rows = await transaction.query<PassRow>(`SELECT * FROM passes WHERE school_id=$1 AND student_id=$2 AND status='OUT' AND (started_at AT TIME ZONE $3)::date=$4::date ORDER BY started_at DESC LIMIT 1 FOR UPDATE`, [proof.school_id, proof.student_id, school.timezone, academicDate]);
      const pass = rows[0]; if (!pass) throw new HallPassError('ACTIVE_PASS_NOT_FOUND', 'No active pass is available to return.', 409);
      validateActionProof(proof, 'RETURN', at, pass.section_id); await consumeActionProof(transaction, tokenHash, proof, 'RETURN', at, pass.section_id);
      const durationMs = Math.max(0, at.getTime() - pass.started_at.getTime()); const counted = durationMs >= MIN_COUNTABLE_DURATION_MS; const countability = counted ? 'COUNTABLE' : 'NON_COUNTABLE';
      const reason = counted ? 'Duration met the 3.0-second countability boundary.' : 'Duration was under the 3.0-second countability boundary.';
      await transaction.query(`UPDATE passes SET returned_at=$2::timestamptz,status='RETURNED',countability=$3,countability_reason=$4,classified_at=$2::timestamptz,duration_ms=$5,authorization_method_return='STUDENT_PIN_PROOF',return_action_proof_id=$6,return_request_id=$7,updated_at=$2::timestamptz WHERE id=$1 AND status='OUT'`, [pass.id, at.toISOString(), countability, reason, durationMs, proof.id, input.correlationId]);
      await writePassEvidence(transaction, { organizationId: proof.organization_id, schoolId: proof.school_id, studentId: proof.student_id, action: 'PASS_RETURNED', targetType: 'PASS', targetId: pass.id, correlationId: input.correlationId, metadata: { sectionId: pass.section_id, durationMs, countability, authorizationMethod: 'STUDENT_PIN_PROOF' }, eventType: 'PASS_RETURNED', aggregateType: 'PASS', aggregateId: pass.id, payload: { passId: pass.id, studentId: proof.student_id, sectionId: pass.section_id, returnedAt: at.toISOString(), durationMs, countability } });
      const promotedRequestId = await this.#settleQueue(transaction, proof.organization_id, proof.school_id, pass.section_id, at, input.correlationId);
      const response: PassReturnResult = { passId: pass.id, status: 'RETURNED', studentId: proof.student_id, sectionId: pass.section_id, returnedAt: at.toISOString(), durationMs, countability, counted, message: counted ? 'Pass returned.' : 'Pass returned. This pass did not count because it was under 3.0 seconds.', promotedRequestId };
      await completeIdempotent(transaction, idempotency.id, response, at, 200); return response;
    });
  }

  async cancelQueuedRequest(input: { studentId: string; passRequestId: string; idempotencyKey: string; correlationId: string }): Promise<QueueCancelResult> {
    const database = this.#transactionalDatabase(); const at = this.#now();
    return database.transaction(async (transaction) => {
      const rows = await transaction.query<PassRequestRow>(`SELECT * FROM pass_requests WHERE id=$1 AND student_id=$2 FOR UPDATE`, [input.passRequestId, input.studentId]);
      const request = rows[0]; if (!request) throw new HallPassError('PASS_REQUEST_NOT_FOUND', 'Waiting request was not found.', 404);
      const idempotency = await startIdempotent(transaction, { organizationId: request.organization_id, schoolId: request.school_id, key: input.idempotencyKey, operation: CANCEL_OPERATION, fingerprint: hashOpaqueValue(`${CANCEL_OPERATION}\u0000${input.passRequestId}\u0000${input.studentId}`), correlationId: input.correlationId, at, ttlMs: this.#idempotencyTtlMs, validateResponse: isQueueCancelResult });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;
      if (request.status !== 'QUEUED') throw new HallPassError('PASS_REQUEST_NOT_WAITING', 'That request is no longer waiting.', 409);
      await lockSection(transaction, request.school_id, request.section_id);
      await transaction.query(`UPDATE queue_entries SET status='CANCELLED',resolved_at=$2::timestamptz,resolution_code='STUDENT_CANCELLED' WHERE school_id=$1 AND pass_request_id=$3 AND status='WAITING'`, [request.school_id, at.toISOString(), request.id]);
      await transaction.query(`UPDATE pass_requests SET status='CANCELLED',resolved_at=$2::timestamptz,resolution_code='STUDENT_CANCELLED' WHERE school_id=$1 AND id=$3 AND status='QUEUED'`, [request.school_id, at.toISOString(), request.id]);
      await writePassEvidence(transaction, { organizationId: request.organization_id, schoolId: request.school_id, studentId: request.student_id, action: 'PASS_QUEUE_CANCELLED', targetType: 'PASS_REQUEST', targetId: request.id, correlationId: input.correlationId, metadata: { sectionId: request.section_id }, eventType: 'PASS_QUEUE_CANCELLED', aggregateType: 'PASS_REQUEST', aggregateId: request.id, payload: { passRequestId: request.id, studentId: request.student_id, sectionId: request.section_id, cancelledAt: at.toISOString() } });
      const promotedRequestId = await this.#settleQueue(transaction, request.organization_id, request.school_id, request.section_id, at, input.correlationId);
      const response: QueueCancelResult = { passRequestId: request.id, status: 'CANCELLED', promotedRequestId }; await completeIdempotent(transaction, idempotency.id, response, at, 200); return response;
    });
  }

  async rollOverPriorDayPasses(schoolId: string, organizationId: string, timezone: string, academicDate: string, correlationId: string): Promise<number> {
    const database = this.#transactionalDatabase(); const at = this.#now(); return database.transaction((transaction) => this.#rollOverStalePasses(transaction, organizationId, schoolId, timezone, academicDate, at, correlationId));
  }

  async #policyEvidence(transaction: QueryExecutor, context: ResolvedContext, enrollmentId: string, studentId: string, at: Date): Promise<PassEvidence> {
    const terms = await transaction.query<MarkingPeriodRow>(`SELECT id,starts_on,ends_on FROM academic_terms WHERE school_id=$1 AND academic_year_id=$2 AND type='MARKING_PERIOD' AND starts_on<=$3::date AND ends_on>=$3::date ORDER BY ordinal`, [context.session.schoolId, context.session.academicYearId, context.session.clock.academicDate]);
    const term = terms[0]; if (!term || terms.length !== 1) throw new HallPassError('PASS_POLICY_UNAVAILABLE', 'Current marking period is unavailable.', 503, true);
    const usage = await transaction.query<UsageRow>(
      `SELECT count(*) FILTER (WHERE p.enrollment_id=$3 AND (p.started_at AT TIME ZONE $4)::date BETWEEN $5::date AND $6::date)::int AS term_used,
              count(*) FILTER (WHERE (p.started_at AT TIME ZONE $4)::date=$7::date)::int AS daily_used,
              max(p.returned_at) FILTER (WHERE p.status IN ('RETURNED','ROLLED_OVER') AND p.countability='COUNTABLE') AS last_countable_return
         FROM passes p WHERE p.school_id=$1 AND p.student_id=$2 AND ((p.status='OUT' AND p.countability='PROVISIONAL') OR (p.status IN ('RETURNED','ROLLED_OVER') AND p.countability='COUNTABLE'))`,
      [context.session.schoolId, studentId, enrollmentId, context.session.clock.timezone, term.starts_on, term.ends_on, context.session.clock.academicDate],
    );
    const row: UsageRow | { term_used: number; daily_used: number; last_countable_return: null } = usage[0] ?? { term_used: 0, daily_used: 0, last_countable_return: null };
    const mode = accessMode(context); const unlimited = mode === 'UNLIMITED';
    const termRaw = Math.floor(numericPolicy(context, 'MARKING_PERIOD_LIMIT')); const dailyRaw = Math.floor(numericPolicy(context, 'DAILY_LIMIT')); const cooldownRaw = Math.floor(numericPolicy(context, 'COOLDOWN_MINUTES'));
    const termLimit = unlimited || termRaw === 0 ? null : termRaw; const dailyLimit = unlimited || dailyRaw === 0 ? null : dailyRaw; const cooldownMinutes = unlimited ? 0 : cooldownRaw;
    const lastReturnAt = row.last_countable_return; const lastReturn = lastReturnAt ? lastReturnAt.getTime() : 0;
    const cooldownRemainingSeconds = cooldownMinutes > 0 && lastReturn > 0 ? Math.max(0, Math.ceil((lastReturn + cooldownMinutes * 60_000 - at.getTime()) / 1000)) : 0;
    return { termUsed: row.term_used, termLimit, termRemaining: termLimit === null ? null : Math.max(0, termLimit - row.term_used), dailyUsed: row.daily_used, dailyLimit, dailyRemaining: dailyLimit === null ? null : Math.max(0, dailyLimit - row.daily_used), cooldownMinutes, cooldownRemainingSeconds, accessMode: mode };
  }

  #assertAllowance(evidence: PassEvidence): void {
    if (evidence.accessMode === 'ESCORT_ONLY') throw new HallPassError('ALLOWANCE_BLOCKED', 'A staff escort is required for this student.', 409);
    if (evidence.termLimit !== null && evidence.termUsed >= evidence.termLimit) throw new HallPassError('ALLOWANCE_BLOCKED', 'Marking-period pass allowance has been used.', 409);
    if (evidence.dailyLimit !== null && evidence.dailyUsed >= evidence.dailyLimit) throw new HallPassError('DAILY_LIMIT_ACTIVE', 'Daily pass allowance has been used.', 409);
    if (evidence.cooldownRemainingSeconds > 0) throw new HallPassError('COOLDOWN_ACTIVE', 'Return cooldown is still active.', 409);
  }

  async #settleQueue(transaction: QueryExecutor, organizationId: string, schoolId: string, sectionId: string, at: Date, correlationId: string): Promise<string | null> {
    await lockSection(transaction, schoolId, sectionId); let firstPromoted: string | null = null;
    while (true) {
      const candidates = await transaction.query<QueueCandidateRow>(`SELECT q.id AS queue_id,q.pass_request_id,q.organization_id,q.school_id,q.student_id,q.section_id,pr.enrollment_id,pr.destination_id,pr.action_proof_id,pr.requested_at,pr.class_end_at,pr.queue_expires_at,q.order_token::text AS order_token FROM queue_entries q JOIN pass_requests pr ON pr.school_id=q.school_id AND pr.id=q.pass_request_id WHERE q.school_id=$1 AND q.section_id=$2 AND q.status='WAITING' AND pr.status='QUEUED' ORDER BY q.order_token LIMIT 1 FOR UPDATE OF q,pr`, [schoolId, sectionId]);
      const candidate = candidates[0]; if (!candidate) break;
      if (at.getTime() >= candidate.class_end_at.getTime() || at.getTime() >= candidate.queue_expires_at.getTime()) { await this.#resolveQueueCandidate(transaction, candidate, 'EXPIRED', 'QUEUE_EXPIRED', at, correlationId); continue; }
      let context: ResolvedContext | null = null;
      try {
        context = resolvedContext(await new SchedulePolicyService(new TransactionReadDatabase(transaction)).resolveContext({ sectionId, studentId: candidate.student_id, at }));
        if (context.session.schoolId !== schoolId) throw new HallPassError('ACTION_WRONG_CONTEXT', 'Queued request school context changed.', 403);
        await requireActiveEnrollment(transaction, schoolId, candidate.student_id, sectionId); await requireDestination(transaction, schoolId, candidate.destination_id);
        this.#assertAllowance(await this.#policyEvidence(transaction, context, candidate.enrollment_id, candidate.student_id, at));
      } catch (error) {
        if (error instanceof HallPassError && !error.retryable) { await this.#resolveQueueCandidate(transaction, candidate, 'INELIGIBLE', error.code, at, correlationId); continue; }
        break;
      }
      if (!context) break;
      const capacity = Math.max(1, Math.floor(numericPolicy(context, 'MAX_ACTIVE_PER_SECTION')));
      const active = await transaction.query<{ count: number } & QueryResultRow>(`SELECT count(*)::int AS count FROM passes WHERE school_id=$1 AND section_id=$2 AND status='OUT' AND (started_at AT TIME ZONE $3)::date=$4::date`, [schoolId, sectionId, context.session.clock.timezone, context.session.clock.academicDate]);
      if ((active[0]?.count ?? 0) >= capacity) break;
      if ((await transaction.query<{ id: string } & QueryResultRow>(`SELECT id FROM passes WHERE school_id=$1 AND student_id=$2 AND status='OUT' LIMIT 1 FOR UPDATE`, [schoolId, candidate.student_id]))[0]) { await this.#resolveQueueCandidate(transaction, candidate, 'INELIGIBLE', 'CONFLICT_ACTIVE_PASS', at, correlationId); continue; }
      const passes = await transaction.query<{ id: string } & QueryResultRow>(`INSERT INTO passes (organization_id,school_id,pass_request_id,student_id,section_id,enrollment_id,destination_id,started_at,start_action_proof_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9) RETURNING id`, [organizationId, schoolId, candidate.pass_request_id, candidate.student_id, sectionId, candidate.enrollment_id, candidate.destination_id, at.toISOString(), candidate.action_proof_id]);
      const created = passes[0]; if (!created) throw new Error('Queue promotion pass insert failed.');
      await transaction.query(`UPDATE queue_entries SET status='STARTED',resolved_at=$2::timestamptz,resolution_code='CAPACITY_AVAILABLE' WHERE id=$1`, [candidate.queue_id, at.toISOString()]);
      await transaction.query(`UPDATE pass_requests SET status='STARTED',resolved_at=$2::timestamptz,resolution_code='QUEUE_PROMOTED' WHERE id=$1`, [candidate.pass_request_id, at.toISOString()]);
      await writePassEvidence(transaction, { organizationId, schoolId, studentId: candidate.student_id, action: 'PASS_QUEUE_PROMOTED', targetType: 'PASS', targetId: created.id, correlationId, metadata: { passRequestId: candidate.pass_request_id, queueEntryId: candidate.queue_id, sectionId, reusedOriginalAuthorization: true }, eventType: 'PASS_QUEUE_PROMOTED', aggregateType: 'PASS', aggregateId: created.id, payload: { passId: created.id, passRequestId: candidate.pass_request_id, queueEntryId: candidate.queue_id, studentId: candidate.student_id, sectionId, startedAt: at.toISOString() } });
      firstPromoted ??= candidate.pass_request_id;
    }
    return firstPromoted;
  }

  async #resolveQueueCandidate(transaction: QueryExecutor, candidate: QueueCandidateRow, status: 'EXPIRED' | 'INELIGIBLE', resolution: string, at: Date, correlationId: string): Promise<void> {
    await transaction.query(`UPDATE queue_entries SET status=$2,resolved_at=$3::timestamptz,resolution_code=$4 WHERE id=$1`, [candidate.queue_id, status, at.toISOString(), resolution]);
    await transaction.query(`UPDATE pass_requests SET status=$2,resolved_at=$3::timestamptz,resolution_code=$4 WHERE id=$1`, [candidate.pass_request_id, status === 'EXPIRED' ? 'EXPIRED' : 'REJECTED', at.toISOString(), resolution]);
    await writePassEvidence(transaction, { organizationId: candidate.organization_id, schoolId: candidate.school_id, studentId: candidate.student_id, action: status === 'EXPIRED' ? 'PASS_QUEUE_EXPIRED' : 'PASS_QUEUE_INELIGIBLE', targetType: 'PASS_REQUEST', targetId: candidate.pass_request_id, correlationId, metadata: { queueEntryId: candidate.queue_id, sectionId: candidate.section_id, resolution }, eventType: status === 'EXPIRED' ? 'PASS_QUEUE_EXPIRED' : 'PASS_QUEUE_INELIGIBLE', aggregateType: 'PASS_REQUEST', aggregateId: candidate.pass_request_id, payload: { passRequestId: candidate.pass_request_id, queueEntryId: candidate.queue_id, studentId: candidate.student_id, sectionId: candidate.section_id, resolution } });
  }

  async #rollOverStalePasses(transaction: QueryExecutor, organizationId: string, schoolId: string, timezone: string, academicDate: string, at: Date, correlationId: string): Promise<number> {
    const stale = await transaction.query<PassRow>(`SELECT * FROM passes WHERE school_id=$1 AND status='OUT' AND (started_at AT TIME ZONE $2)::date<$3::date ORDER BY started_at FOR UPDATE`, [schoolId, timezone, academicDate]);
    for (const pass of stale) {
      const durationMs = Math.max(0, at.getTime() - pass.started_at.getTime());
      await transaction.query(`UPDATE passes SET returned_at=$2::timestamptz,status='ROLLED_OVER',countability='COUNTABLE',countability_reason='No return was recorded before the next school day',classified_at=$2::timestamptz,duration_ms=$3,authorization_method_return='SYSTEM_ROLLOVER',return_action_proof_id=NULL,updated_at=$2::timestamptz WHERE id=$1 AND status='OUT'`, [pass.id, at.toISOString(), durationMs]);
      await writePassEvidence(transaction, { organizationId, schoolId, studentId: null, actorKind: 'SYSTEM', action: 'PASS_ROLLED_OVER', targetType: 'PASS', targetId: pass.id, correlationId, metadata: { studentId: pass.student_id, sectionId: pass.section_id, countability: 'COUNTABLE', durationMs }, eventType: 'PASS_ROLLED_OVER', aggregateType: 'PASS', aggregateId: pass.id, payload: { passId: pass.id, studentId: pass.student_id, sectionId: pass.section_id, returnedAt: at.toISOString(), durationMs, countability: 'COUNTABLE' } });
    }
    return stale.length;
  }

  #transactionalDatabase() {
    if (!supportsTransactions(this.#database)) throw new Error('Hall Pass mutations require a transactional database implementation.');
    return this.#database;
  }
}
