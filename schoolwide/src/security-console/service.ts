import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { roleAllowsCapability } from '../auth/capabilities.js';
import type { Capability } from '../auth/types.js';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import {
  SecurityConsoleError,
  type SecurityActionResult,
  type SecurityConsoleServiceOptions,
  type SecurityDestination,
  type SecurityLiveBoard,
  type SecurityLivePass,
  type SecurityOperationalActionKind,
  type SecurityPrincipal,
  type SecurityStudentSearchResult,
  type SecurityWaitingEntry,
  type SecurityWarningState,
} from './types.js';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_LIVE_LIMIT = 250;
const DEFAULT_WAITING_LIMIT = 250;
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const LATE_POLICY_KEY = 'SECURITY_LATE_WARNING_MINUTES';
const STALE_POLICY_KEY = 'SECURITY_STALE_WARNING_MINUTES';

interface SchoolRow extends QueryResultRow {
  id: string;
  organization_id: string;
  timezone: string;
}

interface PassScopeRow extends QueryResultRow {
  id: string;
  organization_id: string;
  school_id: string;
  student_id: string;
  section_id: string;
  status: 'OUT' | 'RETURNED' | 'ROLLED_OVER';
}

interface LivePassRow extends QueryResultRow {
  pass_id: string;
  student_id: string;
  student_name: string;
  section_id: string;
  section_name: string;
  room: string | null;
  teacher_user_id: string | null;
  teacher_name: string | null;
  destination_id: string;
  destination_name: string;
  started_at: Date;
  latest_action_type: string | null;
  latest_action_at: Date | null;
}

interface WaitingRow extends QueryResultRow {
  request_id: string;
  queue_entry_id: string;
  student_id: string;
  student_name: string;
  section_id: string;
  section_name: string;
  room: string | null;
  destination_id: string;
  destination_name: string;
  joined_at: Date;
}

interface PolicySetRow extends QueryResultRow {
  id: string;
}

interface PolicyValueRow extends QueryResultRow {
  policy_key: string;
  typed_value_json: unknown;
}

interface CountRow extends QueryResultRow {
  count: string | number;
}

interface PassSummaryRow extends QueryResultRow {
  out_count: string | number;
  late_count: string | number;
  stale_count: string | number;
}

interface SearchRow extends QueryResultRow {
  student_id: string;
  student_name: string;
  local_student_number: string | null;
  pass_id: string | null;
  pass_started_at: Date | null;
  pass_destination_name: string | null;
  waiting_request_id: string | null;
  waiting_joined_at: Date | null;
  waiting_destination_name: string | null;
}

interface IdempotencyRow extends QueryResultRow {
  id: string;
  operation: string;
  request_fingerprint: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_json_sanitized: unknown;
  expires_at: Date;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < min || candidate > max) throw new Error('Security Console option is invalid.');
  return candidate;
}

function schoolLocalDate(instant: Date, timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA-u-ca-gregory', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = new Map(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    const year = parts.get('year');
    const month = parts.get('month');
    const day = parts.get('day');
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

function positiveMinutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 24 * 60 ? value : null;
}

function elapsedMs(startedAt: Date, now: Date): number {
  return Math.max(0, now.getTime() - startedAt.getTime());
}

function warningState(elapsed: number, policy: { lateMinutes: number | null; staleMinutes: number | null }): SecurityWarningState {
  if (policy.lateMinutes === null || policy.staleMinutes === null) return 'UNCONFIGURED';
  if (elapsed >= policy.staleMinutes * 60_000) return 'STALE';
  if (elapsed >= policy.lateMinutes * 60_000) return 'LATE';
  return 'NONE';
}

function operationalAction(type: string | null): SecurityOperationalActionKind | null {
  if (type === 'SECURITY_MARK_LOCATED') return 'MARK_LOCATED';
  if (type === 'SECURITY_REQUEST_RETURN') return 'REQUEST_RETURN';
  return null;
}

function isSecurityActionResult(value: unknown): value is SecurityActionResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.actionId === 'string'
    && typeof row.passId === 'string'
    && (row.action === 'MARK_LOCATED' || row.action === 'REQUEST_RETURN')
    && typeof row.recordedAt === 'string';
}

export class SecurityConsoleService {
  readonly #database: Database;
  readonly #now: () => Date;
  readonly #pollAfterMs: number;
  readonly #liveLimit: number;
  readonly #waitingLimit: number;
  readonly #idempotencyTtlMs: number;

  constructor(database: Database, options: SecurityConsoleServiceOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#pollAfterMs = boundedInteger(options.pollAfterMs, DEFAULT_POLL_MS, 1_000, 60_000);
    this.#liveLimit = boundedInteger(options.liveLimit, DEFAULT_LIVE_LIMIT, 1, 500);
    this.#waitingLimit = boundedInteger(options.waitingLimit, DEFAULT_WAITING_LIMIT, 1, 500);
    this.#idempotencyTtlMs = boundedInteger(options.idempotencyTtlMs, DEFAULT_IDEMPOTENCY_TTL_MS, 60_000, 7 * 24 * 60 * 60_000);
  }

  resolveSchoolId(principal: SecurityPrincipal, capability: Capability): string {
    const schoolIds = [...new Set(
      principal.roleGrants
        .filter((grant) => roleAllowsCapability(grant.role, capability))
        .map((grant) => grant.schoolId),
    )];
    if (schoolIds.length === 0) throw new SecurityConsoleError('SECURITY_SCHOOL_SCOPE_DENIED', 'No current Security school scope is available.', 403);
    if (schoolIds.length !== 1) {
      throw new SecurityConsoleError(
        'SECURITY_SCHOOL_SCOPE_AMBIGUOUS',
        'This Security session has more than one school scope; a future explicit school selector is required.',
        409,
      );
    }
    return schoolIds[0]!;
  }

  async passScope(passId: string): Promise<{ organizationId: string; schoolId: string; studentId: string; sectionId: string; status: PassScopeRow['status'] }> {
    const rows = await this.#database.query<PassScopeRow>(
      `SELECT id, organization_id, school_id, student_id, section_id, status
         FROM passes
        WHERE id = $1`,
      [passId],
    );
    const row = rows[0];
    if (!row) throw new SecurityConsoleError('SECURITY_PASS_NOT_FOUND', 'Pass was not found.', 404);
    return {
      organizationId: row.organization_id,
      schoolId: row.school_id,
      studentId: row.student_id,
      sectionId: row.section_id,
      status: row.status,
    };
  }

  async liveBoard(input: {
    principal: SecurityPrincipal;
    destinationId?: string;
    sectionId?: string;
    teacherUserId?: string;
    warning?: SecurityWarningState;
  }): Promise<SecurityLiveBoard> {
    const schoolId = this.resolveSchoolId(input.principal, 'security.live.read');
    const at = this.#now();
    const school = await this.#school(schoolId, input.principal.organizationId);
    const warningPolicy = await this.#warningPolicy(school, at);

    const conditions: string[] = ["p.school_id = $1", "p.status = 'OUT'"];
    const parameters: unknown[] = [schoolId, at.toISOString()];
    let index = 3;
    if (input.destinationId !== undefined) {
      conditions.push(`p.destination_id = $${index++}`);
      parameters.push(input.destinationId);
    }
    if (input.sectionId !== undefined) {
      conditions.push(`p.section_id = $${index++}`);
      parameters.push(input.sectionId);
    }
    if (input.teacherUserId !== undefined) {
      conditions.push(`EXISTS (
        SELECT 1 FROM section_staff_assignments f
         WHERE f.school_id=p.school_id AND f.section_id=p.section_id AND f.user_id=$${index++}
           AND f.revoked_at IS NULL AND f.valid_from <= $2::timestamptz
           AND (f.valid_until IS NULL OR f.valid_until > $2::timestamptz)
      )`);
      parameters.push(input.teacherUserId);
    }
    parameters.push(this.#liveLimit + 1);
    const limitParameter = index;

    const liveRows = await this.#database.query<LivePassRow>(
      `SELECT p.id AS pass_id, p.student_id, st.display_name AS student_name,
              p.section_id, sec.name AS section_name, sec.room,
              teacher.user_id AS teacher_user_id, teacher.display_name AS teacher_name,
              p.destination_id, d.name AS destination_name, p.started_at,
              latest.action_type AS latest_action_type, latest.occurred_at AS latest_action_at
         FROM passes p
         JOIN students st ON st.school_id=p.school_id AND st.id=p.student_id
         JOIN sections sec ON sec.school_id=p.school_id AND sec.id=p.section_id
         JOIN destinations d ON d.school_id=p.school_id AND d.id=p.destination_id AND d.security_visible=true
         LEFT JOIN LATERAL (
           SELECT u.id AS user_id, u.display_name
             FROM section_staff_assignments ssa
             JOIN users u ON u.id=ssa.user_id AND u.status='ACTIVE'
            WHERE ssa.school_id=p.school_id AND ssa.section_id=p.section_id
              AND ssa.revoked_at IS NULL AND ssa.valid_from <= $2::timestamptz
              AND (ssa.valid_until IS NULL OR ssa.valid_until > $2::timestamptz)
            ORDER BY CASE ssa.assignment_role WHEN 'PRIMARY_TEACHER' THEN 0 WHEN 'CO_TEACHER' THEN 1 ELSE 2 END,
                     ssa.valid_from, ssa.id
            LIMIT 1
         ) teacher ON true
         LEFT JOIN LATERAL (
           SELECT sa.action_type, sa.occurred_at
             FROM staff_actions sa
            WHERE sa.school_id=p.school_id AND sa.pass_id=p.id
              AND sa.action_type IN ('SECURITY_MARK_LOCATED','SECURITY_REQUEST_RETURN')
            ORDER BY sa.occurred_at DESC, sa.id DESC
            LIMIT 1
         ) latest ON true
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.started_at, p.id
        LIMIT $${limitParameter}`,
      parameters,
    );

    const mappedPasses: SecurityLivePass[] = liveRows.slice(0, this.#liveLimit).map((row) => {
      const elapsed = elapsedMs(row.started_at, at);
      const action = operationalAction(row.latest_action_type);
      return {
        passId: row.pass_id,
        studentId: row.student_id,
        studentName: row.student_name,
        sectionId: row.section_id,
        sectionName: row.section_name,
        room: row.room,
        sourceTeacher: row.teacher_user_id && row.teacher_name
          ? { userId: row.teacher_user_id, displayName: row.teacher_name }
          : null,
        destinationId: row.destination_id,
        destinationName: row.destination_name,
        startedAt: row.started_at.toISOString(),
        elapsedMs: elapsed,
        warningState: warningState(elapsed, warningPolicy),
        latestOperationalAction: action && row.latest_action_at
          ? { kind: action, occurredAt: row.latest_action_at.toISOString() }
          : null,
      };
    });
    const passes = input.warning === undefined ? mappedPasses : mappedPasses.filter((pass) => pass.warningState === input.warning);

    const waitingRows = await this.#database.query<WaitingRow>(
      `SELECT pr.id AS request_id, q.id AS queue_entry_id, q.student_id,
              st.display_name AS student_name, q.section_id, sec.name AS section_name, sec.room,
              pr.destination_id, d.name AS destination_name, q.joined_at
         FROM queue_entries q
         JOIN pass_requests pr ON pr.school_id=q.school_id AND pr.id=q.pass_request_id
         JOIN students st ON st.school_id=q.school_id AND st.id=q.student_id
         JOIN sections sec ON sec.school_id=q.school_id AND sec.id=q.section_id
         JOIN destinations d ON d.school_id=q.school_id AND d.id=pr.destination_id AND d.security_visible=true
        WHERE q.school_id=$1 AND q.status='WAITING'
        ORDER BY q.order_token, q.id
        LIMIT $2`,
      [schoolId, this.#waitingLimit + 1],
    );
    const waiting: SecurityWaitingEntry[] = waitingRows.slice(0, this.#waitingLimit).map((row) => ({
      requestId: row.request_id,
      queueEntryId: row.queue_entry_id,
      studentId: row.student_id,
      studentName: row.student_name,
      sectionId: row.section_id,
      sectionName: row.section_name,
      room: row.room,
      destinationId: row.destination_id,
      destinationName: row.destination_name,
      joinedAt: row.joined_at.toISOString(),
      waitingMs: elapsedMs(row.joined_at, at),
    }));

    const lateThreshold = warningPolicy.lateMinutes === null ? null : new Date(at.getTime() - warningPolicy.lateMinutes * 60_000).toISOString();
    const staleThreshold = warningPolicy.staleMinutes === null ? null : new Date(at.getTime() - warningPolicy.staleMinutes * 60_000).toISOString();
    const [passSummaryRows, waitingCountRows, destinationRows] = await Promise.all([
      this.#database.query<PassSummaryRow>(
        `SELECT count(*) AS out_count,
                count(*) FILTER (
                  WHERE $2::timestamptz IS NOT NULL
                    AND p.started_at <= $2::timestamptz
                    AND ($3::timestamptz IS NULL OR p.started_at > $3::timestamptz)
                ) AS late_count,
                count(*) FILTER (
                  WHERE $3::timestamptz IS NOT NULL
                    AND p.started_at <= $3::timestamptz
                ) AS stale_count
           FROM passes p
           JOIN destinations d ON d.school_id=p.school_id AND d.id=p.destination_id AND d.security_visible=true
          WHERE p.school_id=$1 AND p.status='OUT'`,
        [schoolId, lateThreshold, staleThreshold],
      ),
      this.#database.query<CountRow>(
        `SELECT count(*) AS count
           FROM queue_entries q
           JOIN pass_requests pr ON pr.school_id=q.school_id AND pr.id=q.pass_request_id
           JOIN destinations d ON d.school_id=q.school_id AND d.id=pr.destination_id AND d.security_visible=true
          WHERE q.school_id=$1 AND q.status='WAITING'`,
        [schoolId],
      ),
      this.#database.query<{ id: string; name: string; category: string } & QueryResultRow>(
        `SELECT id, name, category FROM destinations
          WHERE school_id=$1 AND active=true AND security_visible=true
          ORDER BY name, id LIMIT 100`,
        [schoolId],
      ),
    ]);
    const passSummary = passSummaryRows[0];
    const destinations: SecurityDestination[] = destinationRows.map((row) => ({ destinationId: row.id, name: row.name, category: row.category }));

    return {
      schoolId,
      generatedAt: at.toISOString(),
      summary: {
        out: Number(passSummary?.out_count ?? 0),
        waiting: Number(waitingCountRows[0]?.count ?? 0),
        late: Number(passSummary?.late_count ?? 0),
        stale: Number(passSummary?.stale_count ?? 0),
      },
      passes,
      waiting,
      destinations,
      warningPolicy: {
        status: warningPolicy.lateMinutes !== null && warningPolicy.staleMinutes !== null ? 'CONFIGURED' : 'UNCONFIGURED',
        lateMinutes: warningPolicy.lateMinutes,
        staleMinutes: warningPolicy.staleMinutes,
      },
      transport: {
        mode: 'POLLING_FALLBACK',
        pollAfterMs: this.#pollAfterMs,
        schoolChannel: `school:${schoolId}:security-live`,
      },
      truncated: liveRows.length > this.#liveLimit || waitingRows.length > this.#waitingLimit,
    };
  }

  async searchStudents(principal: SecurityPrincipal, query: string, limit = 20): Promise<{ schoolId: string; results: readonly SecurityStudentSearchResult[] }> {
    const schoolId = this.resolveSchoolId(principal, 'security.student.lookup_live');
    await this.#school(schoolId, principal.organizationId);
    const q = query.trim();
    if (q.length < 2 || q.length > 100) throw new SecurityConsoleError('SECURITY_SEARCH_INVALID', 'Search requires 2 to 100 characters.', 400);
    const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const rows = await this.#database.query<SearchRow>(
      `SELECT st.id AS student_id, st.display_name AS student_name, st.local_student_number,
              p.id AS pass_id, p.started_at AS pass_started_at, pd.name AS pass_destination_name,
              waiting.request_id AS waiting_request_id, waiting.joined_at AS waiting_joined_at,
              waiting.destination_name AS waiting_destination_name
         FROM students st
         LEFT JOIN LATERAL (
           SELECT p1.id, p1.started_at, p1.destination_id
             FROM passes p1
            WHERE p1.school_id=st.school_id AND p1.student_id=st.id AND p1.status='OUT'
            ORDER BY p1.started_at DESC, p1.id DESC LIMIT 1
         ) p ON true
         LEFT JOIN destinations pd ON pd.school_id=st.school_id AND pd.id=p.destination_id AND pd.security_visible=true
         LEFT JOIN LATERAL (
           SELECT pr.id AS request_id, q1.joined_at, d.name AS destination_name
             FROM queue_entries q1
             JOIN pass_requests pr ON pr.school_id=q1.school_id AND pr.id=q1.pass_request_id
             JOIN destinations d ON d.school_id=pr.school_id AND d.id=pr.destination_id AND d.security_visible=true
            WHERE q1.school_id=st.school_id AND q1.student_id=st.id AND q1.status='WAITING'
            ORDER BY q1.order_token, q1.id LIMIT 1
         ) waiting ON true
        WHERE st.school_id=$1 AND st.status='ACTIVE'
          AND (st.display_name ILIKE '%' || $2 || '%' OR coalesce(st.local_student_number,'') ILIKE '%' || $2 || '%')
        ORDER BY st.display_name, st.id
        LIMIT $3`,
      [schoolId, q, boundedLimit],
    );
    return {
      schoolId,
      results: rows.map((row) => {
        let currentState: SecurityStudentSearchResult['currentState'];
        if (row.pass_id && row.pass_started_at && row.pass_destination_name) {
          currentState = { kind: 'OUT', passId: row.pass_id, destinationName: row.pass_destination_name, startedAt: row.pass_started_at.toISOString() };
        } else if (row.waiting_request_id && row.waiting_joined_at && row.waiting_destination_name) {
          currentState = { kind: 'WAITING', requestId: row.waiting_request_id, destinationName: row.waiting_destination_name, joinedAt: row.waiting_joined_at.toISOString() };
        } else {
          currentState = { kind: 'NONE' };
        }
        return {
          studentId: row.student_id,
          studentName: row.student_name,
          localStudentNumber: row.local_student_number,
          currentState,
        };
      }),
    };
  }

  async markLocated(input: {
    actorUserId: string;
    organizationId: string;
    schoolId: string;
    passId: string;
    reasonPrivate: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<SecurityActionResult> {
    return this.#recordAction({ ...input, action: 'MARK_LOCATED' });
  }

  async requestReturn(input: {
    actorUserId: string;
    organizationId: string;
    schoolId: string;
    passId: string;
    reasonPrivate: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<SecurityActionResult> {
    return this.#recordAction({ ...input, action: 'REQUEST_RETURN' });
  }

  async #school(schoolId: string, organizationId: string): Promise<SchoolRow> {
    const rows = await this.#database.query<SchoolRow>(
      `SELECT id, organization_id, timezone FROM schools
        WHERE id=$1 AND organization_id=$2 AND status='ACTIVE'`,
      [schoolId, organizationId],
    );
    const row = rows[0];
    if (!row) throw new SecurityConsoleError('SECURITY_SCHOOL_SCOPE_DENIED', 'Security school scope is unavailable.', 403);
    return row;
  }

  async #warningPolicy(school: SchoolRow, at: Date): Promise<{ lateMinutes: number | null; staleMinutes: number | null }> {
    const academicDate = schoolLocalDate(at, school.timezone);
    if (!academicDate) return { lateMinutes: null, staleMinutes: null };
    const sets = await this.#database.query<PolicySetRow>(
      `SELECT id FROM school_policy_sets
        WHERE school_id=$1 AND active=true
          AND effective_from <= $2::date
          AND (effective_until IS NULL OR effective_until >= $2::date)
        ORDER BY effective_from DESC, id`,
      [school.id, academicDate],
    );
    if (sets.length !== 1) return { lateMinutes: null, staleMinutes: null };
    const rows = await this.#database.query<PolicyValueRow>(
      `SELECT policy_key, typed_value_json FROM policy_values
        WHERE school_id=$1 AND policy_set_id=$2 AND policy_key IN ($3,$4)`,
      [school.id, sets[0]!.id, LATE_POLICY_KEY, STALE_POLICY_KEY],
    );
    const values = new Map(rows.map((row) => [row.policy_key, row.typed_value_json]));
    const lateMinutes = positiveMinutes(values.get(LATE_POLICY_KEY));
    const staleMinutes = positiveMinutes(values.get(STALE_POLICY_KEY));
    if (lateMinutes === null || staleMinutes === null || staleMinutes < lateMinutes) return { lateMinutes: null, staleMinutes: null };
    return { lateMinutes, staleMinutes };
  }

  async #recordAction(input: {
    actorUserId: string;
    organizationId: string;
    schoolId: string;
    passId: string;
    action: SecurityOperationalActionKind;
    reasonPrivate: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<SecurityActionResult> {
    if (!supportsTransactions(this.#database)) throw new Error('Security operational actions require transactional database support.');
    const reason = input.reasonPrivate.trim();
    if (!reason || reason.length > 1000) throw new SecurityConsoleError('SECURITY_ACTION_INVALID', 'A private operational note is required.', 400);
    const at = this.#now();
    const operation = input.action === 'MARK_LOCATED' ? 'SECURITY_MARK_LOCATED' : 'SECURITY_REQUEST_RETURN';
    const eventType = input.action === 'MARK_LOCATED' ? 'SECURITY_PASS_MARKED_LOCATED' : 'SECURITY_PASS_RETURN_REQUESTED';

    return this.#database.transaction(async (transaction) => {
      const passRows = await transaction.query<PassScopeRow>(
        `SELECT id, organization_id, school_id, student_id, section_id, status
           FROM passes WHERE id=$1 FOR UPDATE`,
        [input.passId],
      );
      const pass = passRows[0];
      if (!pass) throw new SecurityConsoleError('SECURITY_PASS_NOT_FOUND', 'Pass was not found.', 404);
      if (pass.organization_id !== input.organizationId || pass.school_id !== input.schoolId) {
        throw new SecurityConsoleError('SECURITY_SCHOOL_SCOPE_DENIED', 'Pass is outside the authorized Security school.', 403);
      }

      const state = await this.#startIdempotent(transaction, {
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        key: input.idempotencyKey,
        operation,
        requestFingerprint: fingerprint(`${operation}\u0000${input.actorUserId}\u0000${input.passId}\u0000${reason}`),
        correlationId: input.correlationId,
        at,
      });
      if (state.kind === 'COMPLETED') return state.response;
      if (pass.status !== 'OUT') throw new SecurityConsoleError('SECURITY_PASS_NOT_ACTIVE', 'Only an active OUT pass can receive a Security operational action.', 409);

      const actions = await transaction.query<{ id: string } & QueryResultRow>(
        `INSERT INTO staff_actions
           (organization_id,school_id,actor_user_id,action_type,student_id,section_id,pass_id,
            restrictions_bypassed_json,reason_private,occurred_at,correlation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'[]'::jsonb,$8,$9::timestamptz,$10)
         RETURNING id`,
        [input.organizationId,input.schoolId,input.actorUserId,operation,pass.student_id,pass.section_id,pass.id,reason,at.toISOString(),input.correlationId],
      );
      const action = actions[0];
      if (!action) throw new Error('Security staff action insert failed.');
      const metadata = { actionId: action.id, sectionId: pass.section_id };

      await transaction.query(
        `INSERT INTO audit_events
           (organization_id,school_id,actor_user_id,actor_student_id,actor_kind,action,target_type,target_id,
            request_id,correlation_id,source,metadata)
         VALUES ($1,$2,$3,NULL,'USER',$4,'PASS',$5,$6,$6,'APPLICATION',$7::jsonb)`,
        [input.organizationId,input.schoolId,input.actorUserId,eventType,pass.id,input.correlationId,JSON.stringify(metadata)],
      );
      await transaction.query(
        `INSERT INTO pass_events
           (organization_id,school_id,event_type,resource_type,resource_id,student_id,actor_kind,actor_user_id,
            occurred_at,correlation_id,metadata_json_sanitized)
         VALUES ($1,$2,$3,'PASS',$4,$5,'USER',$6,$7::timestamptz,$8,$9::jsonb)`,
        [input.organizationId,input.schoolId,eventType,pass.id,pass.student_id,input.actorUserId,at.toISOString(),input.correlationId,JSON.stringify(metadata)],
      );
      await transaction.query(
        `INSERT INTO transactional_outbox
           (organization_id,school_id,topic,event_type,aggregate_type,aggregate_id,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.security',$3,'PASS',$4,$5,$6::jsonb)`,
        [input.organizationId,input.schoolId,eventType,pass.id,input.correlationId,JSON.stringify({
          passId: pass.id,
          studentId: pass.student_id,
          sectionId: pass.section_id,
          actionId: action.id,
          occurredAt: at.toISOString(),
        })],
      );

      const response: SecurityActionResult = { actionId: action.id, passId: pass.id, action: input.action, recordedAt: at.toISOString() };
      await transaction.query(
        `UPDATE idempotency_keys
            SET status='COMPLETED',response_status=201,response_json_sanitized=$2::jsonb,completed_at=$3::timestamptz
          WHERE id=$1 AND status='IN_PROGRESS'`,
        [state.id, JSON.stringify(response), at.toISOString()],
      );
      return response;
    });
  }

  async #startIdempotent(
    transaction: QueryExecutor,
    input: {
      organizationId: string;
      schoolId: string;
      key: string;
      operation: string;
      requestFingerprint: string;
      correlationId: string;
      at: Date;
    },
  ): Promise<{ kind: 'NEW'; id: string } | { kind: 'COMPLETED'; response: SecurityActionResult }> {
    const expiresAt = new Date(input.at.getTime() + this.#idempotencyTtlMs);
    const inserted = await transaction.query<{ id: string } & QueryResultRow>(
      `INSERT INTO idempotency_keys
         (organization_id,school_id,key,operation,request_fingerprint,status,created_at,expires_at,correlation_id)
       VALUES ($1,$2,$3,$4,$5,'IN_PROGRESS',$6::timestamptz,$7::timestamptz,$8)
       ON CONFLICT (school_id,key) DO NOTHING
       RETURNING id`,
      [input.organizationId,input.schoolId,input.key,input.operation,input.requestFingerprint,input.at.toISOString(),expiresAt.toISOString(),input.correlationId],
    );
    if (inserted[0]) return { kind: 'NEW', id: inserted[0].id };
    const rows = await transaction.query<IdempotencyRow>(
      `SELECT id,operation,request_fingerprint,status,response_json_sanitized,expires_at
         FROM idempotency_keys WHERE school_id=$1 AND key=$2 FOR UPDATE`,
      [input.schoolId,input.key],
    );
    const row = rows[0];
    if (!row) throw new SecurityConsoleError('IDEMPOTENCY_CONFLICT', 'Idempotency state is unavailable.', 409, true);
    if (row.expires_at.getTime() <= input.at.getTime()) {
      await transaction.query(
        `UPDATE idempotency_keys
            SET organization_id=$1,operation=$2,request_fingerprint=$3,status='IN_PROGRESS',
                response_status=NULL,response_json_sanitized=NULL,created_at=$4::timestamptz,completed_at=NULL,
                expires_at=$5::timestamptz,correlation_id=$6
          WHERE id=$7`,
        [input.organizationId,input.operation,input.requestFingerprint,input.at.toISOString(),expiresAt.toISOString(),input.correlationId,row.id],
      );
      return { kind: 'NEW', id: row.id };
    }
    if (row.operation !== input.operation || row.request_fingerprint !== input.requestFingerprint) {
      throw new SecurityConsoleError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different request.', 409);
    }
    if (row.status === 'COMPLETED' && isSecurityActionResult(row.response_json_sanitized)) {
      return { kind: 'COMPLETED', response: row.response_json_sanitized };
    }
    throw new SecurityConsoleError('IDEMPOTENCY_CONFLICT', 'The same Security action is still being resolved.', 409, true);
  }
}
