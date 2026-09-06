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
  };
}
