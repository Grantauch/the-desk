export type EffectiveCountability = 'COUNTABLE' | 'NON_COUNTABLE' | 'UNKNOWN_REVIEW';
export type PassCorrectionType = 'VOID_COUNTABILITY' | 'RESTORE_COUNTABILITY';

export type PassCorrectionResult = {
  correctionId: string;
  passId: string;
  studentId: string;
  sectionId: string;
  correctionType: PassCorrectionType;
  originalCountability: EffectiveCountability;
  priorEffectiveCountability: EffectiveCountability;
  resultingEffectiveCountability: EffectiveCountability;
  correctedAt: string;
};

export type PassHistoryItem = {
  kind: 'EVENT' | 'CORRECTION' | 'STAFF_ACTION';
  id: string;
  occurredAt: string;
  action: string;
  actorUserId: string | null;
  reasonPrivate?: string;
  metadata: Record<string, unknown>;
};

export type PassHistoryResult = {
  passId: string;
  studentId: string;
  sectionId: string;
  originalCountability: EffectiveCountability | 'PROVISIONAL';
  effectiveCountability: EffectiveCountability | 'PROVISIONAL';
  items: PassHistoryItem[];
};

export type AuditCorrectionServiceOptions = {
  now?: () => Date;
  idempotencyTtlMs?: number;
};

export class AuditCorrectionError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode: number, retryable = false) {
    super(message);
    this.name = 'AuditCorrectionError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
