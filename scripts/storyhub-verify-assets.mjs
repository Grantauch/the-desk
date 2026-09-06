/**
 * Verify StoryHub release integrity. Read-only, no network, no image tooling —
 * safe to run inside the canonical `npm run verify` gate and in CI.
 *
 * For every manifest in `storyhub/releases/`:
 *   - every declared file exists at an allowlisted path inside public/
 *   - every declared file still matches its sealed byte length and sha256
 *   - declared WebP files are real RIFF/WEBP containers of the sealed pixel size
 *   - the released page embeds no data: image URIs (the extraction stays done)
 *   - every asset path the page references is a declared, sealed release file
 *   - every asset in the story's assets.json is either deployed to a sealed file
 *     or explicitly records why it was not
 *
 * Pass `--dist` to run the same checks against a production build instead of the
 * working tree.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedReleasePath, isWebp, sha256, webpSize } from './lib/storyhub-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const useDist = process.argv.includes('--dist');
const base = useDist ? resolve(root, 'dist') : resolve(root, 'public');
const releaseDir = join(root, 'storyhub', 'releases');
const errors = [];

if (!existsSync(releaseDir)) {
  console.log('StoryHub asset verification: no releases declared.');
  process.exit(0);
}
if (useDist && !existsSync(base)) {
  console.error('StoryHub asset verification failed: dist/ has not been built.');
  process.exit(1);
}

const manifests = readdirSync(releaseDir).filter((name) => name.endsWith('.json'));
let checked = 0;

for (const name of manifests) {
  const manifest = JSON.parse(readFileSync(join(releaseDir, name), 'utf8'));
  const label = manifest.storyId || name;
  const sealed = new Map();

  for (const file of manifest.files || []) {
    const clean = String(file.path).replace(/^\/+/, '');
    if (!isAllowedReleasePath(clean) || clean.includes('..')) {
      errors.push(`${label}: release path is not allowlisted: ${file.path}`);
      continue;
    }
    const onDisk = resolve(base, clean);
    if (onDisk !== base && !onDisk.startsWith(`${base}${sep}`)) {
      errors.push(`${label}: release path escaped the build root: ${file.path}`);
      continue;
    }
    if (!Number.isInteger(file.bytes) || typeof file.sha256 !== 'string' || file.sha256.length !== 64) {
      errors.push(`${label}: ${file.path} is unsealed — run storyhub:seal`);
      continue;
    }
    if (!existsSync(onDisk)) {
      errors.push(`${label}: ${file.path} is declared but missing from ${useDist ? 'dist' : 'public'}/`);
      continue;
    }

    const buffer = readFileSync(onDisk);
    if (buffer.length !== file.bytes) {
      errors.push(`${label}: ${file.path} is ${buffer.length} bytes, sealed at ${file.bytes}`);
      continue;
    }
    const digest = sha256(buffer);
    if (digest !== file.sha256) {
      errors.push(`${label}: ${file.path} sha256 ${digest} does not match the sealed ${file.sha256}`);
      continue;
    }
    if (file.path.endsWith('.webp')) {
      if (!isWebp(buffer)) {
        errors.push(`${label}: ${file.path} is not a valid RIFF/WEBP container`);
        continue;
      }
      const size = webpSize(buffer);
      if (size.width !== file.width || size.height !== file.height) {
        errors.push(`${label}: ${file.path} is ${size.width}x${size.height}, sealed at ${file.width}x${file.height}`);
        continue;
      }
    }
    sealed.set(`/${clean}`, file);
    checked += 1;
  }

  // The released page must stay extracted, and may only reference sealed assets.
  const routePath = resolve(base, String(manifest.route || '').replace(/^\/+/, ''));
  if (manifest.route && existsSync(routePath)) {
    const page = readFileSync(routePath, 'utf8');
    const inlineImages = (page.match(/data:image\/(?:webp|png|jpe?g|gif)/gi) || []).length;
    if (inlineImages) {
      errors.push(`${label}: ${manifest.route} still embeds ${inlineImages} data: image URI(s); assets must be extracted files`);
    }
    for (const reference of new Set(page.match(/\/storyhub\/[a-z0-9/-]+\/assets\/[A-Za-z0-9._-]+/g) || [])) {
      if (!sealed.has(reference)) {
        errors.push(`${label}: ${manifest.route} references ${reference}, which is not a sealed release file`);
      }
    }
  } else if (manifest.route) {
    errors.push(`${label}: route ${manifest.route} was not found in ${useDist ? 'dist' : 'public'}/`);
  }

  // Every catalogued asset must be honestly accounted for.
  const [course, lesson] = String(manifest.storyId || '').split('-');
  const assetsPath = join(root, 'storyhub', 'stories', course || '', lesson || '', 'assets.json');
  if (existsSync(assetsPath)) {
    const deployed = new Set([...sealed.values()].map((file) => file.assetId).filter(Boolean));
    for (const asset of JSON.parse(readFileSync(assetsPath, 'utf8')).assets || []) {
      if (asset.deployPath) {
        if (!sealed.has(asset.deployPath)) {
          errors.push(`${label}: asset ${asset.id} deployPath ${asset.deployPath} is not a sealed release file`);
        } else if (sealed.get(asset.deployPath).assetId !== asset.id) {
          errors.push(`${label}: asset ${asset.id} deployPath points at ${sealed.get(asset.deployPath).assetId}`);
        }
      } else if (deployed.has(asset.id)) {
        errors.push(`${label}: asset ${asset.id} ships in the release but records no deployPath`);
      } else if (!asset.deploymentStatus || !asset.deploymentNote) {
        errors.push(`${label}: asset ${asset.id} has no deployPath and no deploymentStatus/deploymentNote explaining why`);
      }
    }
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`StoryHub asset error: ${error}`));
  console.error(`StoryHub asset verification failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`StoryHub asset verification passed: ${manifests.length} release(s), ${checked} sealed file(s) against ${useDist ? 'dist' : 'public'}/.`);
