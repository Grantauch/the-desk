/**
 * SW-175 EXPERIMENTAL CONTRACT: synthetic-only, off-by-default credential handoff.
 *
 * This module has NO Fastify route, Apps Script RPC or production configuration.
 * A trusted source could issue a one-time attestation AFTER authenticating a
 * student's pre-existing PIN, without exporting its salt, PIN card or hash DB.
 * Deployment/real-data use requires a separate architecture and privacy review.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SyntheticNonceConsumption } from './synthetic-nonce-contract.js';
export type { SyntheticNonceConsumption } from './synthetic-nonce-contract.js';

const VERSION = 1 as const;
const MAX_TTL_SECONDS = 60;
const MAX_CLOCK_SKEW_SECONDS = 5;
const MAX_ENVELOPE_LENGTH = 4096;
const OPAQUE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,191}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

type Claims = {
  version: typeof VERSION;
  issuer: string;
  audience: string;
  schoolId: string;
  studentAlias: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  pinBinding: string;
};

export type LegacyPinAttestationRequest = {
  issuer: string;
  audience: string;
  schoolId: string;
  studentAlias: string;
  pin: string;
  secret: Buffer;
  nowEpochSeconds: number;
  ttlSeconds?: number;
};

export type LegacyPinAttestationVerification = {
  token: string;
  expectedIssuer: string;
  expectedAudience: string;
  expectedSchoolId: string;
  expectedStudentAlias: string;
  pin: string;
  secret: Buffer;
  nowEpochSeconds: number;
  /** Must atomically insert a nonce digest with uniqueness & expiry. Fail closed. */
  consumeNonceDigest: (consumption: SyntheticNonceConsumption) => Promise<boolean>;
};

export type VerifiedLegacyPinAttestation = {
  schoolId: string;
  studentAlias: string;
  issuedAt: number;
  expiresAt: number;
};

const REJECTED = 'Legacy PIN handoff rejected.';

function reject(): never {
  // Never echo the user's PIN, token, hash, salt, secret or alias to log/error.
  throw new Error(REJECTED);
}

function validateSecret(secret: Buffer): void {
  if (!Buffer.isBuffer(secret) || secret.length < 32) reject();
}

function validatePin(pin: string): void {
  // Exact text, not a numeric conversion: leading zeroes are significant.
  if (typeof pin !== 'string' || !/^\d{5,6}$/.test(pin)) reject();
}

function validateName(name: string): void {
  if (typeof name !== 'string' || !OPAQUE_NAME.test(name)) reject();
}

function validateNow(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) reject();
}

function hmac(secret: Buffer, domain: string, value: string): Buffer {
  return createHmac('sha256', secret).update(domain, 'utf8').update('\0', 'utf8').update(value, 'utf8').digest();
}

function constantTimeEqual(expected: Buffer, actual: Buffer): boolean {
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function boundPin(secret: Buffer, nonce: string, pin: string): string {
  return hmac(secret, 'schoolwide-synthetic-pin-binding-v1', nonce + '\0' + pin).toString('base64url');
}

function canonical(claims: Claims): string {
  return JSON.stringify({
    version: claims.version,
    issuer: claims.issuer,
    audience: claims.audience,
    schoolId: claims.schoolId,
    studentAlias: claims.studentAlias,
    nonce: claims.nonce,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
    pinBinding: claims.pinBinding,
  });
}

function decodeStrictBase64Url(value: string, max: number): Buffer {
  if (value.length === 0 || value.length > max || !BASE64URL.test(value)) reject();
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) reject();
  return decoded;
}

function validateClaims(value: unknown): Claims {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject();
  const c = value as Partial<Claims> & Record<string, unknown>;
  const keys = ['version', 'issuer', 'audience', 'schoolId', 'studentAlias',
    'nonce', 'issuedAt', 'expiresAt', 'pinBinding'];
  if (Object.keys(c).length !== keys.length || Object.keys(c).some((key) => !keys.includes(key))) reject();
  if (c.version !== VERSION) reject();
  validateName(c.issuer as string);
  validateName(c.audience as string);
  validateName(c.schoolId as string);
  validateName(c.studentAlias as string);
  if (typeof c.nonce !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(c.nonce)) reject();
  if (typeof c.pinBinding !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(c.pinBinding)) reject();
  if (!Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt)) reject();
  if (c.issuedAt! < 0 || c.expiresAt! - c.issuedAt! <= 0
    || c.expiresAt! - c.issuedAt! > MAX_TTL_SECONDS) reject();
  return c as Claims;
}

export function issueSyntheticLegacyPinAttestation(request: LegacyPinAttestationRequest): string {
  validateSecret(request.secret);
  validatePin(request.pin);
  for (const name of [request.issuer, request.audience, request.schoolId, request.studentAlias]) {
    validateName(name);
  }
  validateNow(request.nowEpochSeconds);
  const ttl = request.ttlSeconds ?? MAX_TTL_SECONDS;
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > MAX_TTL_SECONDS) reject();

  const nonce = randomBytes(24).toString('base64url');
  const claims: Claims = {
    version: VERSION,
    issuer: request.issuer,
    audience: request.audience,
    schoolId: request.schoolId,
    studentAlias: request.studentAlias,
    nonce,
    issuedAt: request.nowEpochSeconds,
    expiresAt: request.nowEpochSeconds + ttl,
    pinBinding: boundPin(request.secret, nonce, request.pin),
  };
  const payload = Buffer.from(canonical(claims), 'utf8').toString('base64url');
  const signature = hmac(request.secret, 'schoolwide-synthetic-legacy-attestation-v1', payload).toString('base64url');
  return payload + '.' + signature;
}

export async function verifySyntheticLegacyPinAttestation(
  request: LegacyPinAttestationVerification,
): Promise<VerifiedLegacyPinAttestation> {
  validateSecret(request.secret);
  validatePin(request.pin);
  validateNow(request.nowEpochSeconds);
  for (const value of [request.expectedIssuer, request.expectedAudience,
    request.expectedSchoolId, request.expectedStudentAlias]) validateName(value);
  if (typeof request.consumeNonceDigest !== 'function') reject();

  if (typeof request.token !== 'string' || request.token.length > MAX_ENVELOPE_LENGTH) reject();
  const parts = request.token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) reject();
  const payloadBytes = decodeStrictBase64Url(parts[0], MAX_ENVELOPE_LENGTH - 44);
  const signature = decodeStrictBase64Url(parts[1], 43);
  if (signature.length !== 32) reject();
  const expectedSignature = hmac(request.secret, 'schoolwide-synthetic-legacy-attestation-v1', parts[0]);
  if (!constantTimeEqual(expectedSignature, signature)) reject();

  let parsed: unknown;
  try { parsed = JSON.parse(payloadBytes.toString('utf8')) as unknown; } catch { reject(); }
  const claims = validateClaims(parsed);
  if (canonical(claims) !== payloadBytes.toString('utf8')) reject();
  if (claims.issuer !== request.expectedIssuer
    || claims.audience !== request.expectedAudience
    || claims.schoolId !== request.expectedSchoolId
    || claims.studentAlias !== request.expectedStudentAlias) reject();
  if (request.nowEpochSeconds < claims.issuedAt - MAX_CLOCK_SKEW_SECONDS
    || request.nowEpochSeconds >= claims.expiresAt) reject();

  // Signature and scope were validated first. Consume *before* checking the
  // PIN so attackers cannot repeatedly guess against the same token.
  const nonceDigest = createHash('sha256')
    .update('schoolwide-one-use-nonce-v1\0' + claims.issuer + '\0' + claims.nonce, 'utf8')
    .digest('hex');
  let consumed = false;
  try {
    consumed = await request.consumeNonceDigest({
      nonceDigest,
      expiresAtEpochSeconds: claims.expiresAt,
      issuer: claims.issuer,
      schoolId: claims.schoolId,
    });
  } catch { reject(); }
  if (consumed !== true) reject();

  const submittedBinding = boundPin(request.secret, claims.nonce, request.pin);
  if (!constantTimeEqual(Buffer.from(claims.pinBinding, 'base64url'), Buffer.from(submittedBinding, 'base64url'))) reject();
  return {
    schoolId: claims.schoolId,
    studentAlias: claims.studentAlias,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  };
}
