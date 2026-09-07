import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import type { Database } from './db/database.js';

export type BuildAppOptions = {
  config: AppConfig;
  database: Database;
};

export function buildApp({ config, database }: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: config.nodeEnv === 'test' ? false : { level: config.logLevel },
    bodyLimit: 1_048_576,
    trustProxy: false,
  });

  app.get('/', async () => ({
    service: 'grantdesk-schoolwide',
    version: 'sw-010',
    status: 'foundation',
  }));

  app.get('/health/live', async () => ({
    status: 'ok',
    service: 'grantdesk-schoolwide',
    instanceId: config.instanceId,
  }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await database.query('SELECT 1 AS ready');
      return { status: 'ready', service: 'grantdesk-schoolwide' };
    } catch {
      reply.code(503);
      return { status: 'not-ready', service: 'grantdesk-schoolwide' };
    }
  });

  app.addHook('onClose', async () => {
    await database.close();
  });

  return app;
}
