import Fastify, { type FastifyInstance } from 'fastify';
import { AuditCorrectionService } from './audit-corrections/service.js';
import { registerAuditCorrectionRoutes } from './audit-corrections/routes.js';
import type { AuditCorrectionServiceOptions } from './audit-corrections/types.js';
import { StaffAuthorizationService } from './auth/authorization.js';
import { DisabledStaffIdentityProvider } from './auth/provider.js';
import { registerStaffAuthRoutes } from './auth/routes.js';
import { StaffAuthenticationService } from './auth/service.js';
import type { StaffIdentityProvider } from './auth/types.js';
import { registerCheckInRoutes } from './checkins/routes.js';
import { CheckInService } from './checkins/service.js';
import type { CheckInServiceOptions } from './checkins/types.js';
import type { AppConfig } from './config.js';
import type { Database } from './db/database.js';
import { registerHallPassRoutes } from './hall-pass/routes.js';
import { HallPassService } from './hall-pass/service.js';
import type { HallPassServiceOptions } from './hall-pass/types.js';
import { registerSchedulePolicyRoutes } from './schedule-policy/routes.js';
import { SchedulePolicyService } from './schedule-policy/service.js';
import { DisabledStudentIdentityProvider } from './student-credentials/provider.js';
import { registerStudentCredentialRoutes } from './student-credentials/routes.js';
import { StudentCredentialService, type StudentCredentialServiceOptions } from './student-credentials/service.js';
import type { StudentIdentityProvider } from './student-credentials/types.js';

export type BuildAppOptions = {
  config: AppConfig;
  database: Database;
  identityProvider?: StaffIdentityProvider;
  sessionTtlMs?: number;
  studentIdentityProvider?: StudentIdentityProvider;
  studentCredentialOptions?: StudentCredentialServiceOptions;
  checkInOptions?: CheckInServiceOptions;
  hallPassOptions?: HallPassServiceOptions;
  auditCorrectionOptions?: AuditCorrectionServiceOptions;
};

export function buildApp({
  config,
  database,
  identityProvider = new DisabledStaffIdentityProvider(),
  sessionTtlMs,
  studentIdentityProvider = new DisabledStudentIdentityProvider(),
  studentCredentialOptions,
  checkInOptions,
  hallPassOptions,
  auditCorrectionOptions,
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
  const studentCredentials = new StudentCredentialService(database, studentIdentityProvider, studentCredentialOptions ?? {});
  const checkins = new CheckInService(database, checkInOptions ?? {});
  const hallPass = new HallPassService(database, hallPassOptions ?? {});
  const corrections = new AuditCorrectionService(database, auditCorrectionOptions ?? {});
  registerStaffAuthRoutes(app, { authentication, authorization });
  registerSchedulePolicyRoutes(app, { authentication, authorization, schedulePolicy });
  registerStudentCredentialRoutes(app, studentCredentials);
  registerCheckInRoutes(app, { authentication, authorization, checkins });
  registerHallPassRoutes(app, { hallPass, studentIdentityProvider });
  registerAuditCorrectionRoutes(app, { authentication, authorization, corrections });

  app.get('/', async () => ({
    service: 'grantdesk-schoolwide',
    version: 'sw-080',
    status: 'audit-corrections',
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
