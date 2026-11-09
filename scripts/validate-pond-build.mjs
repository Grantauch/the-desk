import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { filesBelow, pondSourceHash } from './pond-build-manifest.mjs';
import { relative } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = new URL('../public/hubs/pond/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('build.json', directory), 'utf8'));
const published = filesBelow(fileURLToPath(directory)).map(file => relative(fileURLToPath(directory),file).replaceAll('\\','/')).filter(file => file !== 'build.json');
assert.deepEqual(published.sort(), Object.keys(manifest.files).sort(), 'Pond output must not contain stale or unmanifested assets');
assert.equal(manifest.sourceSha256, pondSourceHash(root), 'Pond source changed: run npm ci --prefix apps/pond, then npm run pond:build');
for (const [name, expected] of Object.entries(manifest.files)) {
  const actual = createHash('sha256').update(readFileSync(new URL(name, directory))).digest('hex');
  assert.equal(actual, expected, `Pond published asset changed: ${name}`);
}
console.log('Pond source and published bundle match.');
