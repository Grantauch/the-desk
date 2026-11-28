export type TeacherSectionSummary = {
  sectionId: string;
  schoolId: string;
  name: string;
  code: string | null;
  periodLabel: string | null;
  room: string | null;
};

export type TeacherRosterStudent = {
  enrollmentId: string;
  studentId: string;
  displayName: string;
  localStudentNumber: string | null;
  checkedIn: boolean;
};

export type TeacherActivePass = {
  passId: string;
  studentId: string;
  studentName: string;
  destinationId: string;
  destinationName: string;
  startedAt: string;
  elapsedSeconds: number;
  expectedMinutes: number | null;
  warning: 'LATE' | null;
};

export type TeacherQueueEntry = {
  queueEntryId: string;
  passRequestId: string;
  studentId: string;
  studentName: string;
  destinationId: string;
  destinationName: string;
  joinedAt: string;
  queueExpiresAt: string;
  waitingSeconds: number;
  warning: 'EXPIRING_SOON' | null;
};

export type TeacherPolicyControl = {
  policyKey: string;
  value: unknown;
  source: 'SCHOOL_DEFAULT' | 'SECTION_OVERRIDE';
};

export type TeacherLiveSnapshot = {
  section: TeacherSectionSummary;
  generatedAt: string;
  academicDate: string;
  schedule: unknown;
  roster: readonly TeacherRosterStudent[];
  activePasses: readonly TeacherActivePass[];
  queue: readonly TeacherQueueEntry[];
  checkInSummary: { enrolled: number; checkedIn: number; missing: number };
  warnings: readonly { code: string; message: string }[];
  policyControls: readonly TeacherPolicyControl[];
  transport: {
    mode: 'POLLING_FALLBACK';
    pollAfterMs: number;
    sectionChannel: string;
  };
};

export type StudentPassEvidenceItem = {
  passId: string;
  startedAt: string;
  returnedAt: string | null;
  destinationName: string;
  status: 'OUT' | 'RETURNED' | 'ROLLED_OVER';
  originalCountability: string;
  effectiveCountability: string;
  durationMs: number | null;
};

export type StudentPassEvidence = {
  sectionId: string;
  studentId: string;
  studentName: string;
  termId: string;
  termStartsOn: string;
  termEndsOn: string;
  limit: number;
  items: readonly StudentPassEvidenceItem[];
};

export type TeacherApplicationServiceOptions = {
  now?: () => Date;
  pollAfterMs?: number;
};

export class TeacherApplicationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode: number, retryable = false) {
    super(message);
    this.name = 'TeacherApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
