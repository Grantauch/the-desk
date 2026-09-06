/**
 * Fetch verified public-domain archival photographs and grade them into a StoryHub's
 * palette so they sit with the story's other artwork.
 *
 * Authoring step, not a verification step: it needs network access and ImageMagick,
 * neither of which the canonical `npm run verify` gate assumes. The committed output
 * is verified by its checksum in the sealed release manifest instead.
 *
 *   node scripts/storyhub-grade-archival.mjs --story USH9/L014
 *
 * The grade is tonal only — crop, grayscale normalisation, a duotone mapped from the
 * story's own approved artwork, and light grain. Nothing in the photograph is added,
 * removed, or repainted, and every portrait carries its record URL and rights
 * statement into assets.json and onto the page.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWebp, resolveReleasePath, sha256, webpSize } from './lib/storyhub-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const fail = (message) => {
  console.error(`StoryHub archival grade failed: ${message}`);
  process.exit(1);
};

const story = arg('story');
if (!story) fail('usage: --story <COURSE/LESSON>');

const config = JSON.parse(readFileSync(join(root, 'storyhub', 'stories', story, 'archival-portraits.json'), 'utf8'));
const cacheDir = join(root, 'node_modules', '.cache', 'storyhub-archival');
mkdirSync(cacheDir, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

for (const portrait of config.portraits) {
  if (!portrait.rightsStatement || !/no known restrictions/i.test(portrait.rightsStatement)) {
    fail(`${portrait.person}: refusing to publish without an explicit "no known restrictions" rights statement`);
  }
  if (!/^https:\/\/(www|cdn)\.loc\.gov\//.test(portrait.sourceImage)) {
    fail(`${portrait.person}: source image must come from a loc.gov host`);
  }

  const cached = join(cacheDir, `${portrait.recordId}.jpg`);
  if (!existsSync(cached)) {
    run('curl', ['-sSL', '--fail', '--max-time', '120', '-o', cached, portrait.sourceImage]);
  }

  const out = resolveReleasePath(root, `${config.output.dir}/${portrait.file}`);
  mkdirSync(dirname(out), { recursive: true });
  const [shadow, highlight] = config.output.duotone;

  run('convert', [
    cached,
    '-crop', portrait.crop, '+repage',
    '-colorspace', 'Gray',
    ...portrait.tone,
    '-resize', `${config.output.size}^`,
    '-gravity', 'north',
    '-extent', config.output.size, '+repage',
    '+level-colors', `${shadow},${highlight}`,
    '(', '+clone', '-fill', 'gray50', '-colorize', '100', '+noise', 'Gaussian', '-attenuate', config.output.grain, ')',
    '-compose', 'SoftLight', '-composite',
    '-quality', config.output.quality,
    out,
  ]);

  const buffer = readFileSync(out);
  if (!isWebp(buffer)) fail(`${portrait.file} is not a valid RIFF/WEBP container`);
  const { width, height } = webpSize(buffer);
  console.log(`  ${portrait.assetId} ${portrait.person.padEnd(16)} ${String(buffer.length).padStart(7)} B  ${width}x${height}  sha256 ${sha256(buffer).slice(0, 16)}…`);
}

writeFileSync(
  join(root, 'storyhub', 'stories', story, 'archival-portraits.json'),
  `${JSON.stringify(config, null, 2)}\n`,
);
console.log(`StoryHub archival grade complete: ${config.portraits.length} verified public-domain portrait(s).`);
