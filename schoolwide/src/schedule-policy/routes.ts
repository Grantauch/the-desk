import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { SchedulePolicyService } from './service.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const paramsSchema = z.object({ sectionId: idSchema }).strict();
const querySchema = z.object({
  at: z.string().datetime({ offset: true }).optional(),
  studentId: idSchema.optional(),
}).strict();

function correlationIdFor(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const correlationId = typeof supplied === 'string' && idSchema.safeParse(supplied).success
    ? supplied
    : randomUUID();
  reply.header('x-correlation-id', correlationId);
  return correlationId;
}

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new AuthenticationError();
  return token;
}

function sendKnownAuthError(reply: FastifyReply, error: unknown, correlationId: string): boolean {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({ error: error.message, correlationId });
    return true;
  }
  return false;
}

export type RegisterSchedulePolicyRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  schedulePolicy: SchedulePolicyService;
};

export function registerSchedulePolicyRoutes(
  app: FastifyInstance,
  { authentication, authorization, schedulePolicy }: RegisterSchedulePolicyRoutesOptions,
): void {
  app.get('/api/sections/:sectionId/schedule-policy-context', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = paramsSchema.safeParse(request.params);
    const query = querySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      reply.code(400);
      return { error: 'Invalid schedule/policy context request.', correlationId };
    }

    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await authorization.requireSectionCapability(
        principal,
        params.data.sectionId,
        'teacher.section.read',
      );
      const at = query.data.at ? new Date(query.data.at) : new Date();
      const contextInput: { sectionId: string; at: Date; studentId?: string } = {
        sectionId: scope.sectionId,
        at,
      };
      if (query.data.studentId !== undefined) contextInput.studentId = query.data.studentId;
      const context = await schedulePolicy.resolveContext(contextInput);
      return { ...context, correlationId };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });
}
