import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { CheckInService } from './service.js';
import { CheckInError } from './types.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const studentBodySchema = z.object({
  actionProof: z.string().min(1).max(512),
  sectionId: idSchema,
}).strict();
const teacherParamsSchema = z.object({ sectionId: idSchema }).strict();
const teacherBodySchema = z.object({
  studentId: idSchema,
  note: z.string().max(1000).optional(),
}).strict();

function correlationIdFor(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const correlationId = typeof supplied === 'string' && idSchema.safeParse(supplied).success
    ? supplied
    : randomUUID();
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

function sendCheckInError(reply: FastifyReply, error: unknown, correlationId: string): boolean {
  if (error instanceof CheckInError) {
    reply.code(error.statusCode).send({
      code: error.code,
      message: error.message,
      requestId: correlationId,
      retryable: error.retryable,
    });
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

export type RegisterCheckInRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  checkins: CheckInService;
};

export function registerCheckInRoutes(
  app: FastifyInstance,
  { authentication, authorization, checkins }: RegisterCheckInRoutesOptions,
): void {
  app.post('/api/v1/checkins', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const parsed = studentBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!parsed.success || !key) {
      reply.code(400);
      return {
        code: 'CHECKIN_REQUEST_INVALID',
        message: 'A valid Check-In request and Idempotency-Key are required.',
        requestId: correlationId,
        retryable: false,
      };
    }

    try {
      const result = await checkins.studentCheckIn({
        actionProof: parsed.data.actionProof,
        sectionId: parsed.data.sectionId,
        idempotencyKey: key,
        correlationId,
      });
      reply.code(result.created ? 201 : 200);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendCheckInError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.post('/api/v1/teacher/sections/:sectionId/checkins', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = teacherParamsSchema.safeParse(request.params);
    const body = teacherBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) {
      reply.code(400);
      return {
        code: 'CHECKIN_REQUEST_INVALID',
        message: 'A valid teacher Check-In request and Idempotency-Key are required.',
        requestId: correlationId,
        retryable: false,
      };
    }

    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await authorization.requireSectionCapability(
        principal,
        params.data.sectionId,
        'teacher.section.attendance_backup',
      );
      const result = await checkins.teacherBackupCheckIn({
        actorUserId: principal.userId,
        sectionId: scope.sectionId,
        studentId: body.data.studentId,
        idempotencyKey: key,
        correlationId,
        ...(body.data.note === undefined ? {} : { note: body.data.note }),
      });
      reply.code(result.created ? 201 : 200);
      return { ...result, requestId: correlationId };
    } catch (error) {
      if (sendCheckInError(reply, error, correlationId)) return;
      throw error;
    }
  });
}
