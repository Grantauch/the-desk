import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const read = (path) => readFile(resolve(process.cwd(), path), 'utf8');
const [coldOpenersText, finishedDecksSource, classicDecksSource, detourHtml, homeHtml, sitemapXml, netlifyConfig] = await Promise.all([
  read('src/data/cold-openers.json'),
  read('src/data/cold-open-rabbit-holes.ts'),
  read('src/data/detour-shelf.ts'),
  read('dist/detour-shelf/index.html'),
  read('dist/index.html'),
  read('dist/sitemap.xml'),
  read('netlify.toml'),
]);

const coldOpeners = JSON.parse(coldOpenersText);
const sourceLinks = (source) => [...source.matchAll(/href:\s*['"](https:\/\/[^'"]+)['"]/g)].map((match) => match[1]);
const finishedDeckLinks = sourceLinks(finishedDecksSource);
const classicDeckLinks = sourceLinks(classicDecksSource);
const allDeckLinks = [...finishedDeckLinks, ...classicDeckLinks];
const deckCards = [...detourHtml.matchAll(/<article[^>]+data-detour-kind="decks"/gi)].length;
const storyCards = [...detourHtml.matchAll(/<article[^>]+data-detour-kind="stories"/gi)].length;
const uniqueDays = new Set(coldOpeners.map((opener) => opener.day));
const failures = [];

if (finishedDeckLinks.length !== 63) failures.push(`expected 63 finished cold-opener deck links, found ${finishedDeckLinks.length}`);
if (classicDeckLinks.length !== 17) failures.push(`expected 17 classic detour deck links, found ${classicDeckLinks.length}`);
if (new Set(allDeckLinks).size !== 80) failures.push(`expected 80 unique deck links, found ${new Set(allDeckLinks).size}`);
if (deckCards !== 80) failures.push(`expected 80 built deck cards, found ${deckCards}`);
if (coldOpeners.length !== 90 || uniqueDays.size !== 90 || !uniqueDays.has(1) || !uniqueDays.has(90)) {
  failures.push(`story bank is incomplete: ${coldOpeners.length} records / ${uniqueDays.size} unique days`);
}
if (storyCards !== 90) failures.push(`expected 90 built story cards, found ${storyCards}`);
if (!homeHtml.includes('href="/detour-shelf/"')) failures.push('homepage does not link to the unified Detour Shelf');
if (/href="\/(?:cold-openers|rabbit-holes)\//.test(homeHtml)) failures.push('homepage still links to a retired split route');
if (!sitemapXml.includes('/detour-shelf/')) failures.push('sitemap does not include the unified Detour Shelf');
if (/\/(?:cold-openers|rabbit-holes)\//.test(sitemapXml)) failures.push('sitemap still includes a retired split route');
if (!netlifyConfig.includes('from = "/cold-openers"') || !netlifyConfig.includes('from = "/rabbit-holes"')) {
  failures.push('legacy Detour Shelf redirects are missing');
}
if (!detourHtml.includes('data-detour-search') || !detourHtml.includes('data-detour-surprise')) {
  failures.push('search or surprise control is missing from the built Detour Shelf');
}
if (/PRIVATE_TEACHER_ONLY|Week_1_TEACHER|Teacher Key v1\.md/i.test(detourHtml)) {
  failures.push('teacher-only release material leaked into the built Detour Shelf');
}

if (failures.length) {
  console.error(`Detour Shelf validation: FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Detour Shelf validation: PASS — ${deckCards} unique ready decks + ${storyCards} opening stories`);
