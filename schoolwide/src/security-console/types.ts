import type { StaffPrincipal } from '../auth/types.js';

export type SecurityWarningState = 'NONE' | 'LATE' | 'STALE' | 'UNCONFIGURED';

export type SecurityOperationalActionKind = 'MARK_LOCATED' | 'REQUEST_RETURN';

export type SecurityLivePass = {
  passId: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  room: string | null;
  sourceTeacher: { userId: string; displayName: string } | null;
  destinationId: string;
  destinationName: string;
  startedAt: string;
  elapsedMs: number;
  warningState: SecurityWarningState;
  latestOperationalAction: {
    kind: SecurityOperationalActionKind;
    occurredAt: string;
  } | null;
};

export type SecurityWaitingEntry = {
  requestId: string;
  queueEntryId: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  room: string | null;
  destinationId: string;
  destinationName: string;
  joinedAt: string;
  waitingMs: number;
};

export type SecurityDestination = {
  destinationId: string;
  name: string;
  category: string;
};

export type SecurityLiveBoard = {
  schoolId: string;
  generatedAt: string;
  summary: {
    out: number;
    waiting: number;
    late: number;
    stale: number;
  };
  passes: readonly SecurityLivePass[];
  waiting: readonly SecurityWaitingEntry[];
  destinations: readonly SecurityDestination[];
  warningPolicy: {
    status: 'CONFIGURED' | 'UNCONFIGURED';
    lateMinutes: number | null;
    staleMinutes: number | null;
  };
  transport: {
    mode: 'POLLING_FALLBACK';
    pollAfterMs: number;
    schoolChannel: string;
  };
  truncated: boolean;
};

export type SecurityStudentSearchResult = {
  studentId: string;
  studentName: string;
  localStudentNumber: string | null;
  currentState:
    | { kind: 'OUT'; passId: string; destinationName: string; startedAt: string }
    | { kind: 'WAITING'; requestId: string; destinationName: string; joinedAt: string }
    | { kind: 'NONE' };
};

export type SecurityActionResult = {
  actionId: string;
  passId: string;
  action: SecurityOperationalActionKind;
  recordedAt: string;
};

export type SecurityConsoleServiceOptions = {
  now?: () => Date;
  pollAfterMs?: number;
  idempotencyTtlMs?: number;
  liveLimit?: number;
  waitingLimit?: number;
};

export type SecurityPrincipal = Pick<StaffPrincipal, 'userId' | 'organizationId' | 'roleGrants'>;

export class SecurityConsoleError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = 'SecurityConsoleError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
