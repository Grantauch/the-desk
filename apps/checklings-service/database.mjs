import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const migrationSql = await readFile(new URL('./migrations/001-foundation.sql', import.meta.url), 'utf8');
const migrationChecksum = createHash('sha256').update(migrationSql).digest('hex');

// A migration is explicitly invoked by an operator, never by a student request.
export async function migrate(database) {
  return database.transaction(async client => {
    // Serialize migration runners without relying on a nonexistent version row.
    await client.query('SELECT pg_advisory_xact_lock(743201001)');
    await client.query('CREATE TABLE IF NOT EXISTS ck_schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL)');
    const {rows} = await client.query('SELECT checksum FROM ck_schema_migrations WHERE version=1');
    if (rows.length) {
      if (rows[0].checksum !== migrationChecksum) throw new Error('Migration checksum mismatch');
      return {applied:false, version:1};
    }
    if (client.exec) await client.exec(migrationSql); else await client.query(migrationSql);
    await client.query('INSERT INTO ck_schema_migrations VALUES (1,$1)', [migrationChecksum]);
    return {applied:true, version:1};
  });
}

/** Inject a private pg.Pool. No browser, Apps Script or workbook credentials. */
export function postgresDatabase(pool) {
  return {
    async transaction(work) {
      // READ COMMITTED + locked member row serializes commands for that owner.
      // Future cross-owner battles require sorted multi-owner locks or SERIALIZABLE.
      for (let attempt=0; ; attempt++) {
        const client = await pool.connect();
        let committed=false;
        let discard=false;
        try {
          await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
          await client.query("SET LOCAL lock_timeout = '5s'");
          await client.query("SET LOCAL statement_timeout = '10s'");
          const result = await work(client);
          await client.query('COMMIT'); committed=true;
          return result;
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch { discard=true; }
          // Never automatically retry a connection error with an uncertain commit.
          if (!committed && ['40001','40P01'].includes(error.code) && attempt<2) continue;
          throw error;
        } finally { client.release(discard); }
      }
    },
  };
}

export async function readiness(database) {
  try {
    return await database.transaction(async c => {
      const {rows} = await c.query('SELECT version,checksum FROM ck_schema_migrations ORDER BY version DESC LIMIT 1');
      return {ready:rows[0]?.version===1 && rows[0]?.checksum===migrationChecksum, schemaVersion:rows[0]?.version??null};
    });
  } catch { return {ready:false, schemaVersion:null}; }
}
