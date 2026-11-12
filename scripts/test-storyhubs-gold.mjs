import { readFile } from 'node:fs/promises';
import { preview } from 'astro';
import { chromium } from 'playwright';

const pages = [
  { path: '/hubs/bts-s01-the-death-harvest.html', marker: 'bts-v2', mapId: 'story-map-title', cards: 30, words: 3000, terms: 9, repairs: 6 },
  { path: '/hubs/hh-s01-the-desk-it-stopped-at.html', marker: 'hh-v2', mapId: 'desk-map-title', cards: 28, words: 2800, terms: 10, repairs: 6 },
  { path: '/hubs/ush9-s01-the-margin.html', marker: 'ush9-v2', mapId: 'margin-map-title', cards: 28, words: 3000, terms: 9, repairs: 6 },
];

const plainLanguageChecks = [
  ['/hubs/ush9-s01-the-margin.html', 'Think of a bathtub with an overflow drain and a plug you can pull.'],
  ['/hubs/hh-s01-the-desk-it-stopped-at.html', 'Drawing it on the whiteboard is one step.'],
  ['/hubs/bts-s01-the-death-harvest.html', 'Picture a goal-line push on almost every important snap.'],
  ['/hubs/ush9-l014-unions.html', 'A railroad makes money by moving. In 1885, the trains stopped.'],
];

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function visibleWordCount(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:[a-z]+|#\d+);/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

for (const page of pages) {
  const html = await readFile(new URL(`../public${page.path}`, import.meta.url), 'utf8');
  const checks = [
    [html.includes(`data-gold-context="${page.marker}"`), 'version marker'],
    [count(html, `aria-labelledby="${page.mapId}"`) === 1, 'one opening context map'],
    [html.includes('/storyhub/subday-20260908/storyhub-context.css'), 'shared context stylesheet'],
    [count(html, 'class="context-card') >= page.cards, `${page.cards}+ context cards`],
    [visibleWordCount(html) >= page.words, `${page.words}+ visible words`],
    [count(html, 'class="term"') >= page.terms, `${page.terms}+ terms`],
    [count(html, 'class="met"') >= page.terms, 'where-you-met-it fields'],
    [count(html, 'class="check"') >= page.repairs, 'Note Repair cross-references'],
    [html.includes('class="source-ledger"'), 'source ledger'],
    [html.includes('data-gold-guide'), 'lesson guide'],
    [html.includes('/storyhub/subday-20260908/storyhub-gold.js'), 'shared guide behavior'],
    [!html.includes('TEACHER NOTES'), 'no teacher notes heading'],
    [!html.includes('Speaker notes'), 'no speaker-notes label'],
  ];
  for (const [ok, label] of checks) {
    if (!ok) throw new Error(`${page.path}: missing ${label}`);
  }
  console.log(`PASS depth ${page.path} (${visibleWordCount(html)} words, ${count(html, 'class="context-card')} context cards)`);
}

for (const [path, anchor] of plainLanguageChecks) {
  const html = await readFile(new URL(`../public${path}`, import.meta.url), 'utf8');
  if (!html.includes(anchor)) throw new Error(`${path}: missing plain-language teaching anchor`);
  console.log(`PASS plain-language context ${path}`);
}

if (process.env.STORYHUB_CONTENT_ONLY === '1') {
  console.log('Gold Standard StoryHub content gate: PASS (content-only)');
  process.exit(0);
}

const externalOrigin = process.env.STORYHUB_BASE_URL?.replace(/\/$/, '');
const origin = externalOrigin || 'http://127.0.0.1:4394';
const server = externalOrigin ? null : await preview({ server: { host: '127.0.0.1', port: 4394 } });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await page.goto(`${origin}/hubs/bts-s01-the-death-harvest.html`, { waitUntil: 'networkidle' });
  const allEntries = await page.locator('.record-entry:not([hidden])').count();
  if (allEntries !== 20) throw new Error(`BTS audit expected 20 entries, found ${allEntries}.`);
  await page.getByRole('button', { name: /college/i }).click();
  const collegeEntries = await page.locator('.record-entry:not([hidden])').count();
  if (collegeEntries !== 2) throw new Error(`BTS college filter expected 2 entries, found ${collegeEntries}.`);

  await page.goto(`${origin}/hubs/hh-s01-the-desk-it-stopped-at.html`, { waitUntil: 'networkidle' });
  if (await page.locator('button.claim').count() !== 5) throw new Error('Hidden History claim ladder does not have five rungs.');

  await page.goto(`${origin}/hubs/ush9-s01-the-margin.html`, { waitUntil: 'networkidle' });
  await page.locator('[data-gold-guide-open]').click();
  if (!(await page.locator('[data-gold-guide]').getAttribute('class')).includes('is-open')) throw new Error('Lesson guide did not open.');
  if (await page.locator('[data-gold-guide] nav a').count() < 10) throw new Error('Lesson guide is missing section links.');
  await page.keyboard.press('Escape');
  if ((await page.locator('[data-gold-guide]').getAttribute('class')).includes('is-open')) throw new Error('Lesson guide did not close with Escape.');
  await page.locator('button.step').first().click();
  if ((await page.locator('#marginRead').innerText()).includes('Choose a decision')) throw new Error('The Margin subtraction instrument did not respond.');
  await page.locator('button.eng').first().click();
  if ((await page.locator('#engRead').innerText()).includes('Choose a conclusion')) throw new Error('The Margin engineering comparison did not respond.');

  console.log('PASS evidence instruments');
} finally {
  if (browser) await browser.close();
  if (server) await server.stop();
}

console.log(`Gold Standard StoryHub content gate: PASS (${externalOrigin ? 'hosted' : 'local'})`);
