/**
 * Extract the embedded images of an approved StoryHub source document into real,
 * cacheable public asset files.
 *
 * Authoring step, not a verification step: it needs the approved source document,
 * which is archived outside this repository. `npm run storyhub:validate` verifies
 * the *result* against the sealed release manifest instead.
 *
 *   node scripts/storyhub-extract-assets.mjs --story USH9/L014 --source <path-to-approved.html>
 *
 * Extraction is content-addressed. Every embedded image is decoded, checked for a
 * valid WebP container, and matched by sha256 against the story's extraction map,
 * so document order can never silently mis-assign an asset id.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWebp, resolveReleasePath, sha256, webpSize } from './lib/storyhub-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const fail = (message) => {
  console.error(`StoryHub extraction failed: ${message}`);
  process.exit(1);
};

const story = arg('story');
const source = arg('source');
if (!story || !source) fail('usage: --story <COURSE/LESSON> --source <approved.html>');

const mapPath = join(root, 'storyhub', 'stories', story, 'asset-extraction.json');
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const html = readFileSync(source);
const sourceSha = sha256(html);

if (sourceSha !== map.sourceSha256) {
  if (!process.argv.includes('--allow-source-drift')) {
    fail(`source checksum ${sourceSha} does not match the approved ${map.sourceSha256}. `
      + 'Re-approve the source and update asset-extraction.json, or pass --allow-source-drift deliberately.');
  }
  console.warn(`StoryHub extraction warning: source checksum drifted to ${sourceSha}`);
}

const text = html.toString('utf8');
const pattern = /data:image\/webp;base64,([A-Za-z0-9+/=]+)/g;
const written = new Map();
let occurrences = 0;
let match;

while ((match = pattern.exec(text))) {
  occurrences += 1;
  const buffer = Buffer.from(match[1], 'base64');
  const digest = sha256(buffer);
  const entry = map.images[digest];
  if (!entry) fail(`embedded image ${occurrences} (sha256 ${digest}) is not in the extraction map`);
  if (!isWebp(buffer)) fail(`${entry.file} did not decode to a valid RIFF/WEBP container`);
  if (buffer.length !== entry.bytes) fail(`${entry.file} decoded to ${buffer.length} bytes, expected ${entry.bytes}`);
  if (written.has(digest)) continue;

  const relPath = `${map.outputDir}/${entry.file}`;
  const out = resolveReleasePath(root, relPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buffer);
  const { width, height } = webpSize(buffer);
  written.set(digest, { assetId: entry.assetId, path: `/${relPath}`, bytes: buffer.length, width, height });
}

const expected = Object.keys(map.images).length;
if (written.size !== expected) fail(`extracted ${written.size} unique images, expected ${expected}`);

for (const item of written.values()) {
  console.log(`  ${item.assetId.padEnd(5)} ${String(item.bytes).padStart(7)} B  ${item.width}x${item.height}  ${item.path}`);
}
console.log(`StoryHub extraction complete: ${written.size} verified asset(s) from ${occurrences} embedded reference(s).`);
