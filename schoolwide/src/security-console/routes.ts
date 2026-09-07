import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { SecurityConsoleService } from './service.js';
import { SecurityConsoleError } from './types.js';
import { securityConsoleHtml } from './ui.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const liveQuerySchema = z.object({
  destinationId: idSchema.optional(),
  sectionId: idSchema.optional(),
  teacherUserId: idSchema.optional(),
  warning: z.enum(['NONE', 'LATE', 'STALE', 'UNCONFIGURED']).optional(),
}).strict();
const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
const passParamsSchema = z.object({ passId: idSchema }).strict();
const actionBodySchema = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new AuthenticationError();
  return token;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
}

function correlationIdFor(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const correlationId = typeof supplied === 'string' && idSchema.safeParse(supplied).success ? supplied : randomUUID();
  reply.header('x-correlation-id', correlationId);
  return correlationId;
}

function sendError(reply: FastifyReply, error: unknown, requestId: string): boolean {
  if (error instanceof SecurityConsoleError) {
    reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId, retryable: error.retryable });
    return true;
  }
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({
      code: error instanceof AuthenticationError ? 'AUTH_REQUIRED' : 'SECURITY_SCOPE_DENIED',
      message: error.message,
      requestId,
      retryable: false,
    });
    return true;
  }
  return false;
}

export type RegisterSecurityConsoleRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  securityConsole: SecurityConsoleService;
};

export function registerSecurityConsoleRoutes(
  app: FastifyInstance,
  { authentication, authorization, securityConsole }: RegisterSecurityConsoleRoutesOptions,
): void {
  app.get('/security', async (_request, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    reply.header('cache-control', 'no-store');
    reply.header('content-security-policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    return securityConsoleHtml();
  });

  app.get('/api/v1/security/live-passes', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const query = liveQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ code: 'SECURITY_REQUEST_INVALID', message: 'Live movement filters are invalid.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const schoolId = securityConsole.resolveSchoolId(principal, 'security.live.read');
      authorization.requireSchoolCapability(principal, schoolId, 'security.live.read');
      const board = await securityConsole.liveBoard({ principal, ...query.data });
      return { ...board, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.get('/api/v1/security/students/search', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const query = searchQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ code: 'SECURITY_REQUEST_INVALID', message: 'A 2–100 character student search is required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const schoolId = securityConsole.resolveSchoolId(principal, 'security.student.lookup_live');
      authorization.requireSchoolCapability(principal, schoolId, 'security.student.lookup_live');
      return { ...(await securityConsole.searchStudents(principal, query.data.q, query.data.limit)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/security/passes/:passId/located', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = passParamsSchema.safeParse(request.params);
    const body = actionBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) {
      return reply.code(400).send({ code: 'SECURITY_REQUEST_INVALID', message: 'A valid active pass, private note, and Idempotency-Key are required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await securityConsole.passScope(params.data.passId);
      authorization.requireSchoolCapability(principal, scope.schoolId, 'security.pass.mark_located');
      const result = await securityConsole.markLocated({
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        schoolId: scope.schoolId,
        passId: params.data.passId,
        reasonPrivate: body.data.reason,
        idempotencyKey: key,
        correlationId: requestId,
      });
      reply.code(201);
      return { ...result, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/security/passes/:passId/request-return', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = passParamsSchema.safeParse(request.params);
    const body = actionBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) {
      return reply.code(400).send({ code: 'SECURITY_REQUEST_INVALID', message: 'A valid active pass, private note, and Idempotency-Key are required.', requestId, retryable: false });
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await securityConsole.passScope(params.data.passId);
      authorization.requireSchoolCapability(principal, scope.schoolId, 'security.pass.request_return');
      const result = await securityConsole.requestReturn({
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        schoolId: scope.schoolId,
        passId: params.data.passId,
        reasonPrivate: body.data.reason,
        idempotencyKey: key,
        correlationId: requestId,
      });
      reply.code(201);
      return { ...result, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });
}
