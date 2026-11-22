import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { createSyntheticPostgresNonceConsumer } from './postgres-synthetic-replay.js';
import { issueSyntheticLegacyPinAttestation, verifySyntheticLegacyPinAttestation } from './synthetic-pin-attestation.js';

const databaseUrl = process.env.DATABASE_URL;
const secret = Buffer.alloc(32, 0x72); // Synthetic only, never a real bridge key.
const issuer = 'sw176-fictional-hall-pass';
const audience = 'sw176-fictional-schoolwide';
const studentAlias = 'fictional-student-alpha';
const pin = '001234';

function executor(pool: Pool): QueryExecutor {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
      return (await pool.query<T>(sql, [...parameters])).rows;
    },
  };
}

if (!databaseUrl) {
  test('SW-176 PostgreSQL replay integration requires DATABASE_URL', { skip: true }, () => {});
} else {
  test('SW-176 PostgreSQL synthetic handoff replay is durable across separate database pools', async (t) => {
    const poolA = new Pool({ connectionString: databaseUrl, max: 8 });
    const poolB = new Pool({ connectionString: databaseUrl, max: 8 });
    const org = randomUUID();
    const school = randomUUID();
    const otherSchool = randomUUID();
    const slug = 'sw176-' + randomBytes(8).toString('hex');
    try {
      await poolA.query('INSERT INTO organizations(id,slug,name) VALUES ($1,$2,$3)',
        [org, slug, 'Fictional SW176 Replay Test Organization']);
      await poolA.query('INSERT INTO schools(id,organization_id,slug,name) VALUES ($1,$2,$3,$4)',
        [school, org, slug + '-one', 'Fictional Replay School One']);
      await poolA.query('INSERT INTO schools(id,organization_id,slug,name) VALUES ($1,$2,$3,$4)',
        [otherSchool, org, slug + '-two', 'Fictional Replay School Two']);

      const scope = { organizationId: org, schoolId: school, issuer };
      const consumeA = createSyntheticPostgresNonceConsumer(executor(poolA), scope);
      const consumeB = createSyntheticPostgresNonceConsumer(executor(poolB), scope);
      const token = issueSyntheticLegacyPinAttestation({
        issuer, audience, schoolId: school, studentAlias, pin, secret,
        nowEpochSeconds: Math.floor(Date.now() / 1000), ttlSeconds: 60,
      });
      const verify = (consumeNonceDigest: typeof consumeA, options: {
        expectedSchoolId?: string; pin?: string;
      } = {}) => verifySyntheticLegacyPinAttestation({
        token, secret, expectedIssuer: issuer, expectedAudience: audience,
        expectedSchoolId: options.expectedSchoolId ?? school,
        expectedStudentAlias: studentAlias, pin: options.pin ?? pin,
        nowEpochSeconds: Math.floor(Date.now() / 1000),
        consumeNonceDigest,
      });

      await t.test('35 concurrent attempts across two independent pools yield exactly one success', async () => {
        const results = await Promise.allSettled(
          Array.from({ length: 35 }, (_, i) => verify(i % 2 ? consumeA : consumeB)),
        );
        assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
        assert.equal(results.filter(x => x.status === 'rejected').length, 34);
        const stored = await poolB.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM legacy_pin_handoff_replays WHERE organization_id=$1 AND school_id=$2 AND issuer=$3',
          [org, school, issuer],
        );
        assert.equal(stored.rows[0]?.count, '1');
        await assert.rejects(verify(consumeA), /Legacy PIN handoff rejected/);
      });

      await t.test('wrong PIN burns the one-time token even across other workers', async () => {
        const wrongPinToken = issueSyntheticLegacyPinAttestation({
          issuer, audience, schoolId: school, studentAlias, pin, secret,
          nowEpochSeconds: Math.floor(Date.now() / 1000),
        });
        const request = (submittedPin: string, store: typeof consumeA) =>
          verifySyntheticLegacyPinAttestation({
            token: wrongPinToken, secret, expectedIssuer: issuer, expectedAudience: audience,
            expectedSchoolId: school, expectedStudentAlias: studentAlias,
            pin: submittedPin, nowEpochSeconds: Math.floor(Date.now() / 1000),
            consumeNonceDigest: store,
          });
        await assert.rejects(request('01234', consumeA), /Legacy PIN handoff rejected/);
        await assert.rejects(request(pin, consumeB), /Legacy PIN handoff rejected/);
        const rows = await poolA.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM legacy_pin_handoff_replays WHERE organization_id=$1 AND school_id=$2',
          [org, school],
        );
        assert.equal(rows.rows[0]?.count, '2');
      });

      await t.test('wrong school scope fails before consuming a nonce in that other school', async () => {
        const tokenForScope = issueSyntheticLegacyPinAttestation({
          issuer, audience, schoolId: school, studentAlias, pin, secret,
          nowEpochSeconds: Math.floor(Date.now() / 1000),
        });
        const secondConsumer = createSyntheticPostgresNonceConsumer(executor(poolB), {
          organizationId: org, schoolId: otherSchool, issuer,
        });
        await assert.rejects(verifySyntheticLegacyPinAttestation({
          token: tokenForScope, secret, expectedIssuer: issuer, expectedAudience: audience,
          expectedSchoolId: otherSchool, expectedStudentAlias: studentAlias,
          pin, nowEpochSeconds: Math.floor(Date.now() / 1000),
          consumeNonceDigest: secondConsumer,
        }), /Legacy PIN handoff rejected/);
        const count = await poolB.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM legacy_pin_handoff_replays WHERE school_id=$1',
          [otherSchool],
        );
        assert.equal(count.rows[0]?.count, '0');
      });

      await t.test('invalid tenant and expired nonce are rejected without DB writes', async () => {
        const digest = createHash('sha256').update('synthetic-nonce-only').digest('hex');
        const badTenant = createSyntheticPostgresNonceConsumer(executor(poolA), {
          organizationId: randomUUID(), schoolId: school, issuer,
        });
        assert.equal(await badTenant(digest, Math.floor(Date.now() / 1000) + 60), false);
        assert.equal(await consumeA(digest, Math.floor(Date.now() / 1000) - 1), false);
        assert.equal(await consumeA('not-a-digest', Math.floor(Date.now() / 1000) + 60), false);
        const rows = await poolA.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM legacy_pin_handoff_replays WHERE nonce_digest=$1', [digest],
        );
        assert.equal(rows.rows[0]?.count, '0');
      });

      await t.test('schema stores no student identity, PIN, hash, or raw confirmation', async () => {
        const result = await poolA.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = 'legacy_pin_handoff_replays'`,
        );
        const cols = result.rows.map(x => x.column_name).sort();
        assert.deepEqual(cols, ['consumed_at', 'expires_at', 'issuer', 'nonce_digest', 'organization_id', 'school_id']);
      });
    } finally {
      await poolA.query('DELETE FROM legacy_pin_handoff_replays WHERE school_id IN ($1,$2)', [school, otherSchool]);
      await poolA.query('DELETE FROM schools WHERE id IN ($1,$2)', [school, otherSchool]);
      await poolA.query('DELETE FROM organizations WHERE id=$1', [org]);
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });
}
