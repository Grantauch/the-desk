import type { StaffPrincipal, StaffRole } from '../auth/types.js';

export type AdminPrincipal = StaffPrincipal;

export type AdminOverview = {
  schoolId: string;
  generatedAt: string;
  summary: {
    activeStaff: number;
    activeSections: number;
    activeStudents: number;
    openIntegrationReviews: number;
    activeDestinations: number;
  };
  integrationHealth: {
    active: number;
    revoked: number;
    error: number;
    staleLinks: number;
  };
};

export type AdminStaffRow = {
  userId: string;
  displayName: string;
  primaryEmail: string;
  status: 'ACTIVE' | 'INACTIVE';
  roles: readonly { roleId: string; role: StaffRole; validFrom: string; validUntil: string | null }[];
};

export type AdminSectionRow = {
  sectionId: string;
  name: string;
  code: string | null;
  periodCode: string | null;
  room: string | null;
  source: string;
  status: 'ACTIVE' | 'INACTIVE';
  academicYearId: string;
  staffCount: number;
  activeEnrollmentCount: number;
};

export type AdminPolicyRow = {
  policySetId: string;
  policySetName: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  active: boolean;
  policyValueId: string;
  policyKey: string;
  typedValue: unknown;
  teacherOverrideAllowed: boolean;
  validationSchemaVersion: number;
};

export type AdminDestinationRow = {
  destinationId: string;
  name: string;
  category: 'RESTROOM' | 'OFFICE' | 'NURSE' | 'COUNSELOR' | 'OTHER';
  active: boolean;
  securityVisible: boolean;
  studentSelectable: boolean;
  defaultExpectedMinutes: number | null;
  capacity: number | null;
};

export type AdminCalendarRow = {
  calendarDayId: string;
  academicDate: string;
  isSchoolDay: boolean;
  scheduleProfileId: string | null;
  scheduleProfileName: string | null;
  label: string | null;
  source: string;
  sourceRevision: string | null;
};

export type AdminStudentAccessRow = {
  ruleId: string;
  studentId: string;
  studentName: string;
  sectionId: string | null;
  sectionName: string | null;
  accessMode: 'STANDARD' | 'UNLIMITED' | 'ESCORT_ONLY';
  reasonPrivate: string | null;
  validFrom: string;
  validUntil: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  setByUserId: string | null;
};

export type AdminIntegrationReviewRow = {
  reviewId: string;
  reviewType: string;
  externalKey: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED_MATCH' | 'RESOLVED_NEW' | 'DISMISSED';
  candidateStudentId: string | null;
  candidateSectionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminAuditRow = {
  auditId: string;
  occurredAt: string;
  actorKind: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  source: string;
  reason: string | null;
  metadata: unknown;
};

export type AdminMutationResult = {
  action: string;
  targetType: string;
  targetId: string;
  recordedAt: string;
};

export type AdminConsoleServiceOptions = {
  now?: () => Date;
  idempotencyTtlMs?: number;
  staleIntegrationMs?: number;
};

export class AdminConsoleError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = 'AdminConsoleError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
