// Creates a second, disposable PostgreSQL DB for the 35-student CI test.
// Never run on a real VPS, staging environment, or production database.
import { Client } from 'pg';

const url = process.env.DATABASE_URL;
if (!url || process.env.GITHUB_ACTIONS !== 'true' || process.env.NODE_ENV !== 'test') {
  throw new Error('CI load database creation requires GitHub Actions test mode.');
}
const parsed = new URL(url);
if (
  parsed.protocol !== 'postgresql:' ||
  parsed.hostname !== '127.0.0.1' ||
  parsed.port !== '5432' ||
  parsed.username !== 'grantdesk' ||
  parsed.pathname !== '/grantdesk_schoolwide'
) {
  throw new Error('CI load database bootstrap refuses this PostgreSQL connection.');
}
const client = new Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
try {
  await client.connect();
  await client.query('CREATE DATABASE grantdesk_schoolwide_load');
  console.log('Created isolated disposable CI classroom-load database.');
} finally {
  await client.end();
}
