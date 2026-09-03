const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const codePath = path.join(root, 'apps-script', 'hall-pass', 'Code.gs');
const htmlPath = path.join(root, 'apps-script', 'hall-pass', 'Index.html');
const manifestPath = path.join(root, 'apps-script', 'hall-pass', 'appsscript.json');
const passPagePath = path.join(root, 'src', 'pages', 'pass.astro');
const checkInPagePath = path.join(root, 'src', 'pages', 'check-in.astro');
const toolsPagePath = path.join(root, 'src', 'pages', 'tools.astro');

const code = fs.readFileSync(codePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const passPage = fs.readFileSync(passPagePath, 'utf8');
const checkInPage = fs.readFileSync(checkInPagePath, 'utf8');
const toolsPage = fs.readFileSync(toolsPagePath, 'utf8');

new vm.Script(code, { filename: codePath });
const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scriptBlocks.length, 'Index.html must contain an application script');
const clientScript = scriptBlocks.at(-1)[1].replace('<?!= JSON.stringify(appMode) ?>', '"student"');
new vm.Script(clientScript, { filename: htmlPath });

const functionSource = (name) => {
  const start = code.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  let depth = 0;
  let opened = false;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    const next = code[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      depth += 1;
      opened = true;
    } else if (char === '}') {
      depth -= 1;
      if (opened && depth === 0) return code.slice(start, index + 1);
    }
  }
  throw new Error(`Could not isolate function ${name}`);
};

assert.match(code, /GD_SCHEMA_VERSION\s*=\s*'2026-09-02-a'/);
assert.match(code, /GD_MIN_COUNTABLE_PASS_SECONDS\s*=\s*3/);
assert.match(code, /GD_ACTION_PROOF_SECONDS\s*=\s*180/);
assert.match(code, /GD_STUDENT_LOCK_WAIT_MS\s*=\s*5000/);
assert.match(code, /GD_BUSY_LOCK_MESSAGE/);
assert.match(code, /INSTRUCTIONS:\s*'Instructions'/);
assert.match(code, /AUDIT:\s*'Pass Audit'/);
assert.match(code, /CALENDAR:\s*'School Calendar'/);
assert.match(code, /UNMATCHED:\s*'Unmatched Sign-ins'/);
assert.match(code, /function teacherApplyUnmatchedEmail/);
assert.match(code, /function teacherAddStudentClass/);
assert.match(code, /function teacherRemoveStudentClass/);
assert.match(code, /function teacherClearUnmatchedSignIns/);
assert.match(code, /function readPinSession_/);
assert.match(code, /function secureEquals_/);
assert.match(code, /function queueTurnKey_/);
assert.match(code, /function readRosterRows_/);
assert.match(code, /function teacherMarkStudentAbsent/);
assert.match(code, /function teacherClearStudentAbsent/);
assert.match(code, /function teacherSetPassRules/);

const setupProject = functionSource('setupProject');
assert.ok(
  setupProject.indexOf('assertTeacher_') < setupProject.indexOf("setProperty('SPREADSHEET_ID'"),
  'Project setup must authorize before changing script properties or workbook state'
);
assert.match(
  setupProject,
  /try\s*\{[\s\S]*SpreadsheetApp\.getUi\(\)[\s\S]*\}\s*catch\s*\(error\)/,
  'Project setup must finish cleanly when an editor/API run has no spreadsheet UI'
);
assert.match(setupProject, /return\s*\{\s*ok:\s*true,\s*schemaVersion:\s*GD_SCHEMA_VERSION\s*\}/);

const studentState = functionSource('getStudentState_');
assert.match(studentState, /passAllowance:\s*studentAllowanceView_\(allowance,\s*Boolean\(detail\.includeEvidence\)\)/);
assert.doesNotMatch(studentState, /passAllowance:\s*allowance\b/);

const allowanceView = functionSource('studentAllowanceView_');
assert.doesNotMatch(allowanceView, /unlimited\s*[:,]/, 'Student payload must not reveal the private unlimited flag');

const generatePins = functionSource('generateMissingPins');
assert.ok(
  generatePins.indexOf('assertTeacher_') < generatePins.indexOf('setupWorkbook_'),
  'PIN generation must authorize before workbook mutation'
);
assert.match(generatePins, /assertPinEmailBatchIdle_/);

const emailBatch = functionSource('runPinEmailBatch_');
assert.match(emailBatch, /withLock_\([\s\S]*PIN_EMAIL_RUNNING/);

const cleanup = functionSource('dailyCleanup');
assert.match(cleanup, /assertTeacher_/);
assert.match(cleanup, /withLock_/);
assert.match(cleanup, /expirePreviousDayPasses_/);

const purgeIfDue = functionSource('purgeIfDue_');
assert.match(purgeIfDue, /withLock_/);
assert.ok(
  purgeIfDue.indexOf('expirePreviousDayPasses_') < purgeIfDue.indexOf("setProperty('LAST_PURGE'") &&
    purgeIfDue.indexOf('purgeOldPasses_') < purgeIfDue.indexOf("setProperty('LAST_PURGE'") &&
    purgeIfDue.indexOf('purgeOldQueue_') < purgeIfDue.indexOf("setProperty('LAST_PURGE'"),
  'Automatic purge must write LAST_PURGE only after rollover and both cleanup calls finish'
);

const passSnapshot = functionSource('getPassSnapshot_');
assert.match(passSnapshot, /safeDateKey_\(pass\.outDate\)\s*===\s*todayKey/);
assert.match(functionSource('expirePreviousDayPasses_'), /'ROLLED_OVER'/);

const pinIdentify = functionSource('identifyPin_');
assert.match(pinIdentify, /verifyStudentPin_\(pin,\s*activeEmail,\s*attemptNonce\)/);
const pinVerifier = functionSource('verifyStudentPin_');
assert.match(pinVerifier, /assertPinAttemptAllowed_\(activeEmail,\s*attemptNonce\)/);
assert.match(pinVerifier, /recordFailedPinAttempt_\(activeEmail,\s*attemptNonce\)/);

const pinSessionWriter = functionSource('putPinSession_');
assert.match(pinSessionWriter, /signTokenPart_/);
assert.doesNotMatch(pinSessionWriter, /CacheService\.getScriptCache\(\)\.put/);
assert.match(functionSource('readPinSession_'), /secureEquals_/);

const queueReader = functionSource('readWaitingQueue_');
assert.doesNotMatch(queueReader, /getQueueTurnStarted_|setQueueTurnStarted_/);
assert.doesNotMatch(queueReader, /CacheService\.getScriptCache/);
assert.match(queueReader, /status\s*===\s*'WAITING'/);

const actionProofWriter = functionSource('putStudentActionProof_');
const actionProofConsumer = functionSource('consumeStudentActionProof_');
assert.match(actionProofWriter, /student-action:/);
assert.match(actionProofWriter, /signTokenPart_/);
assert.match(actionProofConsumer, /deleteProperty\(propertyKey\)/, 'A protected action must consume its one-use proof');
assert.match(actionProofConsumer, /proof\.action\s*!==\s*action/);
for (const [name, action, operationLabel] of [
  ['submitDailyCheckIn', 'CHECKIN', 'daily check-in'],
  ['requestBathroomPass', 'PASS_REQUEST', 'bathroom request'],
  ['returnPass', 'RETURN', 'pass return'],
]) {
  const source = functionSource(name);
  assert.match(source, new RegExp(`consumeStudentActionProof_\\([\\s\\S]*GD_STUDENT_ACTIONS\\.${action}`));
  assert.match(source, new RegExp(`GD_STUDENT_LOCK_WAIT_MS,\\s*'${operationLabel}'`));
}
assert.match(functionSource('startPass'), /page is out of date/i);
assert.match(functionSource('joinPassQueue'), /page is out of date/i);

const queueSettlement = functionSource('settleWaitingQueue_');
assert.match(queueSettlement, /appendPassForStudent_/);
assert.match(queueSettlement, /Verified bathroom request advanced automatically/);
assert.doesNotMatch(queueSettlement, /verifyStudentPin_|putStudentActionProof_|consumeStudentActionProof_/, 'Queue promotion must not verify or request another PIN');

const purgePasses = functionSource('purgeOldPasses_');
assert.ok(
  purgePasses.indexOf('auditSheet.appendRow') < purgePasses.indexOf('sheet.deleteRow'),
  'A completed hot row must be copied into Pass Audit before it is removed from Pass Log'
);
assert.match(purgePasses, /archivedIds/);
assert.match(functionSource('teacherVoidPass'), /getRange\(pass\.row,\s*19,\s*1,\s*3\)/);
assert.doesNotMatch(functionSource('teacherVoidPass'), /deleteRow|clearContent/);
const identityReconciliation = functionSource('reconcileKnownIdentityDrift_');
assert.match(identityReconciliation, /discoverIdentityReconciliations_/);
assert.match(identityReconciliation, /IDENTITY_RECONCILIATION_LAST_CHECK/);
assert.match(identityReconciliation, /previousRepairIsMeaningful/);
assert.match(functionSource('discoverIdentityReconciliations_'), /hashPin_\(card\.pin\)/);
assert.match(functionSource('moveStudentIdentity_'), /NEEDS_RESEND/);
assert.match(functionSource('moveStudentIdentity_'), /GD_SHEETS\.AUDIT/);
assert.match(functionSource('getSchoolCalendarIndex_'), /GD_SHEETS\.CALENDAR/);
assert.match(functionSource('seedOfficialSchoolCalendar_'), /GD_OFFICIAL_CALENDAR_2026_27/);
const workbookSetup = functionSource('setupWorkbook_');
assert.match(workbookSetup, /setSettingDescription_\([\s\S]*'RETENTION_DAYS'[\s\S]*permanent Pass Audit/);
assert.match(workbookSetup, /refreshWorkbookInstructions_\(\)/);
const workbookInstructions = functionSource('refreshWorkbookInstructions_');
assert.match(workbookInstructions, /fresh student PIN/);
assert.match(workbookInstructions, /without a second PIN or start button/);
assert.match(workbookInstructions, /under 3\.0 seconds/);
assert.match(workbookInstructions, /Preserve the current \/exec URL/);

const unmatchedRecorder = functionSource('recordUnmatchedSignIn_');
assert.match(unmatchedRecorder, /withLock_/);
assert.match(unmatchedRecorder, /\['CLEARED',\s*'APPLIED'\]/);
assert.match(unmatchedRecorder, /\['NEW',\s*reopenedNote\]/, 'A cleared mismatch must return if the account is still unmatched');

const unmatchedClearer = functionSource('teacherClearUnmatchedSignIns');
assert.match(unmatchedClearer, /CacheService\.getScriptCache\(\)\.remove/);

for (const name of ['teacherAddStudentClass', 'teacherRemoveStudentClass', 'teacherMarkStudentAbsent', 'teacherClearStudentAbsent']) {
  const source = functionSource(name);
  assert.ok(source.indexOf('assertTeacher_') < source.indexOf('withLock_'), `${name} must authorize before mutation`);
}
for (const name of ['teacherApplyUnmatchedEmail', 'teacherAddStudentClass', 'teacherRemoveStudentClass']) {
  assert.match(functionSource(name), /withLock_\(\(\) => \{\s*assertPinEmailBatchIdle_\(\)/);
}
assert.match(functionSource('reconcileKnownIdentityDrift_'), /repairs\.length\) assertPinEmailBatchIdle_\(\)/);
assert.match(functionSource('ensureOnePinPerStudent_'), /assertPinEmailBatchIdle_\(\)/);

const contentionProperties = new Map();
let contentionWaitMs = 0;
let contentionActionCalls = 0;
let contentionReleases = 0;
let contentionMemoClears = 0;
const contentionContext = {
  LockService: {
    getScriptLock: () => ({
      waitLock(milliseconds) {
        contentionWaitMs = milliseconds;
        throw new Error('busy');
      },
      releaseLock() { contentionReleases += 1; },
    }),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => contentionProperties.get(key) || null,
      setProperty: (key, value) => contentionProperties.set(key, value),
    }),
  },
  Utilities: { formatDate: () => '2026-09-02' },
  Session: { getScriptTimeZone: () => 'America/Detroit' },
  gdClearMemo_: () => { contentionMemoClears += 1; },
};
vm.createContext(contentionContext);
vm.runInContext(`
const GD_BUSY_LOCK_MESSAGE = 'The classroom system is handling other students right now. Press the button once more.';
const GD_LOCK_CONTENTION_PROPERTY = 'LOCK_CONTENTION_SUMMARY';
${functionSource('dateKey_')}
${functionSource('recordLockContention_')}
${functionSource('getLockContentionSummary_')}
${functionSource('withLock_')}
this.__contentionApi = { withLock_, getLockContentionSummary_ };
`, contentionContext);
assert.throws(
  () => contentionContext.__contentionApi.withLock_(() => { contentionActionCalls += 1; }, 5000, 'daily check-in'),
  /handling other students/
);
assert.equal(contentionWaitMs, 5000);
assert.equal(contentionActionCalls, 0, 'A busy lock must fail before a protected student action begins');
assert.equal(contentionReleases, 0, 'A lock that was never acquired must not be released');
const contentionSummary = contentionContext.__contentionApi.getLockContentionSummary_();
assert.equal(contentionSummary.retrySignals, 1);
assert.equal(contentionSummary.byOperation['daily check-in'], 1);
assert.equal(contentionSummary.lastOperation, 'daily check-in');

contentionContext.LockService = {
  getScriptLock: () => ({
    waitLock(milliseconds) { contentionWaitMs = milliseconds; },
    releaseLock() { contentionReleases += 1; },
  }),
};
const contentionResult = contentionContext.__contentionApi.withLock_(() => {
  contentionActionCalls += 1;
  return 'recorded';
}, 5000, 'daily check-in');
assert.equal(contentionResult, 'recorded');
assert.equal(contentionActionCalls, 1);
assert.equal(contentionReleases, 1);
assert.equal(contentionMemoClears, 2, 'A successful protected action must clear memoized reads before and after its write');

const emailGroups = functionSource('buildPinEmailGroups_');
assert.match(emailGroups, /activeKeys/);
assert.match(emailGroups, /filter\(\(card\) => record\.activeKeys\.has\(card\.studentKey\)\)/);

assert.match(html, /sign-in problems\./);
assert.match(html, /class rosters\./);
assert.match(html, /data-remove-student/);
assert.match(html, /teacherAddStudentClass/);
assert.match(html, /teacherRemoveStudentClass/);
assert.match(html, /TEACHER_STALE_MS/);
assert.match(html, /teacher-stamp/);
assert.match(html, /roster-student-email/);
assert.match(html, /data-absent-student/);
assert.match(html, /data-clear-absence/);
assert.match(html, /daily-pass-limit/);
assert.match(html, /pass-cooldown-minutes/);
assert.match(html, /playIfNewPassStarted/);
assert.match(html, /authorizeStudentAction/);
assert.match(html, /requestBathroomPass/);
assert.match(html, /completeAuthorizedAction/);
assert.match(html, /STUDENT_BUSY_RETRY_DELAYS_MS/);
assert.match(html, /const callWithBusyRetry/);
assert.match(html, /callWithBusyRetry\('submitDailyCheckIn'/);
assert.match(html, /callWithBusyRetry\('requestBathroomPass'/);
assert.match(html, /callWithBusyRetry\('returnPass'/);
assert.match(html, /No check-in or pass change was made/);
assert.match(html, /automatic traffic recovery was needed/);
assert.match(functionSource('getTeacherState_'), /lockContention:\s*getLockContentionSummary_\(\)/);
assert.doesNotMatch(html, /call\('startPass'/);
assert.doesNotMatch(html, /call\('joinPassQueue'/);
assert.match(html, /advances automatically/);
assert.match(html, /data-teacher-details/);
assert.match(html, /pass-review-dialog/);
assert.match(html, /show the passes counted/);
assert.match(html, /timeZone:\s*'America\/Detroit'/);
assert.match(passPage, /fresh PIN/i);
assert.match(passPage, /no second PIN/i);
assert.match(checkInPage, /fresh six-digit PIN/i);
assert.match(checkInPage, /official no-school days/i);
assert.match(toolsPage, /automatic line/i);

assert.equal(manifest.runtimeVersion, 'V8');
assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
assert.equal(manifest.webapp.access, 'DOMAIN');

const context = {};
vm.createContext(context);
vm.runInContext(`${code}\n;this.__gdTest = { studentAllowanceView_, normalizeRosterInput_ };`, context);

const privateAllowance = context.__gdTest.studentAllowanceView_({
  limit: 3,
  used: 1,
  remaining: 2,
  limitReached: false,
  dailyLimit: 2,
  todayUsed: 1,
  dailyRemaining: 1,
  dailyLimitReached: false,
  cooldownMinutes: 5,
  cooldownActive: false,
  cooldownRemainingSeconds: 0,
  nextAllowedAt: '',
  blocked: false,
  unlimited: true,
});
assert.deepEqual(
  JSON.parse(JSON.stringify(privateAllowance)),
  {
    capped: false,
    limit: 0,
    used: 0,
    remaining: null,
    limitReached: false,
    dailyCapped: false,
    dailyLimit: 0,
    todayUsed: 0,
    dailyRemaining: null,
    dailyLimitReached: false,
    cooldownMinutes: 0,
    cooldownActive: false,
    cooldownRemainingSeconds: 0,
    nextAllowedAt: '',
    blocked: false,
    blockedReason: '',
  }
);
assert.equal(Object.hasOwn(privateAllowance, 'unlimited'), false);

const rosterInput = context.__gdTest.normalizeRosterInput_(
  'Student, Jordan',
  'jordan.student@students.mtmorrisschools.org',
  'Period 1',
  { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }
);
assert.equal(rosterInput.email, 'jordan.student@students.mtmorrisschools.org');
assert.throws(
  () => context.__gdTest.normalizeRosterInput_('=IMPORTXML()', 'student@students.mtmorrisschools.org', 'Period 1', { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }),
  /cannot begin with =, \+, -, or @/
);
assert.throws(
  () => context.__gdTest.normalizeRosterInput_('Student, Jordan', '=cmd@students.mtmorrisschools.org', 'Period 1', { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }),
  /Student email cannot begin with =, \+, -, or @/
);
assert.throws(
  () => context.__gdTest.normalizeRosterInput_('Student, Jordan', 'student@example.com', 'Period 1', { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }),
  /must end in/
);

const proofStore = new Map();
const proofProperties = {
  setProperty(key, value) { proofStore.set(key, String(value)); },
  getProperty(key) { return proofStore.has(key) ? proofStore.get(key) : null; },
  deleteProperty(key) { proofStore.delete(key); },
  getProperties() { return Object.fromEntries(proofStore); },
};
const proofContext = {
  PropertiesService: { getScriptProperties: () => proofProperties },
  Utilities: { getUuid: () => 'proof-nonce-1' },
};
vm.createContext(proofContext);
vm.runInContext(`${code}
;this.__gdProof = { putStudentActionProof_, consumeStudentActionProof_ };`, proofContext);
proofContext.encodeTokenPart_ = (value) => Buffer.from(String(value), 'utf8').toString('base64url');
proofContext.decodeTokenPart_ = (value) => Buffer.from(String(value), 'base64url').toString('utf8');
proofContext.signTokenPart_ = (value) => `signature-${value}`;
proofContext.getStudentByKey_ = (key) => (key === 'student::period-1' ? {
  key,
  email: 'student@students.mtmorrisschools.org',
  name: 'Student, Jordan',
  classPeriod: 'Period 1',
} : null);
const oneUseProof = proofContext.__gdProof.putStudentActionProof_(
  'student@students.mtmorrisschools.org',
  'student::period-1',
  'PASS_REQUEST',
  'pin'
);
assert.equal(proofStore.size, 1);
assert.throws(
  () => proofContext.__gdProof.consumeStudentActionProof_(oneUseProof, 'RETURN', 'student::period-1'),
  /different action/,
  'An action-bound proof must not authorize a different transaction'
);
assert.equal(proofStore.size, 1, 'A wrong-action attempt must not consume the valid intended proof');
const consumedProof = proofContext.__gdProof.consumeStudentActionProof_(oneUseProof, 'PASS_REQUEST', 'student::period-1');
assert.equal(consumedProof.student.key, 'student::period-1');
assert.equal(proofStore.size, 0);
assert.throws(
  () => proofContext.__gdProof.consumeStudentActionProof_(oneUseProof, 'PASS_REQUEST', 'student::period-1'),
  /already used or expired/,
  'A one-use proof must reject replay'
);

// Preserve the behavioral coverage that predates the Version 9 recovery. The
// structural assertions above catch security/privacy regressions; these
// fixtures catch changes to the classroom rules themselves.
const behaviorContext = {
  Session: {
    getScriptTimeZone: () => 'UTC',
  },
  Utilities: {
    getUuid: () => 'fixture-uuid',
    formatDate(date, zone, format) {
      assert.equal(zone, 'UTC');
      assert.equal(format, 'yyyy-MM-dd');
      return date.toISOString().slice(0, 10);
    },
  },
};
vm.createContext(behaviorContext);
vm.runInContext(`${code}
;this.__gdBehavior = {
  buildStreakIndex_,
  buildPinEmailMessage_,
  getStudentState_,
  getStudentPassAllowance_,
  buildClassSelectionState_,
  ensureOnePinPerStudent_,
  recordCheckIn_,
  getPassSnapshot_,
  expirePreviousDayPasses_,
  classifyPassDuration_,
  passValidity_,
  readWaitingQueue_,
  discoverIdentityReconciliations_,
  reconcileKnownIdentityDrift_,
};`, behaviorContext);

const snapshotNow = new Date();
const priorDay = new Date(snapshotNow.getTime() - 86400000);
behaviorContext.getSettings_ = () => ({ MAX_ACTIVE_PASSES: '1' });
behaviorContext.readPassLog_ = () => ([
  { row: 2, passId: 'old-pass', status: 'OUT', outDate: priorDay, studentEmail: 'old@students.mtmorrisschools.org' },
  { row: 3, passId: 'today-pass', status: 'OUT', outDate: snapshotNow, studentEmail: 'today@students.mtmorrisschools.org' },
]);
behaviorContext.readWaitingQueue_ = () => ({ live: [], expired: [] });
const rolloverSafeSnapshot = behaviorContext.__gdBehavior.getPassSnapshot_();
assert.equal(rolloverSafeSnapshot.active.length, 1, 'A prior-day OUT row must not consume today’s pass slot');
assert.equal(rolloverSafeSnapshot.active[0].passId, 'today-pass');

const rolloverWrites = [];
behaviorContext.getSpreadsheet_ = () => ({
  getSheetByName: () => ({
    getRange(row, column) {
      return { setValues(values) { rolloverWrites.push({ row, column, values }); } };
    },
  }),
});
behaviorContext.gdForget_ = () => {};
const rolledOver = behaviorContext.__gdBehavior.expirePreviousDayPasses_(snapshotNow);
assert.equal(rolledOver, 1);
assert.ok(
  rolloverWrites.some((write) => write.column === 10 && write.values[0][0] === 'ROLLED_OVER'),
  'Prior-day OUT rows must become auditable rollover records'
);
assert.ok(
  rolloverWrites.some((write) => write.column === 13 && write.values[0][0] === 'COUNTABLE'),
  'A valid prior-day rollover must receive explicit countability metadata'
);

assert.equal(behaviorContext.__gdBehavior.classifyPassDuration_(2999).countable, false);
assert.equal(behaviorContext.__gdBehavior.classifyPassDuration_(2999).countability, 'NON_COUNTABLE');
assert.equal(behaviorContext.__gdBehavior.classifyPassDuration_(3000).countable, true);
assert.equal(behaviorContext.__gdBehavior.classifyPassDuration_(3000).countability, 'COUNTABLE');
assert.equal(
  behaviorContext.__gdBehavior.passValidity_({
    outDate: new Date('2026-08-25T12:00:00Z'),
    returnDate: new Date('2026-08-25T12:05:00Z'),
    status: 'RETURNED',
    countability: '',
  }).code,
  'LEGACY_COUNTABLE',
  'A historical completed row with blank classification must not be threshold-reclassified'
);
assert.equal(behaviorContext.__gdBehavior.passValidity_({
  outDate: new Date('2026-09-02T12:00:00Z'),
  returnDate: new Date('2026-09-02T12:00:02Z'),
  status: 'RETURNED',
  countability: 'NON_COUNTABLE',
}).countable, false);
assert.equal(behaviorContext.__gdBehavior.passValidity_({
  outDate: new Date('2026-09-02T12:00:00Z'),
  returnDate: new Date('2026-09-02T12:05:00Z'),
  status: 'RETURNED',
  countability: 'COUNTABLE',
  voidedAt: new Date('2026-09-02T13:00:00Z'),
  voidReason: 'Teacher correction',
}).code, 'TEACHER_VOID');
assert.equal(behaviorContext.__gdBehavior.passValidity_({
  outDate: new Date('2026-09-02T12:00:00Z'),
  returnDate: new Date('2026-09-02T12:05:00Z'),
  status: 'RETURNED',
  countability: 'PROVISIONAL',
}).countable, false, 'A returned row left provisional must fail safe for teacher review');

behaviorContext.readPassQueue_ = () => ([
  { queueId: 'q-1', joinedAt: new Date(Date.now() - 2000), status: 'WAITING' },
  { queueId: 'q-2', joinedAt: new Date(Date.now() - 1000), status: 'WAITING' },
]);
const orderedQueue = behaviorContext.__gdBehavior.readWaitingQueue_({ QUEUE_MAX_WAIT_MINUTES: '20' }, 1);
assert.equal(orderedQueue.live.map((entry) => entry.queueId).join(','), 'q-1,q-2');
assert.equal(orderedQueue.live[0].isTurn, true);
assert.equal(orderedQueue.live[1].isTurn, false);

const checkIn = (dateKey) => ({
  studentKey: 'student::period-1',
  dateKey,
  status: 'CHECKED_IN',
});
const weekdayCalendar = { startKey: '', endKey: '', overrides: {} };

const fridayMonday = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
  checkIn('2026-08-24'),
], weekdayCalendar).streakFor('student::period-1', '2026-08-24');
assert.equal(fridayMonday.current, 2, 'Friday-to-Monday must keep the streak');
assert.equal(fridayMonday.best, 2);

const mondayAtRisk = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
], weekdayCalendar).streakFor('student::period-1', '2026-08-24');
assert.equal(mondayAtRisk.current, 1, 'Monday morning must preserve Friday while awaiting today');
assert.equal(mondayAtRisk.atRiskToday, true);

const missedMonday = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
], weekdayCalendar).streakFor('student::period-1', '2026-08-25');
assert.equal(missedMonday.current, 0, 'A missed weekday must break the current streak');

const weekend = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
], weekdayCalendar).streakFor('student::period-1', '2026-08-23');
assert.equal(weekend.current, 1);
assert.equal(weekend.weekendProtected, true);

const officialClosureCalendar = {
  startKey: '2026-08-25',
  endKey: '2027-06-08',
  overrides: {
    '2026-09-02': true,
    '2026-09-04': false,
    '2026-09-07': false,
  },
};
const laborDayProtected = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-09-03'),
  checkIn('2026-09-08'),
], officialClosureCalendar).streakFor('student::period-1', '2026-09-08');
assert.equal(laborDayProtected.current, 2, 'Official Friday and Monday closures must protect a Thursday-to-Tuesday streak');
const reducedDayCounts = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-09-01'),
  checkIn('2026-09-02'),
  checkIn('2026-09-03'),
], officialClosureCalendar).streakFor('student::period-1', '2026-09-03');
assert.equal(reducedDayCounts.current, 3, 'An official reduced day remains a school day');

const message = behaviorContext.__gdBehavior.buildPinEmailMessage_(
  {
    email: 'student@students.mtmorrisschools.org',
    name: 'Student, Jordan',
    pin: '123456',
    memberships: [
      { classPeriod: 'Period 1 — C US History A', pin: '123456' },
      { classPeriod: 'Period 3 — Beyond the Scoreboard', pin: '123456' },
    ],
  },
  {
    CHECKIN_URL: 'https://grant-desk.com/check-in/',
    PIN_EMAIL_SUBJECT: 'Your private GrantDesk PIN',
  },
  'teacher@mtmorrisschools.org'
);
assert.equal(message.to, 'student@students.mtmorrisschools.org');
assert.match(message.body, /123456/);
assert.doesNotMatch(message.body, /654321/);
assert.match(message.body, /one PIN works in every Mr\. Grant class/i);
assert.match(message.body, /Keep this PIN private/);
assert.match(message.body, /^Hello Jordan,/);

behaviorContext.getUnlimitedPassEmails_ = () => new Set();
const allowance = behaviorContext.__gdBehavior.getStudentPassAllowance_(
  'student@students.mtmorrisschools.org',
  { STUDENT_PASS_LIMIT: '2', STUDENT_PASS_RESET_AT: '2026-08-01T00:00:00Z' },
  [
    { studentEmail: 'student@students.mtmorrisschools.org', outDate: new Date('2026-08-02T12:00:00Z'), returnDate: new Date('2026-08-02T12:05:00Z'), status: 'RETURNED' },
    { studentEmail: 'other@students.mtmorrisschools.org', outDate: new Date('2026-08-03T12:00:00Z'), returnDate: new Date('2026-08-03T12:05:00Z'), status: 'RETURNED' },
  ]
);
assert.equal(allowance.used, 1);
assert.equal(allowance.remaining, 1);
assert.equal(allowance.limitReached, false);

const resetAllowance = behaviorContext.__gdBehavior.getStudentPassAllowance_(
  'student@students.mtmorrisschools.org',
  { STUDENT_PASS_LIMIT: '2', STUDENT_PASS_RESET_AT: '2026-08-04T00:00:00Z' },
  [{ studentEmail: 'student@students.mtmorrisschools.org', outDate: new Date('2026-08-02T12:00:00Z'), returnDate: new Date('2026-08-02T12:05:00Z'), status: 'RETURNED' }]
);
assert.equal(resetAllowance.used, 0, 'Manual reset timestamp must return the student count to zero');

const dailyGuard = behaviorContext.__gdBehavior.getStudentPassAllowance_(
  'student@students.mtmorrisschools.org',
  {
    STUDENT_PASS_LIMIT: '0',
    STUDENT_PASS_RESET_AT: '',
    DAILY_PASS_LIMIT: '2',
    PASS_COOLDOWN_MINUTES: '10',
  },
  [
    {
      studentEmail: 'student@students.mtmorrisschools.org',
      outDate: new Date('2026-09-01T10:00:00Z'),
      returnDate: new Date('2026-09-01T10:10:00Z'),
      status: 'RETURNED',
    },
    {
      studentEmail: 'student@students.mtmorrisschools.org',
      outDate: new Date('2026-09-01T11:45:00Z'),
      returnDate: new Date('2026-09-01T11:57:00Z'),
      status: 'RETURNED',
    },
  ],
  new Date('2026-09-01T12:00:00Z')
);
assert.equal(dailyGuard.todayUsed, 2);
assert.equal(dailyGuard.dailyLimitReached, true, 'Daily cap must block repeated same-day passes');
assert.equal(dailyGuard.cooldownActive, true, 'Cooldown must remain active after a recent return');
assert.equal(dailyGuard.blocked, true);
assert.equal(dailyGuard.cooldownRemainingSeconds, 420);

const cooldownOnly = behaviorContext.__gdBehavior.getStudentPassAllowance_(
  'student@students.mtmorrisschools.org',
  { STUDENT_PASS_LIMIT: '0', STUDENT_PASS_RESET_AT: '', DAILY_PASS_LIMIT: '0', PASS_COOLDOWN_MINUTES: '5' },
  [{
    studentEmail: 'student@students.mtmorrisschools.org',
    outDate: new Date('2026-09-01T11:40:00Z'),
    returnDate: new Date('2026-09-01T11:58:00Z'),
    status: 'RETURNED',
  }],
  new Date('2026-09-01T12:00:00Z')
);
assert.equal(cooldownOnly.dailyLimitReached, false);
assert.equal(cooldownOnly.cooldownActive, true);
assert.equal(cooldownOnly.cooldownRemainingSeconds, 180);

const attendanceStudent = {
  key: 'student::period-1',
  email: 'student@students.mtmorrisschools.org',
  name: 'Jordan Student',
  classPeriod: 'Period 1',
};
const attendanceEntries = [{
  row: 2,
  checkInId: 'absence-1',
  dateKey: new Date().toISOString().slice(0, 10),
  checkInTime: new Date(),
  studentEmail: attendanceStudent.email,
  studentName: attendanceStudent.name,
  classPeriod: attendanceStudent.classPeriod,
  studentKey: attendanceStudent.key,
  method: 'teacher',
  point: 0,
  status: 'ABSENT',
  note: 'Marked absent by teacher',
}];
behaviorContext.readCheckIns_ = () => attendanceEntries;
behaviorContext.getSettings_ = () => ({ CHECKIN_POINT_VALUE: '1' });
behaviorContext.getSpreadsheet_ = () => ({
  getSheetByName: () => ({
    appendRow(row) {
      attendanceEntries.push({
        row: attendanceEntries.length + 2,
        checkInId: row[0],
        dateKey: row[1],
        checkInTime: row[2],
        studentEmail: row[3],
        studentName: row[4],
        classPeriod: row[5],
        studentKey: attendanceStudent.key,
        method: row[6],
        point: row[7],
        status: row[8],
        note: row[9],
      });
    },
    getRange(row) {
      return {
        setValues(values) {
          attendanceEntries[row - 2].status = values[0][0];
          attendanceEntries[row - 2].note = values[0][1];
        },
      };
    },
  }),
});
assert.throws(
  () => behaviorContext.__gdBehavior.recordCheckIn_(attendanceStudent, 'pin', ''),
  /teacher update/i,
  'A student may not erase a teacher absence from their own screen'
);
const teacherArrival = behaviorContext.__gdBehavior.recordCheckIn_(attendanceStudent, 'teacher', 'Late arrival');
assert.equal(attendanceEntries[0].status, 'CLEARED');
assert.equal(teacherArrival.status, 'CHECKED_IN');
assert.equal(attendanceEntries.filter((entry) => entry.status === 'CHECKED_IN').length, 1);

const queuedStudent = {
  queueId: 'queue-1',
  studentKey: 'student::period-1',
  studentEmail: 'student@students.mtmorrisschools.org',
  studentName: 'Jordan Student',
  classPeriod: 'Period 1',
  joinedAt: new Date('2026-08-25T12:00:00Z'),
};
const baseSettings = {
  APP_TITLE: 'Hall Pass',
  DESTINATION: 'Restroom',
  MAX_ACTIVE_PASSES: '1',
  STUDENT_PASS_LIMIT: '3',
  STUDENT_PASS_RESET_AT: '2026-08-01T00:00:00Z',
  DAILY_PASS_LIMIT: '0',
  PASS_COOLDOWN_MINUTES: '5',
  QUEUE_CLAIM_MINUTES: '3',
  LATE_AFTER_MINUTES: '10',
};
behaviorContext.getPassSnapshot_ = () => ({
  settings: baseSettings,
  log: [{ status: 'OUT', studentEmail: 'other@students.mtmorrisschools.org' }],
  active: [{ status: 'OUT', studentEmail: 'other@students.mtmorrisschools.org' }],
  maxActive: 1,
  openSlots: 0,
  queue: [queuedStudent],
  expiredQueue: [],
});
const waitingState = behaviorContext.__gdBehavior.getStudentState_(
  { key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Jordan Student', classPeriod: 'Period 1' },
  'token',
  'pin'
);
assert.equal(waitingState.queuePosition, 1);
assert.equal(waitingState.passAvailable, false);
assert.equal(Object.hasOwn(waitingState.passAllowance, 'unlimited'), false);

behaviorContext.getPassSnapshot_ = () => ({
  settings: baseSettings,
  log: [],
  active: [],
  maxActive: 1,
  openSlots: 1,
  queue: [queuedStudent],
  expiredQueue: [],
});
const firstInLineState = behaviorContext.__gdBehavior.getStudentState_(
  { key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Jordan Student', classPeriod: 'Period 1' },
  'token',
  'pin'
);
assert.equal(firstInLineState.queuePosition, 1);
assert.equal(firstInLineState.passAvailable, true, 'First in line must be released when a slot opens');

behaviorContext.getSettings_ = () => ({ APP_TITLE: 'Hall Pass' });
const classChoice = behaviorContext.__gdBehavior.buildClassSelectionState_([
  { key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 1' },
  { key: 'student::period-3', email: 'student@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 3' },
], 'token', 'pin', 'pass');
assert.equal(classChoice.requiresClassSelection, true);
assert.equal(classChoice.classes.length, 2);
assert.equal(classChoice.pinToken, 'token');

behaviorContext.hashPin_ = (pin) => `hash-${pin}`;
behaviorContext.readRosterRows_ = () => ([
  { email: 'current@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 1', pinHash: 'hash-111111', active: true },
  { email: 'current@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 3', pinHash: 'hash-111111', active: true },
  { email: 'first@students.mtmorrisschools.org', name: 'First Student', classPeriod: 'Period 2', pinHash: 'hash-999999', active: true },
  { email: 'second@students.mtmorrisschools.org', name: 'Second Student', classPeriod: 'Period 2', pinHash: 'hash-999999', active: true },
]);
behaviorContext.readPinCards_ = () => ([
  { studentEmail: 'stale@students.mtmorrisschools.org', classPeriod: 'Period 1', pin: '111111' },
  { studentEmail: 'ambiguous@students.mtmorrisschools.org', classPeriod: 'Period 2', pin: '999999' },
]);
const discoveredRepairs = behaviorContext.__gdBehavior.discoverIdentityReconciliations_();
assert.equal(discoveredRepairs.length, 1, 'Only a unique credential-backed identity repair may run automatically');
assert.equal(discoveredRepairs[0].oldEmail, 'stale@students.mtmorrisschools.org');
assert.equal(discoveredRepairs[0].newEmail, 'current@students.mtmorrisschools.org');

const priorRepairSummary = JSON.stringify({
  schema: '2026-09-02-a',
  reconciledStudents: 10,
  pinRows: 10,
  checkInRows: 18,
  passRows: 2,
});
const reconciliationProperties = new Map([
  ['IDENTITY_RECONCILIATION_LAST', priorRepairSummary],
]);
behaviorContext.discoverIdentityReconciliations_ = () => [];
behaviorContext.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => reconciliationProperties.get(key) || null,
    setProperty: (key, value) => reconciliationProperties.set(key, value),
  }),
};
const noOpReconciliation = behaviorContext.__gdBehavior.reconcileKnownIdentityDrift_();
assert.equal(noOpReconciliation.reconciledStudents, 0);
assert.equal(
  reconciliationProperties.get('IDENTITY_RECONCILIATION_LAST'),
  priorRepairSummary,
  'An idempotent no-op check must not erase the last meaningful identity-repair evidence'
);
assert.match(reconciliationProperties.get('IDENTITY_RECONCILIATION_LAST_CHECK'), /"reconciledStudents":0/);

const fakeRoster = [
  { row: 2, key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 1', pinHash: 'hash-111111' },
  { row: 3, key: 'student::period-3', email: 'student@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 3', pinHash: 'hash-222222' },
  { row: 4, key: 'other::period-1', email: 'other@students.mtmorrisschools.org', name: 'Student, Casey', classPeriod: 'Period 1', pinHash: 'hash-333333' },
];
const fakeCards = [
  { row: 2, studentEmail: fakeRoster[0].email, studentKey: fakeRoster[0].key, pin: '111111', emailStatus: '' },
  { row: 3, studentEmail: fakeRoster[1].email, studentKey: fakeRoster[1].key, pin: '222222', emailStatus: '' },
  { row: 4, studentEmail: fakeRoster[2].email, studentKey: fakeRoster[2].key, pin: '333333', emailStatus: '' },
];
const rosterCells = new Map(fakeRoster.flatMap((student) => [
  [`${student.row}:4`, student.pinHash],
  [`${student.row}:5`, true],
]));
const cardCells = new Map(fakeCards.flatMap((card) => [
  [`${card.row}:4`, card.pin],
  [`${card.row}:6`, card.emailStatus],
  [`${card.row}:7`, ''],
  [`${card.row}:8`, ''],
]));
const fakeRange = (cells, row, column, rows = 1, columns = 1) => ({
  setValue(value) { cells.set(`${row}:${column}`, value); return this; },
  isBlank() { return !cells.get(`${row}:${column}`); },
  getValues() {
    return Array.from({ length: rows }, (_, rowOffset) => (
      Array.from({ length: columns }, (_, columnOffset) => cells.get(`${row + rowOffset}:${column + columnOffset}`) ?? '')
    ));
  },
  clearContent() {
    for (let currentRow = row; currentRow < row + rows; currentRow += 1) {
      for (let currentColumn = column; currentColumn < column + columns; currentColumn += 1) {
        cells.set(`${currentRow}:${currentColumn}`, '');
      }
    }
    return this;
  },
});
const fakeRosterSheet = {
  getLastRow: () => 4,
  getRange: (row, column, rows, columns) => fakeRange(rosterCells, row, column, rows, columns),
};
const fakePinSheet = {
  getRange: (row, column, rows, columns) => fakeRange(cardCells, row, column, rows, columns),
  appendRow() { throw new Error('No card should be appended in this fixture'); },
  showSheet() {},
};
behaviorContext.getRoster_ = () => fakeRoster;
behaviorContext.readPinCards_ = () => fakeCards;
behaviorContext.hashPin_ = (pin) => `hash-${pin}`;
behaviorContext.getSpreadsheet_ = () => ({
  getSheetByName(name) {
    if (name === 'Roster') return fakeRosterSheet;
    if (name === 'PIN Cards') return fakePinSheet;
    throw new Error(`Unexpected sheet ${name}`);
  },
});
const pinMigration = behaviorContext.__gdBehavior.ensureOnePinPerStudent_({ createMissing: false });
assert.equal(rosterCells.get('2:4'), rosterCells.get('3:4'), 'All class memberships for one email must share one PIN hash');
assert.equal(cardCells.get('2:4'), cardCells.get('3:4'), 'All printable class rows for one email must show one PIN');
assert.equal(rosterCells.get('4:4'), 'hash-333333', 'Another student’s PIN must remain unchanged');
assert.ok(pinMigration.normalizedMemberships >= 1);

for (const required of [
  'joinPassQueue',
  'requestBathroomPass',
  'authorizeStudentAction',
  'consumeStudentActionProof_',
  'settleWaitingQueue_',
  'teacherGetCountablePasses',
  'teacherVoidPass',
  'Pass Audit',
  'School Calendar',
  'queuePosition',
  'teacherSetPassLimits',
  'teacherSetPassRules',
  'teacherResetStudentPassCounters',
  'RESET ALL STUDENTS',
  'STUDENT_PASS_LIMIT',
  'DAILY_PASS_LIMIT',
  'PASS_COOLDOWN_MINUTES',
  'ensureOnePinPerStudent_',
  'selectStudentClass',
  'sendStudentPinEmails',
  'EMAIL PINS',
  'teacherClearUnmatchedSignIns',
  'CLEAR SIGN-IN PROBLEMS',
  'teacherMarkStudentAbsent',
  'teacherClearStudentAbsent',
  'getPinAttemptNonce',
  'teacher-pass-sound',
  'students not checked in',
]) {
  assert.ok(code.includes(required) || html.includes(required), `Missing ${required}`);
}

assert.ok(!code.includes("numberSetting_(settings, 'PASS_SESSION_LIMIT'"), 'Old daily/global session limit must not drive active pass logic');
const resetFunction = functionSource('teacherResetStudentPassCounters');
assert.doesNotMatch(resetFunction, /Queue|closePass|deleteRow/, 'Reset must not alter the queue, active passes, or private history');
assert.match(html, /Reset every student’s marking-period pass count to zero/);
assert.match(html, /one student · one PIN/);

const checkInRecorder = functionSource('recordCheckIn_');
assert.match(checkInRecorder, /absence\s*&&\s*method\s*!==\s*'teacher'/, 'A student check-in must not erase a teacher absence');
assert.match(checkInRecorder, /clearAbsentEntry_/, 'A teacher late check-in must preserve and clear the absence audit row');

const absenceClearer = functionSource('clearAbsentEntry_');
assert.match(absenceClearer, /'CLEARED'/);
assert.doesNotMatch(absenceClearer, /deleteRow|clearContent/, 'Clearing an absence must preserve the attendance audit trail');

console.log('GrantDesk hall-pass release: PASS — syntax, one-use action-bound PIN proofs, automatic verified-request queue advancement, 3.0-second countability boundary, legacy-history preservation, teacher corrections, permanent pass audit, credential-backed identity reconciliation, official-calendar streaks, polling-safe collapsible teacher controls, student evidence privacy, roster/attendance safeguards, capacity and cooldown rules, and guarded PIN delivery verified.');
