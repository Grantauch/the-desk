import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { ClassroomIntegrationService } from '../classroom/service.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { readConfig } from '../config.js';
import { InProcessRealtimeBroker } from './broker.js';
import { ClassroomScheduledSyncWorker } from './classroom-scheduler.js';
import { OperationsHealthService } from './operations-service.js';
import { OutboxDeliveryWorker, lanesForOutbox } from './outbox-worker.js';
import type { RealtimeEnvelope, RealtimePublisher } from './types.js';

const databaseUrl = process.env.DATABASE_URL;

class ClientExecutor implements QueryExecutor {
  constructor(readonly client: PoolClient) {}
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    return (await this.client.query<T>(sql, [...parameters])).rows;
  }
}

class PoolDatabase implements TransactionalDatabase {
  constructor(readonly pool: Pool) {}
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    return (await this.pool.query<T>(sql, [...parameters])).rows;
  }
  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new ClientExecutor(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async close(): Promise<void> {}
}

type SyntheticTenant = {
  organizationId: string;
  schoolId: string;
  suffix: string;
};

type SyntheticTeacherSection = SyntheticTenant & {
  academicYearId: string;
  teacherId: string;
  sectionId: string;
};

async function createTenant(database: PoolDatabase): Promise<SyntheticTenant> {
  const organizationId = randomUUID();
  const schoolId = randomUUID();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  await database.query(
    `INSERT INTO organizations (id,slug,name,google_domain)
     VALUES ($1,$2,$3,$4)`,
    [organizationId, `sw130-org-${suffix}`, `SW130 Org ${suffix}`, `sw130-${suffix}.example.invalid`],
  );
  await database.query(
    `INSERT INTO schools (id,organization_id,slug,name,primary_domain,timezone)
     VALUES ($1,$2,$3,$4,$5,'America/Detroit')`,
    [schoolId, organizationId, `sw130-school-${suffix}`, `SW130 School ${suffix}`, `school-${suffix}.example.invalid`],
  );
  return { organizationId, schoolId, suffix };
}

async function createTeacherSection(database: PoolDatabase): Promise<SyntheticTeacherSection> {
  const tenant = await createTenant(database);
  const academicYearId = randomUUID();
  const teacherId = randomUUID();
  const sectionId = randomUUID();
  await database.query(
    `INSERT INTO academic_years (id,school_id,label,starts_on,ends_on)
     VALUES ($1,$2,$3,DATE '2026-08-20',DATE '2027-06-15')`,
    [academicYearId, tenant.schoolId, `2026-27-${tenant.suffix}`],
  );
  await database.query(
    `INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id)
     VALUES ($1,$2,$3,$4,$5)`,
    [teacherId, tenant.organizationId, `teacher-${tenant.suffix}@example.invalid`, `Teacher ${tenant.suffix}`, `google-${tenant.suffix}`],
  );
  await database.query(
    `INSERT INTO staff_profiles (user_id,organization_id,employee_external_id,title)
     VALUES ($1,$2,$3,'Teacher')`,
    [teacherId, tenant.organizationId, `EMP-${tenant.suffix}`],
  );
  await database.query(
    `INSERT INTO user_roles (organization_id,school_id,user_id,role)
     VALUES ($1,$2,$3,'TEACHER')`,
    [tenant.organizationId, tenant.schoolId, teacherId],
  );
  await database.query(
    `INSERT INTO sections (id,school_id,academic_year_id,name,code,period_code,period_label,room)
     VALUES ($1,$2,$3,$4,$5,'P1','1','101')`,
    [sectionId, tenant.schoolId, academicYearId, `Section ${tenant.suffix}`, `SEC-${tenant.suffix}`],
  );
  await database.query(
    `INSERT INTO section_staff_assignments (organization_id,school_id,section_id,user_id,assignment_role)
     VALUES ($1,$2,$3,$4,'PRIMARY_TEACHER')`,
    [tenant.organizationId, tenant.schoolId, sectionId, teacherId],
  );
  return { ...tenant, academicYearId, teacherId, sectionId };
}

function recordingPublisher(target: RealtimeEnvelope[], fail = false): RealtimePublisher {
  return {
    async publish(event) {
      if (fail) throw new Error('synthetic publisher failure');
      target.push(event);
    },
  };
}

test('SW-130 Realtime + Operations', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 8, application_name: 'grantdesk-schoolwide:sw130-test' });
  const database = new PoolDatabase(pool);

  try {
    await t.test('T-RT-001/002/003 lane derivation stays exact-section, exact-school, and self-only', () => {
      const schoolId = randomUUID();
      const sectionId = randomUUID();
      const studentId = randomUUID();
      const passLanes = lanesForOutbox({
        school_id: schoolId,
        topic: 'schoolwide.passes',
        payload_json_sanitized: { sectionId, studentId, displayName: 'must-not-be-forwarded' },
      });
      assert.deepEqual(passLanes, [
        { kind: 'ADMIN_SCHOOL', schoolId },
        { kind: 'TEACHER_SECTION', schoolId, sectionId },
        { kind: 'STUDENT_SELF', schoolId, studentId },
        { kind: 'SECURITY_SCHOOL', schoolId },
      ]);
      const checkinLanes = lanesForOutbox({
        school_id: schoolId,
        topic: 'schoolwide.checkins',
        payload_json_sanitized: { sectionId, studentId },
      });
      assert.equal(checkinLanes.some((lane) => lane.kind === 'SECURITY_SCHOOL'), false);
    });

    await t.test('T-RT-004 duplicate event IDs are suppressed inside only the matching lane', async () => {
      const broker = new InProcessRealtimeBroker();
      const schoolId = randomUUID();
      const laneA = { kind: 'TEACHER_SECTION' as const, schoolId, sectionId: randomUUID() };
      const laneB = { kind: 'TEACHER_SECTION' as const, schoolId, sectionId: randomUUID() };
      const seenA: string[] = [];
      const seenB: string[] = [];
      broker.subscribe(laneA, (event) => seenA.push(event.id));
      broker.subscribe(laneB, (event) => seenB.push(event.id));
      const envelope = { id: 'evt-1', outboxId: randomUUID(), eventType: 'PASS_STARTED', occurredAt: new Date().toISOString(), lane: laneA };
      await broker.publish(envelope);
      await broker.publish(envelope);
      await broker.publish({ ...envelope, lane: laneB });
      assert.deepEqual(seenA, ['evt-1']);
      assert.deepEqual(seenB, ['evt-1']);
    });

    await t.test('T-OPS-001 successful outbox delivery publishes minimal invalidations and marks its row PUBLISHED', async () => {
      const tenant = await createTenant(database);
      const sectionId = randomUUID();
      const studentId = randomUUID();
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.passes','PASS_STARTED','PASS',$3,$4::jsonb) RETURNING id`,
        [tenant.organizationId, tenant.schoolId, randomUUID(), JSON.stringify({ sectionId, studentId, privateReason: 'do-not-forward' })],
      );
      const outboxId = inserted[0]!.id;
      const events: RealtimeEnvelope[] = [];
      const worker = new OutboxDeliveryWorker(database, recordingPublisher(events), { instanceId: `sw130-success-${tenant.suffix}`, batchSize: 100 });
      await worker.runBatch();
      const ours = events.filter((event) => event.outboxId === outboxId);
      assert.equal(ours.length, 4);
      for (const event of ours) {
        assert.deepEqual(Object.keys(event).sort(), ['eventType','id','lane','occurredAt','outboxId'].sort());
        assert.equal(JSON.stringify(event).includes('privateReason'), false);
      }
      const row = await database.query<{ status: string; attempt_count: number; lease_owner: string | null }>('SELECT status,attempt_count,lease_owner FROM transactional_outbox WHERE id=$1',[outboxId]);
      assert.deepEqual(row[0], { status: 'PUBLISHED', attempt_count: 1, lease_owner: null });
    });

    await t.test('T-OPS-002 publisher failure preserves committed outbox evidence and schedules a sanitized retry', async () => {
      const tenant = await createTenant(database);
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.checkins','CHECKIN_CREATED','CHECKIN',$3,'{}'::jsonb) RETURNING id`,
        [tenant.organizationId, tenant.schoolId, randomUUID()],
      );
      const outboxId = inserted[0]!.id;
      const worker = new OutboxDeliveryWorker(database, recordingPublisher([], true), { instanceId: `sw130-fail-${tenant.suffix}`, batchSize: 100, retryBaseMs: 100, maxAttempts: 3 });
      await worker.runBatch();
      const row = await database.query<{ status: string; attempt_count: number; last_error_sanitized: string; next_attempt_at: Date }>('SELECT status,attempt_count,last_error_sanitized,next_attempt_at FROM transactional_outbox WHERE id=$1',[outboxId]);
      assert.equal(row[0]?.status, 'FAILED');
      assert.equal(row[0]?.attempt_count, 1);
      assert.equal(row[0]?.last_error_sanitized, 'REALTIME_PUBLISH_FAILED');
      assert.ok(row[0]?.next_attempt_at instanceof Date);
    });

    await t.test('T-OPS-003 expired PROCESSING leases are reclaimed while two workers cannot publish its row twice', async () => {
      const tenant = await createTenant(database);
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.checkins','CHECKIN_CREATED','CHECKIN',$3,$4::jsonb) RETURNING id`,
        [tenant.organizationId, tenant.schoolId, randomUUID(), JSON.stringify({ sectionId: randomUUID() })],
      );
      const outboxId = inserted[0]!.id;
      await database.query(`UPDATE transactional_outbox SET status='PROCESSING',lease_owner='dead-worker',lease_expires_at=now()-interval '1 minute' WHERE id=$1`,[outboxId]);
      const events: RealtimeEnvelope[] = [];
      const a = new OutboxDeliveryWorker(database, recordingPublisher(events), { instanceId: `worker-a-${tenant.suffix}`, batchSize: 100 });
      const b = new OutboxDeliveryWorker(database, recordingPublisher(events), { instanceId: `worker-b-${tenant.suffix}`, batchSize: 100 });
      await Promise.all([a.runBatch(), b.runBatch()]);
      const ours = events.filter((event) => event.outboxId === outboxId);
      assert.equal(ours.length, 2);
      assert.equal(new Set(ours.map((event) => event.id)).size, ours.length);
      const row = await database.query<{ status: string; attempt_count: number }>('SELECT status,attempt_count FROM transactional_outbox WHERE id=$1',[outboxId]);
      assert.equal(row[0]?.status, 'PUBLISHED');
      assert.equal(row[0]?.attempt_count, 1);
    });

    await t.test('T-OPS-004 exhausted delivery and stale jobs degrade health without exposing private data', async () => {
      const tenant = await createTenant(database);
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,status,attempt_count,last_error_sanitized)
         VALUES ($1,$2,'schoolwide.synthetic','SYNTHETIC','TEST',$3,'FAILED',8,'PRIVATE NAME SHOULD NOT APPEAR') RETURNING id`,
        [tenant.organizationId, tenant.schoolId, randomUUID()],
      );
      const job = await database.query<{ id: string }>(
        `INSERT INTO operations_job_runs (job_type,worker_instance_id,status,started_at)
         VALUES ('OUTBOX_DELIVERY',$1,'STARTED',now()-interval '1 hour') RETURNING id`,
        [`stale-${tenant.suffix}`],
      );
      const health = await new OperationsHealthService(database, { maxOutboxAttempts: 8, staleJobMs: 10 * 60_000 }).snapshot();
      assert.equal(health.status, 'DEGRADED');
      assert.ok(health.outbox.failedExhausted >= 1);
      assert.ok(health.jobs.staleStarted >= 1);
      assert.equal(JSON.stringify(health).includes('PRIVATE NAME'), false);
      const ours = await database.query<{ status: string }>('SELECT status FROM transactional_outbox WHERE id=$1',[inserted[0]!.id]);
      const ourJob = await database.query<{ status: string }>('SELECT status FROM operations_job_runs WHERE id=$1',[job[0]!.id]);
      assert.equal(ours[0]?.status, 'FAILED');
      assert.equal(ourJob[0]?.status, 'STARTED');
    });

    await t.test('T-GC-OPS-001 scheduled Classroom sync requires current teacher role and section assignment', async () => {
      const fixture = await createTeacherSection(database);
      const connection = await database.query<{ id: string }>(
        `INSERT INTO classroom_connections (organization_id,school_id,user_id,google_account_subject,scopes_granted,provider_connection_ref)
         VALUES ($1,$2,$3,$4,ARRAY['scope']::text[],$5) RETURNING id`,
        [fixture.organizationId, fixture.schoolId, fixture.teacherId, `subject-${fixture.suffix}`, `vault-${fixture.suffix}`],
      );
      const link = await database.query<{ id: string }>(
        `INSERT INTO section_external_links (organization_id,school_id,section_id,classroom_connection_id,external_course_id,next_sync_after)
         VALUES ($1,$2,$3,$4,$5,now()-interval '1 minute') RETURNING id`,
        [fixture.organizationId, fixture.schoolId, fixture.sectionId, connection[0]!.id, `course-${fixture.suffix}`],
      );
      let syncCalls = 0;
      const classroom = {
        async dueLinks(limit: number) {
          assert.equal(limit, 10);
          return [{ linkId: link[0]!.id, connectionUserId: fixture.teacherId, schoolId: fixture.schoolId, sectionId: fixture.sectionId }];
        },
        async syncLink() {
          syncCalls++;
          return { status: 'SUCCESS' };
        },
      } as unknown as ClassroomIntegrationService;
      const worker = new ClassroomScheduledSyncWorker(database, classroom, { instanceId: `classroom-${fixture.suffix}`, batchSize: 10 });
      assert.deepEqual(await worker.runBatch(), { claimed: 1, succeeded: 1, failed: 0, skippedUnauthorized: 0 });
      assert.equal(syncCalls, 1);
      await database.query(`UPDATE section_staff_assignments SET revoked_at=now() WHERE section_id=$1 AND user_id=$2`,[fixture.sectionId, fixture.teacherId]);
      assert.deepEqual(await worker.runBatch(), { claimed: 1, succeeded: 0, failed: 0, skippedUnauthorized: 1 });
      assert.equal(syncCalls, 1);
      const latest = await database.query<{ status: string; error_category: string | null }>(
        `SELECT status,error_category FROM operations_job_runs
          WHERE job_type='CLASSROOM_SCHEDULED_SYNC' AND worker_instance_id=$1
          ORDER BY started_at DESC,id DESC LIMIT 1`,
        [`classroom-${fixture.suffix}`],
      );
      assert.deepEqual(latest[0], { status: 'PARTIAL', error_category: 'CLASSROOM_SYNC_AUTHORITY_SKIPPED' });
    });

    await t.test('T-OPS-005 operations workers remain disabled unless explicitly enabled', () => {
      const base = { DATABASE_URL: 'postgres://example.invalid/test' };
      assert.equal(readConfig(base).operationsWorkersEnabled, false);
      assert.equal(readConfig({ ...base, OPERATIONS_WORKERS_ENABLED: 'true' }).operationsWorkersEnabled, true);
    });
  } finally {
    await pool.end();
  }
});
