import type { QueryResultRow } from 'pg';
import { roleAllowsCapability } from '../auth/capabilities.js';
import type { StaffPrincipal } from '../auth/types.js';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import { completeIdempotent, startIdempotent } from '../hall-pass/idempotency.js';
import { HallPassError } from '../hall-pass/types.js';
import { SchedulePolicyService } from '../schedule-policy/service.js';
import { hashOpaqueValue } from '../student-credentials/crypto.js';
import type {
  StudentPassEvidence,
  TeacherApplicationServiceOptions,
  TeacherLiveSnapshot,
  TeacherPolicyControl,
  TeacherSectionSummary,
} from './types.js';
import { TeacherApplicationError } from './types.js';

const DEFAULT_POLL_MS = 5_000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const POLICY_OVERRIDE_OPERATION = 'TEACHER_SECTION_POLICY_OVERRIDE';
const STUDENT_ACCESS_OPERATION = 'TEACHER_SECTION_STUDENT_ACCESS';

interface SectionScopeRow extends QueryResultRow {
  section_id: string;
  school_id: string;
  organization_id: string;
  academic_year_id: string;
  name: string;
  code: string | null;
  period_label: string | null;
  room: string | null;
  timezone: string;
}

interface RosterRow extends QueryResultRow {
  enrollment_id: string;
  student_id: string;
  display_name: string;
  local_student_number: string | null;
}
interface PassLiveRow extends QueryResultRow {
  pass_id: string; student_id: string; display_name: string; destination_id: string; destination_name: string;
  started_at: Date; default_expected_minutes: number | null;
}
interface QueueLiveRow extends QueryResultRow {
  queue_entry_id: string; pass_request_id: string; student_id: string; display_name: string;
  destination_id: string; destination_name: string; joined_at: Date; queue_expires_at: Date;
}
interface PolicySetRow extends QueryResultRow { id: string; effective_from: string | Date; effective_until: string | Date | null }
interface PolicyValueRow extends QueryResultRow { id: string; typed_value_json: unknown; teacher_override_allowed: boolean }
interface EvidenceRow extends QueryResultRow {
  pass_id: string; started_at: Date; returned_at: Date | null; destination_name: string;
  status: 'OUT' | 'RETURNED' | 'ROLLED_OVER'; original_countability: string; effective_countability: string; duration_ms: string | number | null;
}

function dateOnly(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function academicDateAt(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get('year'); const month = values.get('month'); const day = values.get('day');
  if (!year || !month || !day) throw new TeacherApplicationError('SCHOOL_CLOCK_UNAVAILABLE', 'School clock is unavailable.', 503, true);
  return `${year}-${month}-${day}`;
}

function jsonKind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function safeJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(safeJsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(safeJsonValue);
}

function isMutationResponse(value: unknown): value is { id: string; sectionId: string } {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.sectionId === 'string';
}

export class TeacherApplicationService {
  readonly #database: Database;
  readonly #schedulePolicy: SchedulePolicyService;
  readonly #now: () => Date;
  readonly #pollAfterMs: number;

  constructor(database: Database, schedulePolicy: SchedulePolicyService, options: TeacherApplicationServiceOptions = {}) {
    this.#database = database;
    this.#schedulePolicy = schedulePolicy;
    this.#now = options.now ?? (() => new Date());
    this.#pollAfterMs = options.pollAfterMs ?? DEFAULT_POLL_MS;
    if (!Number.isInteger(this.#pollAfterMs) || this.#pollAfterMs < 2_000 || this.#pollAfterMs > 60_000) {
      throw new Error('Teacher polling interval must be between 2 and 60 seconds.');
    }
  }

  async assignedSections(principal: StaffPrincipal): Promise<readonly TeacherSectionSummary[]> {
    const schoolIds = [...new Set(principal.roleGrants
      .filter((grant) => roleAllowsCapability(grant.role, 'teacher.section.read'))
      .map((grant) => grant.schoolId))];
    if (schoolIds.length === 0) return [];
    const rows = await this.#database.query<SectionScopeRow>(
      `SELECT sec.id AS section_id, sec.school_id, s.organization_id, sec.academic_year_id,
              sec.name, sec.code, sec.period_label, sec.room, s.timezone
         FROM section_staff_assignments ssa
         JOIN sections sec ON sec.school_id=ssa.school_id AND sec.id=ssa.section_id AND sec.status='ACTIVE'
         JOIN schools s ON s.id=sec.school_id AND s.organization_id=ssa.organization_id AND s.status='ACTIVE'
        WHERE ssa.organization_id=$1 AND ssa.user_id=$2
          AND ssa.school_id = ANY($3::uuid[])
          AND ssa.revoked_at IS NULL
          AND ssa.valid_from <= now()
          AND (ssa.valid_until IS NULL OR ssa.valid_until > now())
        ORDER BY sec.period_label NULLS LAST, sec.name, sec.id`,
      [principal.organizationId, principal.userId, schoolIds],
    );
    return rows.map((row) => ({
      sectionId: row.section_id, schoolId: row.school_id, name: row.name, code: row.code,
      periodLabel: row.period_label, room: row.room,
    }));
  }

  async sectionScope(sectionId: string): Promise<SectionScopeRow> {
    const rows = await this.#database.query<SectionScopeRow>(
      `SELECT sec.id AS section_id, sec.school_id, s.organization_id, sec.academic_year_id,
              sec.name, sec.code, sec.period_label, sec.room, s.timezone
         FROM sections sec JOIN schools s ON s.id=sec.school_id AND s.status='ACTIVE'
        WHERE sec.id=$1 AND sec.status='ACTIVE'`, [sectionId],
    );
    const row = rows[0];
    if (!row) throw new TeacherApplicationError('SECTION_NOT_FOUND', 'Section was not found.', 404);
    return row;
  }

  async passScope(passId: string): Promise<{ sectionId: string; schoolId: string }> {
    const rows = await this.#database.query<{ section_id: string; school_id: string } & QueryResultRow>(
      `SELECT section_id, school_id FROM passes WHERE id=$1 LIMIT 1`, [passId],
    );
    const row = rows[0];
    if (!row) throw new TeacherApplicationError('PASS_NOT_FOUND', 'Pass was not found.', 404);
    return { sectionId: row.section_id, schoolId: row.school_id };
  }

  async liveSection(sectionId: string): Promise<TeacherLiveSnapshot> {
    const at = this.#now();
    const scope = await this.sectionScope(sectionId);
    const academicDate = academicDateAt(at, scope.timezone);
    const [context, roster, passes, queue, checkins] = await Promise.all([
      this.#schedulePolicy.resolveContext({ sectionId, at }),
      this.#database.query<RosterRow>(
        `SELECT e.id AS enrollment_id, st.id AS student_id, st.display_name, st.local_student_number
           FROM enrollments e
           JOIN students st ON st.school_id=e.school_id AND st.id=e.student_id AND st.status='ACTIVE'
          WHERE e.school_id=$1 AND e.section_id=$2 AND e.status='ACTIVE'
          ORDER BY st.display_name, st.id LIMIT 500`, [scope.school_id, sectionId]),
      this.#database.query<PassLiveRow>(
        `SELECT p.id AS pass_id, p.student_id, st.display_name, p.destination_id, d.name AS destination_name,
                p.started_at, d.default_expected_minutes
           FROM passes p
           JOIN students st ON st.school_id=p.school_id AND st.id=p.student_id
           JOIN destinations d ON d.school_id=p.school_id AND d.id=p.destination_id
          WHERE p.school_id=$1 AND p.section_id=$2 AND p.status='OUT'
          ORDER BY p.started_at, p.id LIMIT 100`, [scope.school_id, sectionId]),
      this.#database.query<QueueLiveRow>(
        `SELECT q.id AS queue_entry_id, q.pass_request_id, q.student_id, st.display_name,
                pr.destination_id, d.name AS destination_name, q.joined_at, pr.queue_expires_at
           FROM queue_entries q
           JOIN pass_requests pr ON pr.school_id=q.school_id AND pr.id=q.pass_request_id AND pr.status='QUEUED'
           JOIN students st ON st.school_id=q.school_id AND st.id=q.student_id
           JOIN destinations d ON d.school_id=q.school_id AND d.id=pr.destination_id
          WHERE q.school_id=$1 AND q.section_id=$2 AND q.status='WAITING'
          ORDER BY q.order_token LIMIT 100`, [scope.school_id, sectionId]),
      this.#database.query<{ student_id: string } & QueryResultRow>(
        `SELECT student_id FROM checkins WHERE school_id=$1 AND section_id=$2 AND academic_date=$3::date LIMIT 500`,
        [scope.school_id, sectionId, academicDate]),
    ]);

    const checked = new Set(checkins.map((row) => row.student_id));
    const activePasses = passes.map((row) => {
      const elapsedSeconds = Math.max(0, Math.floor((at.getTime() - row.started_at.getTime()) / 1000));
      const late = row.default_expected_minutes !== null && elapsedSeconds > row.default_expected_minutes * 60;
      return {
        passId: row.pass_id, studentId: row.student_id, studentName: row.display_name,
        destinationId: row.destination_id, destinationName: row.destination_name,
        startedAt: row.started_at.toISOString(), elapsedSeconds, expectedMinutes: row.default_expected_minutes,
        warning: late ? 'LATE' as const : null,
      };
    });
    const queueItems = queue.map((row) => {
      const waitingSeconds = Math.max(0, Math.floor((at.getTime() - row.joined_at.getTime()) / 1000));
      const expiring = row.queue_expires_at.getTime() - at.getTime() <= 60_000;
      return {
        queueEntryId: row.queue_entry_id, passRequestId: row.pass_request_id, studentId: row.student_id,
        studentName: row.display_name, destinationId: row.destination_id, destinationName: row.destination_name,
        joinedAt: row.joined_at.toISOString(), queueExpiresAt: row.queue_expires_at.toISOString(), waitingSeconds,
        warning: expiring ? 'EXPIRING_SOON' as const : null,
      };
    });

    const warnings: { code: string; message: string }[] = [];
    if (context.session.status !== 'IN_SESSION') warnings.push({ code: 'SCHEDULE_WARNING', message: `Schedule warning: ${context.session.reason}.` });
    for (const pass of activePasses.filter((item) => item.warning === 'LATE')) warnings.push({ code: 'LATE_PASS', message: `Late pass warning for ${pass.studentName}.` });
    for (const item of queueItems.filter((entry) => entry.warning === 'EXPIRING_SOON')) warnings.push({ code: 'QUEUE_EXPIRING', message: `Queue request expiring soon for ${item.studentName}.` });

    const policyControls: TeacherPolicyControl[] = [];
    if (context.policy?.status === 'RESOLVED') {
      const allowed = await this.#database.query<{ policy_key: string } & QueryResultRow>(
        `SELECT policy_key FROM policy_values WHERE school_id=$1 AND policy_set_id=$2 AND teacher_override_allowed=true ORDER BY policy_key`,
        [scope.school_id, context.policy.policySet.id],
      );
      for (const row of allowed) {
        const effective = context.policy.values[row.policy_key];
        if (effective) policyControls.push({ policyKey: row.policy_key, value: effective.value, source: effective.source });
      }
    }

    const rosterItems = roster.map((row) => ({
      enrollmentId: row.enrollment_id, studentId: row.student_id, displayName: row.display_name,
      localStudentNumber: row.local_student_number, checkedIn: checked.has(row.student_id),
    }));
    return {
      section: { sectionId, schoolId: scope.school_id, name: scope.name, code: scope.code, periodLabel: scope.period_label, room: scope.room },
      generatedAt: at.toISOString(), academicDate, schedule: context,
      roster: rosterItems, activePasses, queue: queueItems,
      checkInSummary: { enrolled: rosterItems.length, checkedIn: checked.size, missing: Math.max(0, rosterItems.length - checked.size) },
      warnings, policyControls,
      transport: { mode: 'POLLING_FALLBACK', pollAfterMs: this.#pollAfterMs, sectionChannel: `section:${sectionId}` },
    };
  }

  async studentPassEvidence(sectionId: string, studentId: string, limit: number): Promise<StudentPassEvidence> {
    const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const at = this.#now();
    const scope = await this.sectionScope(sectionId);
    const academicDate = academicDateAt(at, scope.timezone);
    const memberships = await this.#database.query<{ enrollment_id: string; display_name: string } & QueryResultRow>(
      `SELECT e.id AS enrollment_id, st.display_name
         FROM enrollments e JOIN students st ON st.school_id=e.school_id AND st.id=e.student_id AND st.status='ACTIVE'
        WHERE e.school_id=$1 AND e.section_id=$2 AND e.student_id=$3 AND e.status='ACTIVE' LIMIT 1`,
      [scope.school_id, sectionId, studentId],
    );
    const membership = memberships[0];
    if (!membership) throw new TeacherApplicationError('STUDENT_NOT_AVAILABLE_IN_SECTION', 'Student is not available in this section.', 404);
    const terms = await this.#database.query<{ id: string; starts_on: string | Date; ends_on: string | Date } & QueryResultRow>(
      `SELECT id, starts_on, ends_on FROM academic_terms
        WHERE school_id=$1 AND academic_year_id=$2 AND type='MARKING_PERIOD'
          AND starts_on<=$3::date AND ends_on>=$3::date ORDER BY ordinal`,
      [scope.school_id, scope.academic_year_id, academicDate],
    );
    const term = terms[0];
    if (!term || terms.length !== 1) throw new TeacherApplicationError('TERM_UNAVAILABLE', 'Current marking period is unavailable.', 503, true);
    const rows = await this.#database.query<EvidenceRow>(
      `SELECT p.id AS pass_id, p.started_at, p.returned_at, d.name AS destination_name, p.status,
              p.countability AS original_countability,
              CASE WHEN p.status='OUT' THEN p.countability ELSE COALESCE(latest.resulting_countability,p.countability) END AS effective_countability,
              p.duration_ms
         FROM passes p
         JOIN destinations d ON d.school_id=p.school_id AND d.id=p.destination_id
         LEFT JOIN LATERAL (
           SELECT pc.resulting_countability FROM pass_corrections pc
            WHERE pc.school_id=p.school_id AND pc.pass_id=p.id ORDER BY pc.created_at DESC, pc.id DESC LIMIT 1
         ) latest ON true
        WHERE p.school_id=$1 AND p.enrollment_id=$2
          AND (p.started_at AT TIME ZONE $3)::date BETWEEN $4::date AND $5::date
        ORDER BY p.started_at DESC, p.id DESC LIMIT $6`,
      [scope.school_id, membership.enrollment_id, scope.timezone, term.starts_on, term.ends_on, boundedLimit],
    );
    return {
      sectionId, studentId, studentName: membership.display_name, termId: term.id,
      termStartsOn: dateOnly(term.starts_on), termEndsOn: dateOnly(term.ends_on), limit: boundedLimit,
      items: rows.map((row) => ({
        passId: row.pass_id, startedAt: row.started_at.toISOString(), returnedAt: row.returned_at?.toISOString() ?? null,
        destinationName: row.destination_name, status: row.status, originalCountability: row.original_countability,
        effectiveCountability: row.effective_countability, durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      })),
    };
  }

  async setPolicyOverride(input: {
    actorUserId: string; sectionId: string; policyKey: string; value: unknown; reasonPrivate: string;
    idempotencyKey: string; correlationId: string;
  }): Promise<{ id: string; sectionId: string; policyKey: string; value: unknown; effectiveAt: string }> {
    if (!/^[A-Z0-9_]+$/.test(input.policyKey) || !safeJsonValue(input.value) || JSON.stringify(input.value).length > 2_000) {
      throw new TeacherApplicationError('POLICY_OVERRIDE_INVALID', 'Policy override value is invalid.', 400);
    }
    const database = this.#transactionalDatabase(); const at = this.#now();
    return database.transaction(async (transaction) => {
      const scope = await this.#sectionScope(transaction, input.sectionId);
      const policySet = await this.#effectivePolicySet(transaction, scope, at);
      const values = await transaction.query<PolicyValueRow>(
        `SELECT id, typed_value_json, teacher_override_allowed FROM policy_values
          WHERE school_id=$1 AND policy_set_id=$2 AND policy_key=$3 LIMIT 1`,
        [scope.school_id, policySet.id, input.policyKey],
      );
      const policy = values[0];
      if (!policy || !policy.teacher_override_allowed) throw new TeacherApplicationError('POLICY_OVERRIDE_DENIED', 'This policy key is not teacher-overridable.', 403);
      if (jsonKind(policy.typed_value_json) !== jsonKind(input.value)) throw new TeacherApplicationError('POLICY_OVERRIDE_INVALID', 'Override value type does not match the school policy.', 400);
      const idempotency = await startIdempotent(transaction, {
        organizationId: scope.organization_id, schoolId: scope.school_id, key: input.idempotencyKey, operation: POLICY_OVERRIDE_OPERATION,
        fingerprint: hashOpaqueValue(`${POLICY_OVERRIDE_OPERATION}\u0000${input.sectionId}\u0000${input.policyKey}\u0000${JSON.stringify(input.value)}\u0000${input.reasonPrivate}`),
        correlationId: input.correlationId, at, ttlMs: IDEMPOTENCY_TTL_MS,
        validateResponse: (value): value is { id: string; sectionId: string; policyKey: string; value: unknown; effectiveAt: string } => isMutationResponse(value) && typeof (value as Record<string, unknown>).policyKey === 'string',
      });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;
      const existing = await transaction.query<{ id: string; valid_from: Date } & QueryResultRow>(
        `SELECT id, valid_from FROM section_policy_overrides
          WHERE school_id=$1 AND section_id=$2 AND policy_key=$3 AND valid_from<=$4::timestamptz
            AND (valid_until IS NULL OR valid_until>$4::timestamptz) ORDER BY valid_from DESC FOR UPDATE`,
        [scope.school_id, input.sectionId, input.policyKey, at.toISOString()],
      );
      for (const row of existing) {
        if (row.valid_from.getTime() >= at.getTime()) throw new TeacherApplicationError('POLICY_OVERRIDE_CONFLICT', 'An override already starts at this instant.', 409);
        await transaction.query(`UPDATE section_policy_overrides SET valid_until=$2::timestamptz WHERE id=$1`, [row.id, at.toISOString()]);
      }
      const inserted = await transaction.query<{ id: string } & QueryResultRow>(
        `INSERT INTO section_policy_overrides (organization_id,school_id,section_id,policy_key,typed_value_json,valid_from,set_by_user_id,reason)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::timestamptz,$7,$8) RETURNING id`,
        [scope.organization_id, scope.school_id, input.sectionId, input.policyKey, JSON.stringify(input.value), at.toISOString(), input.actorUserId, input.reasonPrivate],
      );
      const override = inserted[0]; if (!override) throw new Error('Policy override insert failed.');
      await this.#writeStaffMutationEvidence(transaction, {
        scope, actorUserId: input.actorUserId, actionType: 'SECTION_POLICY_OVERRIDE', targetType: 'SECTION_POLICY_OVERRIDE', targetId: override.id,
        studentId: null, reasonPrivate: input.reasonPrivate, correlationId: input.correlationId, at,
        metadata: { sectionId: input.sectionId, policyKey: input.policyKey, value: input.value },
      });
      const response = { id: override.id, sectionId: input.sectionId, policyKey: input.policyKey, value: input.value, effectiveAt: at.toISOString() };
      await completeIdempotent(transaction, idempotency.id, response, at, 201); return response;
    });
  }

  async setStudentAccess(input: {
    actorUserId: string; sectionId: string; studentId: string; accessMode: 'STANDARD' | 'UNLIMITED' | 'ESCORT_ONLY';
    reasonPrivate: string; idempotencyKey: string; correlationId: string;
  }): Promise<{ id: string; sectionId: string; studentId: string; accessMode: string; effectiveAt: string }> {
    const database = this.#transactionalDatabase(); const at = this.#now();
    return database.transaction(async (transaction) => {
      const scope = await this.#sectionScope(transaction, input.sectionId);
      const policySet = await this.#effectivePolicySet(transaction, scope, at);
      const enableRows = await transaction.query<PolicyValueRow>(
        `SELECT id, typed_value_json, teacher_override_allowed FROM policy_values
          WHERE school_id=$1 AND policy_set_id=$2 AND policy_key='TEACHER_STUDENT_ACCESS_ENABLED' LIMIT 1`,
        [scope.school_id, policySet.id],
      );
      const enabled = enableRows[0];
      if (!enabled || enabled.typed_value_json !== true || !enabled.teacher_override_allowed) {
        throw new TeacherApplicationError('STUDENT_ACCESS_CHANGE_DENIED', 'Teacher student-access changes are not enabled by school policy.', 403);
      }
      const memberships = await transaction.query<{ id: string } & QueryResultRow>(
        `SELECT id FROM enrollments WHERE school_id=$1 AND section_id=$2 AND student_id=$3 AND status='ACTIVE' LIMIT 1`,
        [scope.school_id, input.sectionId, input.studentId],
      );
      if (!memberships[0]) throw new TeacherApplicationError('STUDENT_NOT_AVAILABLE_IN_SECTION', 'Student is not available in this section.', 404);
      const idempotency = await startIdempotent(transaction, {
        organizationId: scope.organization_id, schoolId: scope.school_id, key: input.idempotencyKey, operation: STUDENT_ACCESS_OPERATION,
        fingerprint: hashOpaqueValue(`${STUDENT_ACCESS_OPERATION}\u0000${input.sectionId}\u0000${input.studentId}\u0000${input.accessMode}\u0000${input.reasonPrivate}`),
        correlationId: input.correlationId, at, ttlMs: IDEMPOTENCY_TTL_MS,
        validateResponse: (value): value is { id: string; sectionId: string; studentId: string; accessMode: string; effectiveAt: string } => isMutationResponse(value) && typeof (value as Record<string, unknown>).studentId === 'string',
      });
      if (idempotency.kind === 'COMPLETED') return idempotency.response;
      await transaction.query(
        `UPDATE student_access_rules SET status='INACTIVE', updated_at=$4::timestamptz
          WHERE school_id=$1 AND student_id=$2 AND section_id=$3 AND status='ACTIVE'`,
        [scope.school_id, input.studentId, input.sectionId, at.toISOString()],
      );
      const inserted = await transaction.query<{ id: string } & QueryResultRow>(
        `INSERT INTO student_access_rules (organization_id,school_id,student_id,section_id,access_mode,reason_private,valid_from,set_by_user_id,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,'ACTIVE') RETURNING id`,
        [scope.organization_id, scope.school_id, input.studentId, input.sectionId, input.accessMode, input.reasonPrivate, at.toISOString(), input.actorUserId],
      );
      const rule = inserted[0]; if (!rule) throw new Error('Student access insert failed.');
      await this.#writeStaffMutationEvidence(transaction, {
        scope, actorUserId: input.actorUserId, actionType: 'STUDENT_ACCESS_CHANGED', targetType: 'STUDENT_ACCESS_RULE', targetId: rule.id,
        studentId: input.studentId, reasonPrivate: input.reasonPrivate, correlationId: input.correlationId, at,
        metadata: { sectionId: input.sectionId, studentId: input.studentId, accessMode: input.accessMode },
      });
      const response = { id: rule.id, sectionId: input.sectionId, studentId: input.studentId, accessMode: input.accessMode, effectiveAt: at.toISOString() };
      await completeIdempotent(transaction, idempotency.id, response, at, 201); return response;
    });
  }

  async #sectionScope(executor: QueryExecutor, sectionId: string): Promise<SectionScopeRow> {
    const rows = await executor.query<SectionScopeRow>(
      `SELECT sec.id AS section_id, sec.school_id, s.organization_id, sec.academic_year_id,
              sec.name, sec.code, sec.period_label, sec.room, s.timezone
         FROM sections sec JOIN schools s ON s.id=sec.school_id AND s.status='ACTIVE'
        WHERE sec.id=$1 AND sec.status='ACTIVE' FOR SHARE`, [sectionId],
    );
    const row = rows[0]; if (!row) throw new TeacherApplicationError('SECTION_NOT_FOUND', 'Section was not found.', 404); return row;
  }

  async #effectivePolicySet(executor: QueryExecutor, scope: SectionScopeRow, at: Date): Promise<PolicySetRow> {
    const academicDate = academicDateAt(at, scope.timezone);
    const rows = await executor.query<PolicySetRow>(
      `SELECT id,effective_from,effective_until FROM school_policy_sets
        WHERE school_id=$1 AND academic_year_id=$2 AND active=true
          AND effective_from<=$3::date AND (effective_until IS NULL OR effective_until>=$3::date)
        ORDER BY effective_from DESC,id`, [scope.school_id, scope.academic_year_id, academicDate],
    );
    if (rows.length !== 1 || !rows[0]) throw new TeacherApplicationError('PASS_POLICY_UNAVAILABLE', 'School policy is unavailable or ambiguous.', 503, true);
    return rows[0];
  }

  async #writeStaffMutationEvidence(executor: QueryExecutor, input: {
    scope: SectionScopeRow; actorUserId: string; actionType: string; targetType: string; targetId: string;
    studentId: string | null; reasonPrivate: string; correlationId: string; at: Date; metadata: Record<string, unknown>;
  }): Promise<void> {
    const actions = await executor.query<{ id: string } & QueryResultRow>(
      `INSERT INTO staff_actions (organization_id,school_id,actor_user_id,action_type,student_id,section_id,restrictions_bypassed_json,reason_private,occurred_at,correlation_id)
       VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,$7,$8::timestamptz,$9) RETURNING id`,
      [input.scope.organization_id,input.scope.school_id,input.actorUserId,input.actionType,input.studentId,input.scope.section_id,input.reasonPrivate,input.at.toISOString(),input.correlationId],
    );
    const action = actions[0]; if (!action) throw new Error('Staff evidence insert failed.');
    const metadata = { ...input.metadata, staffActionId: action.id };
    await executor.query(
      `INSERT INTO audit_events (organization_id,school_id,actor_user_id,actor_student_id,actor_kind,action,target_type,target_id,request_id,correlation_id,source,reason,metadata)
       VALUES ($1,$2,$3,NULL,'USER',$4,$5,$6,$7,$7,'APPLICATION',$8,$9::jsonb)`,
      [input.scope.organization_id,input.scope.school_id,input.actorUserId,input.actionType,input.targetType,input.targetId,input.correlationId,input.reasonPrivate,JSON.stringify(metadata)],
    );
    await executor.query(
      `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,aggregate_id,correlation_id,payload_json_sanitized)
       VALUES ($1,$2,'schoolwide.teacher',$3,$4,$5,$6,$7::jsonb)`,
      [input.scope.organization_id,input.scope.school_id,input.actionType,input.targetType,input.targetId,input.correlationId,JSON.stringify(metadata)],
    );
  }

  #transactionalDatabase() {
    if (!supportsTransactions(this.#database)) throw new HallPassError('TEACHER_MUTATION_UNAVAILABLE', 'Teacher mutations require transactional storage.', 503, true);
    return this.#database;
  }
}
