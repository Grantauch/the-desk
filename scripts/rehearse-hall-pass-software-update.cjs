'use strict';
// Owner-mediated copy of the seven approved Hall Pass source files into synthetic
// copies. This is a rehearsal, not an automatic update and not a hosted website.
// It refuses any target that is not explicitly synthetic, and any id supplied as
// a production script or spreadsheet id through the environment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const SOURCES = [
  ['Code.gs', 'apps-script/hall-pass/Code.gs'],
  ['Index.html', 'apps-script/hall-pass/Index.html'],
  ['ReleaseChecks.gs', 'apps-script/hall-pass/ReleaseChecks.gs'],
  ['ReleaseCheck.html', 'apps-script/hall-pass/ReleaseCheck.html'],
  ['appsscript.json', 'apps-script/hall-pass/appsscript.json'],
  ['Setup.gs', 'apps-script/hall-pass-template/Setup.gs'],
  ['SetupWizard.html', 'apps-script/hall-pass-template/SetupWizard.html'],
];
const PRODUCTION_ENV = ['GAS_SCRIPT_ID', 'GAS_SPREADSHEET_ID', 'SPREADSHEET_ID'];

function productionIds() {
  return new Set(PRODUCTION_ENV.map((key) => process.env[key]).filter(Boolean));
}

function assertSynthetic(scriptId, spreadsheetId) {
  if (!/^synthetic-/.test(scriptId) || !/^synthetic-/.test(spreadsheetId)) {
    throw new Error('Refusing a target that is not a synthetic copy.');
  }
  const blocked = productionIds();
  if (blocked.has(scriptId) || blocked.has(spreadsheetId)) {
    throw new Error('Refusing the production script or spreadsheet id.');
  }
}

function readVersion(dir) {
  const code = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8');
  return {
    applicationVersion: code.match(/const GD_HALL_PASS_VERSION = '([^']+)';/)[1],
    packageVersion: code.match(/const GD_HALL_PASS_PACKAGE_VERSION = '([^']+)';/)[1],
  };
}

function snapshot(dir) {
  return Object.fromEntries(SOURCES.map(([name]) => [name, fs.readFileSync(path.join(dir, name))]));
}

function writeSnapshot(dir, files) {
  assertSynthetic(fs.readFileSync(path.join(dir, 'script-id'), 'utf8').trim(), fs.readFileSync(path.join(dir, 'spreadsheet-id'), 'utf8').trim());
  for (const [name] of SOURCES) fs.writeFileSync(path.join(dir, name), files[name]);
}

function installCurrent(dir) {
  const files = Object.fromEntries(SOURCES.map(([name, relative]) => [name, fs.readFileSync(path.join(root, relative))]));
  writeSnapshot(dir, files);
}

function historyCount(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'history.json'), 'utf8')).rows.length;
}

function makeCopy(parent, scriptId, spreadsheetId) {
  assertSynthetic(scriptId, spreadsheetId);
  const dir = path.join(parent, scriptId);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'script-id'), scriptId);
  fs.writeFileSync(path.join(dir, 'spreadsheet-id'), spreadsheetId);
  installCurrent(dir);
  const codePath = path.join(dir, 'Code.gs');
  const older = fs.readFileSync(codePath, 'utf8')
    .replace("const GD_HALL_PASS_VERSION = '1.0.0-rc.1';", "const GD_HALL_PASS_VERSION = '0.9.0-synthetic';")
    .replace("const GD_HALL_PASS_PACKAGE_VERSION = '1.0.0-rc.2';", "const GD_HALL_PASS_PACKAGE_VERSION = '0.9.0-synthetic';");
  fs.writeFileSync(codePath, older);
  fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify({ rows: ['h1', 'h2', 'h3', 'h4'] }));
  return dir;
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hall-pass-update-'));
try {
  assert.throws(() => assertSynthetic('production-script', 'synthetic-sheet'), /not a synthetic copy/);
  const previous = process.env.GAS_SCRIPT_ID;
  process.env.GAS_SCRIPT_ID = 'synthetic-script-blocked';
  assert.throws(() => assertSynthetic('synthetic-script-blocked', 'synthetic-sheet-ok'), /production script or spreadsheet/);
  if (previous === undefined) delete process.env.GAS_SCRIPT_ID; else process.env.GAS_SCRIPT_ID = previous;

  const copies = ['synthetic-script-a', 'synthetic-script-b'].map((scriptId, index) => makeCopy(scratch, scriptId, `synthetic-sheet-${index}`));
  const previousFiles = copies.map(snapshot);
  copies.forEach((dir) => {
    const reported = readVersion(dir);
    assert.equal(reported.applicationVersion, '0.9.0-synthetic');
    assert.equal(reported.packageVersion, '0.9.0-synthetic');
    assert.equal(historyCount(dir), 4);
  });
  copies.forEach(installCurrent);
  copies.forEach((dir) => {
    const reported = readVersion(dir);
    assert.equal(reported.applicationVersion, '1.0.0-rc.1');
    assert.equal(reported.packageVersion, '1.0.0-rc.2');
    assert.notEqual(reported.applicationVersion, reported.packageVersion);
    assert.equal(historyCount(dir), 4);
    assert.equal(fs.readdirSync(dir).filter((name) => SOURCES.some(([source]) => source === name)).length, 7);
  });
  copies.forEach((dir, index) => writeSnapshot(dir, previousFiles[index]));
  copies.forEach((dir) => {
    const reported = readVersion(dir);
    assert.equal(reported.applicationVersion, '0.9.0-synthetic');
    assert.equal(reported.packageVersion, '0.9.0-synthetic');
    assert.equal(historyCount(dir), 4);
  });
  const version = JSON.parse(fs.readFileSync(path.join(root, 'distribution/hall-pass-teacher-kit/VERSION.json'), 'utf8'));
  assert.equal(version.automaticSoftwareUpdates, false);
  console.log('PASS: synthetic Hall Pass copies report 1.0.0-rc.1 / 1.0.0-rc.2 after the owner-mediated update and the previous version after rollback. History rows survived. automaticSoftwareUpdates remains false.');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
