import { roleAllowsCapability } from '../auth/capabilities.js';
import type { Capability } from '../auth/types.js';
import { fingerprintLegacySnapshot, parseLegacySnapshot } from './snapshot.js';
import {
  LegacyImportError,
  legacySurfaceNames,
  type LegacyDryRunPlan,
  type LegacyMigrationPrincipal,
  type LegacyReconciliationReport,
  type LegacyRow,
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

function overall(findings: readonly MigrationFinding[]): LegacyReconciliationReport['overallStatus'] {
  if (findings.some((finding) => finding.status === 'FAIL')) return 'FAIL';
  if (findings.some((finding) => finding.status === 'REVIEW')) return 'REVIEW';
  return 'PASS';
}

function finding(invariant: string, status: MigrationFinding['status'], category: string, count: number, detail: string): MigrationFinding {
  return { invariant, status, category, count, detail };
}

function plannedMappings(snapshot: LegacySnapshot): PlannedLegacyMapping[] {
  const keyed = new Map<string, PlannedLegacyMapping>();
  const add = (sourceSurface: LegacySurfaceName, legacyEntityType: string, legacyIdOrKey: string | null, schoolwideEntityType: string): void => {
    if (!legacyIdOrKey) return;
    const key = `${legacyEntityType}\u0000${legacyIdOrKey}\u0000${schoolwideEntityType}`;
    if (!keyed.has(key)) keyed.set(key, { sourceSurface, legacyEntityType, legacyIdOrKey, schoolwideEntityType });
  };

  for (const row of snapshot.surfaces.roster) {
    const studentKey = text(row, 'studentKey','legacyStudentKey','studentId');
    const sectionKey = text(row, 'sectionKey','classKey','sectionId','class');
    add('roster','STUDENT',studentKey,'STUDENT');
    add('roster','SECTION',sectionKey,'SECTION');
    add('roster','ENROLLMENT',studentKey && sectionKey ? `${sectionKey}:${studentKey}` : null,'ENROLLMENT');
  }
  for (const row of snapshot.surfaces.bellSchedule) add('bellSchedule','SCHEDULE_PERIOD',text(row,'legacyId','id','periodKey','periodCode'),'SCHEDULE_PERIOD');
  for (const row of snapshot.surfaces.schoolCalendar) add('schoolCalendar','SCHOOL_CALENDAR_DAY',text(row,'legacyId','id','date','academicDate'),'SCHOOL_CALENDAR_DAY');
  for (const row of snapshot.surfaces.settings) add('settings','SETTING',text(row,'legacyId','id','key','settingKey'),'POLICY_INPUT');
  for (const row of snapshot.surfaces.checkins) add('checkins','CHECKIN',text(row,'checkinId','legacyId','id'),'CHECKIN');
  for (const surface of ['passLog','passAudit'] as const) for (const row of snapshot.surfaces[surface]) add(surface,'PASS',text(row,'passId','legacyId','id'),'PASS');
  for (const row of snapshot.surfaces.passQueue) add('passQueue','PASS_REQUEST',text(row,'requestId','queueId','legacyId','id'),'PASS_REQUEST');
  for (const row of snapshot.surfaces.teacherActions) add('teacherActions','STAFF_ACTION',text(row,'actionId','legacyId','id'),'STAFF_ACTION');
  return [...keyed.values()].sort((a,b) => `${a.legacyEntityType}:${a.legacyIdOrKey}`.localeCompare(`${b.legacyEntityType}:${b.legacyIdOrKey}`));
}

function reconcile(snapshot: LegacySnapshot): LegacyReconciliationReport {
  const fingerprint = fingerprintLegacySnapshot(snapshot);
  const surfaceCounts = Object.fromEntries(legacySurfaceNames.map((name) => [name, snapshot.surfaces[name].length])) as Record<LegacySurfaceName, number>;
  const rosterBySection: Record<string, number> = {};
  const students = new Set<string>();
  let ambiguousIdentityCount = 0;
  for (const row of snapshot.surfaces.roster) {
    const studentKey = text(row,'studentKey','legacyStudentKey','studentId');
    const sectionKey = text(row,'sectionKey','classKey','sectionId','class');
    if (!studentKey) ambiguousIdentityCount += 1;
    else students.add(studentKey);
    if (sectionKey) groupIncrement(rosterBySection, sectionKey);
  }

  const checkinsBySectionDate: Record<string, number> = {};
  for (const row of snapshot.surfaces.checkins) {
    const section = text(row,'sectionKey','classKey','sectionId','class') ?? 'UNKNOWN_SECTION';
    const date = text(row,'academicDate','date') ?? (text(row,'timestamp','checkedInAt')?.slice(0,10) ?? 'UNKNOWN_DATE');
    const status = text(row,'status') ?? 'UNKNOWN_STATUS';
    groupIncrement(checkinsBySectionDate, `${section}|${date}|${status}`);
  }

  const passesByClassStatusCountability: Record<string, number> = {};
  let activePassCount = 0;
  let unmappedStatusCount = 0;
  const passIds = new Set<string>();
  for (const surface of ['passLog','passAudit'] as const) {
    for (const row of snapshot.surfaces[surface]) {
      const passId = text(row,'passId','legacyId','id');
      if (surface === 'passAudit' && passId && passIds.has(passId)) continue;
      if (passId) passIds.add(passId);
      const section = text(row,'sectionKey','classKey','sectionId','class') ?? 'UNKNOWN_SECTION';
      const status = (text(row,'status') ?? '').toUpperCase();
      const countability = (text(row,'countability','classification') ?? '').toUpperCase();
      if (!PASS_STATUSES.has(status)) unmappedStatusCount += 1;
      if (!PASS_COUNTABILITY.has(countability)) unmappedStatusCount += 1;
      if (status === 'OUT') activePassCount += 1;
      groupIncrement(passesByClassStatusCountability, `${section}|${status || 'UNKNOWN_STATUS'}|${countability || 'LEGACY_BLANK'}`);
    }
  }

  let queuedRequestCount = 0;
  for (const row of snapshot.surfaces.passQueue) {
    const status = (text(row,'status') ?? '').toUpperCase();
    if (!QUEUE_STATUSES.has(status)) unmappedStatusCount += 1;
    if (status === 'WAITING' || status === 'QUEUED') queuedRequestCount += 1;
  }

  const credentialCoverageCount = snapshot.surfaces.credentialCoverage.filter((row) => row.hasCredential === true).length;
  const duplicateLegacyIds =
    duplicateCount(snapshot.surfaces.roster,['studentKey','legacyStudentKey','studentId']) +
    duplicateCount(snapshot.surfaces.checkins,['checkinId','legacyId','id']) +
    duplicateCount(snapshot.surfaces.passLog,['passId','legacyId','id']) +
    duplicateCount(snapshot.surfaces.passAudit,['passId','legacyId','id']) +
    duplicateCount(snapshot.surfaces.passQueue,['requestId','queueId','legacyId','id']) +
    duplicateCount(snapshot.surfaces.teacherActions,['actionId','legacyId','id']);

  const settingsPresent = snapshot.surfaces.settings.length > 0 && snapshot.surfaces.settings.every((row) => text(row,'key','settingKey') !== null && Object.hasOwn(row,'value'));
  const findings: MigrationFinding[] = [];
  findings.push(finding('T-MIG-001','PASS','READ_ONLY',0,'Snapshot validation and dry-run operate only on supplied structured data and expose no legacy write adapter.'));
  findings.push(finding('T-MIG-002','PASS','FINGERPRINT',0,'Canonical SHA-256 fingerprint and deterministic plan make identical source snapshots idempotent.'));
  findings.push(finding('T-MIG-003','PASS','PASS_DEDUP',0,'Pass Audit rows sharing a Pass ID with Pass Log are represented once in proposed pass mappings/counts.'));
  findings.push(finding('T-MIG-004', duplicateLegacyIds === 0 ? 'PASS' : 'FAIL','LEGACY_IDS',duplicateLegacyIds,duplicateLegacyIds === 0 ? 'Stable legacy identifiers are unique within their source surfaces.' : 'Duplicate stable legacy identifiers require correction before import commit.'));
  findings.push(finding('T-MIG-005', settingsPresent ? 'PASS' : 'FAIL','SETTINGS',settingsPresent ? 0 : 1,settingsPresent ? 'Snapshot contains explicit exported settings; no code defaults are substituted.' : 'Explicit exported Settings key/value rows are required; code defaults are never substituted.'));
  findings.push(finding('T-MIG-006', ambiguousIdentityCount === 0 ? 'PASS' : 'FAIL','IDENTITY',ambiguousIdentityCount,ambiguousIdentityCount === 0 ? 'Roster rows provide stable student identity keys and membership counts can reconcile.' : 'Roster rows without stable student keys are ambiguous and block a PASS result.'));
  findings.push(finding('T-MIG-007','PASS','CHECKINS',0,'Check-ins are grouped by section/date/status from the supplied snapshot.'));
  findings.push(finding('T-MIG-008', unmappedStatusCount === 0 ? 'PASS' : 'REVIEW','PASS_STATE',unmappedStatusCount,unmappedStatusCount === 0 ? 'Observed pass/queue states map to known migration-safe categories.' : 'Unknown pass/countability/queue states remain review-safe and are not promoted to countable evidence.'));
  findings.push(finding('T-MIG-009','PASS','CURRENT_STATE',0,'Active OUT and queued WAITING/QUEUED state are counted at the supplied snapshot high-water mark.'));
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

export class LegacyReadOnlyImporterService {
  resolveSchoolId(principal: LegacyMigrationPrincipal, capability: Capability): string {
    const schoolIds = [...new Set(principal.roleGrants
      .filter((grant) => grant.role === 'ADMIN' && roleAllowsCapability(grant.role, capability))
      .map((grant) => grant.schoolId))];
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
    return {
      mode: 'DRY_RUN',
      fingerprint: report.fingerprint,
      proposedMappings: Object.freeze(plannedMappings(snapshot)),
      proposedOperationalWrites: 0,
      legacyWrites: 0,
      report,
    };
  }
}
