import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const STRONG_VERIFIER_SCHEME = 'SCRYPT_PEPPER_V1' as const;
export const LEGACY_VERIFIER_SCHEME = 'LEGACY_SHA256_SALT_V1' as const;

const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAXMEM = 64 * 1024 * 1024;

function derive(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM }, (error, key) => {
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
  params: { N: number; r: number; p: number; keyLength: number };
}> {
  const salt = randomBytes(16);
  const key = await derive(`${pin}\u0000${pepper}`, salt);
  return {
    hash: key.toString('hex'),
    salt: salt.toString('base64url'),
    params: { N, r: R, p: P, keyLength: KEY_LENGTH },
  };
}

export async function verifyStrongPin(
  pin: string,
  pepper: string,
  salt: string,
  expectedHex: string,
): Promise<boolean> {
  const actual = await derive(`${pin}\u0000${pepper}`, Buffer.from(salt, 'base64url'));
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
