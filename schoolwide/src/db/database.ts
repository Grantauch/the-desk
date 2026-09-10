import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { AppConfig } from '../config.js';

export interface QueryExecutor {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters?: readonly unknown[]): Promise<readonly T[]>;
}

export interface Database extends QueryExecutor {
  close(): Promise<void>;
}

export interface TransactionalDatabase extends Database {
  transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T>;
}

export function supportsTransactions(database: Database): database is TransactionalDatabase {
  return typeof (database as Partial<TransactionalDatabase>).transaction === 'function';
}

class ClientQueryExecutor implements QueryExecutor {
  readonly #client: PoolClient;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.#client.query<T>(sql, [...parameters]);
    return result.rows;
  }
}

export class PostgresDatabase implements TransactionalDatabase {
  readonly #pool: Pool;

  constructor(config: AppConfig) {
    this.#pool = new Pool({
      connectionString: config.databaseUrl,
      ...(config.databaseSocketPath ? { host: config.databaseSocketPath } : {}),
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

  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new ClientQueryExecutor(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original transaction failure.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}
