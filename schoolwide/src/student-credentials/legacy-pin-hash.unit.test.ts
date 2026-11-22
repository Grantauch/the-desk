import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createLegacyCompatibilityHash, verifyLegacyCompatibilityHash } from './crypto.js';

test('SW-174 fictional Hall Pass SHA-256/Base64URL hashes preserve existing 5/6-digit PINs', () => {
  // Only synthetic identifiers. This is the existing Apps Script algorithm:
  // base64EncodeWebSafe(SHA256(scriptSalt + ':' + pinAsText)).
  const fictionalSalt = 'synthetic-source-hall-pass-salt-not-a-secret';
  const cases = ['01234', '001234', '731926'];
  for (const pin of cases) {
    const sourceDigestWithPadding = createHash('sha256')
      .update(fictionalSalt + ':' + pin, 'utf8')
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const internal = createLegacyCompatibilityHash(pin, fictionalSalt);
    assert.equal(internal, sourceDigestWithPadding.replace(/=+$/u, ''));
    assert.equal(verifyLegacyCompatibilityHash(pin, fictionalSalt, sourceDigestWithPadding), true);
    assert.equal(verifyLegacyCompatibilityHash(pin, fictionalSalt, internal), true);
    assert.equal(verifyLegacyCompatibilityHash(pin, 'synthetic-different-salt', sourceDigestWithPadding), false);
  }

  // Leading zeros are credentials, not display padding: these are different secrets.
  assert.notEqual(
    createLegacyCompatibilityHash('01234', fictionalSalt),
    createLegacyCompatibilityHash('001234', fictionalSalt),
  );
  assert.equal(
    verifyLegacyCompatibilityHash('01234', fictionalSalt, createLegacyCompatibilityHash('001234', fictionalSalt)),
    false,
  );
});
