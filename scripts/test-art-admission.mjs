import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { POLICY, inspectContainer, createDecoder, admit, inventory } from '../apps/checklings-tools/art-admission/admit.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(repo, 'browser-results'), { recursive: true });
const scratch = await fs.mkdtemp(path.join(repo, 'browser-results/art-admission-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Independent PNG writer: full IHDR/deflate-IDAT/IEND and bitwise CRCs.
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length);
  body.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
}
function png({ size = 256, color = 20, opaque = false, empty = false, padding = 0, badData = false, animated = false } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    pixels[i] = color; pixels[i + 1] = 100; pixels[i + 2] = 150;
    pixels[i + 3] = empty ? 0 : opaque || (x > 30 && x < size - 30 && y > 30 && y < size - 30) ? 255 : 0;
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    ...(animated ? [chunk('acTL', Buffer.from('0000000100000000', 'hex'))] : []),
    chunk('IDAT', badData ? Buffer.from('not-zlib') : deflateSync(pixels)),
    ...(padding ? [chunk('tEXt', Buffer.concat([Buffer.from('note\0'), Buffer.alloc(padding, 65)]))] : []), chunk('IEND', Buffer.alloc(0))]);
}
const manifest = () => ({ version: 1, policy: POLICY.id, speciesId: 'synthetic-candidate', reducedMotionPose: 'idle', poses: {} });
async function fixture(options = {}) {
  const root = await fs.mkdtemp(path.join(scratch, 'candidate-')), m = manifest();
  for (const [i, pose] of POLICY.poses.entries()) {
    const bytes = png({ color: 30 + i, ...options });
    await fs.writeFile(path.join(root, pose + '.png'), bytes, { flag: 'wx' });
    m.poses[pose] = { path: pose + '.png', sha256: hash(bytes) };
  }
  return { root, m };
}
async function replace(f, pose, bytes, extension = '.png') {
  const name = pose + '-replacement' + extension;
  await fs.writeFile(path.join(f.root, name), bytes, { flag: 'wx' });
  f.m.poses[pose] = { path: name, sha256: hash(bytes) };
}
let count = 0;
async function check(name, fn) { await fn(); console.log('PASS art admission: ' + name); count++; }
function has(report, code) { assert.equal(report.technicalPass, false); assert.ok(report.violations.some(v => v.code === code), JSON.stringify(report.violations)); }
const cli = path.join(repo, 'apps/checklings-tools/art-admission/admit.mjs');
async function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: repo, shell: false, timeout: 30000, env: { ...process.env, ...env } });
    let output = '', errors = '';
    child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { errors += d; });
    child.on('error', reject); child.on('close', code => { try { resolve({ code, report: JSON.parse(output), errors }); } catch { reject(new Error(output + errors)); } });
  });
}
const baseline = JSON.parse(await fs.readFile(path.join(repo, 'docs/checklings/founder-art-baseline.json')));
const before = await Promise.all(baseline.files.map(async f => hash(await fs.readFile(path.join(repo, f.file)))));
const beforeStats = await Promise.all(baseline.files.map(async f => {
  const stat = await fs.stat(path.join(repo, f.file)); return [stat.size, stat.mtimeMs, stat.ctimeMs];
}));
const decoder = await createDecoder();
try {
  await check('all truncated PNG prefixes and corrupt CRCs fail without throwing', async () => {
    const image = png();
    for (let length = 0; length < image.length; length++) assert.equal(inspectContainer(image.subarray(0, length), '.png').ok, false, String(length));
    for (const length of [24, 25, 26, 33]) assert.equal(inspectContainer(image.subarray(0, length), '.png').ok, false);
    const bad = Buffer.from(image); bad[40] ^= 1; assert.equal(inspectContainer(bad, '.png').code, 'PNG_CRC');
    assert.equal(inspectContainer(Buffer.concat([image, Buffer.from([0])]), '.png').ok, false);
  });
  await check('five complete distinct transparent PNGs pass technical staging only', async () => {
    const f = await fixture(); const r = await admit(f.root, f.m, decoder);
    assert.equal(r.technicalPass, true); assert.equal(r.status, 'TECHNICAL_CANDIDATE_ONLY'); assert.equal(r.runtimeImported, false);
    assert.equal(r.files.length, 5); assert.ok(r.files.every(x => x.decoded.visiblePixels > 0 && x.decoded.transparentPixels > 0));
    assert.ok(!JSON.stringify(r).includes(f.root));
  });
  await check('header-valid PNG with invalid compressed pixels fails actual decoding', async () => {
    const f = await fixture(); const image = png({ badData: true }); assert.equal(inspectContainer(image, '.png').ok, true);
    await replace(f, 'hurt', image); has(await admit(f.root, f.m, decoder), 'DECODE_FAILED');
  });
  await check('opaque GIF87a decodes with zero transparent pixels in inventory', async () => {
    const root = await fs.mkdtemp(path.join(scratch, 'gif-'));
    const image = Buffer.from('47494638376101000100800000000000ffffff2c00000000010001000002024401003b', 'hex');
    await fs.writeFile(path.join(root, 'opaque.gif'), image);
    const r = await inventory(root, decoder); assert.equal(r.complete, true); assert.equal(r.technicalPass, null);
    assert.equal(r.files[0].ok, true); assert.equal(r.files[0].decoded.hasTransparentPixels, false);
    assert.deepEqual(r.files[0].decoded.cornerAlpha, [255, 255, 255, 255]);
    for (let n = 0; n < image.length; n++) assert.equal(inspectContainer(image.subarray(0, n), '.gif').ok, false);
    const oversizeFrame = Buffer.from(image); oversizeFrame.writeUInt16LE(65535, 24);
    assert.equal(inspectContainer(oversizeFrame, '.gif').code, 'GIF_FRAME_DIMENSIONS');
  });
  await check('RGBA support alone does not prove a transparent background', async () => {
    const f = await fixture({ opaque: true }); has(await admit(f.root, f.m, decoder), 'TRANSPARENT_BACKGROUND_REQUIRED');
  });
  await check('fully empty transparent images fail as unusable poses', async () => {
    const f = await fixture({ empty: true }); has(await admit(f.root, f.m, decoder), 'EMPTY_POSE');
  });
  await check('static WebP decoder and exact container length are verified', async () => {
    // Encode a PNG through the browser's independent WebP encoder, then admit it.
    const { chromium } = await import('playwright'); const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const data = await page.evaluate(async base64 => {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(256, 256); canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
        return Array.from(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/webp', quality: 1 })).arrayBuffer()));
      }, png({ color: 99 }).toString('base64'));
      const bytes = Buffer.from(data), f = await fixture(); await replace(f, 'idle', bytes, '.webp');
      assert.equal((await admit(f.root, f.m, decoder)).technicalPass, true);
      assert.equal(inspectContainer(bytes.subarray(0, bytes.length - 1), '.webp').ok, false);
      assert.equal(inspectContainer(Buffer.concat([bytes, Buffer.from([0])]), '.webp').ok, false);
      const riffChunk = (type, payload) => {
        const header = Buffer.alloc(8); header.write(type); header.writeUInt32LE(payload.length, 4);
        return Buffer.concat([header, payload, ...(payload.length & 1 ? [Buffer.alloc(1)] : [])]);
      };
      const extended = Buffer.alloc(10); extended.writeUIntLE(255, 4, 3); extended.writeUIntLE(255, 7, 3);
      const maliciousBody = Buffer.concat([Buffer.from('WEBP'), riffChunk('VP8X', extended), riffChunk('VP8L', Buffer.from('2fffffffff', 'hex'))]);
      const riffHeader = Buffer.alloc(8); riffHeader.write('RIFF'); riffHeader.writeUInt32LE(maliciousBody.length, 4);
      assert.equal(inspectContainer(Buffer.concat([riffHeader, maliciousBody]), '.webp').code, 'WEBP_DIMENSIONS');
    } finally { await browser.close(); }
  });
  await check('missing poses, hash changes, unsupported policy and no reduced-motion still fail', async () => {
    const f = await fixture(); delete f.m.poses.defend; has(await admit(f.root, f.m, decoder), 'MISSING_POSE_OR_HASH');
    f.m.poses.idle.sha256 = '0'.repeat(64); has(await admit(f.root, f.m, decoder), 'HASH_MISMATCH');
    f.m.policy = 'loose'; has(await admit(f.root, f.m, decoder), 'INVALID_MANIFEST');
    f.m.policy = POLICY.id; delete f.m.reducedMotionPose; has(await admit(f.root, f.m, decoder), 'REDUCED_MOTION_STILL_REQUIRED');
  });
  await check('per-pose and aggregate budgets independently reject real decodable PNGs', async () => {
    const large = await fixture({ padding: 46000 }); has(await admit(large.root, large.m, decoder), 'POSE_BUDGET');
    const aggregate = await fixture({ padding: 38000 }); const r = await admit(aggregate.root, aggregate.m, decoder);
    has(r, 'BUNDLE_BUDGET'); assert.ok(!r.violations.some(v => v.code === 'POSE_BUDGET'));
  });
  await check('reused file or bytes cannot stand in for five poses', async () => {
    const f = await fixture(); f.m.poses.attack = { ...f.m.poses.idle }; has(await admit(f.root, f.m, decoder), 'DUPLICATE_POSE_FILE');
    const g = await fixture(); const bytes = await fs.readFile(path.join(g.root, 'idle.png')); await replace(g, 'hurt', bytes);
    has(await admit(g.root, g.m, decoder), 'DUPLICATE_POSE_CONTENT');
  });
  await check('dimensions, animation, GIF and founder replacement do not pass candidate policy', async () => {
    const f = await fixture({ size: 64 }); has(await admit(f.root, f.m, decoder), 'POSE_DIMENSIONS');
    for (const id of ['mochi', 'bolt', 'zee', 'ember']) { f.m.speciesId = id; has(await admit(f.root, f.m, decoder), 'FOUNDER_REPLACEMENT_FORBIDDEN'); }
    await replace(f, 'idle', png({ animated: true })); has(await admit(f.root, f.m, decoder), 'ANIMATED_IMAGE');
    f.m.poses.attack.path = 'opaque.gif'; has(await admit(f.root, f.m, decoder), 'STILL_FORMAT_REQUIRED');
  });
  await check('unsafe, absent, remote and Windows escape paths fail closed', async () => {
    const f = await fixture();
    for (const name of ['../outside.png', '/outside.png', 'C:/outside.png', 'https://example.com/image.png', 'a\\b.png', 'missing.png']) {
      f.m.poses.idle.path = name; const r = await admit(f.root, f.m, decoder); assert.equal(r.technicalPass, false); assert.ok(r.violations.some(v => ['UNSAFE_PATH', 'UNREADABLE_IMAGE'].includes(v.code)));
      if (r.violations.some(v => v.code === 'UNSAFE_PATH')) assert.equal(r.files.find(x => x.pose === 'idle').path, null);
    }
  });
  await check('oversize input and inventory limit stop before decoding', async () => {
    const f = await fixture(); await replace(f, 'idle', Buffer.alloc(POLICY.inputBytes + 1)); has(await admit(f.root, f.m, decoder), 'INPUT_TOO_LARGE');
    const header = Buffer.from(png().subarray(16, 29)); header.writeUInt32BE(65536); header.writeUInt32BE(65536, 4);
    const enormous = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', Buffer.from([0])), chunk('IEND', Buffer.alloc(0))]);
    assert.equal(inspectContainer(enormous, '.png').code, 'PIXEL_LIMIT');
    const root = await fs.mkdtemp(path.join(scratch, 'limit-')); for (let i = 0; i <= POLICY.inventoryFiles; i++) await fs.writeFile(path.join(root, i + '.png'), Buffer.alloc(0));
    const r = await inventory(root, decoder); assert.equal(r.complete, false); assert.deepEqual(r.errors, ['INVENTORY_FILE_LIMIT']);
  });
  await check('redirected candidate paths and invalid roots cannot read outside the supplied root', async () => {
    const f = await fixture(), outside = await fixture();
    // Directory junctions work without administrator symlink privileges on Windows.
    await fs.symlink(outside.root, path.join(f.root, 'redirect'), process.platform === 'win32' ? 'junction' : 'dir');
    f.m.poses.idle.path = 'redirect/idle.png'; has(await admit(f.root, f.m, decoder), 'UNSAFE_PATH');
    has(await admit(path.join(scratch, 'absent-root'), f.m, decoder), 'INVALID_ROOT');
  });
  await check('CLI exits distinguish technical pass, rejection, inventory and invalid input', async () => {
    const f = await fixture(); const file = path.join(f.root, 'manifest.json'); await fs.writeFile(file, JSON.stringify(f.m));
    assert.equal((await runCli(['admit', f.root, file])).code, 0);
    const unavailable = await runCli(['admit', f.root, file], { PLAYWRIGHT_BROWSERS_PATH: path.join(scratch, 'absent-browser') });
    assert.equal(unavailable.code, 2); assert.equal(unavailable.report.technicalPass, false);
    delete f.m.poses.knockout; await fs.writeFile(file, JSON.stringify(f.m));
    const rejected = await runCli(['admit', f.root, file]); assert.equal(rejected.code, 1); assert.equal(rejected.report.status, 'REJECTED');
    const inventoried = await runCli(['inventory', f.root]); assert.equal(inventoried.code, 0); assert.equal(inventoried.report.technicalPass, null);
    assert.equal((await runCli(['admit'])).code, 2);
    await fs.writeFile(file, '{broken'); assert.equal((await runCli(['admit', f.root, file])).code, 2);
  });
  await check('read-only inventory decodes all eight frozen original founder files', async () => {
    const r = await inventory(path.join(repo, 'public/hubs/checkling/camp/assets'), decoder);
    for (const f of baseline.files) {
      const item = r.files.find(x => x.path === path.basename(f.file)); assert.equal(item.ok, true, JSON.stringify(item));
      assert.equal(item.sha256, f.sha256); assert.equal(item.bytes, f.bytes);
    }
    assert.equal(r.status, 'INVENTORY_ONLY'); assert.equal(r.technicalPass, null);
    const after = await Promise.all(baseline.files.map(async f => hash(await fs.readFile(path.join(repo, f.file)))));
    assert.deepEqual(after, before); assert.deepEqual(after, baseline.files.map(f => f.sha256));
    const afterStats = await Promise.all(baseline.files.map(async f => {
      const stat = await fs.stat(path.join(repo, f.file)); return [stat.size, stat.mtimeMs, stat.ctimeMs];
    }));
    assert.deepEqual(afterStats, beforeStats, 'read-only tools must also preserve original file modification metadata');
  });
} finally { await decoder.close(); }
await fs.writeFile(path.join(scratch, 'RESULT.json'), JSON.stringify({ status: 'PASS', groups: count, policy: POLICY, syntheticOnly: true, originalsUnchanged: true }, null, 2), { flag: 'wx' });
console.log(`Art admission: ${count}/${count} groups PASS; synthetic technical fixtures only, original artwork unchanged.`);
