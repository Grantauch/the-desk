import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { ClassroomIntegrationService } from '../classroom/service.js';
import type { Database, QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { fixtureIds, seedTwoSchoolFixture } from '../db/test-fixtures.js';
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

async function resetAndSeed(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE TABLE operations_job_runs, transactional_outbox, section_external_links, classroom_courses, classroom_connections, section_staff_assignments, user_roles, staff_profiles, users, enrollments, student_identity_aliases, students, sections, academic_terms, academic_years, schools, organizations RESTART IDENTITY CASCADE`);
  const client = await pool.connect();
  try {
    await seedTwoSchoolFixture(client);
  } finally {
    client.release();
  }
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
      const passLanes = lanesForOutbox({
        school_id: fixtureIds.schoolA,
        topic: 'schoolwide.passes',
        payload_json_sanitized: { sectionId: fixtureIds.sectionA1, studentId: fixtureIds.studentA, displayName: 'must-not-be-forwarded' },
      });
      assert.deepEqual(passLanes, [
        { kind: 'ADMIN_SCHOOL', schoolId: fixtureIds.schoolA },
        { kind: 'TEACHER_SECTION', schoolId: fixtureIds.schoolA, sectionId: fixtureIds.sectionA1 },
        { kind: 'STUDENT_SELF', schoolId: fixtureIds.schoolA, studentId: fixtureIds.studentA },
        { kind: 'SECURITY_SCHOOL', schoolId: fixtureIds.schoolA },
      ]);
      const checkinLanes = lanesForOutbox({
        school_id: fixtureIds.schoolA,
        topic: 'schoolwide.checkins',
        payload_json_sanitized: { sectionId: fixtureIds.sectionA1, studentId: fixtureIds.studentA },
      });
      assert.equal(checkinLanes.some((lane) => lane.kind === 'SECURITY_SCHOOL'), false);
    });

    await t.test('T-RT-004 duplicate event IDs are suppressed inside only the matching lane', async () => {
      const broker = new InProcessRealtimeBroker();
      const laneA = { kind: 'TEACHER_SECTION' as const, schoolId: fixtureIds.schoolA, sectionId: fixtureIds.sectionA1 };
      const laneB = { kind: 'TEACHER_SECTION' as const, schoolId: fixtureIds.schoolA, sectionId: fixtureIds.sectionA2 };
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

    await t.test('T-OPS-001 successful outbox delivery publishes minimal invalidations and marks the row PUBLISHED', async () => {
      await resetAndSeed(pool);
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.passes','PASS_STARTED','PASS',$3,$4::jsonb) RETURNING id`,
        [fixtureIds.orgA, fixtureIds.schoolA, randomUUID(), JSON.stringify({ sectionId: fixtureIds.sectionA1, studentId: fixtureIds.studentA, privateReason: 'do-not-forward' })],
      );
      const events: RealtimeEnvelope[] = [];
      const worker = new OutboxDeliveryWorker(database, recordingPublisher(events), { instanceId: 'sw130-success', batchSize: 10 });
      assert.deepEqual(await worker.runBatch(), { claimed: 1, published: 1, failed: 0 });
      assert.equal(events.length, 4);
      for (const event of events) {
        assert.deepEqual(Object.keys(event).sort(), ['eventType','id','lane','occurredAt','outboxId'].sort());
        assert.equal(JSON.stringify(event).includes('privateReason'), false);
      }
      const row = await database.query<{ status: string; attempt_count: number; lease_owner: string | null }>('SELECT status,attempt_count,lease_owner FROM transactional_outbox WHERE id=$1',[inserted[0]!.id]);
      assert.deepEqual(row[0], { status: 'PUBLISHED', attempt_count: 1, lease_owner: null });
    });

    await t.test('T-OPS-002 publisher failure preserves committed outbox evidence and schedules a sanitized retry', async () => {
      await resetAndSeed(pool);
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.checkins','CHECKIN_CREATED','CHECKIN',$3,'{}'::jsonb) RETURNING id`,
        [fixtureIds.orgA, fixtureIds.schoolA, randomUUID()],
      );
      const worker = new OutboxDeliveryWorker(database, recordingPublisher([], true), { instanceId: 'sw130-fail', retryBaseMs: 100, maxAttempts: 3 });
      assert.deepEqual(await worker.runBatch(), { claimed: 1, published: 0, failed: 1 });
      const row = await database.query<{ status: string; attempt_count: number; last_error_sanitized: string; next_attempt_at: Date }>('SELECT status,attempt_count,last_error_sanitized,next_attempt_at FROM transactional_outbox WHERE id=$1',[inserted[0]!.id]);
      assert.equal(row[0]?.status, 'FAILED');
      assert.equal(row[0]?.attempt_count, 1);
      assert.equal(row[0]?.last_error_sanitized, 'REALTIME_PUBLISH_FAILED');
      assert.ok(row[0]?.next_attempt_at instanceof Date);
    });

    await t.test('T-OPS-003 expired PROCESSING leases are reclaimed while two workers cannot publish one row twice', async () => {
      await resetAndSeed(pool);
      const inserted = await database.query<{ id: string }>(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,payload_json_sanitized)
         VALUES ($1,$2,'schoolwide.checkins','CHECKIN_CREATED','CHECKIN',$3,$4::jsonb) RETURNING id`,
        [fixtureIds.orgA, fixtureIds.schoolA, randomUUID(), JSON.stringify({ sectionId: fixtureIds.sectionA1 })],
      );
      await database.query(`UPDATE transactional_outbox SET status='PROCESSING',lease_owner='dead-worker',lease_expires_at=now()-interval '1 minute' WHERE id=$1`,[inserted[0]!.id]);
      const events: RealtimeEnvelope[] = [];
      const a = new OutboxDeliveryWorker(database, recordingPublisher(events), { instanceId: 'worker-a', batchSize: 1 });
      const b = new OutboxDeliveryWorker(database, recordingPublisher(events), { instanceId: 'worker-b', batchSize: 1 });
      const results = await Promise.all([a.runBatch(), b.runBatch()]);
      assert.equal(results.reduce((sum, result) => sum + result.claimed, 0), 1);
      assert.equal(results.reduce((sum, result) => sum + result.published, 0), 1);
      const ids = new Set(events.map((event) => event.id));
      assert.equal(ids.size, events.length);
      const row = await database.query<{ status: string; attempt_count: number }>('SELECT status,attempt_count FROM transactional_outbox WHERE id=$1',[inserted[0]!.id]);
      assert.equal(row[0]?.status, 'PUBLISHED');
      assert.equal(row[0]?.attempt_count, 1);
    });

    await t.test('T-OPS-004 exhausted delivery and stale jobs degrade health without exposing private data', async () => {
      await resetAndSeed(pool);
      await database.query(
        `INSERT INTO transactional_outbox (organization_id,school_id,topic,event_type,aggregate_type,correlation_id,status,attempt_count,last_error_sanitized)
         VALUES ($1,$2,'schoolwide.synthetic','SYNTHETIC','TEST',$3,'FAILED',8,'PRIVATE NAME SHOULD NOT APPEAR')`,
        [fixtureIds.orgA, fixtureIds.schoolA, randomUUID()],
      );
      await database.query(`INSERT INTO operations_job_runs (job_type,worker_instance_id,status,started_at) VALUES ('OUTBOX_DELIVERY','stale-worker','STARTED',now()-interval '1 hour')`);
      const health = await new OperationsHealthService(database, { maxOutboxAttempts: 8, staleJobMs: 10 * 60_000 }).snapshot();
      assert.equal(health.status, 'DEGRADED');
      assert.equal(health.outbox.failedExhausted, 1);
      assert.equal(health.jobs.staleStarted, 1);
      assert.equal(JSON.stringify(health).includes('PRIVATE NAME'), false);
    });

    await t.test('T-GC-OPS-001 scheduled Classroom sync requires current teacher role and section assignment', async () => {
      await resetAndSeed(pool);
      const connection = await database.query<{ id: string }>(
        `INSERT INTO classroom_connections (organization_id,school_id,user_id,google_account_subject,scopes_granted,provider_connection_ref)
         VALUES ($1,$2,$3,'subject',['scope'],'vault-ref') RETURNING id`,
        [fixtureIds.orgA, fixtureIds.schoolA, fixtureIds.teacherA],
      );
      const link = await database.query<{ id: string }>(
        `INSERT INTO section_external_links (organization_id,school_id,section_id,classroom_connection_id,external_course_id,next_sync_after)
         VALUES ($1,$2,$3,$4,'course-1',now()-interval '1 minute') RETURNING id`,
        [fixtureIds.orgA, fixtureIds.schoolA, fixtureIds.sectionA1, connection[0]!.id],
      );
      let syncCalls = 0;
      const classroom = {
        async dueLinks(limit: number) {
          assert.equal(limit, 10);
          return [{ linkId: link[0]!.id, connectionUserId: fixtureIds.teacherA, schoolId: fixtureIds.schoolA, sectionId: fixtureIds.sectionA1 }];
        },
        async syncLink() {
          syncCalls++;
          return { status: 'SUCCESS' };
        },
      } as unknown as ClassroomIntegrationService;
      const worker = new ClassroomScheduledSyncWorker(database, classroom, { instanceId: 'classroom-worker', batchSize: 10 });
      assert.deepEqual(await worker.runBatch(), { claimed: 1, succeeded: 1, failed: 0, skippedUnauthorized: 0 });
      assert.equal(syncCalls, 1);
      await database.query(`UPDATE section_staff_assignments SET revoked_at=now() WHERE section_id=$1 AND user_id=$2`,[fixtureIds.sectionA1, fixtureIds.teacherA]);
      assert.deepEqual(await worker.runBatch(), { claimed: 1, succeeded: 0, failed: 0, skippedUnauthorized: 1 });
      assert.equal(syncCalls, 1);
      const latest = await database.query<{ status: string; error_category: string | null }>(`SELECT status,error_category FROM operations_job_runs WHERE job_type='CLASSROOM_SCHEDULED_SYNC' ORDER BY started_at DESC,id DESC LIMIT 1`);
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
