export type PassRequestOutcome = 'STARTED' | 'QUEUED';

export type PassEvidence = {
  termUsed: number;
  termLimit: number | null;
  termRemaining: number | null;
  dailyUsed: number;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  cooldownMinutes: number;
  cooldownRemainingSeconds: number;
  accessMode: 'STANDARD' | 'UNLIMITED' | 'ESCORT_ONLY';
};

export type PassRequestResult = {
  outcome: PassRequestOutcome;
  passRequestId: string;
  passId: string | null;
  queueEntryId: string | null;
  sectionId: string;
  destinationId: string;
  studentId: string;
  evidence: PassEvidence;
};

export type PassReturnResult = {
  passId: string;
  status: 'RETURNED';
  studentId: string;
  sectionId: string;
  returnedAt: string;
  durationMs: number;
  countability: 'COUNTABLE' | 'NON_COUNTABLE';
  counted: boolean;
  message: string;
  promotedRequestId: string | null;
};

export type QueueCancelResult = {
  passRequestId: string;
  status: 'CANCELLED';
  promotedRequestId: string | null;
};

export type HallPassServiceOptions = {
  now?: () => Date;
  idempotencyTtlMs?: number;
};

export class HallPassError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode: number, retryable = false) {
    super(message);
    this.name = 'HallPassError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
