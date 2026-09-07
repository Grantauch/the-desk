import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { ClassroomIntegrationService } from './service.js';
import { ClassroomIntegrationError } from './types.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const schoolQuery = z.object({ schoolId: idSchema }).strict();
const startBody = z.object({ schoolId: idSchema, redirectUri: z.string().url().max(2000) }).strict();
const callbackQuery = z.object({ state: z.string().min(20).max(500), code: z.string().min(1).max(4000) }).strict();
const selection = z.object({ courseId: z.string().trim().min(1).max(200), sectionId: idSchema.optional() }).strict();
const previewBody = z.object({ schoolId: idSchema, selections: z.array(selection).min(1).max(50) }).strict();
const commitBody = previewBody.extend({ expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
const linkParams = z.object({ linkId: idSchema }).strict();
const runParams = z.object({ id: idSchema }).strict();

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
  const token = header.slice(7).trim();
  if (!token) throw new AuthenticationError();
  return token;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200 ? value.trim() : null;
}

function correlationId(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const value = typeof supplied === 'string' && idSchema.safeParse(supplied).success ? supplied : randomUUID();
  reply.header('x-correlation-id', value);
  return value;
}

function sendError(reply: FastifyReply, error: unknown, requestId: string): boolean {
  if (error instanceof ClassroomIntegrationError) {
    reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId, retryable: error.retryable });
    return true;
  }
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({
      code: error instanceof AuthenticationError ? 'AUTH_REQUIRED' : 'SECTION_SCOPE_DENIED',
      message: error.message,
      requestId,
      retryable: false,
    });
    return true;
  }
  return false;
}

export function registerClassroomRoutes(
  app: FastifyInstance,
  {
    authentication,
    authorization,
    classroom,
  }: {
    authentication: StaffAuthenticationService;
    authorization: StaffAuthorizationService;
    classroom: ClassroomIntegrationService;
  },
): void {
  app.post('/api/v1/integrations/classroom/connect/start', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const body = startBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ code: 'CLASSROOM_REQUEST_INVALID', message: 'A school and redirect URI are required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      authorization.requireSchoolCapability(principal, body.data.schoolId, 'teacher.classroom.connect');
      return { ...(await classroom.startConnect(principal, body.data.schoolId, body.data.redirectUri)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.get('/api/v1/integrations/classroom/connect/callback', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const query = callbackQuery.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ code: 'CLASSROOM_OAUTH_CALLBACK_INVALID', message: 'Classroom OAuth callback is invalid.', requestId, retryable: false });
    }
    try {
      return { ...(await classroom.completeConnect(query.data.state, query.data.code, requestId)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.get('/api/v1/integrations/classroom/courses', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const query = schoolQuery.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ code: 'CLASSROOM_REQUEST_INVALID', message: 'A valid school is required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      authorization.requireSchoolCapability(principal, query.data.schoolId, 'teacher.classroom.import');
      return { ...(await classroom.discoverCourses(principal, query.data.schoolId)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/integrations/classroom/import/preview', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const body = previewBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ code: 'CLASSROOM_REQUEST_INVALID', message: 'A valid Classroom import selection is required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      authorization.requireSchoolCapability(principal, body.data.schoolId, 'teacher.classroom.import');
      for (const item of body.data.selections) {
        if (item.sectionId) await authorization.requireSectionCapability(principal, item.sectionId, 'teacher.section.read');
      }
      return { ...(await classroom.preview(principal, body.data.schoolId, body.data.selections)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/integrations/classroom/import/commit', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const body = commitBody.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!body.success || !key) {
      return reply.code(400).send({ code: 'CLASSROOM_REQUEST_INVALID', message: 'A valid Classroom import, preview fingerprint, and Idempotency-Key are required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      authorization.requireSchoolCapability(principal, body.data.schoolId, 'teacher.classroom.import');
      for (const item of body.data.selections) {
        if (item.sectionId) await authorization.requireSectionCapability(principal, item.sectionId, 'teacher.section.read');
      }
      return {
        ...(await classroom.commitImport({
          principal,
          schoolId: body.data.schoolId,
          selections: body.data.selections,
          expectedFingerprint: body.data.expectedFingerprint,
          idempotencyKey: key,
          correlationId: requestId,
        })),
        requestId,
      };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/integrations/classroom/links/:linkId/sync', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const params = linkParams.safeParse(request.params);
    const key = idempotencyKey(request);
    if (!params.success || !key) {
      return reply.code(400).send({ code: 'CLASSROOM_REQUEST_INVALID', message: 'A valid Classroom link and Idempotency-Key are required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await classroom.linkScope(params.data.linkId);
      if (scope.connectionUserId !== principal.userId) throw new AuthorizationError();
      await authorization.requireSectionCapability(principal, scope.sectionId, 'teacher.classroom.sync');
      return { ...(await classroom.syncLink({ principal, linkId: params.data.linkId, idempotencyKey: key, correlationId: requestId })), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.get('/api/v1/integrations/classroom/sync-runs/:id', async (request, reply) => {
    const requestId = correlationId(request, reply);
    const params = runParams.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: 'CLASSROOM_REQUEST_INVALID', message: 'A valid sync run is required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      return { ...(await classroom.getSyncRun(principal, params.data.id)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });
}
