import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';

export type OperationsHealth = {
  status: 'HEALTHY' | 'DEGRADED';
  outbox: {
    ready: number;
    processing: number;
    failedRetryable: number;
    failedExhausted: number;
    oldestReadyAgeSeconds: number | null;
  };
  classroom: {
    dueLinks: number;
    activeConnectionsWithErrors: number;
  };
  jobs: {
    recentFailures: number;
    staleStarted: number;
  };
};

export class OperationsHealthService {
  readonly #database: Database;
  readonly #maxOutboxAttempts: number;
  readonly #staleJobMs: number;
  readonly #now: () => Date;

  constructor(database: Database, options: { maxOutboxAttempts?: number; staleJobMs?: number; now?: () => Date } = {}) {
    this.#database = database;
    this.#maxOutboxAttempts = options.maxOutboxAttempts ?? 8;
    this.#staleJobMs = options.staleJobMs ?? 10 * 60_000;
    this.#now = options.now ?? (() => new Date());
  }

  async snapshot(): Promise<OperationsHealth> {
    const at = this.#now();
    const outbox = await this.#database.query<{
      ready: number;
      processing: number;
      failed_retryable: number;
      failed_exhausted: number;
      oldest_ready_age_seconds: number | null;
    } & QueryResultRow>(
      `SELECT
         count(*) FILTER (WHERE status IN ('PENDING','FAILED') AND next_attempt_at<=$2::timestamptz AND attempt_count<$1)::int AS ready,
         count(*) FILTER (WHERE status='PROCESSING')::int AS processing,
         count(*) FILTER (WHERE status='FAILED' AND attempt_count<$1)::int AS failed_retryable,
         count(*) FILTER (WHERE status='FAILED' AND attempt_count>=$1)::int AS failed_exhausted,
         extract(epoch FROM ($2::timestamptz-min(created_at) FILTER (WHERE status IN ('PENDING','FAILED') AND next_attempt_at<=$2::timestamptz AND attempt_count<$1)))::int AS oldest_ready_age_seconds
       FROM transactional_outbox`,
      [this.#maxOutboxAttempts, at.toISOString()],
    );
    const classroom = await this.#database.query<{
      due_links: number;
      active_connections_with_errors: number;
    } & QueryResultRow>(
      `SELECT
         (SELECT count(*)::int FROM section_external_links l JOIN classroom_connections c ON c.id=l.classroom_connection_id WHERE l.status='ACTIVE' AND c.status='ACTIVE' AND l.next_sync_after IS NOT NULL AND l.next_sync_after<=$1::timestamptz) AS due_links,
         (SELECT count(*)::int FROM classroom_connections WHERE status='ACTIVE' AND error_category IS NOT NULL) AS active_connections_with_errors`,
      [at.toISOString()],
    );
    const staleBefore = new Date(at.getTime() - this.#staleJobMs).toISOString();
    const recentSince = new Date(at.getTime() - 60 * 60_000).toISOString();
    const jobs = await this.#database.query<{ recent_failures: number; stale_started: number } & QueryResultRow>(
      `SELECT
         count(*) FILTER (WHERE status IN ('FAILED','PARTIAL') AND started_at>=$2::timestamptz)::int AS recent_failures,
         count(*) FILTER (WHERE status='STARTED' AND started_at<$1::timestamptz)::int AS stale_started
       FROM operations_job_runs`,
      [staleBefore, recentSince],
    );
    const o = outbox[0]!;
    const c = classroom[0]!;
    const j = jobs[0]!;
    const degraded = o.failed_exhausted > 0 || j.stale_started > 0 || c.active_connections_with_errors > 0;
    return {
      status: degraded ? 'DEGRADED' : 'HEALTHY',
      outbox: {
        ready: o.ready,
        processing: o.processing,
        failedRetryable: o.failed_retryable,
        failedExhausted: o.failed_exhausted,
        oldestReadyAgeSeconds: o.oldest_ready_age_seconds,
      },
      classroom: { dueLinks: c.due_links, activeConnectionsWithErrors: c.active_connections_with_errors },
      jobs: { recentFailures: j.recent_failures, staleStarted: j.stale_started },
    };
  }
}
