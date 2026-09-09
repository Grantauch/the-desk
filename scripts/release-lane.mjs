import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const courseRoutes = new Map([
  ['src/pages/us-history.astro', '/us-history/'],
  ['src/pages/hidden-history.astro', '/hidden-history/'],
  ['src/pages/beyond-the-scoreboard.astro', '/beyond-the-scoreboard/'],
]);

const git = (projectRoot, args, { allowFailure = false } = {}) => {
  try {
    return execFileSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (allowFailure) return null;
    const detail = String(error.stderr || error.stdout || error.message || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
};

const names = output => String(output || '').split('\0').filter(Boolean).map(name => name.replaceAll('\\', '/'));
const normalize = source => String(source || '')
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const readAt = (projectRoot, ref, path, { index = false } = {}) => {
  const spec = index ? `:${path}` : `${ref}:${path}`;
  return git(projectRoot, ['show', spec], { allowFailure: true }) ?? '';
};

const catalogRoutes = source => new Set(
  [...String(source || '').matchAll(/\bhref:\s*['"](\/hubs\/[^'"]+\.html)['"]/g)].map(match => match[1]),
);

const findMatchingBrace = (source, openIndex) => {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index++; continue; }
    if (char === '/' && next === '*') { blockComment = true; index++; continue; }
    if (char === '\'' || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const splitStoryhubBlocks = source => {
  const text = String(source || '');
  const blocks = [];
  let stripped = '';
  let cursor = 0;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const tail = text.slice(searchFrom);
    const match = /\bstoryhub\s*:/.exec(tail);
    if (!match) break;
    const token = searchFrom + match.index;
    const lineStart = text.lastIndexOf('\n', token - 1) + 1;
    if (text.slice(lineStart, token).trim()) {
      searchFrom = token + match[0].length;
      continue;
    }
    const open = text.indexOf('{', token + match[0].length);
    if (open < 0) return { valid: false, stripped: text, blocks: [] };
    const close = findMatchingBrace(text, open);
    if (close < 0) return { valid: false, stripped: text, blocks: [] };
    let end = close + 1;
    while (end < text.length && /[ \t]/.test(text[end])) end++;
    if (text[end] === ',') end++;
    while (end < text.length && /[ \t]/.test(text[end])) end++;
    if (text[end] === '\r' && text[end + 1] === '\n') end += 2;
    else if (text[end] === '\n') end++;
    stripped += text.slice(cursor, lineStart);
    blocks.push(text.slice(lineStart, end));
    cursor = end;
    searchFrom = end;
  }
  stripped += text.slice(cursor);
  return { valid: true, stripped: normalize(stripped), blocks };
};

const safeCoursePageChange = ({ baseText, targetText, targetCatalog }) => {
  const before = splitStoryhubBlocks(baseText);
  const after = splitStoryhubBlocks(targetText);
  if (!before.valid || !after.valid || before.stripped !== after.stripped) return false;
  for (const block of after.blocks) {
    const href = /\bhref:\s*['"](\/hubs\/[^'"]+\.html)['"]/.exec(block)?.[1];
    if (href && !targetCatalog.has(href)) return false;
  }
  return true;
};

const routeForHubPath = path => path.startsWith('public/hubs/') ? `/${path.slice('public/'.length)}` : null;

export function classifyRelease({ projectRoot = root, baseRef, headRef = 'HEAD', index = false } = {}) {
  if (!baseRef) return { mode: 'full', routes: [], changed: [], disallowed: ['missing base ref'], reason: 'No comparison base was available.' };
  const diffArgs = index
    ? ['diff', '--cached', '--no-renames', '--name-only', '-z', baseRef, '--']
    : ['diff', '--no-renames', '--name-only', '-z', baseRef, headRef, '--'];
  const changedOutput = git(projectRoot, diffArgs, { allowFailure: true });
  if (changedOutput === null) return { mode: 'full', routes: [], changed: [], disallowed: ['unavailable comparison'], reason: 'The comparison could not be read, so verification failed closed to the full lane.' };
  const changed = names(changedOutput);
  if (!changed.length) return { mode: 'full', routes: [], changed, disallowed: [], reason: 'No changed files were detected; the full lane is the safe default.' };

  const targetOptions = { index };
  const baseCatalogText = readAt(projectRoot, baseRef, 'src/data/storyhubs.ts');
  const targetCatalogText = readAt(projectRoot, headRef, 'src/data/storyhubs.ts', targetOptions);
  const baseCatalog = catalogRoutes(baseCatalogText);
  const targetCatalog = catalogRoutes(targetCatalogText);
  const knownHubPaths = new Set([...baseCatalog, ...targetCatalog].map(route => `public${route}`));
  const routes = new Set(['/storyhubs/']);
  const disallowed = [];

  for (const path of changed) {
    if (path === 'src/data/storyhubs.ts') continue;
    if (path.startsWith('storyhub/stories/')) continue;
    if (path.startsWith('public/storyhub/') && !path.startsWith('public/storyhub/runtime/')) continue;
    if (/^public\/hubs\/[^/]+\.html$/.test(path) && knownHubPaths.has(path)) {
      const route = routeForHubPath(path);
      if (route && targetCatalog.has(route)) routes.add(route);
      continue;
    }
    if (courseRoutes.has(path)) {
      const baseText = readAt(projectRoot, baseRef, path);
      const targetText = readAt(projectRoot, headRef, path, targetOptions);
      if (safeCoursePageChange({ baseText, targetText, targetCatalog })) {
        routes.add(courseRoutes.get(path));
        continue;
      }
    }
    disallowed.push(path);
  }

  if (disallowed.length) {
    return {
      mode: 'full', routes: [], changed, disallowed,
      reason: `Core or non-StoryHub paths changed: ${disallowed.join(', ')}`,
    };
  }

  const assetChanges = changed.filter(path => path.startsWith('public/storyhub/') && !path.startsWith('public/storyhub/runtime/'));
  if (assetChanges.length) {
    for (const route of targetCatalog) {
      const html = readAt(projectRoot, headRef, `public${route}`, targetOptions);
      if (!html) continue;
      if (assetChanges.some(path => html.includes(`/${path.slice('public/'.length)}`))) routes.add(route);
    }
  }

  return {
    mode: 'storyhub',
    routes: [...routes].sort(),
    changed,
    disallowed: [],
    reason: `StoryHub-only release: ${changed.length} changed file${changed.length === 1 ? '' : 's'}.`,
  };
}

export const verificationScriptFor = classification => classification.mode === 'storyhub' ? 'verify:storyhub-fast' : 'verify';

const parseArgs = argv => {
  const options = { headRef: 'HEAD', index: false, json: false, githubOutput: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--base') options.baseRef = argv[++index];
    else if (arg === '--head') options.headRef = argv[++index];
    else if (arg === '--index') options.index = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--github-output') options.githubOutput = true;
    else if (arg === '--root') options.projectRoot = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = classifyRelease(options);
    if (options.githubOutput && process.env.GITHUB_OUTPUT) {
      const oneLine = result.reason.replace(/[\r\n]+/g, ' ');
      appendFileSync(process.env.GITHUB_OUTPUT, `mode=${result.mode}\nroutes=${result.routes.join(',')}\nreason=${oneLine}\n`);
    }
    if (options.json) console.log(JSON.stringify(result));
    else {
      console.log(`Release lane: ${result.mode === 'storyhub' ? 'STORYHUB FAST' : 'FULL'}`);
      console.log(result.reason);
      if (result.routes.length) console.log(`Browser routes: ${result.routes.join(', ')}`);
    }
  } catch (error) {
    console.error(`Release classifier failed closed: ${error.message}`);
    process.exitCode = 1;
  }
}
