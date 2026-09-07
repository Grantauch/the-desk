export const studentActionValues = ['CHECKIN', 'PASS_REQUEST', 'RETURN'] as const;
export type StudentAction = (typeof studentActionValues)[number];

export type VerifiedStudentIdentity = {
  provider: 'GOOGLE' | 'SYNTHETIC';
  subject: string;
  studentId: string;
};

export interface StudentIdentityProvider {
  verify(assertion: string): Promise<VerifiedStudentIdentity>;
}

export type CreatedActionProof = {
  proofId: string;
  proof: string;
  studentId: string;
  schoolId: string;
  action: StudentAction;
  sectionId: string | null;
  credentialVersion: number;
  expiresAt: string;
};

export type ConsumedActionProof = {
  proofId: string;
  studentId: string;
  schoolId: string;
  action: StudentAction;
  sectionId: string | null;
  credentialVersion: number;
  consumedAt: string;
};

export type StudentCredentialErrorCode =
  | 'STUDENT_AUTH_REQUIRED'
  | 'PIN_INVALID'
  | 'PIN_THROTTLED'
  | 'CREDENTIAL_SERVICE_UNAVAILABLE'
  | 'ACTION_PROOF_INVALID'
  | 'ACTION_PROOF_EXPIRED'
  | 'ACTION_PROOF_USED'
  | 'ACTION_WRONG_CONTEXT'
  | 'ACTION_CREDENTIAL_ROTATED';

export class StudentCredentialError extends Error {
  readonly code: StudentCredentialErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(
    code: StudentCredentialErrorCode,
    message: string,
    statusCode: number,
    retryable = false,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'StudentCredentialError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}
