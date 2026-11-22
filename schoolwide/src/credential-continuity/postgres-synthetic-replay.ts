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
