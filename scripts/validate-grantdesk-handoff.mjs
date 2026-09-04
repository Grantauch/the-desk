import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];

function ok(condition, label) {
  if (condition) passes.push(label);
  else failures.push(label);
}

function read(relativePath) {
  const full = path.join(root, relativePath);
  ok(fs.existsSync(full), `path exists: ${relativePath}`);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

const requiredPaths = [
  'apps-script/hall-pass/Code.gs',
  'apps-script/hall-pass/Index.html',
  'apps-script/hall-pass/appsscript.json',
  'apps-script/hall-pass/DEPLOY.md',
  'scripts/test-hall-pass-app.cjs',
  'scripts/test-hall-pass-runtime.cjs',
  'scripts/lib/gas-harness.cjs',
  'scripts/lib/hall-pass-fixtures.cjs',
  'src/pages/pass.astro',
  'src/pages/check-in.astro',
  'src/pages/tools.astro',
  'src/data/pass-config.json',
  '.github/workflows/site-check.yml',
  'package.json',
];

requiredPaths.forEach((relativePath) => {
  ok(fs.existsSync(path.join(root, relativePath)), `path exists: ${relativePath}`);
});

const code = read('apps-script/hall-pass/Code.gs');
const packageJsonText = read('package.json');
const passConfigText = read('src/data/pass-config.json');

const criticalFunctions = [
  'doGet',
  'getBootstrap',
  'identifyWithPin',
  'identifyCheckInWithPin',
  'identifyPin_',
  'verifyStudentPin_',
  'authorizeStudentAction',
  'putStudentActionProof_',
  'consumeStudentActionProof_',
  'selectStudentClass',
  'resolveStudent_',
  'refreshStudentState',
  'startPass',
  'joinPassQueue',
  'requestBathroomPass',
  'createBathroomRequest_',
  'settleWaitingQueue_',
  'appendPassForStudent_',
  'returnPass',
  'submitDailyCheckIn',
  'getStudentPassAllowance_',
  'passValidity_',
  'getTeacherState_',
  'teacherStartPass',
  'teacherEndPass',
  'teacherGetCountablePasses',
  'teacherVoidPass',
  'teacherApplyUnmatchedEmail',
  'discoverIdentityReconciliations_',
  'reconcileKnownIdentityDrift_',
  'ensureWorkbookReady_',
  'setupWorkbook_',
  'closePassForStudent_',
  'closePassById_',
  'closePassRow_',
  'readCheckInsForDate_',
  'expirePreviousDayPassesIfDue_',
];

for (const fn of criticalFunctions) {
  const pattern = new RegExp(`\\bfunction\\s+${fn.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\(`);
  ok(pattern.test(code), `mapped backend function exists: ${fn}`);
}

ok(
  /const\s+GD_SCHEMA_VERSION\s*=\s*['"]2026-09-02-a['"]/.test(code),
  'tracked workbook schema is 2026-09-02-a'
);

let packageJson = null;
try {
  packageJson = JSON.parse(packageJsonText);
  passes.push('package.json parses');
} catch {
  failures.push('package.json parses');
}

if (packageJson) {
  ok(
    packageJson.scripts?.['hall-pass:test'] === 'node scripts/test-hall-pass-app.cjs',
    'hall-pass:test points to expected regression suite'
  );
  ok(
    packageJson.scripts?.['handoff:validate'] === 'node scripts/validate-grantdesk-handoff.mjs',
    'handoff:validate points to expected validator'
  );
  ok(
    packageJson.scripts?.['hall-pass:runtime'] === 'node scripts/test-hall-pass-runtime.cjs',
    'hall-pass:runtime points to expected behavioral suite'
  );
  ok(
    packageJson.scripts?.['hall-pass:verify']
      === 'npm run handoff:validate && npm run hall-pass:test && npm run hall-pass:runtime',
    'hall-pass:verify runs handoff validation, structural regressions and the behavioral suite'
  );
}

let passConfig = null;
try {
  passConfig = JSON.parse(passConfigText);
  passes.push('pass-config.json parses');
} catch {
  failures.push('pass-config.json parses');
}

if (passConfig) {
  ok(
    typeof passConfig.studentAppUrl === 'string'
      && /^https:\/\/script\.google\.com\/a\/macros\/mtmorrisschools\.org\/.+\/exec$/.test(passConfig.studentAppUrl),
    'public config points at the domain-restricted Apps Script /exec URL'
  );
}

// Guard known documentation/source drift without claiming CI can inspect private Drive
// policy files, production workbook contents, or the exact live Apps Script version.
ok(!/MIN(?:IMUM)?[_A-Z]*PASS[_A-Z]*SECONDS\s*=\s*10\b/.test(code), 'no active 10-second minimum constant in backend source');
ok(!/MAX_ACTIVE_PASSES[^\n]*hard.?code[^\n]*1/i.test(code), 'no explicit source comment claiming capacity must be hardcoded to 1');

console.log(`GrantDesk handoff validation: ${passes.length} passed, ${failures.length} failed.`);
for (const label of passes) console.log(`PASS  ${label}`);
for (const label of failures) console.error(`FAIL  ${label}`);

if (failures.length) {
  console.error('\nHandoff map validation failed. Update the map and/or source together; do not silently ignore drift.');
  process.exit(1);
}

console.log('\nRepository-side handoff references are internally consistent.');
console.log('Note: agreement with private AI STATE/READ FIRST and exact live Apps Script deployment identity still require the external handoff/release checks.');
