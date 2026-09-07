import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from './authorization.js';
import { StaffAuthenticationService } from './service.js';
import { AuthenticationError, AuthorizationError } from './types.js';

const signInBodySchema = z.object({ assertion: z.string().min(1).max(16_384) }).strict();
const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

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

export type RegisterStaffAuthRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
};

export function registerStaffAuthRoutes(
  app: FastifyInstance,
  { authentication, authorization }: RegisterStaffAuthRoutesOptions,
): void {
  app.post('/auth/session', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const parsed = signInBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'A valid identity assertion is required.', correlationId };
    }

    try {
      const session = await authentication.signIn(parsed.data.assertion, correlationId);
      reply.code(201);
      return { ...session, correlationId };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.post('/auth/session/rotate', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    try {
      const session = await authentication.rotate(bearerToken(request), correlationId);
      return { ...session, correlationId };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.delete('/auth/session', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    try {
      const token = bearerToken(request);
      await authentication.authenticate(token);
      await authentication.signOut(token);
      reply.code(204).send();
      return;
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.get('/api/me', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      return {
        userId: principal.userId,
        organizationId: principal.organizationId,
        identityProvider: principal.identityProvider,
        roleGrants: principal.roleGrants,
        correlationId,
      };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.get('/api/sections/:sectionId/teacher-context', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = z.object({ sectionId: idSchema }).safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: 'Invalid section identifier.', correlationId };
    }

    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const scope = await authorization.requireSectionCapability(
        principal,
        params.data.sectionId,
        'teacher.section.read',
      );
      return { allowed: true, capability: 'teacher.section.read', ...scope, correlationId };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.get('/api/schools/:schoolId/security-context', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = z.object({ schoolId: idSchema }).safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: 'Invalid school identifier.', correlationId };
    }

    try {
      const principal = await authentication.authenticate(bearerToken(request));
      authorization.requireSchoolCapability(principal, params.data.schoolId, 'security.live.read');
      return {
        allowed: true,
        capability: 'security.live.read',
        schoolId: params.data.schoolId,
        correlationId,
      };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });

  app.get('/api/schools/:schoolId/admin-context', async (request, reply) => {
    const correlationId = correlationIdFor(request, reply);
    const params = z.object({ schoolId: idSchema }).safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: 'Invalid school identifier.', correlationId };
    }

    try {
      const principal = await authentication.authenticate(bearerToken(request));
      authorization.requireSchoolCapability(principal, params.data.schoolId, 'admin.school.read_all_operational');
      return {
        allowed: true,
        capability: 'admin.school.read_all_operational',
        schoolId: params.data.schoolId,
        correlationId,
      };
    } catch (error) {
      if (sendKnownAuthError(reply, error, correlationId)) return;
      throw error;
    }
  });
}
