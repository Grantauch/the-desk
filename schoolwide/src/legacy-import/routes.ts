import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { LegacyReadOnlyImporterService } from './service.js';
import { LegacyImportError } from './types.js';

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);
const validateBody = z.object({ snapshot: z.unknown() }).strict();
const fingerprintBody = z.object({ snapshot: z.unknown(), sourceFingerprint: fingerprintSchema }).strict();

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
  const token = header.slice(7).trim();
  if (!token) throw new AuthenticationError();
  return token;
}

function requestIdFor(request: FastifyRequest, reply: FastifyReply): string {
  const supplied = request.headers['x-correlation-id'];
  const requestId = typeof supplied === 'string' && uuidSchema.safeParse(supplied).success ? supplied : randomUUID();
  reply.header('x-correlation-id', requestId);
  return requestId;
}

function sendError(reply: FastifyReply, error: unknown, requestId: string): boolean {
  if (error instanceof LegacyImportError) {
    reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId, retryable: error.retryable });
    return true;
  }
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    reply.code(error.statusCode).send({ code: error instanceof AuthenticationError ? 'AUTH_REQUIRED' : 'MIGRATION_SCOPE_DENIED', message: error.message, requestId, retryable: false });
    return true;
  }
  return false;
}

export type RegisterLegacyImportRoutesOptions = {
  authentication: StaffAuthenticationService;
  authorization: StaffAuthorizationService;
  importer: LegacyReadOnlyImporterService;
};

export function registerLegacyImportRoutes(app: FastifyInstance, { authentication, authorization, importer }: RegisterLegacyImportRoutesOptions): void {
  app.post('/api/v1/internal/migration/legacy/validate', async (request, reply) => {
    const requestId = requestIdFor(request, reply);
    const parsed = validateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'LEGACY_SNAPSHOT_INVALID', message: 'A structured legacy snapshot is required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const schoolId = importer.resolveSchoolId(principal, 'admin.migration.validate');
      authorization.requireSchoolCapability(principal, schoolId, 'admin.migration.validate');
      return { ...importer.validate(parsed.data.snapshot), schoolId, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/internal/migration/legacy/dry-run', async (request, reply) => {
    const requestId = requestIdFor(request, reply);
    const parsed = fingerprintBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'LEGACY_DRY_RUN_INVALID', message: 'A structured snapshot and validated source fingerprint are required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const schoolId = importer.resolveSchoolId(principal, 'admin.migration.dry_run');
      authorization.requireSchoolCapability(principal, schoolId, 'admin.migration.dry_run');
      const result = importer.dryRun(parsed.data.snapshot);
      if (result.fingerprint.value !== parsed.data.sourceFingerprint) throw new LegacyImportError('LEGACY_FINGERPRINT_MISMATCH', 'The supplied source fingerprint does not match this snapshot. Validate the exact snapshot again before dry-run.', 409);
      return { ...result, schoolId, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });

  app.post('/api/v1/internal/migration/legacy/import-shadow', async (request, reply) => {
    const requestId = requestIdFor(request, reply);
    const parsed = fingerprintBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'LEGACY_SHADOW_IMPORT_INVALID', message: 'A structured snapshot and validated source fingerprint are required.', requestId, retryable: false });
    try {
      const principal = await authentication.authenticate(bearerToken(request));
      const schoolId = importer.resolveSchoolId(principal, 'admin.migration.import_shadow');
      authorization.requireSchoolCapability(principal, schoolId, 'admin.migration.import_shadow');
      const result = await importer.importShadow(principal, schoolId, parsed.data.snapshot, parsed.data.sourceFingerprint);
      return { ...result, schoolId, requestId };
    } catch (error) {
      if (sendError(reply, error, requestId)) return;
      throw error;
    }
  });
}
