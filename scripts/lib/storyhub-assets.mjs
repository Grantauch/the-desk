// Shared StoryHub asset primitives: safe output paths, checksums, and image probing.
// Reusable across StoryHubs. Contains no story-specific logic and no visual opinions.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export const PUBLIC_ROOT = (root) => resolve(root, 'public');

/** Output paths a StoryHub release is allowed to write or claim, relative to public/. */
export const isAllowedReleasePath = (clean) =>
  /^hubs\/[a-z0-9-]+\.html$/.test(clean) ||
  /^storyhub\/[a-z0-9-]+\/[a-z0-9-]+\/assets\/[a-z0-9._-]+$/.test(clean) ||
  /^storyhub\/runtime\/[a-z0-9._-]+$/.test(clean);

/**
 * Resolve a release-relative path inside public/, refusing traversal, absolute
 * paths, and anything outside the allowlist above.
 */
export const resolveReleasePath = (root, relPath) => {
  const clean = String(relPath).replaceAll('\\', '/').replace(/^\/+/, '');
  if (!clean || clean.includes('..')) throw new Error(`unsafe release path: ${relPath}`);
  if (!isAllowedReleasePath(clean)) throw new Error(`release path is not allowlisted: ${clean}`);
  const publicRoot = PUBLIC_ROOT(root);
  const out = resolve(publicRoot, clean);
  if (out !== publicRoot && !out.startsWith(`${publicRoot}${sep}`)) {
    throw new Error(`release path escaped public root: ${clean}`);
  }
  return out;
};

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
export const sha256File = (path) => sha256(readFileSync(path));

/** True when the buffer is a structurally valid RIFF/WEBP container. */
export const isWebp = (buf) =>
  buf.length > 16 &&
  buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
  buf.subarray(8, 12).toString('ascii') === 'WEBP' &&
  buf.readUInt32LE(4) + 8 <= buf.length + 1;

/** Intrinsic pixel size of a WebP buffer (VP8, VP8L, or VP8X). */
export const webpSize = (buf) => {
  if (!isWebp(buf)) throw new Error('not a WebP buffer');
  const fourcc = buf.subarray(12, 16).toString('ascii');
  if (fourcc === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) throw new Error('bad VP8 start code');
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    if (buf[20] !== 0x2f) throw new Error('bad VP8L signature');
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === 'VP8X') {
    const read24 = (o) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }
  throw new Error(`unsupported WebP chunk ${fourcc}`);
};
