import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validatePublicResources, isPublicHref } from './validate-public-resources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = () => ({
  catalog: {
    source: 'the-desk-public-resource-catalog', resourceCount: 2, linkedCount: 1,
    resources: [
      { id: 'ready', course: 'US History', unitTopic: 'Unit', name: 'Ready', type: 'Slides', onWebsite: true, href: 'https://example.org/lesson' },
      { id: 'preparing', course: 'US History', unitTopic: 'Unit', name: 'Preparing', type: 'Packet', onWebsite: true, href: null, status: 'coming-soon' },
    ],
  },
  materials: { version: 1, courses: { 'US History': { Unit: ['ready', 'preparing'] } } },
});
const cases = [
  ['valid linked and null-href coming-soon assignments', () => {}, null],
  ['root-relative public link', ({ catalog }) => { catalog.resources[0].href = '/hubs/lesson.html'; }, null],
  ['coming-soon without href field', ({ catalog }) => { delete catalog.resources[1].href; }, null],
  ['empty unit assignments are legitimate', ({ materials }) => { materials.courses['US History'].Unit = []; }, null],
  ['incorrect total', ({ catalog }) => { catalog.resourceCount++; }, /resourceCount/],
  ['incorrect linked total', ({ catalog }) => { catalog.linkedCount++; }, /linkedCount/],
  ['duplicate resource ID', ({ catalog }) => { catalog.resources[1].id = 'ready'; }, /duplicate resource id/],
  ['missing title', ({ catalog }) => { delete catalog.resources[0].name; }, /name is required/],
  ['missing course', ({ catalog }) => { delete catalog.resources[0].course; }, /course is required/],
  ['missing topic', ({ catalog }) => { delete catalog.resources[0].unitTopic; }, /unitTopic is required/],
  ['missing type', ({ catalog }) => { delete catalog.resources[0].type; }, /type is required/],
  ['restricted with approved flag and link', ({ catalog }) => { catalog.resources[0].status = 'restricted'; }, /restricted resources/],
  ['unapproved linked resource', ({ catalog }) => { catalog.resources[0].onWebsite = false; }, /onWebsite must be true/],
  ['string approval flag', ({ catalog }) => { catalog.resources[0].onWebsite = 'true'; }, /onWebsite must be true/],
  ['missing link on ready resource', ({ catalog }) => { catalog.resources[0].href = null; }, /missing href requires coming-soon/],
  ['coming-soon cannot hide malformed href', ({ catalog }) => { catalog.resources[1].href = 42; }, /href must be/],
  ['unknown publication status', ({ catalog }) => { catalog.resources[0].status = 'draft'; }, /status must be/],
  ['blank href is not a valid link', ({ catalog }) => { catalog.resources[0].href = ' '; }, /href must be/],
  ['local Windows path', ({ catalog }) => { catalog.resources[0].href = 'C:\\private\\lesson.html'; }, /href must be/],
  ['file URL', ({ catalog }) => { catalog.resources[0].href = 'file:///C:/private/lesson.html'; }, /href must be/],
  ['script URL', ({ catalog }) => { catalog.resources[0].href = 'javascript:alert(1)'; }, /href must be/],
  ['protocol-relative URL', ({ catalog }) => { catalog.resources[0].href = '//example.org/file'; }, /href must be/],
  ['malformed percent encoding', ({ catalog }) => { catalog.resources[0].href = '/bad%ZZ'; }, /href must be/],
  ['unknown assignment ID', ({ materials }) => { materials.courses['US History'].Unit.push('absent'); }, /missing resource absent/],
  ['duplicate assignment within unit', ({ materials }) => { materials.courses['US History'].Unit.push('ready'); }, /duplicate assignment ready/],
  ['assignment course mismatch', ({ catalog }) => { catalog.resources[0].course = 'Hidden History'; }, /course mismatch/],
  ['assignment list must be an array', ({ materials }) => { materials.courses['US History'].Unit = 'ready'; }, /must be an array/],
  ['assignment ID must be text', ({ materials }) => { materials.courses['US History'].Unit = [null]; }, /assignment id must be/],
  ['malformed catalog', (data) => { data.catalog = null; }, /catalog.resources must be/],
  ['malformed resource row', ({ catalog }) => { catalog.resources[0] = null; }, /must be an object/],
  ['malformed assignments', (data) => { data.materials = []; }, /materials.courses must be/],
  ['empty catalog cannot silently erase the library', ({ catalog }) => { catalog.resources = []; catalog.resourceCount = 0; catalog.linkedCount = 0; }, /must not be empty/],
];

// CLI fixtures live outside the checkout, with no private inventories. Check
// the exact input bytes after BOTH successful and failed subprocesses.
const scratch = mkdtempSync(join(tmpdir(), 'grantdesk-resource-fixtures-'));
let passed = 0;
try {
  const catalogPath = join(scratch, 'catalog.json');
  const materialsPath = join(scratch, 'materials.json');
  for (const [name, mutate, expected] of cases) {
    const data = fixture();
    mutate(data);
    const before = JSON.stringify(data);
    const errors = validatePublicResources(data.catalog, data.materials);
    if (expected) assert.match(errors.join('\n'), expected, name);
    else assert.deepEqual(errors, [], name);
    assert.equal(JSON.stringify(data), before, `${name}: validation mutated its inputs`);
    const catalogText = JSON.stringify(data.catalog);
    const materialsText = JSON.stringify(data.materials);
    writeFileSync(catalogPath, catalogText);
    writeFileSync(materialsPath, materialsText);
    const result = spawnSync(process.execPath, [join(root, 'scripts/validate-public-resources.mjs'), '--catalog', catalogPath, '--materials', materialsPath], { cwd: scratch, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, expected ? 1 : 0, `${name}: ${result.stderr}`);
    if (expected) assert.match(result.stderr, expected, name);
    assert.equal(readFileSync(catalogPath, 'utf8'), catalogText, `${name}: CLI rewrote catalog`);
    assert.equal(readFileSync(materialsPath, 'utf8'), materialsText, `${name}: CLI rewrote assignments`);
    passed++;
  }
  for (const href of ['https://user:secret@example.org/a', '/%2fexample.org/a', '/a/%2e%2e/private', '/a\\b', 'https://localhost/a', 'http://example.org/a', 'https:example.org/a']) {
    assert.equal(isPublicHref(href), false, href);
  }
  passed++;
  for (const [file, contents, pattern] of [
    [catalogPath, '{broken', /validation FAILED/],
    [materialsPath, '{broken', /validation FAILED/],
  ]) {
    const data = fixture();
    writeFileSync(catalogPath, JSON.stringify(data.catalog));
    writeFileSync(materialsPath, JSON.stringify(data.materials));
    writeFileSync(file, contents);
    const result = spawnSync(process.execPath, [join(root, 'scripts/validate-public-resources.mjs'), '--catalog', catalogPath, '--materials', materialsPath], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, pattern);
    assert.equal(readFileSync(file, 'utf8'), contents);
    passed++;
  }

  // Execute the actual package verify chain with synthetic stage commands.
  // A failure in each stage must prevent all subsequent stages from running.
  const realPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const stages = ['hall-pass:verify', 'tools:test', 'resources:validate', 'check', 'build', 'site:validate'];
  assert.equal(realPackage.scripts.verify, stages.map((stage) => `npm run ${stage}`).join(' && '));
  const npmPath = process.env.npm_execpath;
  assert.ok(npmPath, 'Run these fixtures via npm run resources:validate so npm is available for gate tests.');
  writeFileSync(join(scratch, 'stage.cjs'), "require('node:fs').appendFileSync('stages.txt', process.argv[2]+'\\n'); process.exit(process.argv[2]===process.env.FAIL_STAGE ? 1 : 0);\n");
  writeFileSync(join(scratch, 'package.json'), JSON.stringify({ private: true, scripts: {
    verify: realPackage.scripts.verify,
    ...Object.fromEntries(stages.map((stage) => [stage, `node stage.cjs ${stage}`])),
  } }));
  for (const failStage of ['', ...stages]) {
    writeFileSync(join(scratch, 'stages.txt'), '');
    const result = spawnSync(process.execPath, [npmPath, 'run', 'verify'], {
      cwd: scratch, encoding: 'utf8', env: { ...process.env, FAIL_STAGE: failStage },
    });
    assert.ifError(result.error);
    assert.equal(result.status, failStage ? 1 : 0, result.stderr);
    const expectedStages = failStage ? stages.slice(0, stages.indexOf(failStage) + 1) : stages;
    assert.deepEqual(readFileSync(join(scratch, 'stages.txt'), 'utf8').trim().split('\n'), expectedStages);
    passed++;
  }
  // Missing check dependencies must fail promptly instead of Astro's install
  // prompt. These module stubs exist only in this synthetic temporary project.
  const depProbe = () => spawnSync(process.execPath, [join(root, 'scripts/check-verification-deps.mjs')], { cwd: scratch, encoding: 'utf8', timeout: 10000 });
  for (const installed of [[], ['@astrojs/check'], ['typescript'], ['@astrojs/check', 'typescript']]) {
    const modules = join(scratch, 'node_modules');
    rmSync(modules, { recursive: true, force: true });
    for (const name of installed) {
      const folder = join(modules, name);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, 'index.js'), 'module.exports = {};\n');
    }
    const result = depProbe();
    assert.ifError(result.error);
    assert.equal(result.status, installed.length === 2 ? 0 : 1, result.stderr);
    if (installed.length !== 2) assert.match(result.stderr, /npm install --include=dev/);
    passed++;
  }
  console.log(`Public-resource and release-gate fixtures: ${passed} passed. Success/failure inputs unchanged; all six stages stop on failure.`);
} finally {
  // Only this process's mkdtemp-created synthetic fixture directory is removed.
  rmSync(scratch, { recursive: true, force: true });
}
