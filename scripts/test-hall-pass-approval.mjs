import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProductionAuthorization } from './lib/hall-pass-approval.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.CODEX_PRIMARY_RUNTIME_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const fixtureEnv = Object.fromEntries(['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'CODEX_PRIMARY_RUNTIME_PYTHON']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
const read = name => readFileSync(join(root, name), 'utf8');
const fixture = action => {
  const dir = mkdtempSync(join(tmpdir(), 'hall-pass-approval-'));
  const write = (name, content) => { mkdirSync(dirname(join(dir, name)), { recursive: true }); writeFileSync(join(dir, name), content); };
  try { return action({ dir, write }); } finally { rmSync(dir, { recursive: true, force: true }); }
};
const policy = { distributionApproved: false, productionCutoverAuthorized: false };
const owner = {
  GITHUB_REPOSITORY: 'Grantauch/the-desk', GITHUB_REF: 'refs/heads/main',
  GITHUB_ACTOR: 'Grantauch', GITHUB_TRIGGERING_ACTOR: 'Grantauch', GITHUB_EVENT_NAME: 'workflow_dispatch',
};
const request = (service = 'hall-pass') => ({
  service, mode: 'deploy', policy: { productionCutoverAuthorized: true }, env: { ...owner },
  event: { inputs: { mode: 'deploy', confirmation: service === 'hall-pass' ? 'DEPLOY HALL PASS' : 'DEPLOY TURN IN' } },
});

test('closed cutover gate rejects even the correctly confirmed owner for both services', () => {
  for (const service of ['hall-pass', 'turn-in']) {
    const r = request(service);
    for (const value of [false, undefined, null, 'true', 1]) {
      assert.throws(() => checkProductionAuthorization({ ...r, policy: { productionCutoverAuthorized: value } }), /cutover gate remains closed/);
    }
    // Only the pure decision is exercised with a synthetic open policy. No deploy is run.
    assert.doesNotThrow(() => checkProductionAuthorization(r));
  }
});

test('dispatch requires owner, rerun owner, main, repository, mode and exact confirmation', () => {
  for (const service of ['hall-pass', 'turn-in']) {
    const r = request(service);
    for (const key of Object.keys(owner)) {
      assert.throws(() => checkProductionAuthorization({ ...r, env: { ...owner, [key]: 'unauthorized' } }), /Production approval guard/);
      const env = { ...owner }; delete env[key];
      assert.throws(() => checkProductionAuthorization({ ...r, env }), /Production approval guard/);
    }
    for (const inputs of [{}, { mode: 'preflight', confirmation: r.event.inputs.confirmation },
      { mode: 'deploy' }, { mode: 'deploy', confirmation: r.event.inputs.confirmation.toLowerCase() },
      { mode: 'deploy', confirmation: `${r.event.inputs.confirmation} ` }]) {
      assert.throws(() => checkProductionAuthorization({ ...r, event: { inputs } }), /exact confirmation/);
    }
    assert.throws(() => checkProductionAuthorization({ ...r, mode: 'DEPLOY' }), /unsupported/);
  }
});

test('comment path requires exact owner command on release-control issue 28', () => {
  for (const service of ['hall-pass', 'turn-in']) {
    const r = request(service);
    r.env.GITHUB_EVENT_NAME = 'issue_comment';
    r.event = { action: 'created', issue: { number: 28 }, comment: { user: { login: 'Grantauch' }, body: `/deploy-${service}` } };
    assert.doesNotThrow(() => checkProductionAuthorization(r));
    for (const event of [{ ...r.event, action: 'edited' }, { ...r.event, issue: { number: 319 } },
      { ...r.event, issue: { number: 329 } }, { ...r.event, issue: {} },
      { ...r.event, comment: { ...r.event.comment, user: { login: 'other' } } },
      { ...r.event, comment: { ...r.event.comment, body: `/deploy-${service}\n` } }, {}]) {
      assert.throws(() => checkProductionAuthorization({ ...r, event }), /exact owner-only/);
    }
    assert.throws(() => checkProductionAuthorization({ ...r, policy }), /cutover gate remains closed/);
  }
});

test('preflight decision needs no production authorization; unsupported modes fail', () => {
  assert.doesNotThrow(() => checkProductionAuthorization({ service: 'hall-pass', mode: 'preflight' }));
  assert.throws(() => checkProductionAuthorization({ service: 'unknown', mode: 'deploy' }), /unsupported/);
});

test('public ZIP scanner refuses false/missing/malformed approval and finds renamed Hall Pass ZIPs', () => fixture(({ dir, write }) => {
  write('scripts/check-hall-pass-publication.py', read('scripts/check-hall-pass-publication.py'));
  mkdirSync(join(dir, 'public'), { recursive: true });
  const run = () => spawnSync(python, [join(dir, 'scripts/check-hall-pass-publication.py')], { encoding: 'utf8', env: fixtureEnv });
  const version = value => write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify(value));
  version(policy);
  assert.equal(run().status, 0, 'private candidates / no public ZIP allowed');
  for (const name of ['downloads/HallPass-Teacher-Installer-vfixture.zip', 'nested/HALL-PASS.ZIP', 'hall_pass/files/review.zip']) {
    write(`public/${name}`, 'fixture only; named archives are blocked before opening');
    const r = run(); assert.equal(r.status, 1); assert.match(r.stderr, /distributionApproved is false/);
    rmSync(join(dir, 'public', name));
  }
  const zip = spawnSync(python, ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("VERSION.json", \'{"name":"HallPass-Teacher-Installer"}\'); z.close()', join(dir, 'public/renamed.zip')], { encoding: 'utf8' });
  assert.equal(zip.status, 0, zip.stderr);
  assert.match(run().stderr, /distributionApproved is false/);
  version({ distributionApproved: true });
  assert.equal(run().status, 0, 'synthetic explicit true is the only open publication policy');
  for (const value of [null, [], {}, { distributionApproved: 'true' }, { distributionApproved: null }, { distributionApproved: 1 }]) {
    version(value); assert.equal(run().status, 1);
  }
  write('distribution/hall-pass-teacher-kit/VERSION.json', '{broken');
  assert.equal(run().status, 1);
  rmSync(join(dir, 'distribution/hall-pass-teacher-kit/VERSION.json'));
  assert.equal(run().status, 1);
}));

test('unrelated ZIP remains allowed; malformed public ZIP fails closed', () => fixture(({ dir, write }) => {
  write('scripts/check-hall-pass-publication.py', read('scripts/check-hall-pass-publication.py'));
  write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify(policy));
  mkdirSync(join(dir, 'public'), { recursive: true });
  const run = () => spawnSync(python, [join(dir, 'scripts/check-hall-pass-publication.py')], { encoding: 'utf8' });
  assert.equal(spawnSync(python, ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("README.txt","unrelated fixture"); z.close()', join(dir, 'public/lesson.zip')]).status, 0);
  assert.equal(run().status, 0);
  write('public/lesson.zip', 'corrupt fixture');
  assert.equal(run().status, 1);
  rmSync(join(dir, 'public/lesson.zip'));
  if (process.platform !== 'win32') {
    write('outside/HallPass-fixture.zip', 'fixture');
    symlinkSync(join(dir, 'outside'), join(dir, 'public/linked-directory'));
    assert.match(run().stderr, /Symlinks under public/);
  }
}));

test('copied deploy entrypoints fail before source/credentials/network, including CLI mode', () => fixture(({ dir, write }) => {
  write('scripts/lib/hall-pass-approval.mjs', read('scripts/lib/hall-pass-approval.mjs'));
  write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify(policy));
  write('event.json', JSON.stringify(request().event));
  write('deny-network.mjs', `import { writeFileSync } from 'node:fs'; globalThis.fetch = () => { writeFileSync(${JSON.stringify(join(dir, 'NETWORK_ATTEMPT'))}, 'attempt'); throw Error('NETWORK MUST NOT RUN'); };`);
  // Deliberately do not copy application source or set any credential variables.
  for (const service of ['hall-pass', 'turn-in']) {
    const script = `scripts/deploy-${service}-apps-script.mjs`;
    copyFileSync(join(root, script), join(dir, script));
    write('event.json', JSON.stringify(request(service).event));
    const env = { ...owner, PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, GITHUB_EVENT_PATH: join(dir, 'event.json'), GAS_DEPLOY_MODE: 'deploy' };
    const run = (extraEnv = {}, args = []) => spawnSync(process.execPath, ['--import', join(dir, 'deny-network.mjs'), join(dir, script), ...args], { cwd: dir, env: { ...env, ...extraEnv }, encoding: 'utf8' });
    for (const extraEnv of [{}, { GITHUB_ACTOR: 'other' }, { GITHUB_TRIGGERING_ACTOR: 'other' }, { GITHUB_EVENT_PATH: join(dir, 'missing.json') }]) {
      const r = run(extraEnv); assert.equal(r.status, 1); assert.match(r.stderr, /Production approval guard/);
      assert.doesNotMatch(r.stderr, /Missing required environment|ENOENT|NETWORK MUST NOT RUN/);
    }
    if (service === 'hall-pass') {
      const r = run({ GAS_DEPLOY_MODE: 'preflight' }, ['--mode=deploy']);
      assert.equal(r.status, 1); assert.match(r.stderr, /cutover gate remains closed/);
    }
    write('distribution/hall-pass-teacher-kit/VERSION.json', '{broken');
    assert.match(run().stderr, /missing or invalid policy\/event evidence/);
    write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify(policy));
    write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify({ productionCutoverAuthorized: true }));
    assert.match(run({ GITHUB_ACTOR: 'other' }).stderr, /requires the owner/);
    write('event.json', JSON.stringify({ inputs: { mode: 'deploy' } }));
    assert.match(run().stderr, /exact confirmation/);
    write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify(policy));
    assert.equal(existsSync(join(dir, 'NETWORK_ATTEMPT')), false);
    assert.equal(existsSync(join(dir, 'artifacts')), false);
  }
}));

test('copied npm verification/build lanes stop before downstream commands on a blocked ZIP', () => fixture(({ dir, write }) => {
  for (const name of ['package.json', 'scripts/check-hall-pass-approval.mjs', 'scripts/check-hall-pass-publication.py',
    'scripts/run-release-verification.mjs', 'scripts/release-lane.mjs']) write(name, read(name));
  write('distribution/hall-pass-teacher-kit/VERSION.json', JSON.stringify(policy));
  write('public/downloads/HallPass-fixture.zip', 'fixture only');
  assert.ok(process.env.npm_execpath, 'run this fixture suite through npm');
  for (const script of ['verify', 'verify:full', 'verify:storyhub-fast', 'build']) {
    const r = spawnSync(process.execPath, [process.env.npm_execpath, 'run', script], {
      cwd: dir, encoding: 'utf8', env: fixtureEnv,
    });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /Hall Pass ZIP publication blocked/);
    assert.doesNotMatch(r.stderr, /astro: not found|MODULE_NOT_FOUND/);
    assert.equal(existsSync(join(dir, 'dist')), false);
  }
}));

test('candidate builder refuses public destinations before reading package inputs', () => fixture(({ dir, write }) => {
  write('scripts/build-hall-pass-teacher-kit.py', read('scripts/build-hall-pass-teacher-kit.py'));
  const output = join(dir, 'public/downloads/HallPass-fixture.zip');
  const r = spawnSync(python, [join(dir, 'scripts/build-hall-pass-teacher-kit.py'), '--output', output], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /must stay outside public/);
  assert.equal(existsSync(output), false);
}));

test('all canonical site lanes/builds and both deployment entrypoints retain guard wiring', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  for (const name of ['verify:full', 'verify:storyhub-fast']) assert.ok(scripts[name].startsWith('npm run hall-pass:approval && '));
  assert.equal(scripts.prebuild, 'npm run hall-pass:approval');
  const workflow = read('.github/workflows/site-check.yml');
  assert.ok(workflow.indexOf('run: npm run hall-pass:approval\n') < workflow.indexOf('run: npm ci'));
  for (const service of ['hall-pass', 'turn-in']) {
    const source = read(`scripts/deploy-${service}-apps-script.mjs`);
    assert.ok(source.indexOf(`await assertProductionAuthorization('${service}', mode);`) < source.indexOf("const scriptId = required("));
    const workflow = read(`.github/workflows/deploy-${service}-apps-script.yml`);
    assert.match(workflow, /github\.event_name == 'workflow_dispatch' && github\.actor == 'Grantauch' && github\.triggering_actor == 'Grantauch'/);
    assert.match(workflow, /github\.event_name == 'issue_comment' &&\s+github\.actor == 'Grantauch' && github\.triggering_actor == 'Grantauch'/);
  }
});
