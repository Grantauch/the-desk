import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { publishSite, run } from './publish-site.mjs';
import { syncPublicResources } from './sync-public-resources.mjs';
import { editorResources, validateMaterials } from '../editor/materials.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'grantdesk-publish-fixtures-'));
let passed = 0, sequence = 0;
const write = (base, name, value) => {
  const target = join(base, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
};
const json = (base, name, value) => write(base, name, JSON.stringify(value));
const read = (base, name) => readFileSync(join(base, name), 'utf8');
const git = (base, ...args) => run('git', args, base);
const commit = async (base, ...files) => {
  await git(base, 'add', '--', ...files);
  await git(base, 'commit', '-m', 'synthetic fixture');
};
const fixture = async () => {
  const base = join(scratch, `case-${++sequence}`), remote = join(scratch, `remote-${sequence}.git`);
  mkdirSync(base);
  await git(scratch, 'init', '--bare', remote);
  await git(base, 'init', '-b', 'main');
  await git(base, 'config', 'user.name', 'Synthetic Publisher');
  await git(base, 'config', 'user.email', 'publisher@example.invalid');
  await git(base, 'config', 'commit.gpgsign', 'false');
  await git(base, 'config', 'core.autocrlf', 'false');
  write(base, '.gitignore', 'gate-result.txt\ngate-fail\ngate-mutate\nsrc/data/*.private.json\n');
  json(base, 'package.json', { type: 'module', private: true, scripts: { verify: 'node gate.cjs' } });
  write(base, 'gate.cjs', "const f=require('node:fs'); f.appendFileSync('gate-result.txt','verify\\n'); if(f.existsSync('gate-mutate'))f.appendFileSync('src/data/site-content.json',' '); if(f.existsSync('gate-fail'))process.exit(1);\n");
  write(base, 'src/data/site-content.json', '{"title":"before"}\n');
  write(base, 'src/data/unit-materials.json', '{"version":1,"courses":{"US History":{"Unit":[]}}}\n');
  write(base, 'src/data/resources.json', '{"resources":[]}\n');
  write(base, 'src/data/resources.private.json', 'private synthetic source unchanged\n');
  write(base, 'src/data/unit-materials.private.json', 'private synthetic assignments unchanged\n');
  await commit(base, '.gitignore', 'package.json', 'gate.cjs', 'src/data/site-content.json', 'src/data/unit-materials.json', 'src/data/resources.json');
  await git(base, 'remote', 'add', 'origin', remote);
  await git(base, 'push', 'origin', 'HEAD:refs/heads/main');
  const head = (await git(base, 'rev-parse', 'HEAD')).trim();
  return { base, remote, head };
};
const sameRemote = async ({ remote, head }) => assert.equal((await git(remote, 'rev-parse', 'main')).trim(), head);
const change = (base) => write(base, 'src/data/site-content.json', '{"title":"after"}\n');
const test = async (name, action) => { await action(); passed++; console.log(`PASS: ${name}`); };

try {
  await test('sync and editor retain assigned null/empty/absent-link placeholders and exclude private rows', async () => {
    const base = join(scratch, 'resources');
    const item = { course: 'US History', unitTopic: 'Unit', name: 'Lesson', type: 'Packet', onWebsite: true, privateNote: 'synthetic authoring metadata' };
    const rows = [
      { ...item, id: 'linked', href: 'https://example.org/lesson' },
      { ...item, id: 'null', href: null, status: 'coming-soon' },
      { ...item, id: 'empty', href: '', status: 'coming-soon' },
      { ...item, id: 'absent', status: 'coming-soon' },
      { ...item, id: 'restricted', status: 'restricted', href: 'https://example.org/private' },
      { ...item, id: 'unapproved', onWebsite: false, href: 'https://example.org/private' },
      { ...item, id: 'unlinked' },
      { ...item, id: 'whitespace', href: ' ' },
    ];
    const assignments = { version: 1, courses: { 'US History': { Unit: rows.map((row) => row.id) } } };
    json(base, 'src/data/resources.private.json', { resources: rows });
    json(base, 'src/data/unit-materials.private.json', assignments);
    const before = read(base, 'src/data/resources.private.json'), privateAssignments = read(base, 'src/data/unit-materials.private.json');
    const catalog = syncPublicResources(base);
    const materials = JSON.parse(read(base, 'src/data/unit-materials.json'));
    assert.deepEqual(catalog.resources.map((row) => row.id), ['linked', 'null', 'empty', 'absent']);
    assert.equal(catalog.linkedCount, 1);
    assert.equal(catalog.resources.some((row) => Object.hasOwn(row, 'privateNote')), false);
    assert.deepEqual(materials.courses['US History'].Unit, ['linked', 'null', 'empty', 'absent']);
    assert.equal(read(base, 'src/data/resources.private.json'), before);
    assert.equal(read(base, 'src/data/unit-materials.private.json'), privateAssignments);
    assert.deepEqual(editorResources(rows, materials).map((row) => row.id), ['linked', 'null', 'empty', 'absent']);
    assert.deepEqual(validateMaterials(materials, rows, materials), materials);
    for (const id of ['restricted', 'unapproved', 'unlinked', 'whitespace', 'unknown']) {
      assert.throws(() => validateMaterials(materials, rows, { courses: { 'US History': { Unit: [id] } } }), /no longer matches/);
    }
    const wrongCourse = rows.map((row) => row.id === 'null' ? { ...row, course: 'Hidden History' } : row);
    assert.throws(() => validateMaterials(materials, wrongCourse, materials), /no longer matches/);
    const priorCatalog = read(base, 'src/data/resources.json'), priorMaterials = read(base, 'src/data/unit-materials.json');
    for (const broken of [
      { resources: [{ ...rows[0], href: 'file:///C:/private' }] },
      { resources: [{ ...rows[0], course: 'Hidden History' }] },
      { resources: [{ ...rows[1], href: 42 }] },
    ]) {
      json(base, 'src/data/resources.private.json', broken);
      assert.throws(() => syncPublicResources(base), /validation failed/);
      assert.equal(read(base, 'src/data/resources.json'), priorCatalog);
      assert.equal(read(base, 'src/data/unit-materials.json'), priorMaterials);
    }
  });
  await test('manual publish verifies selected files, preserves private sources, confirms remote and handles no-op', async () => {
    const f = await fixture();
    write(f.base, 'new file.txt', 'intended');
    await git(f.base, 'add', '--', 'new file.txt');
    const result = await publishSite(f.base, { confirm: async (review) => { assert.match(review, /new file/); return true; } });
    assert.equal(result.status, 'pushed');
    assert.equal(read(f.base, 'gate-result.txt'), 'verify\n');
    assert.equal(read(f.base, 'src/data/resources.private.json'), 'private synthetic source unchanged\n');
    assert.equal(read(f.base, 'src/data/unit-materials.private.json'), 'private synthetic assignments unchanged\n');
    assert.equal((await git(f.remote, 'rev-parse', 'main')).trim(), result.commit);
    assert.equal((await publishSite(f.base)).status, 'unchanged');
    assert.equal(read(f.base, 'gate-result.txt'), 'verify\n');
  });
  await test('editor publishes only its saved files and does not require private inventories', async () => {
    const f = await fixture();
    // A fresh synthetic checkout has no ignored private inventory.
    const clean = join(scratch, 'editor-without-private');
    await git(scratch, 'clone', '--branch', 'main', f.remote, clean);
    await git(clean, 'config', 'user.name', 'Synthetic Publisher');
    await git(clean, 'config', 'user.email', 'publisher@example.invalid');
    await git(clean, 'config', 'commit.gpgsign', 'false');
    const catalogBefore = read(clean, 'src/data/resources.json');
    change(clean);
    write(clean, 'src/content/announcements/2026-09-06-fixture.md', 'synthetic announcement');
    const result = await publishSite(clean, { editor: true });
    assert.equal(result.status, 'pushed');
    assert.equal(read(clean, 'src/data/resources.json'), catalogBefore);
    assert.deepEqual((await git(clean, 'diff', '--name-only', `${f.head}..HEAD`)).trim().split('\n').sort(), [
      'src/content/announcements/2026-09-06-fixture.md', 'src/data/site-content.json',
    ]);
  });
  for (const kind of ['staged', 'unstaged', 'untracked']) await test(`editor refuses unrelated ${kind} work without uploading`, async () => {
    const f = await fixture();
    change(f.base);
    if (kind === 'staged') await git(f.base, 'add', '--', 'src/data/site-content.json');
    if (kind === 'unstaged') write(f.base, 'gate.cjs', '// unrelated edit');
    if (kind === 'untracked') write(f.base, 'private-notes.txt', 'unrelated');
    await assert.rejects(publishSite(f.base, { editor: true }), /staged changes|Other project changes/);
    await sameRemote(f);
    assert.equal(existsSync(join(f.base, 'gate-result.txt')), false);
  });
  await test('manual publish refuses unstaged or untracked work without auto-staging', async () => {
    const f = await fixture(); change(f.base);
    await assert.rejects(publishSite(f.base), /Stage only/);
    assert.equal((await git(f.base, 'diff', '--cached', '--name-only')).trim(), '');
    await sameRemote(f);
  });
  await test('verification failure stops commit and upload', async () => {
    const f = await fixture(); change(f.base); write(f.base, 'gate-fail', 'fail');
    await assert.rejects(publishSite(f.base, { editor: true }), /failed/);
    assert.equal((await git(f.base, 'rev-parse', 'HEAD')).trim(), f.head);
    assert.equal((await git(f.base, 'diff', '--cached', '--name-only')).trim(), '');
    await sameRemote(f);
  });
  await test('a source mutation during verify stops publishing', async () => {
    const f = await fixture(); change(f.base); write(f.base, 'gate-mutate', 'mutate');
    await assert.rejects(publishSite(f.base, { editor: true }), /changed during verification/);
    await sameRemote(f);
  });
  await test('confirmation cancellation preserves selected batch', async () => {
    const f = await fixture(); change(f.base); await git(f.base, 'add', '--', 'src/data/site-content.json');
    assert.equal((await publishSite(f.base, { confirm: async () => false })).status, 'cancelled');
    assert.match(await git(f.base, 'diff', '--cached', '--name-only'), /site-content/);
    await sameRemote(f);
  });
  await test('a change while confirmation is open invalidates verification', async () => {
    const f = await fixture(); change(f.base); await git(f.base, 'add', '--', 'src/data/site-content.json');
    await assert.rejects(publishSite(f.base, { confirm: async () => { write(f.base, 'src/data/site-content.json', 'changed again'); return true; } }), /changed during verification/);
    await sameRemote(f);
  });
  await test('Git and publisher locks remain intact and prevent publishing', async () => {
    const f = await fixture();
    for (const name of ['index.lock', 'grantdesk-publish.lock']) {
      write(f.base, `.git/${name}`, 'owned by another process');
      await assert.rejects(publishSite(f.base), /lock|publish is running/);
      assert.equal(read(f.base, `.git/${name}`), 'owned by another process');
      // Remove only the synthetic lock created by this fixture.
      rmSync(join(f.base, '.git', name));
    }
    await sameRemote(f);
  });
  await test('non-main branch is rejected', async () => {
    const f = await fixture(); await git(f.base, 'switch', '-c', 'fixture-branch');
    await assert.rejects(publishSite(f.base), /only allowed from main/);
    await sameRemote(f);
  });
  await test('failed push preserves local commit and a later retry uploads it', async () => {
    const f = await fixture(); change(f.base);
    await git(f.base, 'remote', 'set-url', '--push', 'origin', join(scratch, 'missing-remote.git'));
    await assert.rejects(publishSite(f.base, { editor: true }), /Upload was not confirmed/);
    const local = (await git(f.base, 'rev-parse', 'HEAD')).trim();
    assert.notEqual(local, f.head); await sameRemote(f);
    await git(f.base, 'config', '--unset', 'remote.origin.pushurl');
    const retry = await publishSite(f.base, { editor: true });
    assert.equal(retry.commit, local);
    assert.equal((await git(f.remote, 'rev-parse', 'main')).trim(), local);
  });
  await test('remote advancement prevents stale publication', async () => {
    const f = await fixture();
    const other = join(scratch, 'advanced-remote');
    await git(scratch, 'clone', '--branch', 'main', f.remote, other);
    await git(other, 'config', 'user.name', 'Synthetic Publisher');
    await git(other, 'config', 'user.email', 'publisher@example.invalid');
    await git(other, 'config', 'commit.gpgsign', 'false');
    change(other); await commit(other, 'src/data/site-content.json');
    await git(other, 'push', 'origin', 'main');
    change(f.base);
    await assert.rejects(publishSite(f.base, { editor: true }), /Remote main has changes/);
    assert.equal((await git(f.base, 'rev-parse', 'HEAD')).trim(), f.head);
  });
  await test('actual editor HTTP save/publish preserves placeholders and rejects concurrent writes', async () => {
    const f = await fixture();
    for (const name of ['editor/server.mjs', 'editor/materials.mjs', 'editor/index.html', 'scripts/publish-site.mjs', 'src/lib/public-resources.js']) {
      mkdirSync(dirname(join(f.base, name)), { recursive: true }); copyFileSync(join(root, name), join(f.base, name));
    }
    const materials = { version: 1, courses: { 'US History': { Unit: ['preparing'] } } };
    json(f.base, 'src/data/resources.json', { resources: [{ id: 'preparing', course: 'US History', name: 'Preparing', unitTopic: 'Unit', type: 'Packet', status: 'coming-soon', onWebsite: true, href: null }] });
    json(f.base, 'src/data/unit-materials.json', materials);
    json(f.base, 'src/data/unit-materials.private.json', { version: 1, courses: { 'US History': { Unit: ['preparing', 'private'] } } });
    mkdirSync(join(f.base, 'src/content/announcements'), { recursive: true });
    write(f.base, 'gate.cjs', "const f=require('node:fs'); f.appendFileSync('gate-result.txt','verify\\n'); setTimeout(()=>{},1500);\n");
    await commit(f.base, 'editor/server.mjs', 'editor/materials.mjs', 'editor/index.html', 'scripts/publish-site.mjs', 'src/lib/public-resources.js', 'src/data/resources.json', 'src/data/unit-materials.json', 'gate.cjs');
    await git(f.base, 'push', 'origin', 'main');
    const child = spawn(process.execPath, ['editor/server.mjs'], { cwd: f.base, windowsHide: true, env: { ...process.env, DESK_EDITOR_NO_OPEN: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const url = await new Promise((resolveUrl, reject) => {
        const timer = setTimeout(() => reject(new Error('Editor startup timed out')), 10000);
        let output = '';
        child.once('error', (error) => { clearTimeout(timer); reject(error); });
        child.stdout.on('data', (chunk) => {
          output += chunk;
          const found = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[a-f0-9]+/);
          if (found) { clearTimeout(timer); resolveUrl(new URL(found[0])); }
        });
      });
      const headers = { 'x-editor-token': url.searchParams.get('token'), 'Content-Type': 'application/json' };
      const state = await (await fetch(new URL('/api/state', url), { headers })).json();
      assert.equal(state.resources[0].status, 'coming-soon');
      const saved = await fetch(new URL('/api/materials', url), { method: 'POST', headers, body: JSON.stringify(materials) });
      assert.equal(saved.status, 200);
      assert.deepEqual(JSON.parse(read(f.base, 'src/data/unit-materials.json')), materials);
      assert.deepEqual(JSON.parse(read(f.base, 'src/data/unit-materials.private.json')).courses['US History'].Unit, ['preparing', 'private']);
      const publication = fetch(new URL('/api/publish', url), { method: 'POST', headers, body: '{}' });
      const until = Date.now() + 10000;
      while (!existsSync(join(f.base, 'gate-result.txt')) && Date.now() < until) await new Promise((done) => setTimeout(done, 50));
      assert.ok(existsSync(join(f.base, 'gate-result.txt')), 'HTTP publisher entered verification');
      for (const route of ['/api/content', '/api/publish']) {
        const concurrent = await fetch(new URL(route, url), { method: 'POST', headers, body: '{"title":"must not save"}' });
        assert.equal(concurrent.status, 409);
      }
      const uploaded = await publication;
      assert.equal(uploaded.status, 200);
      const release = await uploaded.json();
      assert.equal(release.status, 'pushed');
      assert.equal((await git(f.remote, 'rev-parse', 'main')).trim(), release.commit);
      assert.deepEqual(JSON.parse(read(f.base, 'src/data/unit-materials.json')), materials);
      assert.deepEqual(JSON.parse(read(f.base, 'src/data/unit-materials.private.json')).courses['US History'].Unit, ['preparing', 'private']);
    } finally {
      const stopped = new Promise((resolveExit) => child.once('exit', resolveExit)); child.kill(); await stopped;
    }
  });
  await test('production configuration and all local shortcuts use the shared gate', async () => {
    assert.match(read(root, 'netlify.toml'), /command = "npm run verify"/);
    assert.match(read(root, 'publish.bat'), /node scripts\\publish-site\.mjs/);
    for (const name of ['publish-games.bat', 'publish-new-year.bat']) {
      assert.match(read(root, name), /call "%~dp0publish\.bat"/);
      assert.doesNotMatch(read(root, name), /git add|git push|\bdel\s/i);
    }
    assert.doesNotMatch(read(root, 'editor/server.mjs'), /resources:sync|git', \['add'/);
    assert.match(read(root, 'editor/server.mjs'), /publishSite\(root, \{ editor: true \}\)/);
  });
  console.log(`Publishing/resource integration: ${passed} checks passed using synthetic local repositories and an editor HTTP fixture. No external uploads.`);
} finally {
  // The entire tree belongs to this mkdtemp-created synthetic fixture run.
  if (resolve(scratch).startsWith(resolve(tmpdir()) + '\\') || resolve(scratch).startsWith(resolve(tmpdir()) + '/')) {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
