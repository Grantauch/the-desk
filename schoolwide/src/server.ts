import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { PostgresDatabase } from './db/database.js';

const config = readConfig();
const database = new PostgresDatabase(config);
const app = buildApp({ config, database });
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down GrantDesk Schoolwide');
  await app.close();
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
