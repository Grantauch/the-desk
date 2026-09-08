import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { StaffAuthorizationService } from '../auth/authorization.js';
import type { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import type { Database } from '../db/database.js';
import type { StudentIdentityProvider } from '../student-credentials/types.js';
import type { OperationsHealthService } from './operations-service.js';
import type { RealtimeBroker, RealtimeEnvelope, RealtimeLane } from './types.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new AuthenticationError();
  return token;
}

function studentAssertion(request: FastifyRequest): string {
  const value = request.headers['x-student-identity-assertion'];
  return typeof value === 'string' ? value : '';
}

function sendAuthError(reply: FastifyReply, error: unknown): boolean {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({ error: error.message });
    return true;
  }
  return false;
}

function writeSse(reply: FastifyReply, event: RealtimeEnvelope): void {
  reply.raw.write(`id: ${event.id}\nevent: invalidate\ndata: ${JSON.stringify(event)}\n\n`);
}

function openStream(request: FastifyRequest, reply: FastifyReply, broker: RealtimeBroker, lane: RealtimeLane): void {
  reply.hijack();
  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-store, must-revalidate',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  reply.raw.write('retry: 5000\n\n');
  const unsubscribe = broker.subscribe(lane, (event) => writeSse(reply, event));
  const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
  heartbeat.unref();
  request.raw.once('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

export function registerRealtimeRoutes(app: FastifyInstance, options: {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  studentIdentityProvider: StudentIdentityProvider;
  database: Database;
  broker: RealtimeBroker;
  health: OperationsHealthService;
}): void {
  app.get('/api/v1/realtime/teacher/sections/:sectionId/events', async (request, reply) => {
    const parsed = z.object({ sectionId: idSchema }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid section identifier.' });
    try {
      const principal = await options.authentication.authenticate(bearerToken(request));
      const scope = await options.authorization.requireSectionCapability(principal, parsed.data.sectionId, 'teacher.section.live_state');
      openStream(request, reply, options.broker, { kind: 'TEACHER_SECTION', schoolId: scope.schoolId, sectionId: scope.sectionId });
      return;
    } catch (error) {
      if (sendAuthError(reply, error)) return;
      throw error;
    }
  });

  app.get('/api/v1/realtime/security/schools/:schoolId/events', async (request, reply) => {
    const parsed = z.object({ schoolId: idSchema }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid school identifier.' });
    try {
      const principal = await options.authentication.authenticate(bearerToken(request));
      options.authorization.requireSchoolCapability(principal, parsed.data.schoolId, 'security.live.read');
      openStream(request, reply, options.broker, { kind: 'SECURITY_SCHOOL', schoolId: parsed.data.schoolId });
      return;
    } catch (error) {
      if (sendAuthError(reply, error)) return;
      throw error;
    }
  });

  app.get('/api/v1/realtime/admin/schools/:schoolId/events', async (request, reply) => {
    const parsed = z.object({ schoolId: idSchema }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid school identifier.' });
    try {
      const principal = await options.authentication.authenticate(bearerToken(request));
      options.authorization.requireSchoolCapability(principal, parsed.data.schoolId, 'admin.school.read_all_operational');
      openStream(request, reply, options.broker, { kind: 'ADMIN_SCHOOL', schoolId: parsed.data.schoolId });
      return;
    } catch (error) {
      if (sendAuthError(reply, error)) return;
      throw error;
    }
  });

  app.get('/api/v1/realtime/student/events', async (request, reply) => {
    try {
      const verified = await options.studentIdentityProvider.verify(studentAssertion(request));
      const rows = await options.database.query<{ school_id: string }>(
        `SELECT school_id FROM students WHERE id=$1 AND status='ACTIVE' LIMIT 1`,
        [verified.studentId],
      );
      const student = rows[0];
      if (!student) return reply.code(401).send({ error: 'Student authentication required.' });
      openStream(request, reply, options.broker, { kind: 'STUDENT_SELF', schoolId: student.school_id, studentId: verified.studentId });
      return;
    } catch {
      return reply.code(401).send({ error: 'Student authentication required.' });
    }
  });

  app.get('/health/operations', async (_request, reply) => {
    try {
      const snapshot = await options.health.snapshot();
      if (snapshot.status === 'DEGRADED') reply.code(503);
      return snapshot;
    } catch {
      reply.code(503);
      return { status: 'DEGRADED', error: 'OPERATIONS_HEALTH_UNAVAILABLE' };
    }
  });
}
