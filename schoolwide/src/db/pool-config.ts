import type { PoolConfig } from 'pg';
import { parseIntoClientConfig } from 'pg-connection-string';
import type { AppConfig } from '../config.js';

/**
 * node-postgres re-parses connectionString after merging Pool options, so
 * { connectionString, host: '/var/run/postgresql' } silently ignores host.
 * Parse once and pass explicit fields to keep the staging socket authoritative.
 */
export function databaseConnectionOptions(
  config: Pick<AppConfig, 'databaseUrl' | 'databaseSocketPath'>,
): PoolConfig {
  if (!config.databaseSocketPath) {
    return { connectionString: config.databaseUrl };
  }
  const parsed = parseIntoClientConfig(config.databaseUrl);
  return { ...parsed, host: config.databaseSocketPath };
}
