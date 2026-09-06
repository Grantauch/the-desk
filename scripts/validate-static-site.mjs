import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const distRoot = resolve(process.cwd(), 'dist');

const walk = async (folder) => {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const functionRoot = resolve(process.cwd(), 'netlify', 'functions');

const dynamicFunctionCandidates = (route) => {
  const match = /^\/\.netlify\/functions\/([^/?#]+)/.exec(route);
  if (!match) return [];
  const name = match[1];
  return [
    join(functionRoot, `${name}.mjs`),
    join(functionRoot, `${name}.js`),
    join(functionRoot, `${name}.ts`),
    join(functionRoot, name, 'index.mjs'),
    join(functionRoot, name, 'index.js'),
    join(functionRoot, name, 'index.ts'),
  ];
};

const files = await walk(distRoot);
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === '.html');
const failures = [];
const htmlByFile = new Map();
let references = 0;

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  htmlByFile.set(htmlFile, html);
  const attributes = [...html.matchAll(/\b(?:href|src)=(?:"([^"]+)"|'([^']+)')/gi)];

  for (const match of attributes) {
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(raw)) continue;
    references += 1;

    let clean;
    try {
      clean = decodeURIComponent(raw.split('#')[0].split('?')[0]);
    } catch {
      failures.push(`${relative(distRoot, htmlFile)} -> malformed URL: ${raw}`);
      continue;
    }

    if (!clean) continue;
    const functionCandidates = dynamicFunctionCandidates(clean);
    if (functionCandidates.length) {
      if (!(await Promise.all(functionCandidates.map(exists))).some(Boolean)) {
        failures.push(`${relative(distRoot, htmlFile)} -> missing Netlify Function source: ${raw}`);
      }
      continue;
    }

    const target = clean.startsWith('/')
      ? resolve(distRoot, `.${clean}`)
      : resolve(dirname(htmlFile), clean);
    if (!target.startsWith(distRoot + sep) && target !== distRoot) {
      failures.push(`${relative(distRoot, htmlFile)} -> escaped build root: ${raw}`);
      continue;
    }

    const candidates = [target];
    if (clean.endsWith('/')) candidates.push(join(target, 'index.html'));
    if (!extname(clean)) candidates.push(`${target}.html`, join(target, 'index.html'));
    if (clean === '/404/' || clean === '/404') candidates.push(join(distRoot, '404.html'));
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
      failures.push(`${relative(distRoot, htmlFile)} -> missing: ${raw}`);
    }
  }
}

for (const [htmlFile, html] of htmlByFile) {
  const route = relative(distRoot, htmlFile).split(sep).join('/');
  const canonical = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)/i)?.[1]
    ?? html.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["']/i)?.[1]
    ?? '';
  if (canonical) {
    try {
      const url = new URL(canonical);
      if (url.protocol !== 'https:' || url.hostname !== 'grant-desk.com') {
        failures.push(`${route} -> canonical must use https://grant-desk.com without www: ${canonical}`);
      }
    } catch {
      failures.push(`${route} -> malformed canonical URL: ${canonical}`);
    }
  }

  const h1Count = [...html.matchAll(/<h1\b/gi)].length;
  if (h1Count > 1) failures.push(`${route} -> expected no more than one h1, found ${h1Count}`);
}

const classroomHubs = [
  'boss_fight_review.html',
  'classroom-jeopardy.html',
  'evidence_locker.html',
  'hidden-history-unit1.html',
  'jeopardy-hidden-history-unit1.html',
  'jeopardy-scoreboard-unit1.html',
  'lessonhub-lab.html',
  'market_shock_arena.html',
  'paycheck-taxes.html',
  'scoreboard-unit1.html',
  'situation_room.html',
];
for (const hub of classroomHubs) {
  const hubPath = join(distRoot, 'hubs', hub);
  const html = htmlByFile.get(hubPath) ?? (await exists(hubPath) ? await readFile(hubPath, 'utf8') : '');
  if (!html) {
    failures.push(`hubs/${hub} -> classroom hub was not built`);
    continue;
  }
  if (!/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']noindex,\s*follow["']/i.test(html)) {
    failures.push(`hubs/${hub} -> classroom hub must declare noindex, follow`);
  }
  const expectedCanonical = `https://grant-desk.com/hubs/${hub}`;
  const hubChecks = [
    [/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'][^"']+["']/i, 'description'],
    [/<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["'][^"']+["']/i, 'Open Graph title'],
    [/<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["'][^"']+["']/i, 'Open Graph description'],
    [/<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']https:\/\/grant-desk\.com\/[^"']+["']/i, 'Open Graph image'],
    [/<meta\b[^>]*\bname=["']twitter:card["'][^>]*\bcontent=["']summary_large_image["']/i, 'Twitter card'],
  ];
  hubChecks.forEach(([pattern, label]) => {
    if (!pattern.test(html)) failures.push(`hubs/${hub} -> missing ${label}`);
  });
  if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) {
    failures.push(`hubs/${hub} -> canonical must be ${expectedCanonical}`);
  }
  if (!html.includes(`<meta property="og:url" content="${expectedCanonical}">`)) {
    failures.push(`hubs/${hub} -> Open Graph URL must match its canonical URL`);
  }
}

const firstDayPath = join(distRoot, 'first-day-materials', 'index.html');
if (await exists(firstDayPath)) {
  const firstDayHtml = htmlByFile.get(firstDayPath) ?? await readFile(firstDayPath, 'utf8');
  const firstDayChecks = [
    [/<a\b[^>]*\bhref=["']#main-content["']/i, 'skip link'],
    [/<main\b[^>]*\bid=["']main-content["']/i, 'main landmark target'],
    [/<nav\b[^>]*\baria-label=["']Primary navigation["']/i, 'primary navigation landmark'],
    [/<nav\b[^>]*\baria-label=["']Footer navigation["']/i, 'footer navigation landmark'],
  ];
  firstDayChecks.forEach(([pattern, label]) => {
    if (!pattern.test(firstDayHtml)) failures.push(`first-day-materials/index.html -> missing ${label}`);
  });
}

const homeHtml = htmlByFile.get(join(distRoot, 'index.html')) ?? '';
if (homeHtml.includes('The farther backward you can look, the farther forward you are likely to see.')) {
  failures.push('index.html -> falsely attributed Churchill wording returned');
}
if (!homeHtml.includes('The longer you can look back, the farther you can look forward.')) {
  failures.push('index.html -> verified Churchill wording is missing');
}

const detourPath = join(distRoot, 'detour-shelf', 'index.html');
if (!(await exists(detourPath))) {
  failures.push('detour-shelf/index.html -> unified Detour Shelf route was not built');
} else {
  const detourHtml = await readFile(detourPath, 'utf8');
  const readyDecks = [...detourHtml.matchAll(/<article[^>]+data-detour-kind="decks"/gi)].length;
  const openingStories = [...detourHtml.matchAll(/<article[^>]+data-detour-kind="stories"/gi)].length;
  if (readyDecks !== 80) failures.push(`detour-shelf/index.html -> expected 80 ready decks, found ${readyDecks}`);
  if (openingStories !== 90) failures.push(`detour-shelf/index.html -> expected 90 opening stories, found ${openingStories}`);
}

for (const retiredRoute of ['cold-openers', 'rabbit-holes']) {
  if (await exists(join(distRoot, retiredRoute, 'index.html'))) {
    failures.push(`${retiredRoute}/index.html -> retired split route still built instead of the unified Detour Shelf`);
  }
}

// --- first-day calendar dates (repair item 20) ---
const instructionalDays = [
  ['01', 'Thu Aug 27'], ['02', 'Fri Aug 28'], ['03', 'Mon Aug 31'],
  ['04', 'Tue Sep 1'],  ['05', 'Wed Sep 2'],  ['06', 'Thu Sep 3'],
  ['07', 'Tue Sep 8'],  ['08', 'Wed Sep 9'],  ['09', 'Thu Sep 10'],
  ['10', 'Fri Sep 11'], ['11', 'Mon Sep 14'], ['12', 'Tue Sep 15'],
  ['13', 'Wed Sep 16'], ['14', 'Thu Sep 17'], ['15', 'Fri Sep 18'],
  ['16', 'Mon Sep 21'], ['17', 'Tue Sep 22'], ['18', 'Wed Sep 23'],
  ['19', 'Thu Sep 24'], ['20', 'Fri Sep 25'],
];
if (await exists(firstDayPath)) {
  const firstDayHtml = htmlByFile.get(firstDayPath) ?? await readFile(firstDayPath, 'utf8');
  for (const [day, date] of instructionalDays) {
    if (!firstDayHtml.includes(`<b>${day}</b>${date}<`)) {
      failures.push(`first-day-materials/index.html -> day ${day} must be dated ${date}`);
    }
  }
  const dayCells = [...firstDayHtml.matchAll(/<td class="day"><b>\d\d<\/b>/g)].length;
  if (dayCells !== instructionalDays.length) {
    failures.push(`first-day-materials/index.html -> expected ${instructionalDays.length} instructional day cells, found ${dayCells}`);
  }
  if (!firstDayHtml.includes('Fri Sep 4 and Mon Sep 7 · no school')) {
    failures.push('first-day-materials/index.html -> missing the explicit no-school row for Sep 4 and Sep 7');
  }
  if (/<td class="day"><b>\d\d<\/b>(?:Fri Sep 4|Mon Sep 7)</.test(firstDayHtml)) {
    failures.push('first-day-materials/index.html -> a lesson is scheduled on a no-school date');
  }
  if (firstDayHtml.includes('1865 → 1900')) {
    failures.push('first-day-materials/index.html -> U.S. History scope still ends at 1900 (repair item 21)');
  }
}

// --- paycheck and taxes annual constants (repair item 48) ---
const taxPath = join(distRoot, 'hubs', 'paycheck-taxes.html');
if (await exists(taxPath)) {
  const taxHtml = htmlByFile.get(taxPath) ?? await readFile(taxPath, 'utf8');
  if (!taxHtml.includes('hoh:[[17700,.10],[67450,.12],[105700,.22],[201750,.24],[256200,.32],[640600,.35],[Infinity,.37]]')) {
    failures.push('hubs/paycheck-taxes.html -> 2026 head-of-household brackets do not match the published IRS table');
  }
  if (!taxHtml.includes('single:[[12400,.10],[50400,.12],[105700,.22],[201775,.24],[256225,.32],[640600,.35],[Infinity,.37]]')) {
    failures.push('hubs/paycheck-taxes.html -> 2026 single-filer brackets do not match the published IRS table');
  }
}

// --- unit names and their material assignment keys stay in step (repair items 25, 26) ---
const renamedUnits = [
  ['Beyond the Scoreboard', 'The Athlete Revolt, 1967–1980', 'The Athlete Revolt, 1963–1980'],
  ['Beyond the Scoreboard', 'The Money Game, 1979–2005', 'The Money Game, 1980–2004'],
  ['Beyond the Scoreboard', 'The Modern Arena, 2005–today', 'The Modern Arena, 2004–today'],
  ['US History', 'Civil Rights & the Soundtrack of a Movement', 'The Civil Rights Movement'],
];
const unitMaterials = JSON.parse(await readFile(resolve(process.cwd(), 'src', 'data', 'unit-materials.json'), 'utf8'));
for (const [course, current, retired] of renamedUnits) {
  const assignments = unitMaterials.courses?.[course] ?? {};
  if (!Object.prototype.hasOwnProperty.call(assignments, current)) {
    failures.push(`unit-materials.json -> ${course} is missing an assignment key for "${current}"`);
  }
  if (Object.prototype.hasOwnProperty.call(assignments, retired)) {
    failures.push(`unit-materials.json -> ${course} still carries the retired key "${retired}"`);
  }
}

// --- StoryHub releases: every declared route must ship as an indexable, shareable page ---
const storyhubReleaseDir = resolve(process.cwd(), 'storyhub', 'releases');
if (await exists(storyhubReleaseDir)) {
  for (const entry of await readdir(storyhubReleaseDir)) {
    if (!entry.endsWith('.json')) continue;
    const release = JSON.parse(await readFile(join(storyhubReleaseDir, entry), 'utf8'));
    const route = String(release.route ?? '').replace(/^\/+/, '');
    if (!route) continue;
    const routePath = join(distRoot, route);
    const html = htmlByFile.get(routePath) ?? ((await exists(routePath)) ? await readFile(routePath, 'utf8') : '');
    if (!html) {
      failures.push(`${route} -> StoryHub release ${release.storyId} was not built`);
      continue;
    }
    const expectedCanonical = `https://grant-desk.com/${route}`;
    const storyChecks = [
      [/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'][^"']+["']/i, 'description'],
      [/<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["'][^"']+["']/i, 'Open Graph title'],
      [/<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']https:\/\/grant-desk\.com\/[^"']+["']/i, 'Open Graph image'],
      [/<meta\b[^>]*\bname=["']twitter:card["'][^>]*\bcontent=["']summary_large_image["']/i, 'Twitter card'],
      [/<a\b[^>]*\bclass=["']skip["'][^>]*\bhref=["']#main-content["']/i, 'skip link'],
      [/<main\b[^>]*\bid=["']main-content["']/i, 'main landmark target'],
      [/prefers-reduced-motion/i, 'reduced-motion handling'],
    ];
    storyChecks.forEach(([pattern, label]) => {
      if (!pattern.test(html)) failures.push(`${route} -> StoryHub page missing ${label}`);
    });
    if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) {
      failures.push(`${route} -> StoryHub canonical must be ${expectedCanonical}`);
    }
    if (/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["'][^"']*noindex/i.test(html)) {
      failures.push(`${route} -> StoryHub pages are public lesson content and must not be noindex`);
    }
    if (/data:image\/(?:webp|png|jpe?g|gif)/i.test(html)) {
      failures.push(`${route} -> StoryHub page still embeds data: image URIs instead of cacheable asset files`);
    }
  }
}

if (failures.length) {
  console.error(`Static site validation: FAIL (${failures.length} missing or unsafe references)`);
  failures.slice(0, 100).forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Static site validation: PASS — ${htmlFiles.length} HTML files, ${references} local references checked`);
}
