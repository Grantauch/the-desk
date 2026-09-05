import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const payloadRoot = join(root, 'storyhub', 'asset-payloads');
const publicRoot = join(root, 'public');
const manifest = JSON.parse(readFileSync(join(payloadRoot, 'manifest.json'), 'utf8'));

const fail = (message) => { throw new Error(`StoryHub materialization failed: ${message}`); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const safePart = (name) => /^[A-Za-z0-9._-]+$/.test(name);

if (!text(manifest.payloadDir) || !text(manifest.sha256) || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
  fail('invalid release-archive manifest');
}

const partDir = join(payloadRoot, manifest.payloadDir);
const base64 = manifest.parts.map((part) => {
  if (!safePart(part)) fail(`unsafe payload part ${part}`);
  return readFileSync(join(partDir, part), 'utf8').trim();
}).join('');
const archive = Buffer.from(base64, 'base64');
const actualSha = createHash('sha256').update(archive).digest('hex');
if (actualSha !== manifest.sha256) fail(`archive checksum mismatch: ${actualSha}`);
if (Number.isInteger(manifest.bytes) && archive.length !== manifest.bytes) fail(`archive byte count ${archive.length} != ${manifest.bytes}`);

const tar = gunzipSync(archive);
let offset = 0;
let files = 0;
while (offset + 512 <= tar.length) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every((byte) => byte === 0)) break;
  const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
  const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
  const rawPath = `${prefix ? `${prefix}/` : ''}${name}`.replace(/^\.\//, '');
  const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
  const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
  const type = String.fromCharCode(header[156] || 48);
  if (!Number.isFinite(size) || size < 0) fail(`bad tar size for ${rawPath}`);
  offset += 512;
  const body = tar.subarray(offset, offset + size);
  offset += Math.ceil(size / 512) * 512;

  if (type === '5' || !rawPath) continue;
  if (type !== '0' && type !== '\0') fail(`unsupported tar entry type for ${rawPath}`);
  const clean = normalize(rawPath).replaceAll('\\', '/').replace(/^\/+/, '');
  const allowed = clean === 'hubs/ush9-l014-unions.html' || clean.startsWith('storyhub/ush9/l014/assets/');
  if (!allowed || clean.includes('../')) fail(`archive attempted unexpected path ${clean}`);
  const out = resolve(publicRoot, clean);
  if (!(out === publicRoot || out.startsWith(`${publicRoot}${sep}`))) fail(`archive path escaped public root: ${clean}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, body);
  files += 1;
}

if (files !== manifest.files) fail(`expected ${manifest.files} release files, wrote ${files}`);
if (!process.argv.includes('--quiet')) console.log(`StoryHub release materialized: ${files} verified file(s).`);
