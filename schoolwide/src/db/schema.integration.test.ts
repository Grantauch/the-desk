import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { seedTwoSchoolFixture } from './test-fixtures.js';

const databaseUrl = process.env.DATABASE_URL;

async function withRollback(pool: Pool, fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function expectPgConstraint(
  client: PoolClient,
  sql: string,
  params: unknown[],
  expectedCodes: string[]
): Promise<void> {
  const savepoint = `sp_${randomUUID().replaceAll('-', '')}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(sql, params);
    assert.fail('Expected PostgreSQL to reject the statement.');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    assert.ok(expectedCodes.includes(code), `Expected PostgreSQL code ${expectedCodes.join('/')} but received ${code || 'unknown'}.`);
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

test('SW-020 PostgreSQL relational foundation', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4, application_name: 'grantdesk-schoolwide:schema-test' });

  try {
    await t.test('all four ordered migrations are recorded', async () => {
      const result = await pool.query<{ version: string }>(
        'SELECT version FROM grantdesk_schema_migrations ORDER BY version'
      );
      assert.deepEqual(result.rows.map((row) => row.version), [
        '001_identity_and_tenancy.sql',
        '002_organization_academics.sql',
        '003_schedule_calendar_policy.sql',
        '004_idempotency_outbox_audit.sql'
      ]);
    });

    await t.test('same display name remains legal while canonical students stay distinct', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        const result = await client.query<{ id: string }>(
          'SELECT id FROM students WHERE school_id = $1 AND display_name = $2 ORDER BY id',
          [ids.schoolA, 'Student Same']
        );
        assert.deepEqual(result.rows.map((row) => row.id), [ids.studentA, ids.studentA2]);
      });
    });

    await t.test('one canonical student can hold multiple section enrollments', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        await client.query(
          `INSERT INTO enrollments (school_id, section_id, student_id)
           VALUES ($1, $2, $3), ($1, $4, $3)`,
          [ids.schoolA, ids.sectionA1, ids.studentA, ids.sectionA2]
        );
        const result = await client.query<{ section_id: string }>(
          'SELECT section_id FROM enrollments WHERE school_id = $1 AND student_id = $2 ORDER BY section_id',
          [ids.schoolA, ids.studentA]
        );
        assert.deepEqual(result.rows.map((row) => row.section_id), [ids.sectionA1, ids.sectionA2]);
      });
    });

    await t.test('raw SQL cannot cross school boundaries for enrollment', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        await expectPgConstraint(
          client,
          'INSERT INTO enrollments (school_id, section_id, student_id) VALUES ($1, $2, $3)',
          [ids.schoolA, ids.sectionB1, ids.studentA],
          ['23503']
        );
      });
    });

    await t.test('raw SQL cannot attach an organization A user to an organization B school role', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        await expectPgConstraint(
          client,
          `INSERT INTO user_roles (organization_id, school_id, user_id, role)
           VALUES ($1, $2, $3, 'TEACHER')`,
          [ids.orgA, ids.schoolB, ids.teacherA],
          ['23503']
        );
      });
    });

    await t.test('authoritative identity aliases cannot collide within one school namespace', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        await client.query(
          `INSERT INTO student_identity_aliases
             (school_id, student_id, kind, value, normalized_value, source)
           VALUES ($1, $2, 'EMAIL', 'learner@north.example.invalid', 'learner@north.example.invalid', 'MANUAL')`,
          [ids.schoolA, ids.studentA]
        );
        await expectPgConstraint(
          client,
          `INSERT INTO student_identity_aliases
             (school_id, student_id, kind, value, normalized_value, source)
           VALUES ($1, $2, 'EMAIL', 'LEARNER@north.example.invalid', 'learner@north.example.invalid', 'MANUAL')`,
          [ids.schoolA, ids.studentA2],
          ['23505']
        );
      });
    });

    await t.test('inactive enrollment is retained instead of deleted', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO enrollments (school_id, section_id, student_id)
           VALUES ($1, $2, $3) RETURNING id`,
          [ids.schoolA, ids.sectionA1, ids.studentA]
        );
        const enrollmentId = inserted.rows[0]?.id;
        assert.ok(enrollmentId);
        await client.query(
          `UPDATE enrollments
             SET status = 'INACTIVE', left_at = now(), updated_at = now()
           WHERE id = $1`,
          [enrollmentId]
        );
        const result = await client.query<{ status: string; student_exists: boolean }>(
          `SELECT e.status, EXISTS(SELECT 1 FROM students s WHERE s.id = e.student_id) AS student_exists
             FROM enrollments e WHERE e.id = $1`,
          [enrollmentId]
        );
        assert.equal(result.rows[0]?.status, 'INACTIVE');
        assert.equal(result.rows[0]?.student_exists, true);
      });
    });

    await t.test('invalid academic, schedule, policy and access intervals fail at the database boundary', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        await expectPgConstraint(
          client,
          `INSERT INTO academic_terms
             (school_id, academic_year_id, name, ordinal, starts_on, ends_on)
           VALUES ($1, $2, 'Broken Term', 1, DATE '2027-01-10', DATE '2027-01-01')`,
          [ids.schoolA, ids.yearA],
          ['23514']
        );

        const profile = await client.query<{ id: string }>(
          `INSERT INTO schedule_profiles (school_id, name, key)
           VALUES ($1, 'Normal Day', 'NORMAL') RETURNING id`,
          [ids.schoolA]
        );
        await expectPgConstraint(
          client,
          `INSERT INTO schedule_periods
             (school_id, schedule_profile_id, period_code, starts_at_local, ends_at_local, ordinal_by_time)
           VALUES ($1, $2, 'P1', TIME '10:00', TIME '09:00', 1)`,
          [ids.schoolA, profile.rows[0]?.id],
          ['23514']
        );

        await expectPgConstraint(
          client,
          `INSERT INTO school_policy_sets
             (school_id, academic_year_id, name, effective_from, effective_until)
           VALUES ($1, $2, 'Broken Policy', DATE '2026-10-10', DATE '2026-10-01')`,
          [ids.schoolA, ids.yearA],
          ['23514']
        );

        await expectPgConstraint(
          client,
          `INSERT INTO student_access_rules
             (school_id, student_id, access_mode, valid_from, valid_until)
           VALUES ($1, $2, 'STANDARD', TIMESTAMPTZ '2026-09-07 12:00:00Z', TIMESTAMPTZ '2026-09-07 11:00:00Z')`,
          [ids.schoolA, ids.studentA],
          ['23514']
        );
      });
    });

    await t.test('policy and student-access rows cannot reference another school section', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        await expectPgConstraint(
          client,
          `INSERT INTO section_policy_overrides
             (school_id, section_id, policy_key, typed_value_json)
           VALUES ($1, $2, 'DAILY_LIMIT', '2'::jsonb)`,
          [ids.schoolA, ids.sectionB1],
          ['23503']
        );
        await expectPgConstraint(
          client,
          `INSERT INTO student_access_rules
             (school_id, student_id, section_id, access_mode)
           VALUES ($1, $2, $3, 'STANDARD')`,
          [ids.schoolA, ids.studentA, ids.sectionB1],
          ['23503']
        );
      });
    });

    await t.test('audit and outbox can share a correlation id and audit rows are append-only', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        const correlationId = randomUUID();
        const audit = await client.query<{ id: string }>(
          `INSERT INTO audit_events
             (organization_id, school_id, actor_kind, action, target_type, correlation_id, source)
           VALUES ($1, $2, 'SYSTEM', 'SYNTHETIC_EVENT', 'SCHEMA_TEST', $3, 'SYSTEM')
           RETURNING id`,
          [ids.orgA, ids.schoolA, correlationId]
        );
        await client.query(
          `INSERT INTO transactional_outbox
             (organization_id, school_id, topic, event_type, aggregate_type, correlation_id)
           VALUES ($1, $2, 'schoolwide.synthetic', 'SYNTHETIC_EVENT', 'SCHEMA_TEST', $3)`,
          [ids.orgA, ids.schoolA, correlationId]
        );
        const count = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM (
             SELECT correlation_id FROM audit_events WHERE school_id = $1 AND correlation_id = $2
             UNION ALL
             SELECT correlation_id FROM transactional_outbox WHERE school_id = $1 AND correlation_id = $2
           ) correlated`,
          [ids.schoolA, correlationId]
        );
        assert.equal(count.rows[0]?.count, '2');
        await expectPgConstraint(
          client,
          'UPDATE audit_events SET reason = $1 WHERE id = $2',
          ['mutation should fail', audit.rows[0]?.id],
          ['P0001']
        );
      });
    });

    await t.test('idempotency keys are unique within a school and tenant-bound', async () => {
      await withRollback(pool, async (client) => {
        const ids = await seedTwoSchoolFixture(client);
        const correlationId = randomUUID();
        await client.query(
          `INSERT INTO idempotency_keys
             (organization_id, school_id, key, operation, request_fingerprint, expires_at, correlation_id)
           VALUES ($1, $2, 'request-1', 'SYNTHETIC', 'fingerprint-a', now() + interval '5 minutes', $3)`,
          [ids.orgA, ids.schoolA, correlationId]
        );
        await expectPgConstraint(
          client,
          `INSERT INTO idempotency_keys
             (organization_id, school_id, key, operation, request_fingerprint, expires_at, correlation_id)
           VALUES ($1, $2, 'request-1', 'SYNTHETIC', 'fingerprint-b', now() + interval '5 minutes', $3)`,
          [ids.orgA, ids.schoolA, randomUUID()],
          ['23505']
        );
        await expectPgConstraint(
          client,
          `INSERT INTO idempotency_keys
             (organization_id, school_id, key, operation, request_fingerprint, expires_at, correlation_id)
           VALUES ($1, $2, 'cross-org', 'SYNTHETIC', 'fingerprint-c', now() + interval '5 minutes', $3)`,
          [ids.orgA, ids.schoolB, randomUUID()],
          ['23503']
        );
      });
    });

    await t.test('required hot-path indexes exist', async () => {
      const result = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = ANY($1::text[])`,
        [[
          'enrollments_current_section_student_idx',
          'section_staff_current_lookup_idx',
          'school_calendar_days_lookup_idx',
          'school_policy_sets_effective_idx',
          'audit_events_school_time_idx',
          'transactional_outbox_pending_idx'
        ]]
      );
      const names = new Set(result.rows.map((row) => row.indexname));
      for (const expected of [
        'enrollments_current_section_student_idx',
        'section_staff_current_lookup_idx',
        'school_calendar_days_lookup_idx',
        'school_policy_sets_effective_idx',
        'audit_events_school_time_idx',
        'transactional_outbox_pending_idx'
      ]) {
        assert.ok(names.has(expected), `Missing required index ${expected}.`);
      }
    });
  } finally {
    await pool.end();
  }
});
