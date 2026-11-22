import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import {
  pruneExpiredSyntheticNonceReplays,
  type SyntheticNonceReplayScope,
} from './postgres-synthetic-replay.js';

// Deliberately refuse any student database, private staging DSN or manual run.
// Only the known fresh GitHub Actions PostgreSQL 18 test service is accepted.
const testDatabaseUrl = 'postgresql://grantdesk:grantdesk@127.0.0.1:5432/grantdesk_schoolwide';
const approved =
  process.env.GITHUB_ACTIONS === 'true'
  && process.env.NODE_ENV === 'test'
  && process.env.LEGACY_PRODUCTION_WRITES === 'forbidden'
  && process.env.DATABASE_URL === testDatabaseUrl;

function executor(pool: Pool): Pick<QueryExecutor, 'query'> {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      parameters: readonly unknown[] = [],
    ): Promise<readonly T[]> {
      return (await pool.query<T>(sql, [...parameters])).rows;
    },
  };
}

if (!approved) {
  test('SW-184 expired-nonce retention test requires the exact synthetic GitHub database', { skip: true }, () => {});
} else {
  test('SW-184 bounded expired-replay cleanup is school-scoped and concurrent-safe', async (t) => {
    const poolA = new Pool({ connectionString: testDatabaseUrl, max: 4 });
    const poolB = new Pool({ connectionString: testDatabaseUrl, max: 4 });
    const org = randomUUID();
    const schoolA = randomUUID();
    const schoolB = randomUUID();
    const issuer = 'sw184-fictional-issuer';
    const slug = 'sw184-' + randomBytes(7).toString('hex');
    const scopeA: SyntheticNonceReplayScope = { organizationId: org, schoolId: schoolA, issuer };
    const scopeB: SyntheticNonceReplayScope = { organizationId: org, schoolId: schoolB, issuer };
    const dbA = executor(poolA);
    const dbB = executor(poolB);

    async function insert(scope: SyntheticNonceReplayScope, expired: boolean, label: string): Promise<string> {
      const digest = createHash('sha256').update('sw184-synthetic-' + label + '-' + randomUUID()).digest('hex');
      const times = expired
        ? "clock_timestamp() - INTERVAL '2 minutes', clock_timestamp() - INTERVAL '1 minute'"
        : "clock_timestamp(), clock_timestamp() + INTERVAL '1 minute'";
      await poolA.query(
        'INSERT INTO legacy_pin_handoff_replays ' +
        '(organization_id, school_id, issuer, nonce_digest, consumed_at, expires_at) ' +
        'VALUES ($1,$2,$3,$4,' + times + ')',
        [scope.organizationId, scope.schoolId, scope.issuer, digest],
      );
      return digest;
    }

    async function count(scope: SyntheticNonceReplayScope, expired: boolean): Promise<number> {
      const rows = await poolA.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM legacy_pin_handoff_replays ' +
        'WHERE organization_id=$1 AND school_id=$2 AND issuer=$3 ' +
        (expired ? 'AND expires_at <= clock_timestamp()' : 'AND expires_at > clock_timestamp()'),
        [scope.organizationId, scope.schoolId, scope.issuer],
      );
      return Number(rows.rows[0]?.total ?? '-1');
    }

    try {
      await poolA.query('INSERT INTO organizations(id,slug,name) VALUES($1,$2,$3)',
        [org, slug, 'SW184 Fictional Retention Organization']);
      await poolA.query('INSERT INTO schools(id,organization_id,slug,name) VALUES($1,$2,$3,$4)',
        [schoolA, org, slug + '-one', 'Fictional Cleanup School One']);
      await poolA.query('INSERT INTO schools(id,organization_id,slug,name) VALUES($1,$2,$3,$4)',
        [schoolB, org, slug + '-two', 'Fictional Cleanup School Two']);

      for (let i = 0; i < 9; i++) await insert(scopeA, true, 'a-expired-' + i);
      for (let i = 0; i < 3; i++) await insert(scopeB, true, 'b-expired-' + i);
      for (let i = 0; i < 2; i++) await insert(scopeA, false, 'a-unexpired-' + i);

      await t.test('reject invalid tenant context and unsafe batch sizes before SQL', async () => {
        const badScope: SyntheticNonceReplayScope = { ...scopeA, organizationId: 'not-a-uuid' };
        await assert.rejects(pruneExpiredSyntheticNonceReplays(dbA, badScope), /cleanup scope rejected/);
        for (const invalid of [0, -1, 501, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
          await assert.rejects(pruneExpiredSyntheticNonceReplays(dbA, scopeA, invalid), /cleanup batch rejected/);
        }
        assert.equal(await count(scopeA, true), 9);
        assert.equal(await count(scopeB, true), 3);
      });

      await t.test('remove at most requested batch and never cross school, issuer or organization', async () => {
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbA, scopeA, 3), 3);
        assert.equal(await count(scopeA, true), 6);
        assert.equal(await count(scopeB, true), 3);
        assert.equal(await count(scopeA, false), 2);
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbB, { ...scopeA, issuer: 'wrong-issuer' }, 5), 0);
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbB, { ...scopeA, organizationId: randomUUID() }, 5), 0);
        assert.equal(await count(scopeA, true), 6);
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbB, scopeA, 5), 5);
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbA, scopeA, 5), 1);
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbA, scopeA, 5), 0);
        assert.equal(await count(scopeA, false), 2);
      });

      await t.test('skip row locks instead of blocking an independent worker', async () => {
        const lockedClient = await poolA.connect();
        let locked = false;
        try {
          await lockedClient.query('BEGIN');
          const row = await lockedClient.query<{ nonce_digest: string }>(
            'SELECT nonce_digest FROM legacy_pin_handoff_replays ' +
            'WHERE organization_id=$1 AND school_id=$2 AND issuer=$3 AND expires_at <= clock_timestamp() ' +
            'ORDER BY expires_at LIMIT 1 FOR UPDATE',
            [scopeB.organizationId, scopeB.schoolId, scopeB.issuer],
          );
          assert.equal(row.rows.length, 1);
          locked = true;
          assert.equal(await pruneExpiredSyntheticNonceReplays(dbB, scopeB, 10), 2);
          assert.equal(await count(scopeB, true), 1);
        } finally {
          if (locked) await lockedClient.query('ROLLBACK');
          else await lockedClient.query('ROLLBACK').catch(() => {});
          lockedClient.release();
        }
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbB, scopeB, 10), 1);
        assert.equal(await count(scopeB, true), 0);
      });

      await t.test('parallel maintenance workers never remove one nonce twice', async () => {
        for (let i = 0; i < 8; i++) await insert(scopeB, true, 'b-concurrent-' + i);
        const results = await Promise.all([
          pruneExpiredSyntheticNonceReplays(dbA, scopeB, 5),
          pruneExpiredSyntheticNonceReplays(dbB, scopeB, 5),
        ]);
        assert.equal(results.reduce((sum, value) => sum + value, 0), 8);
        assert.ok(results.every(value => value >= 0 && value <= 5));
        assert.equal(await count(scopeB, true), 0);
        assert.equal(await count(scopeA, false), 2);
      });

      await t.test('malformed or expired records never cause unbounded work', async () => {
        assert.equal(await pruneExpiredSyntheticNonceReplays(dbA, scopeA, 500), 0);
        assert.equal(await count(scopeA, false), 2);
        const rows = await poolA.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_name='legacy_pin_handoff_replays'",
        );
        assert.ok(!rows.rows.some(row => /pin|student|alias|token|salt|secret/i.test(row.column_name)));
      });
    } finally {
      await poolA.query('DELETE FROM legacy_pin_handoff_replays WHERE school_id IN ($1,$2)', [schoolA, schoolB]);
      await poolA.query('DELETE FROM schools WHERE id IN ($1,$2)', [schoolA, schoolB]);
      await poolA.query('DELETE FROM organizations WHERE id=$1', [org]);
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });
}
