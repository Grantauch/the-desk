import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { AuditCorrectionService } from './service.js';
import { AuditCorrectionError } from './types.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const paramsSchema = z.object({ passId: idSchema }).strict();
const correctionBodySchema = z.object({
  type: z.enum(['VOID_COUNTABILITY', 'RESTORE_COUNTABILITY']),
  reason: z.string().trim().min(1).max(1000),
}).strict();
const historyQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }).strict();

function correlationIdFor(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const correlationId = typeof supplied === 'string' && idSchema.safeParse(supplied).success ? supplied : randomUUID();
  reply.header('x-correlation-id', correlationId);
  return correlationId;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
}

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new AuthenticationError();
  return token;
}

function sendError(reply: FastifyReply, error: unknown, correlationId: string): boolean {
  if (error instanceof AuditCorrectionError) {
    reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId: correlationId, retryable: error.retryable });
    return true;
  }
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({
      code: error instanceof AuthenticationError ? 'AUTH_REQUIRED' : 'SECTION_SCOPE_DENIED',
      message: error.message,
      requestId: correlationId,
      retryable: false,
    });
    return true;
  }
  return false;
}

export type RegisterAuditCorrectionRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  corrections: AuditCorrectionService;
};

export function registerAuditCorrectionRoutes(
  app: FastifyInstance,
  { authentication, authorization, corrections }: RegisterAuditCorrectionRoutesOptions,
): void {
  app.post('/api/v1/teacher/passes/:passId/corrections', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = paramsSchema.safeParse(request.params);
    const body = correctionBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) {
      reply.code(400);
      return { code: 'PASS_CORRECTION_REQUEST_INVALID', message: 'A valid correction, reason, and Idempotency-Key are required.', requestId: correlationId, retryable: false };
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await corrections.passScope(params.data.passId);
      await authorization.requireSectionCapability(principal, scope.sectionId, 'teacher.section.pass_correct');
      const result = await corrections.correctPass({ actorUserId: principal.userId, passId: params.data.passId, correctionType: body.data.type, reasonPrivate: body.data.reason, idempotencyKey: key, correlationId });
      reply.code(201);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.get('/api/v1/teacher/passes/:passId/history', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = paramsSchema.safeParse(request.params);
    const query = historyQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      reply.code(400);
      return { code: 'PASS_HISTORY_REQUEST_INVALID', message: 'A valid bounded history request is required.', requestId: correlationId, retryable: false };
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await corrections.passScope(params.data.passId);
      await authorization.requireSectionCapability(principal, scope.sectionId, 'teacher.section.pass_review');
      const result = await corrections.passHistory(params.data.passId, query.data.limit ?? 50);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.post('/api/v1/admin/passes/:passId/corrections', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = paramsSchema.safeParse(request.params);
    const body = correctionBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) {
      reply.code(400);
      return { code: 'PASS_CORRECTION_REQUEST_INVALID', message: 'A valid correction, reason, and Idempotency-Key are required.', requestId: correlationId, retryable: false };
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await corrections.passScope(params.data.passId);
      authorization.requireSchoolCapability(principal, scope.schoolId, 'admin.pass.correct');
      const result = await corrections.correctPass({ actorUserId: principal.userId, passId: params.data.passId, correctionType: body.data.type, reasonPrivate: body.data.reason, idempotencyKey: key, correlationId });
      reply.code(201);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.get('/api/v1/admin/passes/:passId/history', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = paramsSchema.safeParse(request.params);
    const query = historyQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      reply.code(400);
      return { code: 'PASS_HISTORY_REQUEST_INVALID', message: 'A valid bounded history request is required.', requestId: correlationId, retryable: false };
    }
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await corrections.passScope(params.data.passId);
      authorization.requireSchoolCapability(principal, scope.schoolId, 'admin.audit.read_bounded');
      const result = await corrections.passHistory(params.data.passId, query.data.limit ?? 50);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendError(reply, error, correlationId)) return;
      throw error;
    }
  });
}
