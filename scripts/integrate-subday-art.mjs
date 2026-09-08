import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'public/hubs/ush9-s01-the-margin.html',
  'public/hubs/hh-s01-the-desk-it-stopped-at.html',
  'public/hubs/bts-s01-the-death-harvest.html',
  'public/hubs/substitute-day-2026-09-08.html',
];
const stylesheet = '<link rel="stylesheet" href="/storyhub/subday-20260908/storyhub-art.css">';
const runtime = '<script src="/storyhub/subday-20260908/storyhub-art.js"></script>';

for (const relative of pages) {
  const target = path.join(root, relative);
  let html = await readFile(target, 'utf8');
  if (!html.includes(stylesheet)) html = html.replace('</head>', `${stylesheet}</head>`);
  if (!html.includes(runtime)) html = html.replace('</body>', `${runtime}</body>`);
  html = html.replace('class="meter" aria-label=', 'class="meter" role="img" aria-label=');
  html = html.replace('class="series" aria-label=', 'class="series" tabindex="0" role="region" aria-label=');
  await writeFile(target, html);
  console.log(`Integrated artwork runtime: ${relative}`);
}
