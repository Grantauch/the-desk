import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { readConfig } from '../config.js';

const migrationLock = 'grantdesk-schoolwide-schema-migrations-v1';

async function main(): Promise<void> {
  const config = readConfig();
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, application_name: 'grantdesk-schoolwide:migrate' });
  const client = await pool.connect();
  const migrationsDirectory = join(process.cwd(), 'db', 'migrations');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS grantdesk_schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [migrationLock]);

    const files = (await readdir(migrationsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    const appliedRows = await client.query<{ version: string }>('SELECT version FROM grantdesk_schema_migrations');
    const applied = new Set(appliedRows.rows.map((row) => row.version));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO grantdesk_schema_migrations(version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [migrationLock]);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
