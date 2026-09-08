import Fastify, { type FastifyInstance } from 'fastify';
import { registerAdminConsoleRoutes } from './admin-console/routes.js';
import { AdminConsoleService } from './admin-console/service.js';
import { registerAdminStructureRoutes } from './admin-console/structure-routes.js';
import { AdminStructureService } from './admin-console/structure.js';
import type { AdminConsoleServiceOptions } from './admin-console/types.js';
import { registerAuditCorrectionRoutes } from './audit-corrections/routes.js';
import { AuditCorrectionService } from './audit-corrections/service.js';
import type { AuditCorrectionServiceOptions } from './audit-corrections/types.js';
import { StaffAuthorizationService } from './auth/authorization.js';
import { DisabledStaffIdentityProvider } from './auth/provider.js';
import { registerStaffAuthRoutes } from './auth/routes.js';
import { StaffAuthenticationService } from './auth/service.js';
import type { StaffIdentityProvider } from './auth/types.js';
import { DisabledClassroomProvider } from './classroom/provider.js';
import { registerClassroomRoutes } from './classroom/routes.js';
import { ClassroomIntegrationService, type ClassroomIntegrationServiceOptions } from './classroom/service.js';
import type { ClassroomProvider } from './classroom/types.js';
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
import { registerSecurityConsoleRoutes } from './security-console/routes.js';
import { SecurityConsoleService } from './security-console/service.js';
import type { SecurityConsoleServiceOptions } from './security-console/types.js';
import { DisabledStudentIdentityProvider } from './student-credentials/provider.js';
import { registerStudentCredentialRoutes } from './student-credentials/routes.js';
import { StudentCredentialService, type StudentCredentialServiceOptions } from './student-credentials/service.js';
import type { StudentIdentityProvider } from './student-credentials/types.js';
import { registerTeacherApplicationRoutes } from './teacher-app/routes.js';
import { TeacherApplicationService } from './teacher-app/service.js';
import type { TeacherApplicationServiceOptions } from './teacher-app/types.js';

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
  teacherApplicationOptions?: TeacherApplicationServiceOptions;
  classroomProvider?: ClassroomProvider;
  classroomOptions?: ClassroomIntegrationServiceOptions;
  securityConsoleOptions?: SecurityConsoleServiceOptions;
  adminConsoleOptions?: AdminConsoleServiceOptions;
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
  teacherApplicationOptions,
  classroomProvider = new DisabledClassroomProvider(),
  classroomOptions,
  securityConsoleOptions,
  adminConsoleOptions,
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
  const teacherApp = new TeacherApplicationService(database, schedulePolicy, teacherApplicationOptions ?? {});
  const classroom = new ClassroomIntegrationService(database, classroomProvider, classroomOptions ?? {});
  const securityConsole = new SecurityConsoleService(database, securityConsoleOptions ?? {});
  const adminConsole = new AdminConsoleService(database, adminConsoleOptions ?? {});
  const adminNow = adminConsoleOptions?.now ?? (() => new Date());
  const adminStructure = new AdminStructureService(database, adminNow);

  registerStaffAuthRoutes(app, { authentication, authorization });
  registerSchedulePolicyRoutes(app, { authentication, authorization, schedulePolicy });
  registerStudentCredentialRoutes(app, studentCredentials);
  registerCheckInRoutes(app, { authentication, authorization, checkins });
  registerHallPassRoutes(app, { hallPass, studentIdentityProvider });
  registerAuditCorrectionRoutes(app, { authentication, authorization, corrections });
  registerTeacherApplicationRoutes(app, { authentication, authorization, teacherApp, hallPass });
  registerClassroomRoutes(app, { authentication, authorization, classroom });
  registerSecurityConsoleRoutes(app, { authentication, authorization, securityConsole });
  registerAdminConsoleRoutes(app, { authentication, authorization, adminConsole });
  registerAdminStructureRoutes(app, { authentication, authorization, adminConsole, structure: adminStructure });

  app.get('/', async () => ({
    service: 'grantdesk-schoolwide',
    version: 'sw-120',
    status: 'admin-console',
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
