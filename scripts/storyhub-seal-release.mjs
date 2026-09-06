/**
 * Seal a StoryHub release: recompute the byte length, sha256 and (for images) the
 * intrinsic pixel size of every file the release manifest declares, and write them
 * back into the manifest.
 *
 * Authoring step. `npm run storyhub:validate` then verifies the working tree and the
 * production build against the sealed numbers, so a truncated, corrupted, half-copied
 * or silently swapped asset fails the gate instead of shipping.
 *
 *   node scripts/storyhub-seal-release.mjs            # every release
 *   node scripts/storyhub-seal-release.mjs --story USH9-L014
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWebp, resolveReleasePath, sha256, webpSize } from './lib/storyhub-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = join(root, 'storyhub', 'releases');
const only = (() => {
  const i = process.argv.indexOf('--story');
  return i > -1 ? process.argv[i + 1] : undefined;
})();

const manifests = readdirSync(releaseDir)
  .filter((name) => name.endsWith('.json'))
  .filter((name) => !only || basename(name, '.json') === only);

if (!manifests.length) {
  console.error(`StoryHub seal failed: no release manifest${only ? ` for ${only}` : ''}`);
  process.exit(1);
}

for (const name of manifests) {
  const manifestPath = join(releaseDir, name);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let total = 0;

  for (const file of manifest.files) {
    const onDisk = resolveReleasePath(root, file.path);
    const buffer = readFileSync(onDisk);
    file.bytes = buffer.length;
    file.sha256 = sha256(buffer);
    total += buffer.length;
    if (file.path.endsWith('.webp')) {
      if (!isWebp(buffer)) {
        console.error(`StoryHub seal failed: ${file.path} is not a valid RIFF/WEBP container`);
        process.exit(1);
      }
      const { width, height } = webpSize(buffer);
      file.width = width;
      file.height = height;
    }
  }

  manifest.totalBytes = total;
  manifest.sealedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Sealed ${manifest.storyId}: ${manifest.files.length} file(s), ${(total / 1024).toFixed(0)} KB total.`);
}
