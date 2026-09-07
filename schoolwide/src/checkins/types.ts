export const checkInErrorCodes = [
  'ACTION_PROOF_INVALID',
  'ACTION_PROOF_USED',
  'ACTION_PROOF_EXPIRED',
  'ACTION_WRONG_CONTEXT',
  'ACTION_CREDENTIAL_ROTATED',
  'STUDENT_NOT_AVAILABLE_IN_SECTION',
  'CLASS_NOT_IN_SESSION',
  'CHECKIN_WINDOW_CLOSED',
  'CHECKIN_POLICY_UNAVAILABLE',
  'IDEMPOTENCY_CONFLICT',
  'TEACHER_BACKUP_UNAVAILABLE',
] as const;

export type CheckInErrorCode = (typeof checkInErrorCodes)[number];

export class CheckInError extends Error {
  readonly code: CheckInErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: CheckInErrorCode, message: string, statusCode: number, retryable = false) {
    super(message);
    this.name = 'CheckInError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export type CheckInRecord = {
  checkInId: string;
  studentId: string;
  schoolId: string;
  sectionId: string;
  enrollmentId: string;
  academicDate: string;
  checkedInAt: string;
  status: 'CHECKED_IN';
  pointValue: number;
  authorizationMethod: 'STUDENT_PIN_PROOF' | 'TEACHER_BACKUP';
  created: boolean;
  streak: number;
};

export type CheckInServiceOptions = {
  now?: () => Date;
  idempotencyTtlMs?: number;
};
