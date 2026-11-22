/**
 * SW-176 — experimental durable replay consumer for the OFF-BY-DEFAULT
 * synthetic PIN handoff. Not imported by the runtime app or connected to
 * Apps Script. Caller must supply server-trusted tenant/school/issuer scope.
 */
import type { QueryExecutor } from '../db/database.js';
import type { SyntheticNonceConsumption } from './synthetic-nonce-contract.js';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISSUER = /^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,191}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const MAX_VALIDITY_SECONDS = 65; // 60-second issued lifetime + maximum 5-second clock skew.

export type SyntheticNonceReplayScope = Readonly<{
  organizationId: string;
  schoolId: string;
  issuer: string;
}>;

/**
 * Each call requires an atomic INSERT protected by a database primary key,
 * so replays across different Fastify instances cannot both succeed.
 *
 * The scope is set from a trusted server-side identity mapping, never from
 * a browser-provided school/alias. No Student ID, PIN or source secret enters
 * SQL or the replay table. The returned callback matches the synthetic
 * attestation verifier's consumeNonceDigest contract.
 *
 * Fail closed if the database is unavailable or the token has expired.
 */
export function createSyntheticPostgresNonceConsumer(
  database: Pick<QueryExecutor, 'query'>,
  scope: SyntheticNonceReplayScope,
): (consumption: SyntheticNonceConsumption) => Promise<boolean> {
  if (!GUID.test(scope.organizationId) || !GUID.test(scope.schoolId) || !ISSUER.test(scope.issuer)) {
    throw new Error('Synthetic replay scope rejected.');
  }
  return async (consumption) => {
    // The signed payload's issuer/school must match this server-trusted
    // database scope. A wrong consumer cannot burn a token in another school
    // or accept the same signed nonce a second time under that other scope.
    if (!consumption || typeof consumption !== 'object') return false;
    const { nonceDigest, expiresAtEpochSeconds, schoolId, issuer } = consumption;
    if (schoolId !== scope.schoolId || issuer !== scope.issuer
      || typeof nonceDigest !== 'string' || !DIGEST.test(nonceDigest)
      || !Number.isSafeInteger(expiresAtEpochSeconds) || expiresAtEpochSeconds <= 0) return false;
    try {
      const rows = await database.query<{ accepted: number }>(
        `INSERT INTO legacy_pin_handoff_replays
           (organization_id, school_id, issuer, nonce_digest, expires_at)
         SELECT $1::uuid, $2::uuid, $3::text, $4::text, to_timestamp($5::double precision)
         WHERE to_timestamp($5::double precision) > clock_timestamp()
           AND to_timestamp($5::double precision) <= clock_timestamp() + INTERVAL '65 seconds'
         ON CONFLICT (school_id, issuer, nonce_digest) DO NOTHING
         RETURNING 1::integer AS accepted`,
        [scope.organizationId, scope.schoolId, scope.issuer, nonceDigest, expiresAtEpochSeconds],
      );
      return rows.length === 1 && rows[0]?.accepted === 1;
    } catch {
      // Treat network outages, FK mismatches, or write failures as denial.
      // Never print a token or database exception to the student.
      return false;
    }
  };
}


const MAX_REPLAY_CLEANUP_BATCH = 500;

/**
 * SW-184: bounded maintenance for an individual trusted replay scope.
 *
 * This helper is intentionally NOT wired to any runtime route or scheduler.
 * The replay table contains only one-way nonce digests (never source PINs).
 * When later authorized, a trusted maintenance service can call this in small
 * batches. Expiration is evaluated by the DB clock, not a caller-supplied time.
 *
 * FOR UPDATE SKIP LOCKED allows parallel workers without blocking each other.
 * The statement deletes only expired rows belonging to the exact organization,
 * school and issuer, and never touches an unexpired replay guard.
 */
export async function pruneExpiredSyntheticNonceReplays(
  database: Pick<QueryExecutor, 'query'>,
  scope: SyntheticNonceReplayScope,
  limit = 250,
): Promise<number> {
  if (!scope || typeof scope !== 'object'
    || !GUID.test(scope.organizationId) || !GUID.test(scope.schoolId)
    || !ISSUER.test(scope.issuer)) {
    throw new Error('Synthetic replay cleanup scope rejected.');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPLAY_CLEANUP_BATCH) {
    throw new Error('Synthetic replay cleanup batch rejected.');
  }
  try {
    const removed = await database.query<{ removed: number }>(
      'WITH expired AS MATERIALIZED (' +
        ' SELECT ctid FROM legacy_pin_handoff_replays' +
        ' WHERE organization_id = $1::uuid AND school_id = $2::uuid AND issuer = $3::text' +
        ' AND expires_at <= clock_timestamp()' +
        ' ORDER BY expires_at, nonce_digest' +
        ' LIMIT $4::integer FOR UPDATE SKIP LOCKED' +
      ') DELETE FROM legacy_pin_handoff_replays AS replay' +
        ' USING expired WHERE replay.ctid = expired.ctid' +
        ' RETURNING 1::integer AS removed',
      [scope.organizationId, scope.schoolId, scope.issuer, limit],
    );
    return removed.length;
  } catch {
    // No database details or identifiers should reach a teacher/student.
    throw new Error('Synthetic replay cleanup unavailable.');
  }
}
