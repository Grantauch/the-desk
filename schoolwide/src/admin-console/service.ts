import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { roleAllowsCapability } from '../auth/capabilities.js';
import type { Capability, StaffRole } from '../auth/types.js';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import {
  AdminConsoleError,
  type AdminAuditRow,
  type AdminCalendarRow,
  type AdminConsoleServiceOptions,
  type AdminDestinationRow,
  type AdminIntegrationReviewRow,
  type AdminMutationResult,
  type AdminOverview,
  type AdminPolicyRow,
  type AdminPrincipal,
  type AdminSectionRow,
  type AdminStaffRow,
  type AdminStudentAccessRow,
} from './types.js';

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_STALE_INTEGRATION_MS = 24 * 60 * 60_000;
const ADMIN_GRANTABLE_ROLES = ['TEACHER', 'SECURITY', 'ADMIN'] as const;
type AdminGrantableRole = (typeof ADMIN_GRANTABLE_ROLES)[number];

interface CountRow extends QueryResultRow { count: string | number }
interface IdempotencyRow extends QueryResultRow {
  id: string;
  operation: string;
  request_fingerprint: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_json_sanitized: unknown;
  expires_at: Date;
}
interface SchoolRow extends QueryResultRow { id: string; organization_id: string }
interface TargetUserRow extends QueryResultRow { id: string; organization_id: string; status: 'ACTIVE' | 'INACTIVE' }
interface RoleRow extends QueryResultRow { id: string; organization_id: string; school_id: string; user_id: string; role: StaffRole; revoked_at: Date | null }

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function bounded(value: number, max: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(max, Math.floor(value)));
}
function isAdminMutationResult(value: unknown): value is AdminMutationResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.action === 'string' && typeof row.targetType === 'string'
    && typeof row.targetId === 'string' && typeof row.recordedAt === 'string';
}
function grantableRole(role: StaffRole): role is AdminGrantableRole {
  return ADMIN_GRANTABLE_ROLES.includes(role as AdminGrantableRole);
}
function isoDate(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export class AdminConsoleService {
  readonly #database: Database;
  readonly #now: () => Date;
  readonly #idempotencyTtlMs: number;
  readonly #staleIntegrationMs: number;

  constructor(database: Database, options: AdminConsoleServiceOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#idempotencyTtlMs = options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    this.#staleIntegrationMs = options.staleIntegrationMs ?? DEFAULT_STALE_INTEGRATION_MS;
  }

  resolveSchoolId(principal: AdminPrincipal, capability: Capability): string {
    const schoolIds = [...new Set(principal.roleGrants
      .filter((grant) => grant.role === 'ADMIN' && roleAllowsCapability(grant.role, capability))
      .map((grant) => grant.schoolId))];
    if (schoolIds.length === 0) throw new AdminConsoleError('ADMIN_SCHOOL_SCOPE_DENIED', 'No current administrator school scope is available.', 403);
    if (schoolIds.length !== 1) throw new AdminConsoleError('ADMIN_SCHOOL_SCOPE_AMBIGUOUS', 'This administrator session has more than one school scope; an explicit authorized selector is required before district-wide administration.', 409);
    return schoolIds[0]!;
  }

  async overview(principal: AdminPrincipal): Promise<AdminOverview> {
    const schoolId = this.resolveSchoolId(principal, 'admin.school.read_all_operational');
    await this.#school(schoolId, principal.organizationId);
    const at = this.#now();
    const staleBefore = new Date(at.getTime() - this.#staleIntegrationMs).toISOString();
    const [staff, sections, students, reviews, destinations, connections, stale] = await Promise.all([
      this.#database.query<CountRow>(`SELECT count(DISTINCT u.id) AS count FROM users u JOIN user_roles ur ON ur.organization_id=u.organization_id AND ur.user_id=u.id WHERE ur.school_id=$1 AND u.status='ACTIVE' AND ur.revoked_at IS NULL AND ur.valid_from <= $2::timestamptz AND (ur.valid_until IS NULL OR ur.valid_until > $2::timestamptz)`, [schoolId, at.toISOString()]),
      this.#database.query<CountRow>(`SELECT count(*) AS count FROM sections WHERE school_id=$1 AND status='ACTIVE'`, [schoolId]),
      this.#database.query<CountRow>(`SELECT count(*) AS count FROM students WHERE school_id=$1 AND status='ACTIVE'`, [schoolId]),
      this.#database.query<CountRow>(`SELECT count(*) AS count FROM integration_review_items WHERE school_id=$1 AND status='OPEN'`, [schoolId]),
      this.#database.query<CountRow>(`SELECT count(*) AS count FROM destinations WHERE school_id=$1 AND active=true`, [schoolId]),
      this.#database.query<{ status: string; count: string | number } & QueryResultRow>(`SELECT status,count(*) AS count FROM classroom_connections WHERE school_id=$1 GROUP BY status`, [schoolId]),
      this.#database.query<CountRow>(`SELECT count(*) AS count FROM section_external_links WHERE school_id=$1 AND status='ACTIVE' AND (last_success_at IS NULL OR last_success_at < $2::timestamptz)`, [schoolId, staleBefore]),
    ]);
    const statusCounts = new Map(connections.map((row) => [row.status, Number(row.count)]));
    return {
      schoolId,
      generatedAt: at.toISOString(),
      summary: {
        activeStaff: Number(staff[0]?.count ?? 0),
        activeSections: Number(sections[0]?.count ?? 0),
        activeStudents: Number(students[0]?.count ?? 0),
        openIntegrationReviews: Number(reviews[0]?.count ?? 0),
        activeDestinations: Number(destinations[0]?.count ?? 0),
      },
      integrationHealth: {
        active: statusCounts.get('ACTIVE') ?? 0,
        revoked: statusCounts.get('REVOKED') ?? 0,
        error: statusCounts.get('ERROR') ?? 0,
        staleLinks: Number(stale[0]?.count ?? 0),
      },
    };
  }

  async listStaff(principal: AdminPrincipal, limit = 100): Promise<{ schoolId: string; rows: readonly AdminStaffRow[] }> {
    const schoolId = this.resolveSchoolId(principal, 'admin.school.read_all_operational');
    const at = this.#now();
    const rows = await this.#database.query<{
      user_id: string; display_name: string; primary_email: string; user_status: 'ACTIVE' | 'INACTIVE';
      role_id: string | null; role: StaffRole | null; valid_from: Date | null; valid_until: Date | null;
    } & QueryResultRow>(
      `SELECT u.id AS user_id,u.display_name,u.primary_email,u.status AS user_status,
              ur.id AS role_id,ur.role,ur.valid_from,ur.valid_until
         FROM users u
         JOIN user_roles school_role ON school_role.organization_id=u.organization_id AND school_role.user_id=u.id AND school_role.school_id=$1
         LEFT JOIN user_roles ur ON ur.organization_id=u.organization_id AND ur.user_id=u.id AND ur.school_id=$1
           AND ur.revoked_at IS NULL AND ur.valid_from <= $2::timestamptz AND (ur.valid_until IS NULL OR ur.valid_until > $2::timestamptz)
        WHERE u.organization_id=$3
        GROUP BY u.id,u.display_name,u.primary_email,u.status,ur.id,ur.role,ur.valid_from,ur.valid_until
        ORDER BY u.display_name,u.id,ur.role
        LIMIT $4`,
      [schoolId, at.toISOString(), principal.organizationId, bounded(limit, 250) * 4],
    );
    const byUser = new Map<string, AdminStaffRow>();
    for (const row of rows) {
      const current = byUser.get(row.user_id) ?? { userId: row.user_id, displayName: row.display_name, primaryEmail: row.primary_email, status: row.user_status, roles: [] };
      const roles = [...current.roles];
      if (row.role_id && row.role && row.valid_from) roles.push({ roleId: row.role_id, role: row.role, validFrom: row.valid_from.toISOString(), validUntil: row.valid_until?.toISOString() ?? null });
      byUser.set(row.user_id, { ...current, roles });
      if (byUser.size >= bounded(limit, 250)) break;
    }
    return { schoolId, rows: [...byUser.values()] };
  }

  async listSections(principal: AdminPrincipal, limit = 100): Promise<{ schoolId: string; rows: readonly AdminSectionRow[] }> {
    const schoolId = this.resolveSchoolId(principal, 'admin.school.read_all_operational');
    const rows = await this.#database.query<{
      section_id: string; name: string; code: string | null; period_code: string | null; room: string | null; source: string;
      status: 'ACTIVE' | 'INACTIVE'; academic_year_id: string; staff_count: string | number; enrollment_count: string | number;
    } & QueryResultRow>(
      `SELECT sec.id AS section_id,sec.name,sec.code,sec.period_code,sec.room,sec.source,sec.status,sec.academic_year_id,
              count(DISTINCT ssa.id) FILTER (WHERE ssa.revoked_at IS NULL) AS staff_count,
              count(DISTINCT e.id) FILTER (WHERE e.status='ACTIVE') AS enrollment_count
         FROM sections sec
         LEFT JOIN section_staff_assignments ssa ON ssa.school_id=sec.school_id AND ssa.section_id=sec.id
         LEFT JOIN enrollments e ON e.school_id=sec.school_id AND e.section_id=sec.id
        WHERE sec.school_id=$1 GROUP BY sec.id ORDER BY sec.status,sec.name,sec.id LIMIT $2`,
      [schoolId, bounded(limit, 250)],
    );
    return { schoolId, rows: rows.map((r) => ({ sectionId:r.section_id,name:r.name,code:r.code,periodCode:r.period_code,room:r.room,source:r.source,status:r.status,academicYearId:r.academic_year_id,staffCount:Number(r.staff_count),activeEnrollmentCount:Number(r.enrollment_count) })) };
  }

  async listPolicies(principal: AdminPrincipal, limit = 200): Promise<{ schoolId: string; rows: readonly AdminPolicyRow[] }> {
    const schoolId = this.resolveSchoolId(principal, 'admin.policies.manage');
    const rows = await this.#database.query<{
      set_id:string; set_name:string; effective_from:string|Date; effective_until:string|Date|null; active:boolean;
      value_id:string; policy_key:string; typed_value_json:unknown; teacher_override_allowed:boolean; validation_schema_version:number;
    } & QueryResultRow>(
      `SELECT sps.id AS set_id,sps.name AS set_name,sps.effective_from,sps.effective_until,sps.active,
              pv.id AS value_id,pv.policy_key,pv.typed_value_json,pv.teacher_override_allowed,pv.validation_schema_version
         FROM school_policy_sets sps JOIN policy_values pv ON pv.school_id=sps.school_id AND pv.policy_set_id=sps.id
        WHERE sps.school_id=$1 ORDER BY sps.effective_from DESC,pv.policy_key LIMIT $2`, [schoolId,bounded(limit,300)]);
    return { schoolId, rows: rows.map((r)=>({policySetId:r.set_id,policySetName:r.set_name,effectiveFrom:isoDate(r.effective_from),effectiveUntil:r.effective_until?isoDate(r.effective_until):null,active:r.active,policyValueId:r.value_id,policyKey:r.policy_key,typedValue:r.typed_value_json,teacherOverrideAllowed:r.teacher_override_allowed,validationSchemaVersion:r.validation_schema_version})) };
  }

  async listDestinations(principal: AdminPrincipal): Promise<{ schoolId: string; rows: readonly AdminDestinationRow[] }> {
    const schoolId = this.resolveSchoolId(principal, 'admin.destinations.manage');
    const rows = await this.#database.query<{
      id:string;name:string;category:AdminDestinationRow['category'];active:boolean;security_visible:boolean;student_selectable:boolean;default_expected_minutes:number|null;capacity:number|null;
    } & QueryResultRow>(`SELECT id,name,category,active,security_visible,student_selectable,default_expected_minutes,capacity FROM destinations WHERE school_id=$1 ORDER BY active DESC,name,id LIMIT 150`,[schoolId]);
    return { schoolId, rows: rows.map((r)=>({destinationId:r.id,name:r.name,category:r.category,active:r.active,securityVisible:r.security_visible,studentSelectable:r.student_selectable,defaultExpectedMinutes:r.default_expected_minutes,capacity:r.capacity})) };
  }

  async listCalendar(principal: AdminPrincipal, from: string, to: string): Promise<{ schoolId: string; rows: readonly AdminCalendarRow[] }> {
    const schoolId = this.resolveSchoolId(principal, 'admin.calendar.manage');
    const rows = await this.#database.query<{
      id:string;academic_date:string|Date;is_school_day:boolean;schedule_profile_id:string|null;schedule_profile_name:string|null;label:string|null;source:string;source_revision:string|null;
    } & QueryResultRow>(`SELECT cal.id,cal.academic_date,cal.is_school_day,cal.schedule_profile_id,sp.name AS schedule_profile_name,cal.label,cal.source,cal.source_revision FROM school_calendar_days cal LEFT JOIN schedule_profiles sp ON sp.school_id=cal.school_id AND sp.id=cal.schedule_profile_id WHERE cal.school_id=$1 AND cal.academic_date BETWEEN $2::date AND $3::date ORDER BY cal.academic_date LIMIT 100`,[schoolId,from,to]);
    return { schoolId, rows: rows.map((r)=>({calendarDayId:r.id,academicDate:isoDate(r.academic_date),isSchoolDay:r.is_school_day,scheduleProfileId:r.schedule_profile_id,scheduleProfileName:r.schedule_profile_name,label:r.label,source:r.source,sourceRevision:r.source_revision})) };
  }

  async listStudentAccess(principal: AdminPrincipal, limit = 100): Promise<{ schoolId:string; rows:readonly AdminStudentAccessRow[] }> {
    const schoolId=this.resolveSchoolId(principal,'admin.student_access.manage');
    const rows=await this.#database.query<{
      id:string;student_id:string;student_name:string;section_id:string|null;section_name:string|null;access_mode:AdminStudentAccessRow['accessMode'];reason_private:string|null;valid_from:Date;valid_until:Date|null;status:AdminStudentAccessRow['status'];set_by_user_id:string|null;
    } & QueryResultRow>(`SELECT sar.id,sar.student_id,st.display_name AS student_name,sar.section_id,sec.name AS section_name,sar.access_mode,sar.reason_private,sar.valid_from,sar.valid_until,sar.status,sar.set_by_user_id FROM student_access_rules sar JOIN students st ON st.school_id=sar.school_id AND st.id=sar.student_id LEFT JOIN sections sec ON sec.school_id=sar.school_id AND sec.id=sar.section_id WHERE sar.school_id=$1 ORDER BY sar.created_at DESC,sar.id DESC LIMIT $2`,[schoolId,bounded(limit,200)]);
    return {schoolId,rows:rows.map((r)=>({ruleId:r.id,studentId:r.student_id,studentName:r.student_name,sectionId:r.section_id,sectionName:r.section_name,accessMode:r.access_mode,reasonPrivate:r.reason_private,validFrom:r.valid_from.toISOString(),validUntil:r.valid_until?.toISOString()??null,status:r.status,setByUserId:r.set_by_user_id}))};
  }

  async listIntegrationReviews(principal: AdminPrincipal, limit=100): Promise<{schoolId:string;rows:readonly AdminIntegrationReviewRow[]}> {
    const schoolId=this.resolveSchoolId(principal,'admin.integrations.review');
    const rows=await this.#database.query<{
      id:string;review_type:string;external_key:string;reason:string;status:AdminIntegrationReviewRow['status'];candidate_student_id:string|null;candidate_section_id:string|null;created_at:Date;resolved_at:Date|null;
    } & QueryResultRow>(`SELECT id,review_type,external_key,reason,status,candidate_student_id,candidate_section_id,created_at,resolved_at FROM integration_review_items WHERE school_id=$1 ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT $2`,[schoolId,bounded(limit,200)]);
    return {schoolId,rows:rows.map((r)=>({reviewId:r.id,reviewType:r.review_type,externalKey:r.external_key,reason:r.reason,status:r.status,candidateStudentId:r.candidate_student_id,candidateSectionId:r.candidate_section_id,createdAt:r.created_at.toISOString(),resolvedAt:r.resolved_at?.toISOString()??null}))};
  }

  async listAudit(principal: AdminPrincipal, input:{limit?:number;before?:Date;from?:Date}={}): Promise<{schoolId:string;rows:readonly AdminAuditRow[]}> {
    const schoolId=this.resolveSchoolId(principal,'admin.audit.read_bounded');
    const limit=bounded(input.limit??50,100);
    const before=input.before??this.#now();
    const from=input.from??new Date(before.getTime()-30*24*60*60_000);
    if (before.getTime()<=from.getTime() || before.getTime()-from.getTime()>90*24*60*60_000) throw new AdminConsoleError('ADMIN_AUDIT_RANGE_INVALID','Audit range must be positive and no longer than 90 days.',400);
    const rows=await this.#database.query<{
      id:string;occurred_at:Date;actor_kind:string;actor_user_id:string|null;actor_display_name:string|null;action:string;target_type:string;target_id:string|null;source:string;reason:string|null;metadata:unknown;
    } & QueryResultRow>(`SELECT ae.id,ae.occurred_at,ae.actor_kind,ae.actor_user_id,u.display_name AS actor_display_name,ae.action,ae.target_type,ae.target_id,ae.source,ae.reason,ae.metadata FROM audit_events ae LEFT JOIN users u ON u.organization_id=ae.organization_id AND u.id=ae.actor_user_id WHERE ae.school_id=$1 AND ae.occurred_at >= $2::timestamptz AND ae.occurred_at < $3::timestamptz ORDER BY ae.occurred_at DESC,ae.id DESC LIMIT $4`,[schoolId,from.toISOString(),before.toISOString(),limit]);
    return {schoolId,rows:rows.map((r)=>({auditId:r.id,occurredAt:r.occurred_at.toISOString(),actorKind:r.actor_kind,actorUserId:r.actor_user_id,actorDisplayName:r.actor_display_name,action:r.action,targetType:r.target_type,targetId:r.target_id,source:r.source,reason:r.reason,metadata:r.metadata}))};
  }

  async grantRole(input:{principal:AdminPrincipal;targetUserId:string;role:StaffRole;reason:string;idempotencyKey:string;correlationId:string;validUntil?:Date}):Promise<AdminMutationResult>{
    if(!grantableRole(input.role)) throw new AdminConsoleError('ADMIN_ROLE_INVALID','Only teacher, security, or administrator school roles may be granted through this console.',400);
    const schoolId=this.resolveSchoolId(input.principal,'admin.staff.roles.manage');
    const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_ROLE_GRANT',targetType:'USER_ROLE',targetId:input.targetUserId,reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[input.targetUserId,input.role,input.validUntil?.toISOString()??''],at,work:async(tx)=>{
      const users=await tx.query<TargetUserRow>(`SELECT id,organization_id,status FROM users WHERE id=$1 AND organization_id=$2 FOR UPDATE`,[input.targetUserId,input.principal.organizationId]);
      if(!users[0]||users[0].status!=='ACTIVE') throw new AdminConsoleError('ADMIN_TARGET_USER_INVALID','Target staff user is not an active user in this organization.',404);
      const existing=await tx.query<RoleRow>(`SELECT id,organization_id,school_id,user_id,role,revoked_at FROM user_roles WHERE school_id=$1 AND user_id=$2 AND role=$3 AND revoked_at IS NULL AND valid_from <= $4::timestamptz AND (valid_until IS NULL OR valid_until > $4::timestamptz) FOR UPDATE`,[schoolId,input.targetUserId,input.role,at.toISOString()]);
      if(existing[0]) return existing[0].id;
      const inserted=await tx.query<{id:string}&QueryResultRow>(`INSERT INTO user_roles (organization_id,school_id,user_id,role,valid_from,valid_until,granted_by_user_id,metadata) VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8::jsonb) RETURNING id`,[input.principal.organizationId,schoolId,input.targetUserId,input.role,at.toISOString(),input.validUntil?.toISOString()??null,input.principal.userId,JSON.stringify({reason:input.reason.trim()})]);
      return inserted[0]!.id;
    }});
  }

  async revokeRole(input:{principal:AdminPrincipal;roleId:string;reason:string;idempotencyKey:string;correlationId:string}):Promise<AdminMutationResult>{
    const schoolId=this.resolveSchoolId(input.principal,'admin.staff.roles.manage');
    const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_ROLE_REVOKE',targetType:'USER_ROLE',targetId:input.roleId,reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[input.roleId],at,work:async(tx)=>{
      const rows=await tx.query<RoleRow>(`SELECT id,organization_id,school_id,user_id,role,revoked_at FROM user_roles WHERE id=$1 FOR UPDATE`,[input.roleId]);
      const role=rows[0];
      if(!role) throw new AdminConsoleError('ADMIN_ROLE_NOT_FOUND','Role grant was not found.',404);
      if(role.organization_id!==input.principal.organizationId||role.school_id!==schoolId) throw new AdminConsoleError('ADMIN_SCHOOL_SCOPE_DENIED','Role grant is outside the authorized school.',403);
      if(role.role==='SYSTEM') throw new AdminConsoleError('ADMIN_ROLE_INVALID','System roles cannot be changed through the browser console.',403);
      if(!role.revoked_at) await tx.query(`UPDATE user_roles SET revoked_at=$2::timestamptz,metadata=metadata || $3::jsonb WHERE id=$1`,[role.id,at.toISOString(),JSON.stringify({revokedReason:input.reason.trim(),revokedByUserId:input.principal.userId})]);
      return role.id;
    }});
  }

  async updatePolicyValue(input:{principal:AdminPrincipal;policyValueId:string;typedValue:unknown;teacherOverrideAllowed:boolean;reason:string;idempotencyKey:string;correlationId:string}):Promise<AdminMutationResult>{
    const schoolId=this.resolveSchoolId(input.principal,'admin.policies.manage');
    if(input.typedValue===null||input.typedValue===undefined) throw new AdminConsoleError('ADMIN_POLICY_VALUE_INVALID','Policy value must be explicit and non-null.',400);
    const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_POLICY_VALUE_UPDATE',targetType:'POLICY_VALUE',targetId:input.policyValueId,reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[input.policyValueId,JSON.stringify(input.typedValue),String(input.teacherOverrideAllowed)],at,work:async(tx)=>{
      const rows=await tx.query<{id:string;school_id:string;policy_key:string}&QueryResultRow>(`SELECT id,school_id,policy_key FROM policy_values WHERE id=$1 FOR UPDATE`,[input.policyValueId]);
      if(!rows[0]) throw new AdminConsoleError('ADMIN_POLICY_NOT_FOUND','Policy value was not found.',404);
      if(rows[0].school_id!==schoolId) throw new AdminConsoleError('ADMIN_SCHOOL_SCOPE_DENIED','Policy value is outside the authorized school.',403);
      await tx.query(`UPDATE policy_values SET typed_value_json=$2::jsonb,teacher_override_allowed=$3,updated_at=$4::timestamptz WHERE id=$1`,[input.policyValueId,JSON.stringify(input.typedValue),input.teacherOverrideAllowed,at.toISOString()]);
      return input.policyValueId;
    }});
  }

  async upsertCalendarDay(input:{principal:AdminPrincipal;academicDate:string;isSchoolDay:boolean;scheduleProfileId:string|null;label:string|null;reason:string;idempotencyKey:string;correlationId:string}):Promise<AdminMutationResult>{
    const schoolId=this.resolveSchoolId(input.principal,'admin.calendar.manage');
    if(!input.isSchoolDay&&input.scheduleProfileId!==null) throw new AdminConsoleError('ADMIN_CALENDAR_INVALID','A no-school day cannot have a schedule profile.',400);
    const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_CALENDAR_UPSERT',targetType:'CALENDAR_DAY',targetId:input.academicDate,reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[input.academicDate,String(input.isSchoolDay),input.scheduleProfileId??'',input.label??''],at,work:async(tx)=>{
      if(input.scheduleProfileId){const profiles=await tx.query<{id:string}&QueryResultRow>(`SELECT id FROM schedule_profiles WHERE id=$1 AND school_id=$2 AND status='ACTIVE'`,[input.scheduleProfileId,schoolId]);if(!profiles[0]) throw new AdminConsoleError('ADMIN_CALENDAR_INVALID','Schedule profile is not active in this school.',400);}
      const rows=await tx.query<{id:string}&QueryResultRow>(`INSERT INTO school_calendar_days (organization_id,school_id,academic_date,is_school_day,schedule_profile_id,label,source,updated_by_user_id,updated_at) VALUES ($1,$2,$3::date,$4,$5,$6,'MANUAL',$7,$8::timestamptz) ON CONFLICT (school_id,academic_date) DO UPDATE SET is_school_day=EXCLUDED.is_school_day,schedule_profile_id=EXCLUDED.schedule_profile_id,label=EXCLUDED.label,source='MANUAL',updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=EXCLUDED.updated_at RETURNING id`,[input.principal.organizationId,schoolId,input.academicDate,input.isSchoolDay,input.scheduleProfileId,input.label,input.principal.userId,at.toISOString()]);return rows[0]!.id;
    }});
  }

  async createDestination(input:{principal:AdminPrincipal;name:string;category:AdminDestinationRow['category'];securityVisible:boolean;studentSelectable:boolean;defaultExpectedMinutes:number|null;capacity:number|null;reason:string;idempotencyKey:string;correlationId:string}):Promise<AdminMutationResult>{
    const schoolId=this.resolveSchoolId(input.principal,'admin.destinations.manage');
    const name=input.name.trim();if(!name) throw new AdminConsoleError('ADMIN_DESTINATION_INVALID','Destination name is required.',400);
    const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_DESTINATION_CREATE',targetType:'DESTINATION',targetId:name.toLowerCase(),reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[name,input.category,String(input.securityVisible),String(input.studentSelectable),String(input.defaultExpectedMinutes??''),String(input.capacity??'')],at,work:async(tx)=>{
      const rows=await tx.query<{id:string}&QueryResultRow>(`INSERT INTO destinations (school_id,name,category,active,security_visible,student_selectable,default_expected_minutes,capacity) VALUES ($1,$2,$3,true,$4,$5,$6,$7) RETURNING id`,[schoolId,name,input.category,input.securityVisible,input.studentSelectable,input.defaultExpectedMinutes,input.capacity]);return rows[0]!.id;
    }});
  }

  async createStudentAccessRule(input:{principal:AdminPrincipal;studentId:string;sectionId:string|null;accessMode:AdminStudentAccessRow['accessMode'];reasonPrivate:string;validFrom:Date;validUntil:Date|null;reason:string;idempotencyKey:string;correlationId:string}):Promise<AdminMutationResult>{
    const schoolId=this.resolveSchoolId(input.principal,'admin.student_access.manage');
    if(input.validUntil&&input.validUntil.getTime()<=input.validFrom.getTime()) throw new AdminConsoleError('ADMIN_STUDENT_ACCESS_INVALID','Student access end must be after its start.',400);
    const privateReason=input.reasonPrivate.trim();if(!privateReason) throw new AdminConsoleError('ADMIN_STUDENT_ACCESS_INVALID','A private student-access reason is required.',400);
    const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_STUDENT_ACCESS_CREATE',targetType:'STUDENT_ACCESS_RULE',targetId:input.studentId,reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[input.studentId,input.sectionId??'',input.accessMode,input.validFrom.toISOString(),input.validUntil?.toISOString()??'',hash(privateReason)],at,work:async(tx)=>{
      const students=await tx.query<{id:string}&QueryResultRow>(`SELECT id FROM students WHERE id=$1 AND school_id=$2`,[input.studentId,schoolId]);if(!students[0]) throw new AdminConsoleError('ADMIN_STUDENT_NOT_FOUND','Student was not found in this school.',404);
      if(input.sectionId){const sections=await tx.query<{id:string}&QueryResultRow>(`SELECT id FROM sections WHERE id=$1 AND school_id=$2`,[input.sectionId,schoolId]);if(!sections[0]) throw new AdminConsoleError('ADMIN_SECTION_NOT_FOUND','Section was not found in this school.',404);}
      const rows=await tx.query<{id:string}&QueryResultRow>(`INSERT INTO student_access_rules (organization_id,school_id,student_id,section_id,access_mode,reason_private,valid_from,valid_until,set_by_user_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,'ACTIVE') RETURNING id`,[input.principal.organizationId,schoolId,input.studentId,input.sectionId,input.accessMode,privateReason,input.validFrom.toISOString(),input.validUntil?.toISOString()??null,input.principal.userId]);return rows[0]!.id;
    }});
  }

  async resolveIntegrationReview(input:{principal:AdminPrincipal;reviewId:string;resolution:'RESOLVED_MATCH'|'RESOLVED_NEW'|'DISMISSED';reason:string;idempotencyKey:string;correlationId:string}):Promise<AdminMutationResult>{
    const schoolId=this.resolveSchoolId(input.principal,'admin.integrations.review');const at=this.#now();
    return this.#mutate({principal:input.principal,schoolId,operation:'ADMIN_INTEGRATION_REVIEW_RESOLVE',targetType:'INTEGRATION_REVIEW',targetId:input.reviewId,reason:input.reason,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,fingerprintParts:[input.reviewId,input.resolution],at,work:async(tx)=>{
      const rows=await tx.query<{id:string;school_id:string;status:string}&QueryResultRow>(`SELECT id,school_id,status FROM integration_review_items WHERE id=$1 FOR UPDATE`,[input.reviewId]);if(!rows[0]) throw new AdminConsoleError('ADMIN_REVIEW_NOT_FOUND','Integration review item was not found.',404);if(rows[0].school_id!==schoolId) throw new AdminConsoleError('ADMIN_SCHOOL_SCOPE_DENIED','Review item is outside the authorized school.',403);
      if(rows[0].status==='OPEN') await tx.query(`UPDATE integration_review_items SET status=$2,resolved_by_user_id=$3,resolved_at=$4::timestamptz WHERE id=$1`,[input.reviewId,input.resolution,input.principal.userId,at.toISOString()]);
      return input.reviewId;
    }});
  }

  async #school(schoolId:string,organizationId:string):Promise<SchoolRow>{const rows=await this.#database.query<SchoolRow>(`SELECT id,organization_id FROM schools WHERE id=$1 AND organization_id=$2 AND status='ACTIVE'`,[schoolId,organizationId]);if(!rows[0]) throw new AdminConsoleError('ADMIN_SCHOOL_SCOPE_DENIED','Administrator school scope is unavailable.',403);return rows[0];}

  async #mutate(input:{principal:AdminPrincipal;schoolId:string;operation:string;targetType:string;targetId:string;reason:string;idempotencyKey:string;correlationId:string;fingerprintParts:readonly string[];at:Date;work:(tx:QueryExecutor)=>Promise<string>}):Promise<AdminMutationResult>{
    if(!supportsTransactions(this.#database)) throw new Error('Admin mutations require transactional database support.');
    const reason=input.reason.trim();if(!reason||reason.length>1000) throw new AdminConsoleError('ADMIN_REASON_REQUIRED','A concise private administrative reason is required.',400);
    await this.#school(input.schoolId,input.principal.organizationId);
    const requestFingerprint=hash([input.operation,input.principal.userId,...input.fingerprintParts,reason].join('\u0000'));
    return this.#database.transaction(async(tx)=>{
      const state=await this.#startIdempotent(tx,{organizationId:input.principal.organizationId,schoolId:input.schoolId,key:input.idempotencyKey,operation:input.operation,requestFingerprint,correlationId:input.correlationId,at:input.at});
      if(state.kind==='COMPLETED') return state.response;
      const effectiveTargetId=await input.work(tx);
      const response:AdminMutationResult={action:input.operation,targetType:input.targetType,targetId:effectiveTargetId,recordedAt:input.at.toISOString()};
      const metadata={operation:input.operation,targetType:input.targetType};
      await tx.query(`INSERT INTO audit_events (organization_id,school_id,actor_user_id,actor_student_id,actor_kind,action,target_type,target_id,reason,request_id,correlation_id,source,metadata) VALUES ($1,$2,$3,NULL,'USER',$4,$5,$6,$7,$8,$8,'APPLICATION',$9::jsonb)`,[input.principal.organizationId,input.schoolId,input.principal.userId,input.operation,input.targetType,effectiveTargetId,reason,input.correlationId,JSON.stringify(metadata)]);
      await tx.query(`INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,aggregate_id,correlation_id,payload_json_sanitized) VALUES ($1,$2,'schoolwide.admin',$3,$4,$5::uuid,$6,$7::jsonb)`,[input.principal.organizationId,input.schoolId,input.operation,input.targetType,/^[0-9a-f-]{36}$/i.test(effectiveTargetId)?effectiveTargetId:null,input.correlationId,JSON.stringify({action:input.operation,targetType:input.targetType,targetId:effectiveTargetId,actorUserId:input.principal.userId,occurredAt:input.at.toISOString()})]);
      await tx.query(`UPDATE idempotency_keys SET status='COMPLETED',response_status=201,response_json_sanitized=$2::jsonb,completed_at=$3::timestamptz WHERE id=$1 AND status='IN_PROGRESS'`,[state.id,JSON.stringify(response),input.at.toISOString()]);
      return response;
    });
  }

  async #startIdempotent(tx:QueryExecutor,input:{organizationId:string;schoolId:string;key:string;operation:string;requestFingerprint:string;correlationId:string;at:Date}):Promise<{kind:'NEW';id:string}|{kind:'COMPLETED';response:AdminMutationResult}>{
    const expiresAt=new Date(input.at.getTime()+this.#idempotencyTtlMs);
    const inserted=await tx.query<{id:string}&QueryResultRow>(`INSERT INTO idempotency_keys (organization_id,school_id,key,operation,request_fingerprint,status,created_at,expires_at,correlation_id) VALUES ($1,$2,$3,$4,$5,'IN_PROGRESS',$6::timestamptz,$7::timestamptz,$8) ON CONFLICT (school_id,key) DO NOTHING RETURNING id`,[input.organizationId,input.schoolId,input.key,input.operation,input.requestFingerprint,input.at.toISOString(),expiresAt.toISOString(),input.correlationId]);
    if(inserted[0]) return {kind:'NEW',id:inserted[0].id};
    const rows=await tx.query<IdempotencyRow>(`SELECT id,operation,request_fingerprint,status,response_json_sanitized,expires_at FROM idempotency_keys WHERE school_id=$1 AND key=$2 FOR UPDATE`,[input.schoolId,input.key]);const row=rows[0];if(!row) throw new AdminConsoleError('IDEMPOTENCY_CONFLICT','Idempotency state is unavailable.',409,true);
    if(row.operation!==input.operation||row.request_fingerprint!==input.requestFingerprint) throw new AdminConsoleError('IDEMPOTENCY_CONFLICT','Idempotency key was already used for a different administrator request.',409);
    if(row.status==='COMPLETED'&&isAdminMutationResult(row.response_json_sanitized)) return {kind:'COMPLETED',response:row.response_json_sanitized};
    if(row.expires_at.getTime()<=input.at.getTime()) {await tx.query(`UPDATE idempotency_keys SET organization_id=$1,operation=$2,request_fingerprint=$3,status='IN_PROGRESS',response_status=NULL,response_json_sanitized=NULL,created_at=$4::timestamptz,completed_at=NULL,expires_at=$5::timestamptz,correlation_id=$6 WHERE id=$7`,[input.organizationId,input.operation,input.requestFingerprint,input.at.toISOString(),expiresAt.toISOString(),input.correlationId,row.id]);return {kind:'NEW',id:row.id};}
    throw new AdminConsoleError('IDEMPOTENCY_CONFLICT','The same administrator request is still being resolved.',409,true);
  }
}
