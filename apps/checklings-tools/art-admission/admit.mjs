import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// A staging policy, never a species registry or permission to publish artwork.
export const POLICY = Object.freeze({ id: 'pilot-still-v1', width: 256, height: 256,
  poseBytes: 45056, bundleBytes: 184320, inputBytes: 1048576, inventoryFiles: 64,
  decodePixels: 1048576, poses: Object.freeze(['idle', 'attack', 'defend', 'hurt', 'knockout']) });
const FOUNDERS = new Set(['mochi', 'bolt', 'zee', 'ember']);
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const failure = code => ({ ok: false, code });
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

// Structural checks precede browser decoding: a partial progressive image must
// not become an admissible asset just because a decoder can paint some pixels.
export function inspectContainer(bytes, extension) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) return failure('EMPTY_IMAGE');
  if (bytes.length > POLICY.inputBytes) return failure('INPUT_TOO_LARGE');
  if (extension === '.png') {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG)) return failure('INVALID_PNG');
    let offset = 8, count = 0, width, height, idat = false, endedIdat = false;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) return failure('TRUNCATED_PNG');
      const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
      if (end > bytes.length) return failure('TRUNCATED_PNG');
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) return failure('PNG_CRC');
      if (count++ === 0) {
        if (type !== 'IHDR' || size !== 13) return failure('PNG_IHDR');
        width = bytes.readUInt32BE(offset + 8); height = bytes.readUInt32BE(offset + 12);
      } else if (type === 'IHDR') return failure('PNG_IHDR');
      if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') return failure('ANIMATED_IMAGE');
      if (type === 'IDAT') {
        if (endedIdat) return failure('PNG_IDAT_ORDER');
        idat = true;
      } else if (idat) endedIdat = true;
      if (type === 'IEND') {
        if (size !== 0 || !idat || end !== bytes.length) return failure('PNG_END');
        return dimensionResult('image/png', width, height, false);
      }
      offset = end;
    }
    return failure('PNG_END');
  }
  if (extension === '.webp') {
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP'
      || bytes.readUInt32LE(4) + 8 !== bytes.length) return failure('INVALID_WEBP');
    let offset = 12, width, height, image = false;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) return failure('TRUNCATED_WEBP');
      const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
      const start = offset + 8, end = start + size;
      if (end + (size & 1) > bytes.length) return failure('TRUNCATED_WEBP');
      if (type === 'ANIM' || type === 'ANMF') return failure('ANIMATED_IMAGE');
      if (type === 'VP8X') {
        if (size !== 10 || (bytes[start] & 2)) return failure('ANIMATED_OR_INVALID_WEBP');
        width = bytes.readUIntLE(start + 4, 3) + 1; height = bytes.readUIntLE(start + 7, 3) + 1;
      } else if (type === 'VP8L') {
        if (image || size < 5 || bytes[start] !== 0x2f) return failure('INVALID_WEBP');
        const bits = bytes.readUInt32LE(start + 1);
        const w = (bits & 0x3fff) + 1, h = ((bits >>> 14) & 0x3fff) + 1;
        if (!dimensionResult('image/webp', w, h, false).ok || (width !== undefined && (width !== w || height !== h))) return failure('WEBP_DIMENSIONS');
        width = w; height = h; image = true;
      } else if (type === 'VP8 ') {
        if (image || size < 10 || !bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 1, 0x2a]))) return failure('INVALID_WEBP');
        const w = bytes.readUInt16LE(start + 6) & 0x3fff, h = bytes.readUInt16LE(start + 8) & 0x3fff;
        if (!dimensionResult('image/webp', w, h, false).ok || (width !== undefined && (width !== w || height !== h))) return failure('WEBP_DIMENSIONS');
        width = w; height = h; image = true;
      }
      offset = end + (size & 1);
    }
    return image ? dimensionResult('image/webp', width, height, false) : failure('WEBP_NO_IMAGE');
  }
  if (extension === '.gif') {
    if (bytes.length < 14 || !['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return failure('INVALID_GIF');
    const width = bytes.readUInt16LE(6), height = bytes.readUInt16LE(8);
    if (!dimensionResult('image/gif', width, height, false).ok) return failure('PIXEL_LIMIT');
    let offset = 13 + ((bytes[10] & 128) ? 3 * (2 ** ((bytes[10] & 7) + 1)) : 0), frames = 0;
    const skipBlocks = () => {
      while (offset < bytes.length) {
        const size = bytes[offset++];
        if (!size) return true;
        offset += size;
        if (offset > bytes.length) return false;
      }
      return false;
    };
    while (offset < bytes.length) {
      const type = bytes[offset++];
      if (type === 0x3b) return frames && offset === bytes.length
        ? dimensionResult('image/gif', width, height, frames > 1) : failure('GIF_END');
      if (type === 0x21) { if (offset++ >= bytes.length || !skipBlocks()) return failure('TRUNCATED_GIF'); }
      else if (type === 0x2c) {
        if (offset + 9 > bytes.length) return failure('TRUNCATED_GIF');
        const left = bytes.readUInt16LE(offset), top = bytes.readUInt16LE(offset + 2);
        const w = bytes.readUInt16LE(offset + 4), h = bytes.readUInt16LE(offset + 6);
        if (!w || !h || left + w > width || top + h > height) return failure('GIF_FRAME_DIMENSIONS');
        const packed = bytes[offset + 8]; offset += 9;
        if (packed & 128) offset += 3 * (2 ** ((packed & 7) + 1));
        if (offset++ >= bytes.length || !skipBlocks()) return failure('TRUNCATED_GIF');
        frames++;
      } else return failure('INVALID_GIF_BLOCK');
    }
    return failure('GIF_END');
  }
  return failure('UNSUPPORTED_FORMAT');
}
function dimensionResult(mime, width, height, animated) {
  return width > 0 && height > 0 && width * height <= POLICY.decodePixels
    ? { ok: true, mime, width, height, animated } : failure('PIXEL_LIMIT');
}

// The tool launches an isolated offline context. Candidate bytes are supplied
// directly; it never opens a candidate URL, script, SVG or local HTML file.
export async function createDecoder() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', offline: true });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    return {
      close: () => browser.close(),
      async decode(bytes, container) {
        let timer;
        try {
          const decoded = page.evaluate(async ({ data, mime, width, height }) => {
            const raw = Uint8Array.from(atob(data), char => char.charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([raw], { type: mime }));
            try {
              if (bitmap.width !== width || bitmap.height !== height) return { ok: false, code: 'DECODE_DIMENSIONS' };
              const canvas = new OffscreenCanvas(width, height);
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(bitmap, 0, 0);
              const pixels = ctx.getImageData(0, 0, width, height).data;
              let transparentPixels = 0, visiblePixels = 0;
              for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] < 255) transparentPixels++;
                if (pixels[i] > 0) visiblePixels++;
              }
              const corners = [0, width - 1, (height - 1) * width, width * height - 1].map(i => pixels[i * 4 + 3]);
              return { ok: true, width, height, transparentPixels, visiblePixels, cornerAlpha: corners,
                alphaScope: 'FIRST_DECODED_FRAME', hasTransparentPixels: transparentPixels > 0 };
            } finally { bitmap.close(); }
          }, { data: bytes.toString('base64'), ...container });
          return await Promise.race([decoded, new Promise(resolve => {
            timer = setTimeout(() => {
              // Terminate the decoding context after a timeout; subsequent
              // inputs fail closed instead of using a busy decoder.
              void context.close().catch(() => {});
              resolve(failure('DECODE_TIMEOUT'));
            }, 10000);
          })]);
        } catch { return failure('DECODE_FAILED'); }
        finally { clearTimeout(timer); }
      }
    };
  } catch (error) { await browser.close(); throw error; }
}

async function rootDirectory(root) {
  const resolved = await fs.realpath(root);
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error('INVALID_ROOT');
  return resolved;
}
async function readImage(root, relative, decoder) {
  if (typeof relative !== 'string' || relative.length > 240 || relative.includes('\\')
    || relative.split('/').some(p => !p || p === '.' || p === '..' || /[:\x00-\x1f]/.test(p)) || path.isAbsolute(relative)) return failure('UNSAFE_PATH');
  const absolute = path.resolve(root, relative);
  try {
    const real = await fs.realpath(absolute), rel = path.relative(root, real);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel) || real !== absolute) return failure('UNSAFE_PATH');
    const stat = await fs.stat(real);
    if (!stat.isFile()) return failure('NOT_IMAGE_FILE');
    if (stat.size > POLICY.inputBytes) return failure('INPUT_TOO_LARGE');
    const bytes = await fs.readFile(real);
    const container = inspectContainer(bytes, path.extname(relative).toLowerCase());
    const facts = { bytes: bytes.length, sha256: sha256(bytes), container };
    if (!container.ok) return { ...facts, ...failure(container.code) };
    const decoded = await decoder.decode(bytes, container);
    return { ...facts, decoded, ok: decoded.ok, ...(decoded.ok ? {} : { code: decoded.code }) };
  } catch { return failure('UNREADABLE_IMAGE'); }
}
const envelope = mode => ({ version: 1, mode, policy: POLICY.id, runtimeImported: false,
  limitations: ['Technical staging only; no species/catalog promotion.', 'Visual quality, distinct poses, originality, anatomy and classroom/device performance require separate review.'] });

export async function admit(root, manifest, decoder) {
  const report = { ...envelope('ADMISSION'), status: 'REJECTED', technicalPass: false, violations: [], files: [] };
  const reject = (code, pose) => report.violations.push({ code, ...(pose ? { pose } : {}) });
  if (!manifest || typeof manifest !== 'object' || manifest.version !== 1 || manifest.policy !== POLICY.id
    || typeof manifest.speciesId !== 'string' || !/^[a-z][a-z0-9-]{1,39}$/.test(manifest.speciesId) || !manifest.poses || typeof manifest.poses !== 'object'
    || Array.isArray(manifest.poses)) { reject('INVALID_MANIFEST'); return report; }
  report.speciesId = manifest.speciesId;
  if (FOUNDERS.has(manifest.speciesId)) reject('FOUNDER_REPLACEMENT_FORBIDDEN');
  if (manifest.reducedMotionPose !== 'idle') reject('REDUCED_MOTION_STILL_REQUIRED');
  if (Object.keys(manifest.poses).some(pose => !POLICY.poses.includes(pose))) reject('UNKNOWN_POSE');
  let resolved;
  try { resolved = await rootDirectory(root); } catch { reject('INVALID_ROOT'); return report; }
  const seenPaths = new Set(), seenHashes = new Set(); let totalBytes = 0;
  for (const pose of POLICY.poses) {
    const entry = manifest.poses[pose];
    if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) { reject('MISSING_POSE_OR_HASH', pose); continue; }
    if (!['.png', '.webp'].includes(path.extname(entry.path).toLowerCase())) { reject('STILL_FORMAT_REQUIRED', pose); continue; }
    if (seenPaths.has(entry.path.toLowerCase())) reject('DUPLICATE_POSE_FILE', pose);
    seenPaths.add(entry.path.toLowerCase());
    const result = await readImage(resolved, entry.path, decoder);
    report.files.push({ pose, path: result.code === 'UNSAFE_PATH' ? null : entry.path, ...result });
    if (!result.ok) { reject(result.code, pose); continue; }
    totalBytes += result.bytes;
    if (result.sha256 !== entry.sha256) reject('HASH_MISMATCH', pose);
    if (seenHashes.has(result.sha256)) reject('DUPLICATE_POSE_CONTENT', pose);
    seenHashes.add(result.sha256);
    if (result.bytes > POLICY.poseBytes) reject('POSE_BUDGET', pose);
    if (result.container.width !== POLICY.width || result.container.height !== POLICY.height) reject('POSE_DIMENSIONS', pose);
    if (!result.decoded.hasTransparentPixels || result.decoded.cornerAlpha.some(alpha => alpha !== 0)) reject('TRANSPARENT_BACKGROUND_REQUIRED', pose);
    if (!result.decoded.visiblePixels) reject('EMPTY_POSE', pose);
  }
  report.totalBytes = totalBytes;
  if (totalBytes > POLICY.bundleBytes) reject('BUNDLE_BUDGET');
  report.technicalPass = report.violations.length === 0;
  report.status = report.technicalPass ? 'TECHNICAL_CANDIDATE_ONLY' : 'REJECTED';
  return report;
}

export async function inventory(root, decoder) {
  const report = { ...envelope('INVENTORY'), status: 'INVENTORY_ONLY', technicalPass: null, complete: false, files: [], errors: [] };
  try {
    const resolved = await rootDirectory(root);
    // Deliberately bounded and nonrecursive: inventory is not a filesystem scan.
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const files = entries.filter(x => x.isFile() && /\.(png|gif|webp)$/i.test(x.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length > POLICY.inventoryFiles) { report.errors.push('INVENTORY_FILE_LIMIT'); return report; }
    for (const file of files) report.files.push({ path: file.name, ...await readImage(resolved, file.name, decoder) });
    report.complete = true;
  } catch { report.errors.push('INVALID_ROOT'); }
  return report;
}

export async function main(args) {
  const [mode, root, manifestFile, ...extra] = args;
  if (!['admit', 'inventory'].includes(mode) || !root || extra.length || (mode === 'admit' ? !manifestFile : manifestFile)) {
    console.log(JSON.stringify({ status: 'ERROR', code: 'USAGE', usage: 'node admit.mjs admit <root> <manifest.json> | inventory <root>' })); return 2;
  }
  let decoder;
  try {
    let manifest;
    if (mode === 'admit') {
      const stat = await fs.stat(manifestFile);
      if (stat.size > 65536) throw new Error('MANIFEST_LIMIT');
      manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    }
    decoder = await createDecoder();
    const report = mode === 'admit' ? await admit(root, manifest, decoder) : await inventory(root, decoder);
    console.log(JSON.stringify(report, null, 2));
    return mode === 'admit' ? (report.technicalPass ? 0 : 1) : (report.complete ? 0 : 1);
  } catch {
    console.log(JSON.stringify({ status: 'ERROR', code: 'INPUT_OR_DECODER_UNAVAILABLE', technicalPass: false })); return 2;
  } finally { if (decoder) await decoder.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
