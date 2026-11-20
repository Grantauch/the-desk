import type { StaffPrincipal } from '../auth/types.js';

export const legacySurfaceNames = [
  'roster',
  'bellSchedule',
  'schoolCalendar',
  'settings',
  'checkins',
  'passLog',
  'passAudit',
  'passQueue',
  'teacherActions',
  'credentialCoverage',
  'unmatchedSignIns',
] as const;

export type LegacySurfaceName = (typeof legacySurfaceNames)[number];
export type LegacyRow = Readonly<Record<string, unknown>>;

export type LegacySnapshotMetadata = {
  sourceAlias: string;
  schemaVersion: string;
  exportedAt: string;
  highWaterMark?: string;
};

export type LegacySnapshot = {
  metadata: LegacySnapshotMetadata;
  surfaces: Readonly<Record<LegacySurfaceName, readonly LegacyRow[]>>;
};

export type LegacySnapshotFingerprint = {
  algorithm: 'SHA256';
  value: string;
  sourceAlias: string;
  schemaVersion: string;
  exportedAt: string;
  highWaterMark: string | null;
  rowCounts: Readonly<Record<LegacySurfaceName, number>>;
};

export type MigrationFindingStatus = 'PASS' | 'FAIL' | 'REVIEW';
export type MigrationFinding = {
  invariant: string;
  status: MigrationFindingStatus;
  category: string;
  count: number;
  detail: string;
};

export type PlannedLegacyMapping = {
  sourceSurface: LegacySurfaceName;
  legacyEntityType: string;
  legacyIdOrKey: string;
  schoolwideEntityType: string;
};

export type LegacyReconciliationReport = {
  overallStatus: 'PASS' | 'FAIL' | 'REVIEW';
  fingerprint: LegacySnapshotFingerprint;
  surfaceCounts: Readonly<Record<LegacySurfaceName, number>>;
  uniqueStudents: number;
  memberships: number;
  rosterBySection: Readonly<Record<string, number>>;
  credentialCoverageCount: number;
  checkinsBySectionDate: Readonly<Record<string, number>>;
  passesByClassStatusCountability: Readonly<Record<string, number>>;
  activePassCount: number;
  queuedRequestCount: number;
  duplicateLegacyIds: number;
  ambiguousIdentityCount: number;
  unmappedStatusCount: number;
  settingsPresent: boolean;
  findings: readonly MigrationFinding[];
};

export type LegacyDryRunPlan = {
  mode: 'DRY_RUN';
  fingerprint: LegacySnapshotFingerprint;
  proposedMappings: readonly PlannedLegacyMapping[];
  proposedOperationalWrites: 0;
  legacyWrites: 0;
  report: LegacyReconciliationReport;
};

export type LegacyValidateResult = {
  mode: 'VALIDATE';
  fingerprint: LegacySnapshotFingerprint;
  legacyWrites: 0;
  schoolwideOperationalWrites: 0;
  report: LegacyReconciliationReport;
};

export type LegacyShadowImportResult = {
  mode: 'IMPORT_SHADOW';
  importRunId: string;
  replayed: boolean;
  fingerprint: LegacySnapshotFingerprint;
  shadowRecordCount: number;
  legacyWrites: 0;
  schoolwideOperationalWrites: 0;
  report: LegacyReconciliationReport;
};

export type LegacyMigrationPrincipal = StaffPrincipal;

export class LegacyImportError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = 'LegacyImportError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
