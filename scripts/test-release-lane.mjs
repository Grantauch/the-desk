import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { classifyRelease, verificationScriptFor } from './release-lane.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'grantdesk-release-lane-'));
let passed = 0;
const git = (base, ...args) => execFileSync('git', args, { cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const write = (base, path, content) => {
  const target = join(base, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
};
const commit = (base, message) => {
  git(base, 'add', '--all');
  git(base, 'commit', '-m', message);
  return git(base, 'rev-parse', 'HEAD').trim();
};
const coursePage = ({ name = 'The Gilded Age', title = 'L015', href = '/hubs/ush9-l015.html' } = {}) => `const units = [\n  {\n    name: '${name}',\n    storyhub: {\n      title: '${title}',\n      href: '${href}',\n      blurb: 'fixture',\n    },\n  },\n];\n`;
const workPanel = (hubs, { count = hubs.length, checkedAt = '2026-10-29', mode = 'assignment' } = {}) => `${JSON.stringify({
  checkedAt,
  catalogueCount: count,
  hubs: hubs.map(hub => ({ hub, mode, legacyStorageMovedToTab: false })),
}, null, 2)}\n`;
const createFixture = () => {
  const base = join(scratch, `case-${passed + 1}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(base);
  git(base, 'init', '-b', 'main');
  git(base, 'config', 'user.name', 'Release Lane Fixture');
  git(base, 'config', 'user.email', 'fixture@example.invalid');
  git(base, 'config', 'commit.gpgsign', 'false');
  write(base, 'src/data/storyhubs.ts', "export const storyHubs = [{ href: '/hubs/ush9-l015.html' }];\n");
  write(base, 'public/hubs/ush9-l015.html', '<!doctype html><h1>L015</h1>\n');
  write(base, 'public/storyhub/ush9/l015/assets/a.svg', '<svg/>\n');
  write(base, 'storyhub/stories/USH9/L015/story.json', '{}\n');
  write(base, 'src/pages/us-history.astro', coursePage());
  write(base, 'docs/storyhub/work-panel-catalog.json', workPanel(['ush9-l015.html']));
  write(base, 'src/pages/hidden-history.astro', "const units = [{ name: 'Evidence' }];\n");
  write(base, 'src/pages/beyond-the-scoreboard.astro', "const units = [{ name: 'Sport' }];\n");
  write(base, 'src/components/Nav.astro', '<nav>core</nav>\n');
  write(base, 'public/storyhub/runtime/storyhub-runtime.js', 'export const runtime = true;\n');
  write(base, '.github/workflows/site-check.yml', 'name: site check\n');
  return { base, initial: commit(base, 'initial') };
};
const test = async (name, action) => {
  await action();
  passed++;
  console.log(`PASS: ${name}`);
};

await test('new catalogued StoryHub, assets, manifests, and course pointer use fast lane', () => {
  const f = createFixture();
  write(f.base, 'src/data/storyhubs.ts', "export const storyHubs = [{ href: '/hubs/ush9-l015.html' }, { href: '/hubs/ush9-l016.html' }];\n");
  write(f.base, 'public/hubs/ush9-l016.html', '<!doctype html><h1>L016</h1><img src="/storyhub/ush9/l016/assets/a.svg">\n');
  write(f.base, 'public/storyhub/ush9/l016/assets/a.svg', '<svg/>\n');
  write(f.base, 'storyhub/stories/USH9/L016/story.json', '{}\n');
  write(f.base, 'src/pages/us-history.astro', coursePage({ title: 'L016', href: '/hubs/ush9-l016.html' }));
  const head = commit(f.base, 'storyhub release');
  const result = classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head });
  assert.equal(result.mode, 'storyhub');
  assert.equal(verificationScriptFor(result), 'verify:storyhub-fast');
  assert.deepEqual(result.routes, ['/hubs/ush9-l016.html', '/storyhubs/', '/us-history/']);
});

await test('editing an existing StoryHub page stays in fast lane', () => {
  const f = createFixture();
  write(f.base, 'public/hubs/ush9-l015.html', '<!doctype html><h1>L015 improved</h1>\n');
  const head = commit(f.base, 'edit hub');
  const result = classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head });
  assert.equal(result.mode, 'storyhub');
  assert.ok(result.routes.includes('/hubs/ush9-l015.html'));
});

await test('uncatalogued standalone HTML fails closed to full lane', () => {
  const f = createFixture();
  write(f.base, 'public/hubs/random-game.html', '<h1>game</h1>\n');
  const head = commit(f.base, 'random hub');
  const result = classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head });
  assert.equal(result.mode, 'full');
  assert.ok(result.disallowed.includes('public/hubs/random-game.html'));
});

await test('shared StoryHub runtime change requires full lane', () => {
  const f = createFixture();
  write(f.base, 'public/storyhub/runtime/storyhub-runtime.js', 'export const runtime = false;\n');
  const head = commit(f.base, 'runtime');
  assert.equal(classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head }).mode, 'full');
});

await test('core component or workflow change requires full lane', () => {
  for (const path of ['src/components/Nav.astro', '.github/workflows/site-check.yml']) {
    const f = createFixture();
    write(f.base, path, `${path}\nchanged\n`);
    const head = commit(f.base, `core ${path}`);
    assert.equal(classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head }).mode, 'full');
  }
});

await test('course page changes beyond the StoryHub block require full lane', () => {
  const f = createFixture();
  write(f.base, 'src/pages/us-history.astro', coursePage({ name: 'Renamed Gilded Age' }));
  const head = commit(f.base, 'course content');
  assert.equal(classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head }).mode, 'full');
});

await test('staged local StoryHub batch is classified without committing', () => {
  const f = createFixture();
  write(f.base, 'public/hubs/ush9-l015.html', '<!doctype html><h1>staged</h1>\n');
  git(f.base, 'add', '--', 'public/hubs/ush9-l015.html');
  const result = classifyRelease({ projectRoot: f.base, baseRef: 'HEAD', index: true });
  assert.equal(result.mode, 'storyhub');
  assert.ok(result.routes.includes('/hubs/ush9-l015.html'));
});

await test('adding a catalogued hub to the work panel catalog stays in fast lane', () => {
  const f = createFixture();
  write(f.base, 'src/data/storyhubs.ts', "export const storyHubs = [{ href: '/hubs/ush9-l015.html' }, { href: '/hubs/ush9-l016.html' }];\n");
  write(f.base, 'public/hubs/ush9-l016.html', '<!doctype html><h1>L016</h1>\n');
  write(f.base, 'docs/storyhub/work-panel-catalog.json', workPanel(['ush9-l015.html', 'ush9-l016.html'], { checkedAt: '2026-11-17' }));
  const head = commit(f.base, 'new hub with work panel entry');
  const result = classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head });
  assert.equal(result.mode, 'storyhub');
  assert.ok(result.routes.includes('/hubs/ush9-l016.html'));
});

await test('work panel catalog changes that do not match the StoryHub catalog require full lane', () => {
  const cases = [
    ['entry for an uncatalogued hub', workPanel(['ush9-l015.html', 'random-game.html'], { count: 1 })],
    ['removed entry', workPanel([], { count: 1 })],
    ['count that disagrees with the catalog', workPanel(['ush9-l015.html'], { count: 2 })],
    ['malformed file', '{ not json\n'],
  ];
  for (const [label, text] of cases) {
    const f = createFixture();
    write(f.base, 'docs/storyhub/work-panel-catalog.json', text);
    const head = commit(f.base, label);
    const result = classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head });
    assert.equal(result.mode, 'full', label);
    assert.ok(result.disallowed.includes('docs/storyhub/work-panel-catalog.json'), label);
  }
});

await test('a new top level field in the work panel catalog requires full lane', () => {
  const f = createFixture();
  const extra = JSON.parse(workPanel(['ush9-l015.html']));
  extra.policy = 'changed';
  write(f.base, 'docs/storyhub/work-panel-catalog.json', `${JSON.stringify(extra, null, 2)}\n`);
  const head = commit(f.base, 'extra field');
  assert.equal(classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head }).mode, 'full');
});

await test('a catalog entry written with quoted keys still counts as catalogued', () => {
  const f = createFixture();
  write(f.base, 'src/data/storyhubs.ts', "export const storyHubs = [{ href: '/hubs/ush9-l015.html' }, { \"href\": \"/hubs/hh-l02.html\" }];\n");
  write(f.base, 'public/hubs/hh-l02.html', '<!doctype html><h1>HH</h1>\n');
  write(f.base, 'docs/storyhub/work-panel-catalog.json', workPanel(['ush9-l015.html', 'hh-l02.html']));
  const head = commit(f.base, 'quoted key hub');
  const result = classifyRelease({ projectRoot: f.base, baseRef: f.initial, headRef: head });
  assert.equal(result.mode, 'storyhub');
  assert.ok(result.routes.includes('/hubs/hh-l02.html'));
});

console.log(`Release lane classifier: ${passed}/${passed} fixture groups passed.`);
