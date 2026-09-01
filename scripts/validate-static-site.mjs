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

if (failures.length) {
  console.error(`Static site validation: FAIL (${failures.length} missing or unsafe references)`);
  failures.slice(0, 100).forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Static site validation: PASS — ${htmlFiles.length} HTML files, ${references} local references checked`);
}
