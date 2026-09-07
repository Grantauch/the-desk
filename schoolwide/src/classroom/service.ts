import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import type { StaffPrincipal } from '../auth/types.js';
import {
  ClassroomIntegrationError,
  ClassroomProviderError,
  classroomApprovedScopes,
  type ClassroomCourse,
  type ClassroomLinkScope,
  type ClassroomPerson,
  type ClassroomProvider,
  type CourseSelection,
  type ImportPreview,
  type SyncRunSummary,
} from './types.js';

type ConnectionRow = {
  id: string; organization_id: string; school_id: string; user_id: string;
  google_account_subject: string; scopes_granted: string[]; provider_connection_ref: string; status: string;
};
type LinkRow = {
  id: string; organization_id: string; school_id: string; section_id: string;
  classroom_connection_id: string; external_course_id: string; connection_user_id: string; provider_connection_ref: string;
};
type IdentityResolution = { kind: 'MATCH'; studentId: string } | { kind: 'NEW' } | { kind: 'REVIEW'; candidates: string[]; reason: string };
type Snapshot = { course: ClassroomCourse; students: ClassroomPerson[]; teachers: ClassroomPerson[]; fingerprint: string };

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function normalizeEmail(value?: string): string | undefined { const email = value?.trim().toLowerCase(); return email && email.includes('@') ? email : undefined; }
function canonicalSnapshot(course: ClassroomCourse, students: ClassroomPerson[], teachers: ClassroomPerson[]): string {
  const normalized = {
    course: { id: course.id, name: course.name, section: course.section ?? '', room: course.room ?? '', ownerId: course.ownerId ?? '', state: course.courseState },
    students: students.map((p) => ({ id: p.id, email: normalizeEmail(p.email) ?? '', name: p.displayName })).sort((a, b) => a.id.localeCompare(b.id)),
    teachers: teachers.map((p) => ({ id: p.id, email: normalizeEmail(p.email) ?? '', name: p.displayName })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  return sha256(JSON.stringify(normalized));
}

export type ClassroomIntegrationServiceOptions = { now?: () => Date; oauthStateTtlMs?: number; maxPages?: number; scheduledPollMs?: number };

export class ClassroomIntegrationService {
  readonly #database: Database;
  readonly #provider: ClassroomProvider;
  readonly #now: () => Date;
  readonly #oauthStateTtlMs: number;
  readonly #maxPages: number;
  readonly #scheduledPollMs: number;

  constructor(database: Database, provider: ClassroomProvider, options: ClassroomIntegrationServiceOptions = {}) {
    this.#database = database; this.#provider = provider; this.#now = options.now ?? (() => new Date());
    this.#oauthStateTtlMs = options.oauthStateTtlMs ?? 10 * 60_000; this.#maxPages = options.maxPages ?? 100;
    this.#scheduledPollMs = options.scheduledPollMs ?? 6 * 60 * 60_000;
  }

  async startConnect(principal: StaffPrincipal, schoolId: string, redirectUri: string): Promise<{ authorizationUrl: string; stateExpiresAt: string }> {
    const state = randomBytes(32).toString('base64url');
    const pending = await this.#provider.beginAuthorization({ state, redirectUri, scopes: classroomApprovedScopes });
    const now = this.#now(); const expires = new Date(now.getTime() + this.#oauthStateTtlMs);
    await this.#database.query(
      `INSERT INTO classroom_oauth_states (organization_id,school_id,user_id,state_hash,provider_pending_ref,requested_scopes,created_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz)`,
      [principal.organizationId, schoolId, principal.userId, sha256(state), pending.pendingRef, [...classroomApprovedScopes], now.toISOString(), expires.toISOString()],
    );
    return { authorizationUrl: pending.authorizationUrl, stateExpiresAt: expires.toISOString() };
  }

  async completeConnect(state: string, code: string, redirectUri: string, correlationId: string): Promise<{ connectionId: string; schoolId: string }> {
    if (!supportsTransactions(this.#database)) throw new ClassroomIntegrationError('CLASSROOM_TRANSACTION_UNAVAILABLE', 'Classroom integration requires transactional database support.', 503, true);
    const stateHash = sha256(state); const now = this.#now();
    const oauth = await this.#database.transaction(async (tx) => {
      const rows = await tx.query<{ id: string; organization_id: string; school_id: string; user_id: string; provider_pending_ref: string; requested_scopes: string[]; expires_at: Date; consumed_at: Date | null }>(
        `SELECT id,organization_id,school_id,user_id,provider_pending_ref,requested_scopes,expires_at,consumed_at FROM classroom_oauth_states WHERE state_hash=$1 FOR UPDATE`, [stateHash],
      );
      const row = rows[0];
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= now.getTime()) throw new ClassroomIntegrationError('CLASSROOM_OAUTH_STATE_INVALID', 'Classroom connection state is invalid, expired, or already used.', 400, false);
      await tx.query(`UPDATE classroom_oauth_states SET consumed_at=$2::timestamptz WHERE id=$1`, [row.id, now.toISOString()]);
      return row;
    });
    let completed;
    try { completed = await this.#provider.completeAuthorization({ pendingRef: oauth.provider_pending_ref, code, redirectUri }); }
    catch (error) { if (error instanceof ClassroomProviderError) throw new ClassroomIntegrationError(error.code, error.message, error.code === 'EXTERNAL_AUTH_REVOKED' ? 401 : 502, error.retryable); throw error; }
    const granted = [...new Set(completed.scopesGranted)].sort();
    const required = [...classroomApprovedScopes].sort();
    if (granted.length !== required.length || required.some((scope, index) => scope !== granted[index])) {
      throw new ClassroomIntegrationError('CLASSROOM_SCOPE_MISMATCH', 'Google Classroom authorization did not return exactly the approved read-only scopes.', 403, false);
    }
    const users = await this.#database.query<{ google_subject_id: string | null }>(`SELECT google_subject_id FROM users WHERE organization_id=$1 AND id=$2`, [oauth.organization_id, oauth.user_id]);
    const subject = users[0]?.google_subject_id;
    if (!subject) throw new ClassroomIntegrationError('CLASSROOM_ACCOUNT_SUBJECT_UNAVAILABLE', 'The staff Google subject is unavailable for this Classroom connection.', 409, false);
    return this.#database.transaction(async (tx) => {
      await tx.query(`UPDATE classroom_connections SET status='REVOKED',revoked_at=$4::timestamptz,updated_at=$4::timestamptz,error_category='RECONNECTED' WHERE organization_id=$1 AND school_id=$2 AND user_id=$3 AND status='ACTIVE'`, [oauth.organization_id, oauth.school_id, oauth.user_id, now.toISOString()]);
      const created = await tx.query<{ id: string }>(
        `INSERT INTO classroom_connections (organization_id,school_id,user_id,google_account_subject,scopes_granted,provider_connection_ref,connected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz) RETURNING id`,
        [oauth.organization_id, oauth.school_id, oauth.user_id, subject, granted, completed.connectionRef, now.toISOString()],
      );
      const connectionId = created[0]?.id; if (!connectionId) throw new Error('Classroom connection insert returned no id.');
      await tx.query(`INSERT INTO audit_events (organization_id,school_id,actor_kind,actor_user_id,action,target_type,target_id,correlation_id,source,metadata) VALUES ($1,$2,'USER',$3,'CLASSROOM_CONNECTED','CLASSROOM_CONNECTION',$4,$5,'INTEGRATION',$6::jsonb)`, [oauth.organization_id, oauth.school_id, oauth.user_id, connectionId, correlationId, JSON.stringify({ scopes: granted })]);
      return { connectionId, schoolId: oauth.school_id };
    });
  }

  async #connectionFor(principal: StaffPrincipal, schoolId: string): Promise<ConnectionRow> {
    const rows = await this.#database.query<ConnectionRow>(
      `SELECT id,organization_id,school_id,user_id,google_account_subject,scopes_granted,provider_connection_ref,status FROM classroom_connections WHERE organization_id=$1 AND school_id=$2 AND user_id=$3 AND status='ACTIVE' ORDER BY connected_at DESC LIMIT 1`,
      [principal.organizationId, schoolId, principal.userId],
    );
    const connection = rows[0]; if (!connection) throw new ClassroomIntegrationError('CLASSROOM_NOT_CONNECTED', 'Connect Google Classroom before using roster integration.', 409, false);
    return connection;
  }

  async #paginate<T>(read: (token?: string) => Promise<{ items: readonly T[]; nextPageToken?: string }>): Promise<T[]> {
    const all: T[] = []; let token: string | undefined; const seen = new Set<string>();
    for (let page = 0; page < this.#maxPages; page++) {
      const result = await read(token); all.push(...result.items);
      if (!result.nextPageToken) return all;
      if (seen.has(result.nextPageToken)) throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Google Classroom pagination repeated a page token.');
      seen.add(result.nextPageToken); token = result.nextPageToken;
    }
    throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Google Classroom pagination exceeded the safety bound.');
  }

  async discoverCourses(principal: StaffPrincipal, schoolId: string): Promise<{ courses: ClassroomCourse[]; connectionHealth: string; lastSuccessAt?: string }> {
    const connection = await this.#connectionFor(principal, schoolId);
    try {
      const courses = await this.#paginate((token) => this.#provider.listCourses(connection.provider_connection_ref, token));
      const now = this.#now().toISOString();
      await this.#database.query(`UPDATE classroom_connections SET last_attempt_at=$2::timestamptz,updated_at=$2::timestamptz,error_category=NULL WHERE id=$1`, [connection.id, now]);
      return { courses, connectionHealth: 'ACTIVE' };
    } catch (error) { await this.#recordConnectionFailure(connection, error); throw this.#translateProvider(error); }
  }

  async #snapshot(connection: ConnectionRow, course: ClassroomCourse): Promise<Snapshot> {
    const students = await this.#paginate((token) => this.#provider.listStudents(connection.provider_connection_ref, course.id, token));
    const teachers = await this.#paginate((token) => this.#provider.listTeachers(connection.provider_connection_ref, course.id, token));
    return { course, students, teachers, fingerprint: canonicalSnapshot(course, students, teachers) };
  }

  async #selectedSnapshots(principal: StaffPrincipal, schoolId: string, selections: readonly CourseSelection[]): Promise<{ connection: ConnectionRow; snapshots: Snapshot[] }> {
    const connection = await this.#connectionFor(principal, schoolId);
    let courses: ClassroomCourse[];
    try { courses = await this.#paginate((token) => this.#provider.listCourses(connection.provider_connection_ref, token)); }
    catch (error) { await this.#recordConnectionFailure(connection, error); throw this.#translateProvider(error); }
    const byId = new Map(courses.map((course) => [course.id, course]));
    const snapshots: Snapshot[] = [];
    for (const selection of selections) {
      const course = byId.get(selection.courseId);
      if (!course) throw new ClassroomIntegrationError('CLASSROOM_COURSE_NOT_AUTHORIZED', 'A selected Classroom course is not available to the connected teacher.', 403, false);
      try { snapshots.push(await this.#snapshot(connection, course)); }
      catch (error) { await this.#recordConnectionFailure(connection, error); throw this.#translateProvider(error); }
    }
    return { connection, snapshots };
  }

  async #resolveIdentity(executor: QueryExecutor, schoolId: string, person: ClassroomPerson): Promise<IdentityResolution> {
    const gc = await executor.query<{ student_id: string }>(`SELECT student_id FROM student_identity_aliases WHERE school_id=$1 AND kind='GOOGLE_CLASSROOM_USER_ID' AND normalized_value=$2 AND retired_at IS NULL`, [schoolId, person.id]);
    if (gc.length === 1) return { kind: 'MATCH', studentId: gc[0]!.student_id };
    if (gc.length > 1) return { kind: 'REVIEW', candidates: gc.map((r) => r.student_id), reason: 'Conflicting Classroom user identities.' };
    const email = normalizeEmail(person.email);
    if (email) {
      const verifiedEmail = await executor.query<{ student_id: string }>(`SELECT student_id FROM student_identity_aliases WHERE school_id=$1 AND kind='EMAIL' AND normalized_value=$2 AND verified_at IS NOT NULL AND retired_at IS NULL`, [schoolId, email]);
      const unique = [...new Set(verifiedEmail.map((r) => r.student_id))];
      if (unique.length === 1) return { kind: 'MATCH', studentId: unique[0]! };
      if (unique.length > 1) return { kind: 'REVIEW', candidates: unique, reason: 'Ambiguous verified school email identity.' };
      const alternate = await executor.query<{ student_id: string }>(`SELECT student_id FROM student_identity_aliases WHERE school_id=$1 AND kind IN ('LEGACY_EMAIL','LEGACY_STUDENT_KEY') AND (normalized_value=$2 OR external_subject_id=$3) AND verified_at IS NOT NULL AND retired_at IS NULL`, [schoolId, email, person.id]);
      const altUnique = [...new Set(alternate.map((r) => r.student_id))];
      if (altUnique.length === 1) return { kind: 'MATCH', studentId: altUnique[0]! };
      if (altUnique.length > 1) return { kind: 'REVIEW', candidates: altUnique, reason: 'Ambiguous verified alternate identity.' };
    }
    return { kind: 'NEW' };
  }

  async preview(principal: StaffPrincipal, schoolId: string, selections: readonly CourseSelection[]): Promise<ImportPreview> {
    const { snapshots } = await this.#selectedSnapshots(principal, schoolId, selections);
    const courses: ImportPreview['courses'] = [];
    for (let index = 0; index < snapshots.length; index++) {
      const snapshot = snapshots[index]!; const selection = selections[index]!;
      let existingMatches = 0, newStudents = 0, reviewsRequired = 0;
      for (const person of snapshot.students) {
        const match = await this.#resolveIdentity(this.#database, schoolId, person);
        if (match.kind === 'MATCH') existingMatches++; else if (match.kind === 'NEW') newStudents++; else reviewsRequired++;
      }
      courses.push({ courseId: snapshot.course.id, courseName: snapshot.course.name, sectionId: selection.sectionId, rosterCount: snapshot.students.length, teacherCount: snapshot.teachers.length, existingMatches, newStudents, reviewsRequired });
    }
    const fingerprint = sha256(JSON.stringify(snapshots.map((snapshot) => ({ courseId: snapshot.course.id, fingerprint: snapshot.fingerprint }))));
    return { fingerprint, courses };
  }

  async commitImport(input: { principal: StaffPrincipal; schoolId: string; selections: readonly CourseSelection[]; expectedFingerprint: string; idempotencyKey: string; correlationId: string }): Promise<{ fingerprint: string; links: Array<{ linkId: string; sectionId: string; courseId: string; syncRun: SyncRunSummary }> }> {
    if (!supportsTransactions(this.#database)) throw new ClassroomIntegrationError('CLASSROOM_TRANSACTION_UNAVAILABLE', 'Classroom integration requires transactional database support.', 503, true);
    const { connection, snapshots } = await this.#selectedSnapshots(input.principal, input.schoolId, input.selections);
    const fingerprint = sha256(JSON.stringify(snapshots.map((snapshot) => ({ courseId: snapshot.course.id, fingerprint: snapshot.fingerprint }))));
    if (fingerprint !== input.expectedFingerprint) throw new ClassroomIntegrationError('CLASSROOM_PREVIEW_STALE', 'Classroom roster changed after preview. Review the updated reconciliation before importing.', 409, false);
    const requestFingerprint = sha256(JSON.stringify({ selections: input.selections, fingerprint }));
    const existing = await this.#database.query<{ status: string; request_fingerprint: string; response_json_sanitized: unknown }>(`SELECT status,request_fingerprint,response_json_sanitized FROM idempotency_keys WHERE school_id=$1 AND key=$2`, [input.schoolId, input.idempotencyKey]);
    if (existing[0]) {
      if (existing[0].request_fingerprint !== requestFingerprint) throw new ClassroomIntegrationError('IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used for a different Classroom import.', 409, false);
      if (existing[0].status === 'COMPLETED') return existing[0].response_json_sanitized as { fingerprint: string; links: Array<{ linkId: string; sectionId: string; courseId: string; syncRun: SyncRunSummary }> };
      throw new ClassroomIntegrationError('IDEMPOTENCY_IN_PROGRESS', 'Classroom import with this Idempotency-Key is already in progress.', 409, true);
    }
    const now = this.#now(); const response = await this.#database.transaction(async (tx) => {
      await tx.query(`INSERT INTO idempotency_keys (organization_id,school_id,key,operation,request_fingerprint,expires_at,correlation_id) VALUES ($1,$2,$3,'CLASSROOM_IMPORT_COMMIT',$4,$5::timestamptz,$6)`, [input.principal.organizationId, input.schoolId, input.idempotencyKey, requestFingerprint, new Date(now.getTime()+24*60*60_000).toISOString(), input.correlationId]);
      const links: Array<{ linkId: string; sectionId: string; courseId: string; syncRun: SyncRunSummary }> = [];
      for (let index=0; index<snapshots.length; index++) {
        const snapshot=snapshots[index]!; const selection=input.selections[index]!;
        const sectionId = selection.sectionId ?? await this.#createSection(tx, input.principal, input.schoolId, snapshot.course, now);
        const linkId = await this.#upsertCourseAndLink(tx, connection, sectionId, snapshot.course, now);
        const syncRun = await this.#applyCompleteSnapshot(tx, { connection, linkId, sectionId, snapshot, triggerType: 'IMPORT', actorUserId: input.principal.userId, correlationId: input.correlationId, now });
        links.push({ linkId, sectionId, courseId: snapshot.course.id, syncRun });
      }
      const result = { fingerprint, links };
      await tx.query(`UPDATE idempotency_keys SET status='COMPLETED',response_status=200,response_json_sanitized=$3::jsonb,completed_at=$4::timestamptz WHERE school_id=$1 AND key=$2`, [input.schoolId, input.idempotencyKey, JSON.stringify(result), now.toISOString()]);
      return result;
    });
    return response;
  }

  async #createSection(tx: QueryExecutor, principal: StaffPrincipal, schoolId: string, course: ClassroomCourse, now: Date): Promise<string> {
    const years = await tx.query<{ id: string }>(`SELECT id FROM academic_years WHERE school_id=$1 AND status='ACTIVE' AND $2::date BETWEEN starts_on AND ends_on`, [schoolId, now.toISOString().slice(0,10)]);
    if (years.length !== 1) throw new ClassroomIntegrationError('CLASSROOM_ACADEMIC_YEAR_UNRESOLVED', 'Exactly one active academic year is required to import a new Classroom section.', 409, false);
    const inserted = await tx.query<{ id: string }>(`INSERT INTO sections (school_id,academic_year_id,name,period_label,room,source,source_external_id,status) VALUES ($1,$2,$3,$4,$5,'GOOGLE_CLASSROOM',$6,'ACTIVE') ON CONFLICT (school_id,source,source_external_id) WHERE source_external_id IS NOT NULL DO UPDATE SET name=EXCLUDED.name,period_label=EXCLUDED.period_label,room=EXCLUDED.room,updated_at=$7::timestamptz RETURNING id`, [schoolId, years[0]!.id, course.name, course.section ?? null, course.room ?? null, course.id, now.toISOString()]);
    const sectionId = inserted[0]!.id;
    await tx.query(`INSERT INTO section_staff_assignments (organization_id,school_id,section_id,user_id,assignment_role,valid_from) SELECT $1,$2,$3,$4,'PRIMARY_TEACHER',$5::timestamptz WHERE NOT EXISTS (SELECT 1 FROM section_staff_assignments WHERE organization_id=$1 AND school_id=$2 AND section_id=$3 AND user_id=$4 AND revoked_at IS NULL AND valid_from <= $5::timestamptz AND (valid_until IS NULL OR valid_until > $5::timestamptz))`, [principal.organizationId, schoolId, sectionId, principal.userId, now.toISOString()]);
    return sectionId;
  }

  async #upsertCourseAndLink(tx: QueryExecutor, connection: ConnectionRow, sectionId: string, course: ClassroomCourse, now: Date): Promise<string> {
    await tx.query(`INSERT INTO classroom_courses (organization_id,school_id,classroom_connection_id,google_course_id,google_owner_id,name,section_text,room_text,course_state,imported_at,last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$10::timestamptz) ON CONFLICT (classroom_connection_id,google_course_id) DO UPDATE SET google_owner_id=EXCLUDED.google_owner_id,name=EXCLUDED.name,section_text=EXCLUDED.section_text,room_text=EXCLUDED.room_text,course_state=EXCLUDED.course_state,last_seen_at=EXCLUDED.last_seen_at`, [connection.organization_id,connection.school_id,connection.id,course.id,course.ownerId ?? null,course.name,course.section ?? null,course.room ?? null,course.courseState,now.toISOString()]);
    const existing = await tx.query<{ id: string }>(`SELECT id FROM section_external_links WHERE classroom_connection_id=$1 AND external_course_id=$2 AND status='ACTIVE' FOR UPDATE`, [connection.id, course.id]);
    if (existing[0]) {
      const scope = await tx.query<{ section_id: string }>(`SELECT section_id FROM section_external_links WHERE id=$1`, [existing[0].id]);
      if (scope[0]?.section_id !== sectionId) throw new ClassroomIntegrationError('CLASSROOM_COURSE_ALREADY_LINKED', 'This Classroom course is already linked to another section.', 409, false);
      return existing[0].id;
    }
    const inserted = await tx.query<{ id: string }>(`INSERT INTO section_external_links (organization_id,school_id,section_id,classroom_connection_id,external_course_id,linked_at,next_sync_after) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz) RETURNING id`, [connection.organization_id,connection.school_id,sectionId,connection.id,course.id,now.toISOString(),new Date(now.getTime()+this.#scheduledPollMs).toISOString()]);
    return inserted[0]!.id;
  }

  async #createReview(tx: QueryExecutor, input: { organizationId: string; schoolId: string; linkId: string; runId: string; type: string; externalKey: string; candidateStudentId?: string; reason: string }): Promise<void> {
    await tx.query(`INSERT INTO integration_review_items (organization_id,school_id,review_type,external_key,section_external_link_id,classroom_sync_run_id,candidate_student_id,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [input.organizationId,input.schoolId,input.type,input.externalKey,input.linkId,input.runId,input.candidateStudentId ?? null,input.reason]);
  }

  async #applyCompleteSnapshot(tx: QueryExecutor, input: { connection: ConnectionRow; linkId: string; sectionId: string; snapshot: Snapshot; triggerType: 'IMPORT'|'MANUAL'|'SCHEDULED'; actorUserId: string; correlationId: string; now: Date }): Promise<SyncRunSummary> {
    const priorRuns = await tx.query<{ id: string }>(`SELECT id FROM classroom_sync_runs WHERE section_external_link_id=$1 AND status='SUCCESS' AND snapshot_complete=true ORDER BY started_at DESC LIMIT 1`, [input.linkId]);
    const run = await tx.query<{ id: string }>(`INSERT INTO classroom_sync_runs (organization_id,school_id,classroom_connection_id,section_external_link_id,trigger_type,status,snapshot_complete,courses_seen,students_seen,teachers_seen,roster_fingerprint,correlation_id,started_at,finished_at) VALUES ($1,$2,$3,$4,$5,'SUCCESS',true,1,$6,$7,$8,$9,$10::timestamptz,$10::timestamptz) RETURNING id`, [input.connection.organization_id,input.connection.school_id,input.connection.id,input.linkId,input.triggerType,input.snapshot.students.length,input.snapshot.teachers.length,input.snapshot.fingerprint,input.correlationId,input.now.toISOString()]);
    const runId = run[0]!.id;
    for (const person of input.snapshot.students) await tx.query(`INSERT INTO classroom_roster_members (organization_id,school_id,classroom_sync_run_id,section_external_link_id,google_user_id,email_normalized,display_name,role,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'STUDENT',$8::timestamptz)`, [input.connection.organization_id,input.connection.school_id,runId,input.linkId,person.id,normalizeEmail(person.email) ?? null,person.displayName,input.now.toISOString()]);
    for (const person of input.snapshot.teachers) await tx.query(`INSERT INTO classroom_roster_members (organization_id,school_id,classroom_sync_run_id,section_external_link_id,google_user_id,email_normalized,display_name,role,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'TEACHER',$8::timestamptz)`, [input.connection.organization_id,input.connection.school_id,runId,input.linkId,person.id,normalizeEmail(person.email) ?? null,person.displayName,input.now.toISOString()]);
    let adds=0, reactivations=0, deactivations=0, pendingRemovals=0, reviewsRequired=0;
    const presentStudentIds = new Set<string>();
    for (const person of input.snapshot.students) {
      const resolution = await this.#resolveIdentity(tx,input.connection.school_id,person);
      if (resolution.kind === 'REVIEW') { reviewsRequired++; await this.#createReview(tx,{organizationId:input.connection.organization_id,schoolId:input.connection.school_id,linkId:input.linkId,runId,type:'AMBIGUOUS_IDENTITY',externalKey:person.id,candidateStudentId:resolution.candidates[0],reason:resolution.reason}); continue; }
      let studentId = resolution.kind === 'MATCH' ? resolution.studentId : '';
      if (resolution.kind === 'NEW') {
        const created = await tx.query<{ id:string }>(`INSERT INTO students (school_id,display_name,status) VALUES ($1,$2,'ACTIVE') RETURNING id`,[input.connection.school_id,person.displayName]); studentId=created[0]!.id;
      }
      presentStudentIds.add(studentId);
      await tx.query(`INSERT INTO student_identity_aliases (school_id,student_id,kind,value,normalized_value,external_subject_id,source,verified_at) VALUES ($1,$2,'GOOGLE_CLASSROOM_USER_ID',$3,$3,$3,'GOOGLE_CLASSROOM',$4::timestamptz) ON CONFLICT (school_id,kind,normalized_value) DO NOTHING`,[input.connection.school_id,studentId,person.id,input.now.toISOString()]);
      const email=normalizeEmail(person.email); if (email) await tx.query(`INSERT INTO student_identity_aliases (school_id,student_id,kind,value,normalized_value,source,verified_at) VALUES ($1,$2,'EMAIL',$3,$3,'GOOGLE_CLASSROOM',$4::timestamptz) ON CONFLICT (school_id,kind,normalized_value) DO NOTHING`,[input.connection.school_id,studentId,email,input.now.toISOString()]);
      const enrollment = await tx.query<{ id:string; status:string; source:string }>(`SELECT id,status,source FROM enrollments WHERE section_id=$1 AND student_id=$2 FOR UPDATE`,[input.sectionId,studentId]);
      if (!enrollment[0]) { await tx.query(`INSERT INTO enrollments (school_id,section_id,student_id,source,source_external_id,status,joined_at) VALUES ($1,$2,$3,'GOOGLE_CLASSROOM',$4,'ACTIVE',$5::timestamptz)`,[input.connection.school_id,input.sectionId,studentId,person.id,input.now.toISOString()]); adds++; }
      else if (enrollment[0].status !== 'ACTIVE' && enrollment[0].source === 'GOOGLE_CLASSROOM') { await tx.query(`UPDATE enrollments SET status='ACTIVE',left_at=NULL,source_external_id=$2,updated_at=$3::timestamptz WHERE id=$1`,[enrollment[0].id,person.id,input.now.toISOString()]); reactivations++; }
      else if (enrollment[0].status !== 'ACTIVE' && enrollment[0].source !== 'GOOGLE_CLASSROOM') { reviewsRequired++; await this.#createReview(tx,{organizationId:input.connection.organization_id,schoolId:input.connection.school_id,linkId:input.linkId,runId,type:'MANUAL_ENROLLMENT_CONFLICT',externalKey:person.id,candidateStudentId:studentId,reason:'Classroom reports an enrolled student whose manual membership is inactive; manual state was preserved.'}); }
    }
    const activeClassroomEnrollments = await tx.query<{ id:string; student_id:string; google_user_id:string|null }>(`SELECT e.id,e.student_id,(SELECT a.normalized_value FROM student_identity_aliases a WHERE a.school_id=e.school_id AND a.student_id=e.student_id AND a.kind='GOOGLE_CLASSROOM_USER_ID' AND a.retired_at IS NULL ORDER BY a.created_at DESC LIMIT 1) AS google_user_id FROM enrollments e WHERE e.school_id=$1 AND e.section_id=$2 AND e.status='ACTIVE' AND e.source='GOOGLE_CLASSROOM' FOR UPDATE`,[input.connection.school_id,input.sectionId]);
    const currentGoogleIds = new Set(input.snapshot.students.map((person)=>person.id));
    const priorRunId = priorRuns[0]?.id;
    for (const enrollment of activeClassroomEnrollments) {
      if (presentStudentIds.has(enrollment.student_id) || (enrollment.google_user_id && currentGoogleIds.has(enrollment.google_user_id))) continue;
      let previousAlsoMissing=false;
      if (priorRunId && enrollment.google_user_id) {
        const priorPresence = await tx.query<{ present:boolean }>(`SELECT EXISTS(SELECT 1 FROM classroom_roster_members WHERE classroom_sync_run_id=$1 AND section_external_link_id=$2 AND google_user_id=$3 AND role='STUDENT') AS present`,[priorRunId,input.linkId,enrollment.google_user_id]);
        previousAlsoMissing = priorPresence[0]?.present === false;
      }
      if (previousAlsoMissing) { await tx.query(`UPDATE enrollments SET status='INACTIVE',left_at=$2::timestamptz,updated_at=$2::timestamptz WHERE id=$1`,[enrollment.id,input.now.toISOString()]); deactivations++; }
      else { pendingRemovals++; reviewsRequired++; await this.#createReview(tx,{organizationId:input.connection.organization_id,schoolId:input.connection.school_id,linkId:input.linkId,runId,type:'ROSTER_MISSING_PENDING',externalKey:enrollment.google_user_id ?? enrollment.student_id,candidateStudentId:enrollment.student_id,reason:'Student is absent from one complete Classroom snapshot. GrantDesk requires two consecutive complete absences before deactivation.'}); }
    }
    await tx.query(`UPDATE classroom_sync_runs SET adds=$2,reactivations=$3,deactivations=$4,pending_removals=$5,reviews_required=$6 WHERE id=$1`,[runId,adds,reactivations,deactivations,pendingRemovals,reviewsRequired]);
    await tx.query(`UPDATE classroom_connections SET last_attempt_at=$2::timestamptz,last_success_at=$2::timestamptz,updated_at=$2::timestamptz,error_category=NULL WHERE id=$1`,[input.connection.id,input.now.toISOString()]);
    await tx.query(`UPDATE section_external_links SET last_attempt_at=$2::timestamptz,last_success_at=$2::timestamptz,next_sync_after=$3::timestamptz WHERE id=$1`,[input.linkId,input.now.toISOString(),new Date(input.now.getTime()+this.#scheduledPollMs).toISOString()]);
    await tx.query(`INSERT INTO audit_events (organization_id,school_id,actor_kind,actor_user_id,action,target_type,target_id,correlation_id,source,metadata) VALUES ($1,$2,'USER',$3,'CLASSROOM_ROSTER_SYNCED','SECTION_EXTERNAL_LINK',$4,$5,'INTEGRATION',$6::jsonb)`,[input.connection.organization_id,input.connection.school_id,input.actorUserId,input.linkId,input.correlationId,JSON.stringify({runId,adds,reactivations,deactivations,pendingRemovals,reviewsRequired})]);
    await tx.query(`INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,aggregate_id,correlation_id,payload_json_sanitized) VALUES ($1,$2,'schoolwide.classroom','CLASSROOM_ROSTER_SYNCED','SECTION_EXTERNAL_LINK',$3,$4,$5::jsonb)`,[input.connection.organization_id,input.connection.school_id,input.linkId,input.correlationId,JSON.stringify({runId,sectionId:input.sectionId,adds,reactivations,deactivations,pendingRemovals,reviewsRequired})]);
    return { id:runId,status:'SUCCESS',snapshotComplete:true,studentsSeen:input.snapshot.students.length,teachersSeen:input.snapshot.teachers.length,adds,reactivations,deactivations,pendingRemovals,reviewsRequired };
  }

  async linkScope(linkId: string): Promise<ClassroomLinkScope> {
    const rows = await this.#database.query<LinkRow>(`SELECT l.id,l.organization_id,l.school_id,l.section_id,l.classroom_connection_id,l.external_course_id,c.user_id AS connection_user_id,c.provider_connection_ref FROM section_external_links l JOIN classroom_connections c ON c.id=l.classroom_connection_id AND c.organization_id=l.organization_id AND c.school_id=l.school_id WHERE l.id=$1 AND l.status='ACTIVE'`,[linkId]);
    const row=rows[0]; if(!row) throw new ClassroomIntegrationError('CLASSROOM_LINK_NOT_FOUND','Classroom link not found.',404,false);
    return {linkId:row.id,schoolId:row.school_id,sectionId:row.section_id,connectionId:row.classroom_connection_id,connectionUserId:row.connection_user_id};
  }

  async syncLink(input:{principal:StaffPrincipal;linkId:string;idempotencyKey:string;correlationId:string;triggerType?:'MANUAL'|'SCHEDULED'}):Promise<SyncRunSummary>{
    if(!supportsTransactions(this.#database)) throw new ClassroomIntegrationError('CLASSROOM_TRANSACTION_UNAVAILABLE','Classroom integration requires transactional database support.',503,true);
    const rows=await this.#database.query<LinkRow>(`SELECT l.id,l.organization_id,l.school_id,l.section_id,l.classroom_connection_id,l.external_course_id,c.user_id AS connection_user_id,c.provider_connection_ref FROM section_external_links l JOIN classroom_connections c ON c.id=l.classroom_connection_id AND c.organization_id=l.organization_id AND c.school_id=l.school_id WHERE l.id=$1 AND l.status='ACTIVE'`,[input.linkId]);
    const link=rows[0]; if(!link) throw new ClassroomIntegrationError('CLASSROOM_LINK_NOT_FOUND','Classroom link not found.',404,false);
    if(link.connection_user_id!==input.principal.userId||link.organization_id!==input.principal.organizationId) throw new ClassroomIntegrationError('SECTION_SCOPE_DENIED','Not authorized for that Classroom link.',403,false);
    const requestFingerprint=sha256(JSON.stringify({linkId:input.linkId,triggerType:input.triggerType??'MANUAL'}));
    const existing=await this.#database.query<{status:string;request_fingerprint:string;response_json_sanitized:unknown}>(`SELECT status,request_fingerprint,response_json_sanitized FROM idempotency_keys WHERE school_id=$1 AND key=$2`,[link.school_id,input.idempotencyKey]);
    if(existing[0]){if(existing[0].request_fingerprint!==requestFingerprint)throw new ClassroomIntegrationError('IDEMPOTENCY_CONFLICT','Idempotency-Key was already used for another operation.',409,false);if(existing[0].status==='COMPLETED')return existing[0].response_json_sanitized as SyncRunSummary;throw new ClassroomIntegrationError('IDEMPOTENCY_IN_PROGRESS','Classroom sync with this Idempotency-Key is already in progress.',409,true);}
    const connectionRows=await this.#database.query<ConnectionRow>(`SELECT id,organization_id,school_id,user_id,google_account_subject,scopes_granted,provider_connection_ref,status FROM classroom_connections WHERE id=$1`,[link.classroom_connection_id]); const connection=connectionRows[0]!;
    const now=this.#now();
    await this.#database.query(`INSERT INTO idempotency_keys (organization_id,school_id,key,operation,request_fingerprint,expires_at,correlation_id) VALUES ($1,$2,$3,'CLASSROOM_LINK_SYNC',$4,$5::timestamptz,$6)`,[link.organization_id,link.school_id,input.idempotencyKey,requestFingerprint,new Date(now.getTime()+24*60*60_000).toISOString(),input.correlationId]);
    let course:ClassroomCourse|undefined; let snapshot:Snapshot;
    try{const courses=await this.#paginate((token)=>this.#provider.listCourses(connection.provider_connection_ref,token));course=courses.find((item)=>item.id===link.external_course_id);if(!course)throw new ClassroomProviderError('SYNC_INCOMPLETE','Linked Classroom course is no longer readable.');snapshot=await this.#snapshot(connection,course);}catch(error){const failed=await this.#recordFailedRun(link,connection,error,input.correlationId,input.triggerType??'MANUAL',now);await this.#database.query(`UPDATE idempotency_keys SET status='COMPLETED',response_status=$3,response_json_sanitized=$4::jsonb,completed_at=$5::timestamptz WHERE school_id=$1 AND key=$2`,[link.school_id,input.idempotencyKey,failed.status==='FAILED'?502:409,JSON.stringify(failed),now.toISOString()]);return failed;}
    const result=await this.#database.transaction(async(tx)=>{const applied=await this.#applyCompleteSnapshot(tx,{connection,linkId:link.id,sectionId:link.section_id,snapshot,triggerType:input.triggerType??'MANUAL',actorUserId:input.principal.userId,correlationId:input.correlationId,now});await tx.query(`UPDATE idempotency_keys SET status='COMPLETED',response_status=200,response_json_sanitized=$3::jsonb,completed_at=$4::timestamptz WHERE school_id=$1 AND key=$2`,[link.school_id,input.idempotencyKey,JSON.stringify(applied),now.toISOString()]);return applied;});return result;
  }

  async #recordFailedRun(link:LinkRow,connection:ConnectionRow,error:unknown,correlationId:string,triggerType:'MANUAL'|'SCHEDULED',now:Date):Promise<SyncRunSummary>{
    const provider=error instanceof ClassroomProviderError?error:new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR','Google Classroom sync failed.');
    const status:'FAILED'|'PARTIAL'=provider.code==='SYNC_INCOMPLETE'?'PARTIAL':'FAILED';
    const inserted=await this.#database.query<{id:string}>(`INSERT INTO classroom_sync_runs (organization_id,school_id,classroom_connection_id,section_external_link_id,trigger_type,status,snapshot_complete,errors_count,error_category,error_summary_sanitized,correlation_id,started_at,finished_at) VALUES ($1,$2,$3,$4,$5,$6,false,1,$7,$8,$9,$10::timestamptz,$10::timestamptz) RETURNING id`,[link.organization_id,link.school_id,connection.id,link.id,triggerType,status,provider.code,provider.message,correlationId,now.toISOString()]);
    await this.#recordConnectionFailure(connection,provider); await this.#database.query(`UPDATE section_external_links SET last_attempt_at=$2::timestamptz WHERE id=$1`,[link.id,now.toISOString()]);
    return{id:inserted[0]!.id,status,snapshotComplete:false,studentsSeen:0,teachersSeen:0,adds:0,reactivations:0,deactivations:0,pendingRemovals:0,reviewsRequired:0,errorCategory:provider.code};
  }

  async #recordConnectionFailure(connection:ConnectionRow,error:unknown):Promise<void>{const provider=error instanceof ClassroomProviderError?error:new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR','Google Classroom request failed.');const now=this.#now().toISOString();if(provider.code==='EXTERNAL_AUTH_REVOKED')await this.#database.query(`UPDATE classroom_connections SET status='REVOKED',revoked_at=$2::timestamptz,last_attempt_at=$2::timestamptz,updated_at=$2::timestamptz,error_category=$3 WHERE id=$1`,[connection.id,now,provider.code]);else await this.#database.query(`UPDATE classroom_connections SET last_attempt_at=$2::timestamptz,updated_at=$2::timestamptz,error_category=$3 WHERE id=$1`,[connection.id,now,provider.code]);}
  #translateProvider(error:unknown):ClassroomIntegrationError{if(error instanceof ClassroomProviderError)return new ClassroomIntegrationError(error.code,error.message,error.code==='EXTERNAL_AUTH_REVOKED'?401:502,error.retryable);return new ClassroomIntegrationError('EXTERNAL_PROVIDER_ERROR','Google Classroom request failed.',502,true);}

  async getSyncRun(principal:StaffPrincipal,runId:string):Promise<SyncRunSummary>{const rows=await this.#database.query<{id:string;status:'SUCCESS'|'PARTIAL'|'FAILED';snapshot_complete:boolean;students_seen:number;teachers_seen:number;adds:number;reactivations:number;deactivations:number;pending_removals:number;reviews_required:number;error_category:string|null;connection_user_id:string;organization_id:string}>(`SELECT r.id,r.status,r.snapshot_complete,r.students_seen,r.teachers_seen,r.adds,r.reactivations,r.deactivations,r.pending_removals,r.reviews_required,r.error_category,c.user_id AS connection_user_id,r.organization_id FROM classroom_sync_runs r JOIN classroom_connections c ON c.id=r.classroom_connection_id WHERE r.id=$1 AND r.status<>'STARTED'`,[runId]);const row=rows[0];if(!row||row.connection_user_id!==principal.userId||row.organization_id!==principal.organizationId)throw new ClassroomIntegrationError('CLASSROOM_SYNC_RUN_NOT_FOUND','Classroom sync run not found.',404,false);return{id:row.id,status:row.status,snapshotComplete:row.snapshot_complete,studentsSeen:row.students_seen,teachersSeen:row.teachers_seen,adds:row.adds,reactivations:row.reactivations,deactivations:row.deactivations,pendingRemovals:row.pending_removals,reviewsRequired:row.reviews_required,errorCategory:row.error_category??undefined};}

  async dueLinks(limit=50):Promise<Array<{linkId:string;schoolId:string;sectionId:string;connectionUserId:string}>>{const rows=await this.#database.query<{link_id:string;school_id:string;section_id:string;connection_user_id:string}>(`SELECT l.id AS link_id,l.school_id,l.section_id,c.user_id AS connection_user_id FROM section_external_links l JOIN classroom_connections c ON c.id=l.classroom_connection_id WHERE l.status='ACTIVE' AND c.status='ACTIVE' AND l.next_sync_after IS NOT NULL AND l.next_sync_after<=now() ORDER BY l.next_sync_after,l.id LIMIT $1`,[Math.max(1,Math.min(200,limit))]);return rows.map((row)=>({linkId:row.link_id,schoolId:row.school_id,sectionId:row.section_id,connectionUserId:row.connection_user_id}));}
}
