import { Pool, type QueryResultRow } from 'pg';
import type { AppConfig } from '../config.js';

export interface Database {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters?: readonly unknown[]): Promise<readonly T[]>;
  close(): Promise<void>;
}

export class PostgresDatabase implements Database {
  readonly #pool: Pool;

  constructor(config: AppConfig) {
    this.#pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.dbPoolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: `grantdesk-schoolwide:${config.instanceId}`,
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
    const result = await this.#pool.query<T>(sql, [...parameters]);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}
