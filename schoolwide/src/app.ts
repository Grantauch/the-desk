import Fastify, { type FastifyInstance } from 'fastify';
import { StaffAuthorizationService } from './auth/authorization.js';
import { DisabledStaffIdentityProvider } from './auth/provider.js';
import { registerStaffAuthRoutes } from './auth/routes.js';
import { StaffAuthenticationService } from './auth/service.js';
import type { StaffIdentityProvider } from './auth/types.js';
import type { AppConfig } from './config.js';
import type { Database } from './db/database.js';
import { registerSchedulePolicyRoutes } from './schedule-policy/routes.js';
import { SchedulePolicyService } from './schedule-policy/service.js';

export type BuildAppOptions = {
  config: AppConfig;
  database: Database;
  identityProvider?: StaffIdentityProvider;
  sessionTtlMs?: number;
};

export function buildApp({
  config,
  database,
  identityProvider = new DisabledStaffIdentityProvider(),
  sessionTtlMs,
}: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: config.nodeEnv === 'test' ? false : { level: config.logLevel },
    bodyLimit: 1_048_576,
    trustProxy: false,
  });

  const authenticationOptions = sessionTtlMs === undefined ? {} : { sessionTtlMs };
  const authentication = new StaffAuthenticationService(database, identityProvider, authenticationOptions);
  const authorization = new StaffAuthorizationService(database);
  const schedulePolicy = new SchedulePolicyService(database);
  registerStaffAuthRoutes(app, { authentication, authorization });
  registerSchedulePolicyRoutes(app, { authentication, authorization, schedulePolicy });

  app.get('/', async () => ({
    service: 'grantdesk-schoolwide',
    version: 'sw-040',
    status: 'schedule-policy-services',
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
