const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const codePath = path.join(root, 'apps-script', 'hall-pass', 'Code.gs');
const htmlPath = path.join(root, 'apps-script', 'hall-pass', 'Index.html');
const manifestPath = path.join(root, 'apps-script', 'hall-pass', 'appsscript.json');

const code = fs.readFileSync(codePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

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
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
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

assert.match(code, /GD_SCHEMA_VERSION\s*=\s*'2026-08-28-a'/);
assert.match(code, /UNMATCHED:\s*'Unmatched Sign-ins'/);
assert.match(code, /function teacherApplyUnmatchedEmail/);
assert.match(code, /function teacherAddStudentClass/);
assert.match(code, /function teacherRemoveStudentClass/);
assert.match(code, /function readRosterRows_/);

const studentState = functionSource('getStudentState_');
assert.match(studentState, /passAllowance:\s*studentAllowanceView_\(allowance\)/);
assert.doesNotMatch(studentState, /passAllowance:\s*allowance\b/);

const allowanceView = functionSource('studentAllowanceView_');
assert.doesNotMatch(allowanceView, /unlimited\s*[:,]/, 'Student payload must not reveal the private unlimited flag');

const generatePins = functionSource('generateMissingPins');
assert.ok(
  generatePins.indexOf('assertTeacher_') < generatePins.indexOf('setupWorkbook_'),
  'PIN generation must authorize before workbook mutation'
);

const emailBatch = functionSource('runPinEmailBatch_');
assert.match(emailBatch, /withLock_\([\s\S]*PIN_EMAIL_RUNNING/);

const cleanup = functionSource('dailyCleanup');
assert.match(cleanup, /assertTeacher_/);
assert.match(cleanup, /withLock_/);

for (const name of ['teacherAddStudentClass', 'teacherRemoveStudentClass']) {
  const source = functionSource(name);
  assert.ok(source.indexOf('assertTeacher_') < source.indexOf('withLock_'), `${name} must authorize before mutation`);
}

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
  unlimited: true,
});
assert.deepEqual(
  JSON.parse(JSON.stringify(privateAllowance)),
  { capped: false, limit: 0, used: 0, remaining: null, limitReached: false }
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
  /cannot begin with an equals sign/
);
assert.throws(
  () => context.__gdTest.normalizeRosterInput_('Student, Jordan', 'student@example.com', 'Period 1', { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }),
  /must end in/
);

// Preserve the behavioral coverage that predates the Version 9 recovery. The
// structural assertions above catch security/privacy regressions; these
// fixtures catch changes to the classroom rules themselves.
const behaviorContext = {
  Utilities: {
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
};`, behaviorContext);

const checkIn = (dateKey) => ({
  studentKey: 'student::period-1',
  dateKey,
  status: 'CHECKED_IN',
});

const fridayMonday = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
  checkIn('2026-08-24'),
]).streakFor('student::period-1', '2026-08-24');
assert.equal(fridayMonday.current, 2, 'Friday-to-Monday must keep the streak');
assert.equal(fridayMonday.best, 2);

const mondayAtRisk = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
]).streakFor('student::period-1', '2026-08-24');
assert.equal(mondayAtRisk.current, 1, 'Monday morning must preserve Friday while awaiting today');
assert.equal(mondayAtRisk.atRiskToday, true);

const missedMonday = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
]).streakFor('student::period-1', '2026-08-25');
assert.equal(missedMonday.current, 0, 'A missed weekday must break the current streak');

const weekend = behaviorContext.__gdBehavior.buildStreakIndex_([
  checkIn('2026-08-21'),
]).streakFor('student::period-1', '2026-08-23');
assert.equal(weekend.current, 1);
assert.equal(weekend.weekendProtected, true);

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
    { studentEmail: 'student@students.mtmorrisschools.org', outDate: new Date('2026-08-02T12:00:00Z') },
    { studentEmail: 'other@students.mtmorrisschools.org', outDate: new Date('2026-08-03T12:00:00Z') },
  ]
);
assert.equal(allowance.used, 1);
assert.equal(allowance.remaining, 1);
assert.equal(allowance.limitReached, false);

const resetAllowance = behaviorContext.__gdBehavior.getStudentPassAllowance_(
  'student@students.mtmorrisschools.org',
  { STUDENT_PASS_LIMIT: '2', STUDENT_PASS_RESET_AT: '2026-08-04T00:00:00Z' },
  [{ studentEmail: 'student@students.mtmorrisschools.org', outDate: new Date('2026-08-02T12:00:00Z') }]
);
assert.equal(resetAllowance.used, 0, 'Manual reset timestamp must return the student count to zero');

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
  'queuePosition',
  'teacherSetPassLimits',
  'teacherResetStudentPassCounters',
  'RESET ALL STUDENTS',
  'STUDENT_PASS_LIMIT',
  'ensureOnePinPerStudent_',
  'selectStudentClass',
  'sendStudentPinEmails',
  'EMAIL PINS',
]) {
  assert.ok(code.includes(required) || html.includes(required), `Missing ${required}`);
}

assert.ok(!code.includes("numberSetting_(settings, 'PASS_SESSION_LIMIT'"), 'Old daily/global session limit must not drive active pass logic');
const resetFunction = functionSource('teacherResetStudentPassCounters');
assert.doesNotMatch(resetFunction, /Queue|closePass|deleteRow/, 'Reset must not alter the queue, active passes, or private history');
assert.match(html, /Reset every student’s marking-period pass count to zero/);
assert.match(html, /one student · one PIN/);

console.log('GrantDesk hall-pass release: PASS — syntax, Version 9 protections, roster management, student-payload privacy, pass allowances, confirmed reset, one PIN per student, class selection, queue position, weekday streaks, timers, and guarded PIN email flow verified.');
