import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { StaffPrincipal } from '../auth/types.js';
import type { ClassroomIntegrationService } from '../classroom/service.js';
import type { Database } from '../db/database.js';
import type { ClassroomScheduleBatchResult, ClassroomSchedulerOptions } from './types.js';

interface CurrentAuthorityRow extends QueryResultRow {
  organization_id: string;
  next_sync_after: Date;
}

export class ClassroomScheduledSyncWorker {
  readonly #database: Database;
  readonly #classroom: ClassroomIntegrationService;
  readonly #instanceId: string;
  readonly #batchSize: number;
  readonly #now: () => Date;

  constructor(database: Database, classroom: ClassroomIntegrationService, options: ClassroomSchedulerOptions) {
    this.#database = database;
    this.#classroom = classroom;
    this.#instanceId = options.instanceId;
    this.#batchSize = options.batchSize ?? 20;
    this.#now = options.now ?? (() => new Date());
    if (!this.#instanceId.trim()) throw new Error('Classroom scheduler instanceId is required.');
    if (!Number.isInteger(this.#batchSize) || this.#batchSize < 1 || this.#batchSize > 100) throw new Error('Classroom scheduler batchSize is invalid.');
  }

  async runBatch(): Promise<ClassroomScheduleBatchResult> {
    const startedAt = this.#now();
    const job = await this.#database.query<{ id: string } & QueryResultRow>(
      `INSERT INTO operations_job_runs (job_type,worker_instance_id,status,started_at)
       VALUES ('CLASSROOM_SCHEDULED_SYNC',$1,'STARTED',$2::timestamptz) RETURNING id`,
      [this.#instanceId, startedAt.toISOString()],
    );
    const jobId = job[0]!.id;
    let claimed = 0;
    let succeeded = 0;
    let failed = 0;
    let skippedUnauthorized = 0;

    try {
      const due = await this.#classroom.dueLinks(this.#batchSize);
      claimed = due.length;
      for (const link of due) {
        const authority = await this.#database.query<CurrentAuthorityRow>(
          `SELECT s.organization_id,l.next_sync_after
             FROM section_external_links l
             JOIN schools s ON s.id=l.school_id AND s.status='ACTIVE'
             JOIN user_roles ur
               ON ur.organization_id=s.organization_id AND ur.school_id=l.school_id
              AND ur.user_id=$2 AND ur.role='TEACHER' AND ur.revoked_at IS NULL
              AND ur.valid_from<=now() AND (ur.valid_until IS NULL OR ur.valid_until>now())
             JOIN section_staff_assignments a
               ON a.organization_id=s.organization_id AND a.school_id=l.school_id
              AND a.section_id=l.section_id AND a.user_id=$2 AND a.revoked_at IS NULL
              AND a.valid_from<=now() AND (a.valid_until IS NULL OR a.valid_until>now())
            WHERE l.id=$1 AND l.school_id=$3 AND l.section_id=$4 AND l.status='ACTIVE'
              AND l.next_sync_after IS NOT NULL AND l.next_sync_after<=now()
            LIMIT 1`,
          [link.linkId, link.connectionUserId, link.schoolId, link.sectionId],
        );
        const row = authority[0];
        if (!row) {
          skippedUnauthorized++;
          continue;
        }
        const principal: StaffPrincipal = {
          sessionId: `scheduled:${this.#instanceId}`,
          userId: link.connectionUserId,
          organizationId: row.organization_id,
          identityProvider: 'SYNTHETIC',
          identitySubject: `scheduled:${link.connectionUserId}`,
          roleGrants: [{ schoolId: link.schoolId, role: 'TEACHER' }],
        };
        try {
          const result = await this.#classroom.syncLink({
            principal,
            linkId: link.linkId,
            triggerType: 'SCHEDULED',
            idempotencyKey: `classroom-scheduled:${link.linkId}:${row.next_sync_after.toISOString()}`,
            correlationId: randomUUID(),
          });
          if (result.status === 'SUCCESS') succeeded++;
          else failed++;
        } catch {
          failed++;
        }
      }

      const finishedAt = this.#now();
      const status = failed === 0 && skippedUnauthorized === 0
        ? 'SUCCESS'
        : (succeeded > 0 || skippedUnauthorized > 0 ? 'PARTIAL' : 'FAILED');
      const errorCategory = failed > 0
        ? 'CLASSROOM_SCHEDULED_SYNC_FAILED'
        : (skippedUnauthorized > 0 ? 'CLASSROOM_SYNC_AUTHORITY_SKIPPED' : null);
      await this.#database.query(
        `UPDATE operations_job_runs
            SET status=$2,items_claimed=$3,items_succeeded=$4,items_failed=$5,finished_at=$6::timestamptz,
                error_category=$7,error_summary_sanitized=$8
          WHERE id=$1`,
        [
          jobId,
          status,
          claimed,
          succeeded,
          failed + skippedUnauthorized,
          finishedAt.toISOString(),
          errorCategory,
          failed || skippedUnauthorized ? 'One or more due Classroom links were not successfully synchronized.' : null,
        ],
      );
      return { claimed, succeeded, failed, skippedUnauthorized };
    } catch (error) {
      const finishedAt = this.#now();
      await this.#database.query(
        `UPDATE operations_job_runs
            SET status='FAILED',items_claimed=$2,items_succeeded=$3,items_failed=$4,finished_at=$5::timestamptz,
                error_category='CLASSROOM_SCHEDULER_FAILED',error_summary_sanitized='Classroom scheduler batch failed before completion.'
          WHERE id=$1`,
        [jobId, claimed, succeeded, Math.max(failed + skippedUnauthorized, claimed - succeeded), finishedAt.toISOString()],
      );
      throw error;
    }
  }
}
