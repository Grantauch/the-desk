import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  SCHOOLWIDE_INSTANCE_ID: z.string().min(1).max(100).default('local'),
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
  dbPoolMax: number;
  instanceId: string;
  legacyReadAdapterMode: z.infer<typeof configSchema>['LEGACY_READ_ADAPTER_MODE'];
  legacyProductionWrites: 'forbidden';
  operationsWorkersEnabled: boolean;
  outboxWorkerIntervalMs: number;
  classroomSyncIntervalMs: number;
  outboxWorkerBatchSize: number;
  classroomSyncBatchSize: number;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.parse(environment);
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    dbPoolMax: parsed.DB_POOL_MAX,
    instanceId: parsed.SCHOOLWIDE_INSTANCE_ID,
    legacyReadAdapterMode: parsed.LEGACY_READ_ADAPTER_MODE,
    legacyProductionWrites: parsed.LEGACY_PRODUCTION_WRITES,
    operationsWorkersEnabled: parsed.OPERATIONS_WORKERS_ENABLED === 'true',
    outboxWorkerIntervalMs: parsed.OUTBOX_WORKER_INTERVAL_MS,
    classroomSyncIntervalMs: parsed.CLASSROOM_SYNC_INTERVAL_MS,
    outboxWorkerBatchSize: parsed.OUTBOX_WORKER_BATCH_SIZE,
    classroomSyncBatchSize: parsed.CLASSROOM_SYNC_BATCH_SIZE,
  };
}
