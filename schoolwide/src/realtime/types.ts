export type RealtimeLane =
  | { kind: 'TEACHER_SECTION'; schoolId: string; sectionId: string }
  | { kind: 'SECURITY_SCHOOL'; schoolId: string }
  | { kind: 'ADMIN_SCHOOL'; schoolId: string }
  | { kind: 'STUDENT_SELF'; schoolId: string; studentId: string };

export type RealtimeEnvelope = {
  id: string;
  outboxId: string;
  eventType: string;
  occurredAt: string;
  lane: RealtimeLane;
};

export type RealtimeListener = (event: RealtimeEnvelope) => void;

export interface RealtimePublisher {
  publish(event: RealtimeEnvelope): Promise<void>;
}

export interface RealtimeBroker extends RealtimePublisher {
  subscribe(lane: RealtimeLane, listener: RealtimeListener): () => void;
}

export type OutboxWorkerOptions = {
  instanceId: string;
  batchSize?: number;
  leaseMs?: number;
  maxAttempts?: number;
  retryBaseMs?: number;
  now?: () => Date;
};

export type OutboxBatchResult = {
  claimed: number;
  published: number;
  failed: number;
};

export type ClassroomSchedulerOptions = {
  instanceId: string;
  batchSize?: number;
  now?: () => Date;
};

export type ClassroomScheduleBatchResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  skippedUnauthorized: number;
};
