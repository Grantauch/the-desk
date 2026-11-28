import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const STRONG_VERIFIER_SCHEME = 'SCRYPT_PEPPER_V1' as const;
export const LEGACY_VERIFIER_SCHEME = 'LEGACY_SHA256_SALT_V1' as const;

export type StrongVerifierParams = { N: number; r: number; p: number; keyLength: number };

const CURRENT_PARAMS: StrongVerifierParams = { N: 16_384, r: 8, p: 5, keyLength: 32 };
const LEGACY_STRONG_PARAMS: StrongVerifierParams = { N: 16_384, r: 8, p: 1, keyLength: 32 };
const MAXMEM = 64 * 1024 * 1024;

function isSupportedParams(value: unknown): value is StrongVerifierParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<StrongVerifierParams>;
  return (
    candidate.N === 16_384
    && candidate.r === 8
    && (candidate.p === 1 || candidate.p === 5)
    && candidate.keyLength === 32
  );
}

export function normalizeStrongVerifierParams(value: unknown): StrongVerifierParams | null {
  return isSupportedParams(value) ? { N: value.N, r: value.r, p: value.p, keyLength: value.keyLength } : null;
}

export function strongVerifierNeedsUpgrade(value: unknown): boolean {
  const params = normalizeStrongVerifierParams(value);
  return !params
    || params.N !== CURRENT_PARAMS.N
    || params.r !== CURRENT_PARAMS.r
    || params.p !== CURRENT_PARAMS.p
    || params.keyLength !== CURRENT_PARAMS.keyLength;
}

function derive(secret: string, salt: Buffer, params: StrongVerifierParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, params.keyLength, { N: params.N, r: params.r, p: params.p, maxmem: MAXMEM }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function hashOpaqueValue(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function createStrongPinVerifier(pin: string, pepper: string): Promise<{
  hash: string;
  salt: string;
  params: StrongVerifierParams;
}> {
  const salt = randomBytes(16);
  const key = await derive(`${pin}\u0000${pepper}`, salt, CURRENT_PARAMS);
  return {
    hash: key.toString('hex'),
    salt: salt.toString('base64url'),
    params: { ...CURRENT_PARAMS },
  };
}

export async function verifyStrongPin(
  pin: string,
  pepper: string,
  salt: string,
  expectedHex: string,
  paramsValue: unknown = LEGACY_STRONG_PARAMS,
): Promise<boolean> {
  const params = normalizeStrongVerifierParams(paramsValue);
  if (!params) return false;
  const actual = await derive(`${pin}\u0000${pepper}`, Buffer.from(salt, 'base64url'), params);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createLegacyCompatibilityHash(pin: string, legacySalt: string): string {
  return createHash('sha256').update(`${legacySalt}:${pin}`, 'utf8').digest('base64url');
}

export function verifyLegacyCompatibilityHash(pin: string, legacySalt: string, expected: string): boolean {
  const actual = Buffer.from(createLegacyCompatibilityHash(pin, legacySalt).replace(/=+$/u, ''), 'utf8');
  const normalizedExpected = Buffer.from(expected.replace(/=+$/u, ''), 'utf8');
  return actual.length === normalizedExpected.length && timingSafeEqual(actual, normalizedExpected);
}
