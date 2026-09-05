import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const payloadRoot = join(root, 'storyhub', 'asset-payloads');
const publicRoot = join(root, 'public');
const manifestPath = join(payloadRoot, 'manifest.json');

const isText = (value) => typeof value === 'string' && value.trim().length > 0;

if (!process.argv.includes('--quiet')) console.log('StoryHub asset materialization starting.');

if (!readFileSync) throw new Error('node:fs unavailable');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  throw new Error('StoryHub asset payload manifest has no assets.');
}

let written = 0;
for (const asset of manifest.assets) {
  for (const field of ['id', 'fileName', 'payloadDir', 'deployPath', 'sha256']) {
    if (!isText(asset[field])) throw new Error(`StoryHub payload ${asset.id || '(unknown)'} missing ${field}`);
  }
  if (!Array.isArray(asset.parts) || asset.parts.length === 0) {
    throw new Error(`StoryHub payload ${asset.id} has no parts.`);
  }
  if (!asset.deployPath.startsWith('/')) throw new Error(`StoryHub payload ${asset.id} deployPath must be site-root-relative.`);
  if (asset.deployPath.includes('..')) throw new Error(`StoryHub payload ${asset.id} deployPath contains traversal.`);

  const partDir = join(payloadRoot, asset.payloadDir);
  const b64 = asset.parts.map((part) => {
    if (!/^[A-Za-z0-9._-]+$/.test(part)) throw new Error(`StoryHub payload ${asset.id} has unsafe part name.`);
    return readFileSync(join(partDir, part), 'utf8').trim();
  }).join('');
  const bytes = Buffer.from(b64, 'base64');
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== asset.sha256) {
    throw new Error(`StoryHub payload ${asset.id} checksum mismatch: expected ${asset.sha256}, got ${actual}.`);
  }
  if (Number.isInteger(asset.bytes) && bytes.length !== asset.bytes) {
    throw new Error(`StoryHub payload ${asset.id} byte-count mismatch: expected ${asset.bytes}, got ${bytes.length}.`);
  }
  const out = join(publicRoot, asset.deployPath.replace(/^\//, ''));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  written += 1;
}

if (!process.argv.includes('--quiet')) {
  console.log(`StoryHub assets materialized: ${written} verified file(s).`);
}
