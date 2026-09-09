import { createHash } from 'node:crypto';
import { roleAllowsCapability } from '../auth/capabilities.js';
import type { Capability } from '../auth/types.js';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import { fingerprintLegacySnapshot, parseLegacySnapshot, stableSnapshotJson } from './snapshot.js';
import {
  LegacyImportError,
  legacySurfaceNames,
  type LegacyDryRunPlan,
  type LegacyMigrationPrincipal,
  type LegacyReconciliationReport,
  type LegacyRow,
  type LegacyShadowImportResult,
  type LegacySnapshot,
  type LegacySurfaceName,
  type LegacyValidateResult,
  type MigrationFinding,
  type PlannedLegacyMapping,
} from './types.js';

const PASS_STATUSES = new Set(['OUT','RETURNED','ROLLED_OVER','CLOSED_BY_SYSTEM']);
const PASS_COUNTABILITY = new Set(['PROVISIONAL','COUNTABLE','NON_COUNTABLE','UNKNOWN_REVIEW','']);
const QUEUE_STATUSES = new Set(['WAITING','QUEUED','STARTED','CANCELLED','EXPIRED','INELIGIBLE','REJECTED']);

function text(row: LegacyRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function bool(row: LegacyRow, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true','yes','y','1','active'].includes(normalized)) return true;
      if (['false','no','n','0','inactive'].includes(normalized)) return false;
    }
  }
  return null;
}

function groupIncrement(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function duplicateCount(rows: readonly LegacyRow[], keys: readonly string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const value = text(row, ...keys);
    if (!value) continue;
    if (seen.has(value)) duplicates += 1;
    else seen.add(value);
  }
  return duplicates;
}

function duplicateMembershipCount(rows: readonly LegacyRow[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const studentKey = text(row,'studentKey','legacyStudentKey','studentId','studentEmail','email','Student Email');
    const sectionKey = text(row,'sectionKey','classKey','sectionId','class','Class / Period');
    if (!studentKey || !sectionKey) continue;
    const membership = `${sectionKey}\u0000${studentKey}`;
    if (seen.has(membership)) duplicates += 1;
    else seen.add(membership);
  }
  return duplicates;
}

function overall(findings: readonly MigrationFinding[]): LegacyReconciliationReport['overallStatus'] {
  if (findings.some((entry) => entry.status === 'FAIL')) return 'FAIL';
  if (findings.some((entry) => entry.status === 'REVIEW')) return 'REVIEW';
  return 'PASS';
}

function finding(invariant: string, status: MigrationFinding['status'], category: string, count: number, detail: string): MigrationFinding {
  return { invariant, status, category, count, detail };
}

function studentKey(row: LegacyRow): string | null {
  return text(row,'studentKey','legacyStudentKey','studentId','studentEmail','email','Student Email');
}

function sectionKey(row: LegacyRow): string | null {
  return text(row,'sectionKey','classKey','sectionId','class','Class / Period');
}

function plannedMappings(snapshot: LegacySnapshot): PlannedLegacyMapping[] {
  const keyed = new Map<string, PlannedLegacyMapping>();
  const add = (sourceSurface: LegacySurfaceName, legacyEntityType: string, legacyIdOrKey: string | null, schoolwideEntityType: string): void => {
    if (!legacyIdOrKey) return;
    const key = `${legacyEntityType}\u0000${legacyIdOrKey}\u0000${schoolwideEntityType}`;
    if (!keyed.has(key)) keyed.set(key, { sourceSurface, legacyEntityType, legacyIdOrKey, schoolwideEntityType });
  };

  for (const row of snapshot.surfaces.roster) {
    const student = studentKey(row);
    const section = sectionKey(row);
    add('roster','STUDENT',student,'STUDENT');
    add('roster','SECTION',section,'SECTION');
    add('roster','ENROLLMENT',student && section ? `${section}:${student}` : null,'ENROLLMENT');
  }
  for (const row of snapshot.surfaces.bellSchedule) add('bellSchedule','SCHEDULE_PERIOD',text(row,'legacyId','id','periodKey','periodCode','Period'),'SCHEDULE_PERIOD');
  for (const row of snapshot.surfaces.schoolCalendar) add('schoolCalendar','SCHOOL_CALENDAR_DAY',text(row,'legacyId','id','date','academicDate','Date'),'SCHOOL_CALENDAR_DAY');
  for (const row of snapshot.surfaces.settings) add('settings','SETTING',text(row,'legacyId','id','key','settingKey','Key'),'POLICY_INPUT');
  for (const row of snapshot.surfaces.checkins) add('checkins','CHECKIN',text(row,'checkinId','legacyId','id','Check-in ID'),'CHECKIN');
  for (const surface of ['passLog','passAudit'] as const) for (const row of snapshot.surfaces[surface]) add(surface,'PASS',text(row,'passId','legacyId','id','Pass ID'),'PASS');
  for (const row of snapshot.surfaces.passQueue) add('passQueue','PASS_REQUEST',text(row,'requestId','queueId','legacyId','id','Request ID','Queue ID'),'PASS_REQUEST');
  for (const row of snapshot.surfaces.teacherActions) add('teacherActions','STAFF_ACTION',text(row,'actionId','legacyId','id','Action ID'),'STAFF_ACTION');
  return [...keyed.values()].sort((a,b) => `${a.legacyEntityType}:${a.legacyIdOrKey}`.localeCompare(`${b.legacyEntityType}:${b.legacyIdOrKey}`));
}

function reconcile(snapshot: LegacySnapshot): LegacyReconciliationReport {
  const fingerprint = fingerprintLegacySnapshot(snapshot);
  const surfaceCounts = Object.fromEntries(legacySurfaceNames.map((name) => [name, snapshot.surfaces[name].length])) as Record<LegacySurfaceName, number>;
  const rosterBySection: Record<string, number> = {};
  const students = new Set<string>();
  let ambiguousIdentityCount = 0;
  for (const row of snapshot.surfaces.roster) {
    const student = studentKey(row);
    const section = sectionKey(row);
    if (!student) ambiguousIdentityCount += 1;
    else students.add(student.trim().toLowerCase());
    if (section) groupIncrement(rosterBySection, section);
  }

  const checkinsBySectionDate: Record<string, number> = {};
  for (const row of snapshot.surfaces.checkins) {
    const section = sectionKey(row) ?? 'UNKNOWN_SECTION';
    const date = text(row,'academicDate','date','Date') ?? (text(row,'timestamp','checkedInAt','Check-in Time')?.slice(0,10) ?? 'UNKNOWN_DATE');
    const status = text(row,'status','Status') ?? 'UNKNOWN_STATUS';
    groupIncrement(checkinsBySectionDate, `${section}|${date}|${status}`);
  }

  const passesByClassStatusCountability: Record<string, number> = {};
  let activePassCount = 0;
  let unmappedStatusCount = 0;
  const passIds = new Set<string>();
  for (const surface of ['passLog','passAudit'] as const) {
    for (const row of snapshot.surfaces[surface]) {
      const passId = text(row,'passId','legacyId','id','Pass ID');
      if (surface === 'passAudit' && passId && passIds.has(passId)) continue;
      if (passId) passIds.add(passId);
      const section = sectionKey(row) ?? 'UNKNOWN_SECTION';
      const status = (text(row,'status','Status') ?? '').toUpperCase();
      const countability = (text(row,'countability','classification','Countability') ?? '').toUpperCase().replaceAll(' ','_');
      if (!PASS_STATUSES.has(status)) unmappedStatusCount += 1;
      if (!PASS_COUNTABILITY.has(countability)) unmappedStatusCount += 1;
      if (status === 'OUT') activePassCount += 1;
      groupIncrement(passesByClassStatusCountability, `${section}|${status || 'UNKNOWN_STATUS'}|${countability || 'LEGACY_BLANK'}`);
    }
  }

  let queuedRequestCount = 0;
  for (const row of snapshot.surfaces.passQueue) {
    const status = (text(row,'status','Status') ?? '').toUpperCase();
    if (!QUEUE_STATUSES.has(status)) unmappedStatusCount += 1;
    if (status === 'WAITING' || status === 'QUEUED') queuedRequestCount += 1;
  }

  const credentialCoverageCount = snapshot.surfaces.credentialCoverage.filter((row) => row.hasCredential === true).length;
  const duplicateLegacyIds =
    duplicateMembershipCount(snapshot.surfaces.roster) +
    duplicateCount(snapshot.surfaces.checkins,['checkinId','legacyId','id','Check-in ID']) +
    duplicateCount(snapshot.surfaces.passLog,['passId','legacyId','id','Pass ID']) +
    duplicateCount(snapshot.surfaces.passAudit,['passId','legacyId','id','Pass ID']) +
    duplicateCount(snapshot.surfaces.passQueue,['requestId','queueId','legacyId','id','Request ID','Queue ID']) +
    duplicateCount(snapshot.surfaces.teacherActions,['actionId','legacyId','id','Action ID']);

  const settingsPresent = snapshot.surfaces.settings.length > 0 && snapshot.surfaces.settings.every((row) => text(row,'key','settingKey','Key') !== null && (Object.hasOwn(row,'value') || Object.hasOwn(row,'Value')));
  const findings: MigrationFinding[] = [];
  findings.push(finding('T-MIG-001','PASS','READ_ONLY',0,'Snapshot validation/shadow import exposes no legacy write adapter.'));
  findings.push(finding('T-MIG-002','PASS','FINGERPRINT',0,'Canonical SHA-256 fingerprint makes identical source snapshots idempotent.'));
  findings.push(finding('T-MIG-003','PASS','PASS_DEDUP',0,'Pass Audit rows sharing a Pass ID with Pass Log are represented once in logical pass reconciliation.'));
  findings.push(finding('T-MIG-004', duplicateLegacyIds === 0 ? 'PASS' : 'FAIL','LEGACY_IDS',duplicateLegacyIds,duplicateLegacyIds === 0 ? 'Stable legacy identifiers are unique within source surfaces; repeated students in different sections remain distinct memberships.' : 'Duplicate stable legacy entity/membership identifiers require correction before parity can pass.'));
  findings.push(finding('T-MIG-005', settingsPresent ? 'PASS' : 'FAIL','SETTINGS',settingsPresent ? 0 : 1,settingsPresent ? 'Snapshot contains explicit exported workbook Settings; code defaults are not substituted.' : 'Explicit exported Settings key/value rows are required.'));
  findings.push(finding('T-MIG-006', ambiguousIdentityCount === 0 ? 'PASS' : 'FAIL','IDENTITY',ambiguousIdentityCount,ambiguousIdentityCount === 0 ? 'Roster rows provide stable student identity keys and membership counts can reconcile.' : 'Roster rows without stable student keys are ambiguous and block PASS.'));
  findings.push(finding('T-MIG-007','PASS','CHECKINS',0,'Check-ins are grouped by section/date/status from the supplied snapshot.'));
  findings.push(finding('T-MIG-008', unmappedStatusCount === 0 ? 'PASS' : 'REVIEW','PASS_STATE',unmappedStatusCount,unmappedStatusCount === 0 ? 'Observed pass/queue states map to known migration-safe categories.' : 'Unknown pass/countability/queue states remain review-safe.'));
  findings.push(finding('T-MIG-009','PASS','CURRENT_STATE',0,'Active OUT and queued WAITING/QUEUED state are counted at the supplied high-water mark.'));
  findings.push(finding('T-MIG-010', ambiguousIdentityCount === 0 ? 'PASS' : 'FAIL','AMBIGUOUS_IDENTITY',ambiguousIdentityCount,'Ambiguous identities are never guessed from display name.'));
  if (snapshot.surfaces.unmatchedSignIns.length > 0) findings.push(finding('MIG-UNMATCHED-SIGNINS','REVIEW','IDENTITY_REVIEW',snapshot.surfaces.unmatchedSignIns.length,'Unmatched sign-ins remain review evidence and never create students automatically.'));

  return {
    overallStatus: overall(findings),
    fingerprint,
    surfaceCounts: Object.freeze(surfaceCounts),
    uniqueStudents: students.size,
    memberships: snapshot.surfaces.roster.length,
    rosterBySection: Object.freeze(rosterBySection),
    credentialCoverageCount,
    checkinsBySectionDate: Object.freeze(checkinsBySectionDate),
    passesByClassStatusCountability: Object.freeze(passesByClassStatusCountability),
    activePassCount,
    queuedRequestCount,
    duplicateLegacyIds,
    ambiguousIdentityCount,
    unmappedStatusCount,
    settingsPresent,
    findings: Object.freeze(findings),
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value,'utf8').digest('hex');
}

function stateFor(surface: LegacySurfaceName, row: LegacyRow): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  const copyText = (target: string, ...keys: string[]): void => { const value = text(row,...keys); if (value !== null) state[target] = value; };
  const copyBool = (target: string, ...keys: string[]): void => { const value = bool(row,...keys); if (value !== null) state[target] = value; };
  if (surface === 'roster') { copyBool('active','active','Active'); copyBool('unlimited','unlimitedPasses','Unlimited Passes'); copyText('accessMode','passAccess','Pass Access'); }
  if (surface === 'bellSchedule') { copyText('scheduleKey','scheduleKey','Schedule Key'); copyText('period','periodCode','Period'); copyText('start','start','Start Time'); copyText('end','end','End Time'); }
  if (surface === 'schoolCalendar') { copyText('date','date','Date'); copyBool('schoolDay','isSchoolDay','School Day'); copyText('scheduleKey','scheduleKey','Schedule Key'); }
  if (surface === 'settings') { const key=text(row,'key','settingKey','Key'); const value=row.value ?? row.Value; if(key) state.key=key; if(value !== undefined) state.valueHash=sha256(JSON.stringify(value)); }
  if (surface === 'checkins') { copyText('date','academicDate','date','Date'); copyText('timestamp','timestamp','checkedInAt','Check-in Time'); copyText('method','method','Method'); copyText('status','status','Status'); }
  if (surface === 'passLog' || surface === 'passAudit') { copyText('destination','destination','Destination'); copyText('outTime','startedAt','outTime','Out Time'); copyText('returnTime','returnedAt','returnTime','Return Time'); copyText('status','status','Status'); copyText('countability','countability','classification','Countability'); copyText('authorizationMethod','authorizationMethod','Authorization Method'); copyText('requestId','requestId','Request ID'); copyText('voidedAt','voidedAt','Voided At'); }
  if (surface === 'passQueue') { copyText('joinedAt','joinedAt','requestedAt','Joined At'); copyText('status','status','Status'); copyText('resolvedAt','resolvedAt','Resolved At'); copyText('resolution','resolution','Resolution'); copyText('requestId','requestId','Request ID'); }
  if (surface === 'teacherActions') { copyText('at','occurredAt','At'); copyText('action','actionType','action','Action'); copyText('referenceId','referenceId','Reference ID'); }
  if (surface === 'credentialCoverage') { if (row.hasCredential === true || row.hasCredential === false) state.hasCredential=row.hasCredential; copyText('algorithm','algorithm'); if (typeof row.credentialVersion === 'number') state.credentialVersion=row.credentialVersion; }
  if (surface === 'unmatchedSignIns') { copyText('status','status','Status'); copyText('firstSeen','firstSeen','First Seen'); copyText('lastSeen','lastSeen','Last Seen'); }
  return state;
}

function recordType(surface: LegacySurfaceName): string {
  return ({roster:'ROSTER_MEMBERSHIP',bellSchedule:'SCHEDULE_PERIOD',schoolCalendar:'SCHOOL_CALENDAR_DAY',settings:'SETTING',checkins:'CHECKIN',passLog:'PASS_LOG',passAudit:'PASS_AUDIT',passQueue:'PASS_QUEUE',teacherActions:'TEACHER_ACTION',credentialCoverage:'CREDENTIAL_COVERAGE',unmatchedSignIns:'UNMATCHED_SIGNIN'} as const)[surface];
}

function legacyKey(surface: LegacySurfaceName, row: LegacyRow): string | null {
  if (surface === 'roster') { const student=studentKey(row); const section=sectionKey(row); return student && section ? `${section}:${student}` : null; }
  if (surface === 'bellSchedule') return text(row,'legacyId','id','periodKey','periodCode','Period');
  if (surface === 'schoolCalendar') return text(row,'legacyId','id','date','academicDate','Date');
  if (surface === 'settings') return text(row,'legacyId','id','key','settingKey','Key');
  if (surface === 'checkins') return text(row,'checkinId','legacyId','id','Check-in ID');
  if (surface === 'passLog' || surface === 'passAudit') return text(row,'passId','legacyId','id','Pass ID');
  if (surface === 'passQueue') return text(row,'requestId','queueId','legacyId','id','Request ID','Queue ID');
  if (surface === 'teacherActions') return text(row,'actionId','legacyId','id','Action ID');
  return studentKey(row);
}

async function insertShadowRecords(tx: QueryExecutor, organizationId: string, schoolId: string, runId: string, snapshot: LegacySnapshot): Promise<number> {
  let count = 0;
  for (const surface of legacySurfaceNames) {
    const rows = snapshot.surfaces[surface];
    for (let ordinal = 0; ordinal < rows.length; ordinal += 1) {
      const row = rows[ordinal]!;
      const identity = studentKey(row);
      const sanitizedState = stateFor(surface,row);
      await tx.query(
        `INSERT INTO migration_shadow_records (organization_id,school_id,import_run_id,source_surface,source_ordinal,record_type,legacy_key,identity_key_hash,section_key,source_row_hash,state_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [organizationId,schoolId,runId,surface,ordinal,recordType(surface),legacyKey(surface,row),identity ? sha256(identity.trim().toLowerCase()) : null,sectionKey(row),sha256(stableSnapshotJson({metadata:snapshot.metadata,surfaces:{...Object.fromEntries(legacySurfaceNames.map((name)=>[name,name===surface?[row]:[]]))} as LegacySnapshot['surfaces']})),JSON.stringify(sanitizedState)],
      );
      count += 1;
    }
  }
  return count;
}

async function persistedShadowResult(database: Database, schoolId: string, fingerprint: string): Promise<LegacyShadowImportResult | null> {
  const rows = await database.query<{id:string;counts_json:Record<string,unknown>;artifact_reference:string|null}>(
    `SELECT id,counts_json,artifact_reference FROM migration_import_runs WHERE school_id=$1 AND source_type='LEGACY_GRANT_CLASSROOM' AND source_snapshot_fingerprint=$2 AND mode='IMPORT_SHADOW' AND status<>'STARTED' LIMIT 1`,
    [schoolId,fingerprint],
  );
  const run = rows[0];
  if (!run) return null;
  const reports = await database.query<{report_json:LegacyReconciliationReport;source_counts_json:Record<LegacySurfaceName,number>}>(`SELECT report_json,source_counts_json FROM migration_shadow_parity_reports WHERE import_run_id=$1 LIMIT 1`,[run.id]);
  const report = reports[0]?.report_json;
  if (!report) return null;
  const countRows = await database.query<{count:string}>(`SELECT count(*)::text AS count FROM migration_shadow_records WHERE import_run_id=$1`,[run.id]);
  return {mode:'IMPORT_SHADOW',importRunId:run.id,replayed:true,fingerprint:report.fingerprint,shadowRecordCount:Number(countRows[0]?.count??0),legacyWrites:0,schoolwideOperationalWrites:0,report};
}

export class LegacyReadOnlyImporterService {
  readonly #database?: Database;
  constructor(database?: Database) { this.#database = database; }

  resolveSchoolId(principal: LegacyMigrationPrincipal, capability: Capability): string {
    const schoolIds = [...new Set(principal.roleGrants.filter((grant) => grant.role === 'ADMIN' && roleAllowsCapability(grant.role, capability)).map((grant) => grant.schoolId))];
    if (schoolIds.length === 0) throw new LegacyImportError('MIGRATION_SCOPE_DENIED','No current administrator migration scope is available.',403);
    if (schoolIds.length !== 1) throw new LegacyImportError('MIGRATION_SCOPE_AMBIGUOUS','Migration operations require exactly one current authorized school scope.',409);
    return schoolIds[0]!;
  }

  validate(input: unknown): LegacyValidateResult {
    const snapshot = parseLegacySnapshot(input);
    const report = reconcile(snapshot);
    return { mode: 'VALIDATE', fingerprint: report.fingerprint, legacyWrites: 0, schoolwideOperationalWrites: 0, report };
  }

  dryRun(input: unknown): LegacyDryRunPlan {
    const snapshot = parseLegacySnapshot(input);
    const report = reconcile(snapshot);
    return {mode:'DRY_RUN',fingerprint:report.fingerprint,proposedMappings:Object.freeze(plannedMappings(snapshot)),proposedOperationalWrites:0,legacyWrites:0,report};
  }

  async importShadow(principal: LegacyMigrationPrincipal, schoolId: string, input: unknown, sourceFingerprint: string): Promise<LegacyShadowImportResult> {
    const database = this.#database;
    if (!database || !supportsTransactions(database)) throw new LegacyImportError('MIGRATION_TRANSACTION_REQUIRED','IMPORT_SHADOW requires transactional Schoolwide storage.',503,true);
    if (principal.organizationId.length === 0) throw new LegacyImportError('MIGRATION_SCOPE_DENIED','Migration principal organization is required.',403);
    const snapshot = parseLegacySnapshot(input);
    const report = reconcile(snapshot);
    if (report.fingerprint.value !== sourceFingerprint) throw new LegacyImportError('LEGACY_FINGERPRINT_MISMATCH','The supplied source fingerprint does not match this snapshot.',409);
    const replay = await persistedShadowResult(database,schoolId,sourceFingerprint);
    if (replay) return replay;

    return database.transaction(async (tx) => {
      const existing = await tx.query<{id:string}>(`SELECT id FROM migration_import_runs WHERE school_id=$1 AND source_type='LEGACY_GRANT_CLASSROOM' AND source_snapshot_fingerprint=$2 AND mode='IMPORT_SHADOW' LIMIT 1 FOR UPDATE`,[schoolId,sourceFingerprint]);
      if (existing[0]) {
        const completed = await persistedShadowResult(database,schoolId,sourceFingerprint);
        if (completed) return completed;
        throw new LegacyImportError('MIGRATION_SHADOW_IN_PROGRESS','This shadow fingerprint is already being imported.',409,true);
      }
      const runRows = await tx.query<{id:string}>(
        `INSERT INTO migration_import_runs (organization_id,school_id,source_snapshot_fingerprint,source_alias,source_schema_version,source_exported_at,source_high_water_mark,mode,status,counts_json,discrepancy_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'IMPORT_SHADOW','STARTED',$8::jsonb,0) RETURNING id`,
        [principal.organizationId,schoolId,sourceFingerprint,snapshot.metadata.sourceAlias,snapshot.metadata.schemaVersion,snapshot.metadata.exportedAt,snapshot.metadata.highWaterMark??null,JSON.stringify(report.surfaceCounts)],
      );
      const runId = runRows[0]?.id;
      if (!runId) throw new LegacyImportError('MIGRATION_SHADOW_FAILED','Could not create shadow migration run.',500,true);
      const shadowRecordCount = await insertShadowRecords(tx,principal.organizationId,schoolId,runId,snapshot);
      const shadowCountsRows = await tx.query<{source_surface:string;count:string}>(`SELECT source_surface,count(*)::text AS count FROM migration_shadow_records WHERE import_run_id=$1 GROUP BY source_surface`,[runId]);
      const shadowCounts = Object.fromEntries(legacySurfaceNames.map((name)=>[name,0])) as Record<LegacySurfaceName,number>;
      for (const row of shadowCountsRows) if ((legacySurfaceNames as readonly string[]).includes(row.source_surface)) shadowCounts[row.source_surface as LegacySurfaceName]=Number(row.count);
      let discrepancies = 0;
      for (const name of legacySurfaceNames) if (shadowCounts[name] !== report.surfaceCounts[name]) discrepancies += Math.abs(shadowCounts[name]-report.surfaceCounts[name]);
      const parityFinding = finding('T-MIG-SHADOW-COUNT',discrepancies===0?'PASS':'FAIL','SHADOW_PARITY',discrepancies,discrepancies===0?'Every approved source row has exactly one isolated shadow projection row.':'Source/shadow row counts diverged.');
      const finalFindings = Object.freeze([...report.findings,parityFinding]);
      const finalReport: LegacyReconciliationReport = {...report,overallStatus:overall(finalFindings),findings:finalFindings};
      for (const entry of finalFindings) await tx.query(
        `INSERT INTO migration_reconciliation_findings (organization_id,school_id,import_run_id,invariant_code,status,category,count_value,detail_sanitized) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [principal.organizationId,schoolId,runId,entry.invariant,entry.status,entry.category,entry.count,entry.detail],
      );
      await tx.query(
        `INSERT INTO migration_shadow_parity_reports (organization_id,school_id,import_run_id,source_snapshot_fingerprint,overall_status,source_counts_json,shadow_counts_json,discrepancy_count,report_json)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)`,
        [principal.organizationId,schoolId,runId,sourceFingerprint,finalReport.overallStatus,JSON.stringify(report.surfaceCounts),JSON.stringify(shadowCounts),discrepancies,JSON.stringify(finalReport)],
      );
      const runStatus = finalReport.overallStatus === 'PASS' ? 'PASS' : finalReport.overallStatus === 'FAIL' ? 'FAIL' : 'PARTIAL';
      await tx.query(`UPDATE migration_import_runs SET status=$1,discrepancy_count=$2,finished_at=now(),artifact_reference='migration_shadow_parity_reports' WHERE id=$3`,[runStatus,discrepancies,runId]);
      return {mode:'IMPORT_SHADOW',importRunId:runId,replayed:false,fingerprint:finalReport.fingerprint,shadowRecordCount,legacyWrites:0,schoolwideOperationalWrites:0,report:finalReport};
    });
  }
}
