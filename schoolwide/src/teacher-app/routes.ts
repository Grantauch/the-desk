import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { HallPassService } from '../hall-pass/service.js';
import { HallPassError } from '../hall-pass/types.js';
import { TeacherApplicationService } from './service.js';
import { TeacherApplicationError } from './types.js';
import { teacherAppHtml } from './ui.js';

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const sectionParamsSchema = z.object({ sectionId: idSchema }).strict();
const passParamsSchema = z.object({ passId: idSchema }).strict();
const studentParamsSchema = z.object({ sectionId: idSchema, studentId: idSchema }).strict();
const policyParamsSchema = z.object({ sectionId: idSchema, policyKey: z.string().regex(/^[A-Z0-9_]+$/).max(100) }).strict();
const evidenceQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(25) }).strict();
const returnBodySchema = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();
const policyBodySchema = z.object({ value: z.unknown(), reason: z.string().trim().min(1).max(1000) }).strict();
const accessBodySchema = z.object({
  studentId: idSchema,
  accessMode: z.enum(['STANDARD', 'UNLIMITED', 'ESCORT_ONLY']),
  reason: z.string().trim().min(1).max(1000),
}).strict();

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
  if (error instanceof TeacherApplicationError || error instanceof HallPassError) {
    reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId, retryable: error.retryable });
    return true;
  }
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({
      code: error instanceof AuthenticationError ? 'AUTH_REQUIRED' : 'SECTION_SCOPE_DENIED',
      message: error.message, requestId, retryable: false,
    });
    return true;
  }
  return false;
}

export type RegisterTeacherApplicationRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  teacherApp: TeacherApplicationService;
  hallPass: HallPassService;
};

export function registerTeacherApplicationRoutes(
  app: FastifyInstance,
  { authentication, authorization, teacherApp, hallPass }: RegisterTeacherApplicationRoutesOptions,
): void {
  app.get('/teacher', async (_request, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    reply.header('cache-control', 'no-store');
    reply.header('content-security-policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    return teacherAppHtml();
  });

  app.get('/api/v1/teacher/sections', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      return { sections: await teacherApp.assignedSections(principal), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.get('/api/v1/teacher/sections/:sectionId/live', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = sectionParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'TEACHER_REQUEST_INVALID', message: 'A valid section is required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      await authorization.requireSectionCapability(principal, params.data.sectionId, 'teacher.section.live_state');
      return { ...(await teacherApp.liveSection(params.data.sectionId)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.get('/api/v1/teacher/sections/:sectionId/students/:studentId/pass-evidence', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = studentParamsSchema.safeParse(request.params);
    const query = evidenceQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ code: 'TEACHER_REQUEST_INVALID', message: 'A valid evidence request is required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      await authorization.requireSectionCapability(principal, params.data.sectionId, 'teacher.section.pass_review');
      return { ...(await teacherApp.studentPassEvidence(params.data.sectionId, params.data.studentId, query.data.limit)), requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/teacher/passes/:passId/return', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = passParamsSchema.safeParse(request.params);
    const body = returnBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) return reply.code(400).send({ code: 'TEACHER_REQUEST_INVALID', message: 'A valid pass return, reason, and Idempotency-Key are required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const passScope = await teacherApp.passScope(params.data.passId);
      const scope = await authorization.requireSectionCapability(principal, passScope.sectionId, 'teacher.section.pass_return');
      const result = await hallPass.teacherReturnPass({
        actorUserId: principal.userId, passId: params.data.passId, sectionId: scope.sectionId,
        reasonPrivate: body.data.reason, idempotencyKey: key, correlationId: requestId,
      });
      return { ...result, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/teacher/sections/:sectionId/policy-overrides/:policyKey', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = policyParamsSchema.safeParse(request.params);
    const body = policyBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) return reply.code(400).send({ code: 'TEACHER_REQUEST_INVALID', message: 'A valid policy override, reason, and Idempotency-Key are required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      await authorization.requireSectionCapability(principal, params.data.sectionId, 'teacher.section.policy_override');
      const result = await teacherApp.setPolicyOverride({
        actorUserId: principal.userId, sectionId: params.data.sectionId, policyKey: params.data.policyKey,
        value: body.data.value, reasonPrivate: body.data.reason, idempotencyKey: key, correlationId: requestId,
      });
      reply.code(201);
      return { ...result, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/teacher/sections/:sectionId/student-access', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = sectionParamsSchema.safeParse(request.params);
    const body = accessBodySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success || !key) return reply.code(400).send({ code: 'TEACHER_REQUEST_INVALID', message: 'A valid student-access change, reason, and Idempotency-Key are required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      await authorization.requireSectionCapability(principal, params.data.sectionId, 'teacher.section.student_access');
      const result = await teacherApp.setStudentAccess({
        actorUserId: principal.userId, sectionId: params.data.sectionId, studentId: body.data.studentId,
        accessMode: body.data.accessMode, reasonPrivate: body.data.reason, idempotencyKey: key, correlationId: requestId,
      });
      reply.code(201);
      return { ...result, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/teacher/sections/:sectionId/passes/start-override', async (request, reply) => {
    const requestId = correlationIdFor(request, reply);
    const params = sectionParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'TEACHER_REQUEST_INVALID', message: 'A valid section is required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      await authorization.requireSectionCapability(principal, params.data.sectionId, 'teacher.section.pass_start');
      return reply.code(409).send({
        code: 'TEACHER_PASS_START_POLICY_UNAVAILABLE',
        message: 'Teacher-start pass authorization is fail-closed until an explicit school policy and truthful start-attribution schema are approved.',
        requestId, retryable: false,
      });
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });
}
