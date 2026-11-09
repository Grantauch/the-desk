// Intentional authoring step; site verification never rewrites app bundles.
import { cpSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { filesBelow, pondSourceHash } from '../../scripts/pond-build-manifest.mjs';
const target = new URL('../../public/hubs/pond/', import.meta.url);
mkdirSync(target, { recursive: true });
// This directory contains this app's generated output only.
for (const name of readdirSync(target)) rmSync(new URL(name, target), { recursive: true, force: true });
cpSync(new URL('./dist/', import.meta.url), target, { recursive: true });
for (const name of ['favicon.svg', 'og.jpg']) cpSync(new URL(name, import.meta.url), new URL(name, target));
const files = Object.fromEntries(filesBelow(fileURLToPath(target)).map(file => [relative(fileURLToPath(target), file).replaceAll('\\','/'), createHash('sha256').update(readFileSync(file)).digest('hex')]));
writeFileSync(new URL('build.json', target), JSON.stringify({sourceSha256:pondSourceHash(fileURLToPath(new URL('../../', import.meta.url))), files}, null, 2) + '\n');
console.log('Published Pond to public/hubs/pond/');
