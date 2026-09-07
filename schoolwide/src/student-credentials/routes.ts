import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StudentCredentialService } from './service.js';
import { StudentCredentialError, studentActionValues } from './types.js';

const idSchema = z.string().uuid();
const bodySchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
  action: z.enum(studentActionValues),
  sectionId: idSchema.optional(),
  clientAttemptNonce: z.string().min(1).max(256).optional(),
}).strict();

function correlationIdFor(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const parsed = typeof supplied === 'string' ? idSchema.safeParse(supplied) : null;
  const correlationId = parsed?.success ? parsed.data : randomUUID();
  reply.header('x-correlation-id', correlationId);
  return correlationId;
}

function identityAssertion(request: FastifyRequest): string {
  const value = request.headers['x-student-identity-assertion'];
  return typeof value === 'string' ? value : '';
}

export function registerStudentCredentialRoutes(app: FastifyInstance, credentials: StudentCredentialService): void {
  app.post('/api/v1/student/actions/authorize', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        code: 'ACTION_AUTHORIZATION_INVALID',
        message: 'A valid action authorization request is required.',
        requestId: correlationId,
        retryable: false,
      };
    }

    try {
      const result = await credentials.authorizeAction({
        identityAssertion: identityAssertion(request),
        pin: parsed.data.pin,
        action: parsed.data.action,
        correlationId,
        ...(parsed.data.sectionId === undefined ? {} : { sectionId: parsed.data.sectionId }),
        ...(parsed.data.clientAttemptNonce === undefined ? {} : { clientAttemptNonce: parsed.data.clientAttemptNonce }),
      });
      reply.code(201);
      return {
        actionProof: result.proof,
        action: result.action,
        sectionId: result.sectionId,
        expiresAt: result.expiresAt,
        requestId: correlationId,
      };
    } catch (error) {
      if (!(error instanceof StudentCredentialError)) throw error;
      if (error.retryAfterSeconds !== undefined) reply.header('retry-after', String(error.retryAfterSeconds));
      reply.code(error.statusCode);
      return {
        code: error.code,
        message: error.message,
        requestId: correlationId,
        retryable: error.retryable,
      };
    }
  });
}
