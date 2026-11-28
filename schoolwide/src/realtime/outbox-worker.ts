import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';
import type { OutboxBatchResult, OutboxWorkerOptions, RealtimeEnvelope, RealtimeLane, RealtimePublisher } from './types.js';

interface OutboxRow extends QueryResultRow {
  id: string;
  school_id: string;
  topic: string;
  event_type: string;
  payload_json_sanitized: unknown;
  created_at: Date;
  attempt_count: number;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function lanesForOutbox(row: Pick<OutboxRow, 'school_id' | 'topic' | 'payload_json_sanitized'>): RealtimeLane[] {
  const payload = objectPayload(row.payload_json_sanitized);
  const lanes: RealtimeLane[] = [{ kind: 'ADMIN_SCHOOL', schoolId: row.school_id }];
  const sectionId = stringField(payload, 'sectionId');
  const studentId = stringField(payload, 'studentId');
  if (sectionId) lanes.push({ kind: 'TEACHER_SECTION', schoolId: row.school_id, sectionId });
  if (studentId) lanes.push({ kind: 'STUDENT_SELF', schoolId: row.school_id, studentId });
  if (row.topic === 'schoolwide.passes') lanes.push({ kind: 'SECURITY_SCHOOL', schoolId: row.school_id });
  return lanes;
}

function eventId(outboxId: string, lane: RealtimeLane): string {
  switch (lane.kind) {
    case 'TEACHER_SECTION': return `${outboxId}:teacher:${lane.sectionId}`;
    case 'SECURITY_SCHOOL': return `${outboxId}:security`;
    case 'ADMIN_SCHOOL': return `${outboxId}:admin`;
    case 'STUDENT_SELF': return `${outboxId}:student:${lane.studentId}`;
  }
}

export class OutboxDeliveryWorker {
  readonly #database: Database;
  readonly #publisher: RealtimePublisher;
  readonly #instanceId: string;
  readonly #batchSize: number;
  readonly #leaseMs: number;
  readonly #maxAttempts: number;
  readonly #retryBaseMs: number;
  readonly #now: () => Date;

  constructor(database: Database, publisher: RealtimePublisher, options: OutboxWorkerOptions) {
    this.#database = database;
    this.#publisher = publisher;
    this.#instanceId = options.instanceId;
    this.#batchSize = options.batchSize ?? 50;
    this.#leaseMs = options.leaseMs ?? 30_000;
    this.#maxAttempts = options.maxAttempts ?? 8;
    this.#retryBaseMs = options.retryBaseMs ?? 1_000;
    this.#now = options.now ?? (() => new Date());
    if (!this.#instanceId.trim()) throw new Error('Outbox worker instanceId is required.');
    if (!Number.isInteger(this.#batchSize) || this.#batchSize < 1 || this.#batchSize > 200) throw new Error('Outbox worker batchSize is invalid.');
    if (!Number.isInteger(this.#leaseMs) || this.#leaseMs < 1_000 || this.#leaseMs > 5 * 60_000) throw new Error('Outbox worker leaseMs is invalid.');
    if (!Number.isInteger(this.#maxAttempts) || this.#maxAttempts < 1 || this.#maxAttempts > 25) throw new Error('Outbox worker maxAttempts is invalid.');
    if (!Number.isInteger(this.#retryBaseMs) || this.#retryBaseMs < 100 || this.#retryBaseMs > 60_000) throw new Error('Outbox worker retryBaseMs is invalid.');
  }

  async runBatch(): Promise<OutboxBatchResult> {
    if (!supportsTransactions(this.#database)) throw new Error('Outbox delivery requires transactional database support.');
    const startedAt = this.#now();
    const job = await this.#database.query<{ id: string } & QueryResultRow>(
      `INSERT INTO operations_job_runs (job_type,worker_instance_id,status,started_at)
       VALUES ('OUTBOX_DELIVERY',$1,'STARTED',$2::timestamptz) RETURNING id`,
      [this.#instanceId, startedAt.toISOString()],
    );
    const jobId = job[0]!.id;
    let claimed: readonly OutboxRow[] = [];
    let published = 0;
    let failed = 0;
    try {
      claimed = await this.#database.transaction(async (tx) => {
        const now = this.#now();
        const leaseExpires = new Date(now.getTime() + this.#leaseMs);
        return tx.query<OutboxRow>(
          `WITH candidates AS (
             SELECT id
               FROM transactional_outbox
              WHERE attempt_count < $1
                AND (
                  (status IN ('PENDING','FAILED') AND next_attempt_at <= $2::timestamptz)
                  OR (status='PROCESSING' AND lease_expires_at <= $2::timestamptz)
                )
              ORDER BY COALESCE(next_attempt_at,available_at),created_at,id
              FOR UPDATE SKIP LOCKED
              LIMIT $3
           )
           UPDATE transactional_outbox o
              SET status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=$2::timestamptz,
                  lease_owner=$4,lease_expires_at=$5::timestamptz,last_error_sanitized=NULL,updated_at=$2::timestamptz
             FROM candidates c
            WHERE o.id=c.id
           RETURNING o.id,o.school_id,o.topic,o.event_type,o.payload_json_sanitized,o.created_at,o.attempt_count`,
          [this.#maxAttempts, now.toISOString(), this.#batchSize, this.#instanceId, leaseExpires.toISOString()],
        );
      });

      for (const row of claimed) {
        try {
          for (const lane of lanesForOutbox(row)) {
            const envelope: RealtimeEnvelope = {
              id: eventId(row.id, lane),
              outboxId: row.id,
              eventType: row.event_type,
              occurredAt: row.created_at.toISOString(),
              lane,
            };
            await this.#publisher.publish(envelope);
          }
          const now = this.#now();
          await this.#database.query(
            `UPDATE transactional_outbox
                SET status='PUBLISHED',published_at=$2::timestamptz,lease_owner=NULL,lease_expires_at=NULL,
                    last_error_sanitized=NULL,updated_at=$2::timestamptz
              WHERE id=$1 AND status='PROCESSING' AND lease_owner=$3`,
            [row.id, now.toISOString(), this.#instanceId],
          );
          published++;
        } catch {
          const now = this.#now();
          const cappedExponent = Math.min(6, Math.max(0, row.attempt_count - 1));
          const retryAt = new Date(now.getTime() + this.#retryBaseMs * (2 ** cappedExponent));
          await this.#database.query(
            `UPDATE transactional_outbox
                SET status='FAILED',next_attempt_at=$2::timestamptz,lease_owner=NULL,lease_expires_at=NULL,
                    last_error_sanitized='REALTIME_PUBLISH_FAILED',updated_at=$3::timestamptz
              WHERE id=$1 AND status='PROCESSING' AND lease_owner=$4`,
            [row.id, retryAt.toISOString(), now.toISOString(), this.#instanceId],
          );
          failed++;
        }
      }

      const finishedAt = this.#now();
      await this.#database.query(
        `UPDATE operations_job_runs
            SET status=$2,items_claimed=$3,items_succeeded=$4,items_failed=$5,finished_at=$6::timestamptz,
                error_category=$7,error_summary_sanitized=$8
          WHERE id=$1`,
        [jobId, failed === 0 ? 'SUCCESS' : (published > 0 ? 'PARTIAL' : 'FAILED'), claimed.length, published, failed, finishedAt.toISOString(), failed ? 'REALTIME_PUBLISH_FAILED' : null, failed ? 'One or more realtime invalidations remain retryable.' : null],
      );
      return { claimed: claimed.length, published, failed };
    } catch (error) {
      const finishedAt = this.#now();
      await this.#database.query(
        `UPDATE operations_job_runs
            SET status='FAILED',items_claimed=$2,items_succeeded=$3,items_failed=$4,finished_at=$5::timestamptz,
                error_category='OUTBOX_WORKER_FAILED',error_summary_sanitized='Outbox worker batch failed before completion.'
          WHERE id=$1`,
        [jobId, claimed.length, published, Math.max(failed, claimed.length - published), finishedAt.toISOString()],
      );
      throw error;
    }
  }
}
