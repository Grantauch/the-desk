import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { StudentIdentityProvider } from '../student-credentials/types.js';
import { HallPassService } from './service.js';
import { HallPassError } from './types.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const requestBodySchema = z.object({
  actionProof: z.string().min(1).max(512),
  sectionId: idSchema,
  destinationId: idSchema,
}).strict();
const returnBodySchema = z.object({ actionProof: z.string().min(1).max(512) }).strict();
const cancelParamsSchema = z.object({ requestId: idSchema }).strict();

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

function identityAssertion(request: FastifyRequest): string | null {
  const value = request.headers['x-student-identity-assertion'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sendHallPassError(reply: FastifyReply, error: unknown, correlationId: string): boolean {
  if (!(error instanceof HallPassError)) return false;
  reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId: correlationId, retryable: error.retryable });
  return true;
}

export function registerHallPassRoutes(
  app: FastifyInstance,
  options: { hallPass: HallPassService; studentIdentityProvider: StudentIdentityProvider },
): void {
  app.post('/api/v1/passes/requests', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const body = requestBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!body.success || !key) {
      reply.code(400);
      return { code: 'PASS_REQUEST_INVALID', message: 'A valid pass request and Idempotency-Key are required.', requestId: correlationId, retryable: false };
    }
    try {
      const result = await options.hallPass.requestPass({ ...body.data, idempotencyKey: key, correlationId });
      reply.code(201);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendHallPassError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.post('/api/v1/student/passes/active/return', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const body = returnBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!body.success || !key) {
      reply.code(400);
      return { code: 'PASS_RETURN_INVALID', message: 'A valid return request and Idempotency-Key are required.', requestId: correlationId, retryable: false };
    }
    try {
      const result = await options.hallPass.returnActivePass({ actionProof: body.data.actionProof, idempotencyKey: key, correlationId });
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendHallPassError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.post('/api/v1/passes/requests/:requestId/cancel', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = cancelParamsSchema.safeParse(request.params);
    const key = idempotencyKey(request);
    const assertion = identityAssertion(request);
    if (!params.success || !key || !assertion) {
      reply.code(400);
      return { code: 'PASS_CANCEL_INVALID', message: 'A valid owned waiting request, student identity, and Idempotency-Key are required.', requestId: correlationId, retryable: false };
    }
    try {
      let identity;
      try {
        identity = await options.studentIdentityProvider.verify(assertion);
      } catch {
        throw new HallPassError('STUDENT_AUTH_REQUIRED', 'Student identity is required.', 401);
      }
      const result = await options.hallPass.cancelQueuedRequest({ studentId: identity.studentId, passRequestId: params.data.requestId, idempotencyKey: key, correlationId });
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendHallPassError(reply, error, correlationId)) return;
      throw error;
    }
  });
}
