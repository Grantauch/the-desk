import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  DATABASE_SOCKET_PATH: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  SCHOOLWIDE_INSTANCE_ID: z.string().min(1).max(100).default('local'),
  DEPLOYMENT_TIER: z.enum(['local', 'staging', 'production']).default('local'),
  STAGING_PLATFORM: z.enum(['cloudsql', 'vps', 'vps-host']).default('cloudsql'),
  RELEASE_SHA: z.string().regex(/^(local|[0-9a-f]{40})$/).default('local'),
  LEGACY_READ_ADAPTER_MODE: z.enum(['disabled', 'shadow-read']).default('disabled'),
  LEGACY_PRODUCTION_WRITES: z.literal('forbidden').default('forbidden'),
  OPERATIONS_WORKERS_ENABLED: z.enum(['true', 'false']).default('false'),
  OUTBOX_WORKER_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(1_000),
  CLASSROOM_SYNC_INTERVAL_MS: z.coerce.number().int().min(30_000).max(3_600_000).default(300_000),
  OUTBOX_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(50),
  CLASSROOM_SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof configSchema>['NODE_ENV'];
  host: string;
  port: number;
  logLevel: z.infer<typeof configSchema>['LOG_LEVEL'];
  databaseUrl: string;
  databaseSocketPath?: string;
  dbPoolMax: number;
  instanceId: string;
  deploymentTier?: z.infer<typeof configSchema>['DEPLOYMENT_TIER'];
  stagingPlatform?: z.infer<typeof configSchema>['STAGING_PLATFORM'];
  releaseSha?: string;
  legacyReadAdapterMode: z.infer<typeof configSchema>['LEGACY_READ_ADAPTER_MODE'];
  legacyProductionWrites: 'forbidden';
  operationsWorkersEnabled?: boolean;
  outboxWorkerIntervalMs?: number;
  classroomSyncIntervalMs?: number;
  outboxWorkerBatchSize?: number;
  classroomSyncBatchSize?: number;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.parse(environment);
  if (parsed.DEPLOYMENT_TIER !== 'local' && parsed.RELEASE_SHA === 'local') {
    throw new Error('Staging/production Schoolwide deployments require an exact RELEASE_SHA.');
  }
  if (parsed.DEPLOYMENT_TIER === 'staging') {
    if (parsed.STAGING_PLATFORM === 'cloudsql') {
      if (!parsed.DATABASE_SOCKET_PATH?.startsWith('/cloudsql/')) {
        throw new Error('Schoolwide staging requires DATABASE_SOCKET_PATH through the Cloud SQL Unix socket mount.');
      }
    } else if (parsed.STAGING_PLATFORM === 'vps') {
      // The VPS staging path is deliberately restricted to the internal Compose
      // database service; the database must not be reachable on a public host.
      if (parsed.DATABASE_SOCKET_PATH) {
        throw new Error('VPS staging must not set DATABASE_SOCKET_PATH.');
      }
      let address: URL;
      try {
        address = new URL(parsed.DATABASE_URL);
      } catch {
        throw new Error('VPS staging requires a valid private PostgreSQL DATABASE_URL.');
      }
      if (
        (address.protocol !== 'postgresql:' && address.protocol !== 'postgres:') ||
        address.hostname !== 'postgres' ||
        (address.port !== '' && address.port !== '5432') ||
        address.username !== 'grantdesk_stage' ||
        !address.password ||
        address.pathname !== '/grantdesk_schoolwide_stage'
      ) {
        throw new Error('VPS staging requires the dedicated internal postgres service and staging database.');
      }
    } else {
      // A systemd staging service on the VPS uses its own PostgreSQL cluster
      // through local peer-authenticated Unix sockets, not Margin's database.
      if (
        parsed.HOST !== '127.0.0.1' ||
        parsed.PORT !== 18787 ||
        parsed.LEGACY_READ_ADAPTER_MODE !== 'disabled' ||
        parsed.OPERATIONS_WORKERS_ENABLED !== 'false'
      ) {
        throw new Error('VPS host staging must bind localhost and keep all legacy/sync workers disabled.');
      }
      if (parsed.DATABASE_SOCKET_PATH !== '/var/run/postgresql') {
        throw new Error('VPS host staging requires a local PostgreSQL Unix socket.');
      }
      let address: URL;
      try {
        address = new URL(parsed.DATABASE_URL);
      } catch {
        throw new Error('VPS host staging requires a valid isolated PostgreSQL URL.');
      }
      if (
        address.protocol !== 'postgresql:' ||
        address.hostname !== 'localhost' ||
        address.port !== '55432' ||
        address.username !== 'grantdesk_stage' ||
        address.password !== '' ||
        address.pathname !== '/grantdesk_schoolwide_stage' ||
        address.search !== '' ||
        address.hash !== ''
      ) {
        throw new Error('VPS host staging requires its dedicated PostgreSQL cluster, role and database.');
      }
    }
  }
  if (parsed.DEPLOYMENT_TIER === 'production' && parsed.STAGING_PLATFORM !== 'cloudsql') {
    throw new Error('VPS staging platform cannot be used as a production cutover flag.');
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    ...(parsed.DATABASE_SOCKET_PATH ? { databaseSocketPath: parsed.DATABASE_SOCKET_PATH } : {}),
    dbPoolMax: parsed.DB_POOL_MAX,
    instanceId: parsed.SCHOOLWIDE_INSTANCE_ID,
    deploymentTier: parsed.DEPLOYMENT_TIER,
    stagingPlatform: parsed.STAGING_PLATFORM,
    releaseSha: parsed.RELEASE_SHA,
    legacyReadAdapterMode: parsed.LEGACY_READ_ADAPTER_MODE,
    legacyProductionWrites: parsed.LEGACY_PRODUCTION_WRITES,
    operationsWorkersEnabled: parsed.OPERATIONS_WORKERS_ENABLED === 'true',
    outboxWorkerIntervalMs: parsed.OUTBOX_WORKER_INTERVAL_MS,
    classroomSyncIntervalMs: parsed.CLASSROOM_SYNC_INTERVAL_MS,
    outboxWorkerBatchSize: parsed.OUTBOX_WORKER_BATCH_SIZE,
    classroomSyncBatchSize: parsed.CLASSROOM_SYNC_BATCH_SIZE,
  };
}
