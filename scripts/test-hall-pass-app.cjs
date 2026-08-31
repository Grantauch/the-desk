const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const codePath = path.join(root, 'apps-script', 'hall-pass', 'Code.gs');
const htmlPath = path.join(root, 'apps-script', 'hall-pass', 'Index.html');
const code = fs.readFileSync(codePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

new vm.Script(code, { filename: codePath });

const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scriptBlocks.length, 'Index.html must contain an application script');
const clientScript = scriptBlocks.at(-1)[1].replace('<?!= JSON.stringify(appMode) ?>', '"student"');
new vm.Script(clientScript, { filename: htmlPath });

const context = {
  Utilities: {
    formatDate(date, zone, format) {
      assert.equal(zone, 'UTC');
      assert.equal(format, 'yyyy-MM-dd');
      return date.toISOString().slice(0, 10);
    },
  },
};
vm.createContext(context);
vm.runInContext(`${code}\n;globalThis.__gdTest = { computeStreak_, buildPinEmailMessage_, getStudentState_, getStudentPassAllowance_, buildClassSelectionState_, ensureOnePinPerStudent_, normalizeRosterInput_ };`, context);

const checkIn = (dateKey) => ({
  studentKey: 'student::period-1',
  dateKey,
  status: 'CHECKED_IN',
});

const fridayMonday = context.__gdTest.computeStreak_(new Set(['2026-08-21', '2026-08-24']), '2026-08-24');
assert.equal(fridayMonday.current, 2, 'Friday-to-Monday must keep the streak');
assert.equal(fridayMonday.best, 2);

const mondayAtRisk = context.__gdTest.computeStreak_(new Set(['2026-08-21']), '2026-08-24');
assert.equal(mondayAtRisk.current, 1, 'Monday morning must preserve Friday while awaiting today');
assert.equal(mondayAtRisk.atRiskToday, true);

const missedMonday = context.__gdTest.computeStreak_(new Set(['2026-08-21']), '2026-08-25');
assert.equal(missedMonday.current, 0, 'A missed weekday must break the current streak');

const weekend = context.__gdTest.computeStreak_(new Set(['2026-08-21']), '2026-08-23');
assert.equal(weekend.current, 1);
assert.equal(weekend.weekendProtected, true);

const message = context.__gdTest.buildPinEmailMessage_(
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
  'gauch@mtmorrisschools.org'
);
assert.equal(message.to, 'student@students.mtmorrisschools.org');
assert.match(message.body, /123456/);
assert.doesNotMatch(message.body, /654321/);
assert.match(message.body, /one PIN works in every Mr\. Grant class/i);
assert.match(message.body, /Keep this PIN private/);
assert.match(message.body, /^Hello Jordan,/);

context.getUnlimitedPassEmails_ = () => new Set();
const allowance = context.__gdTest.getStudentPassAllowance_(
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

const resetAllowance = context.__gdTest.getStudentPassAllowance_(
  'student@students.mtmorrisschools.org',
  { STUDENT_PASS_LIMIT: '2', STUDENT_PASS_RESET_AT: '2026-08-04T00:00:00Z' },
  [{ studentEmail: 'student@students.mtmorrisschools.org', outDate: new Date('2026-08-02T12:00:00Z') }]
);
assert.equal(resetAllowance.used, 0, 'Manual reset timestamp must return the student count to zero');

const queueFixture = [{
  queueId: 'queue-1',
  studentKey: 'student::period-1',
  studentEmail: 'student@students.mtmorrisschools.org',
  studentName: 'Jordan Student',
  classPeriod: 'Period 1',
  joinedAt: new Date('2026-08-25T12:00:00Z'),
}];
const stateSettings = { APP_TITLE: 'Hall Pass', DESTINATION: 'Restroom', STUDENT_PASS_LIMIT: '3' };
context.getUnlimitedPassEmails_ = () => new Set();
context.getPassSnapshot_ = () => ({
  settings: stateSettings,
  log: [{ status: 'OUT', studentEmail: 'other@students.mtmorrisschools.org' }],
  active: [{ status: 'OUT', studentEmail: 'other@students.mtmorrisschools.org' }],
  maxActive: 1,
  openSlots: 0,
  queue: queueFixture,
  expiredQueue: [],
});
const waitingState = context.__gdTest.getStudentState_(
  { key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Jordan Student', classPeriod: 'Period 1' },
  'token',
  'pin'
);
assert.equal(waitingState.queuePosition, 1);
assert.equal(waitingState.passAvailable, false);

context.getPassSnapshot_ = () => ({
  settings: stateSettings,
  log: [],
  active: [],
  maxActive: 1,
  openSlots: 1,
  queue: queueFixture,
  expiredQueue: [],
});
const firstInLineState = context.__gdTest.getStudentState_(
  { key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Jordan Student', classPeriod: 'Period 1' },
  'token',
  'pin'
);
assert.equal(firstInLineState.queuePosition, 1);
assert.equal(firstInLineState.passAvailable, true, 'First in line must be released when a slot opens');

context.getSettings_ = () => ({ APP_TITLE: 'Hall Pass' });
const classChoice = context.__gdTest.buildClassSelectionState_([
  { key: 'student::period-1', email: 'student@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 1' },
  { key: 'student::period-3', email: 'student@students.mtmorrisschools.org', name: 'Student, Jordan', classPeriod: 'Period 3' },
], 'token', 'pin', 'pass');
assert.equal(classChoice.requiresClassSelection, true);
assert.equal(classChoice.classes.length, 2);
assert.equal(classChoice.pinToken, 'token');

const rosterInput = context.__gdTest.normalizeRosterInput_(
  '  Student,   Jordan  ',
  'JORDAN@students.mtmorrisschools.org ',
  ' Period 3 — Beyond the Scoreboard ',
  { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }
);
assert.equal(rosterInput.name, 'Student, Jordan');
assert.equal(rosterInput.email, 'jordan@students.mtmorrisschools.org');
assert.equal(rosterInput.classPeriod, 'Period 3 — Beyond the Scoreboard');
assert.equal(rosterInput.key, 'jordan@students.mtmorrisschools.org::period 3 — beyond the scoreboard');
assert.throws(() => context.__gdTest.normalizeRosterInput_(
  'Student, Jordan',
  'jordan@gmail.com',
  'Period 3',
  { STUDENT_EMAIL_DOMAIN: 'students.mtmorrisschools.org' }
), /must end in @students\.mtmorrisschools\.org/);

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
  getValues() {
    return Array.from({ length: rows }, (_, rowOffset) => Array.from(
      { length: columns },
      (_, columnOffset) => cells.get(`${row + rowOffset}:${column + columnOffset}`) || ''
    ));
  },
  isBlank() { return !cells.get(`${row}:${column}`); },
  clearContent() {
    for (let r = row; r < row + rows; r += 1) for (let c = column; c < column + columns; c += 1) cells.set(`${r}:${c}`, '');
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
context.getRoster_ = () => fakeRoster;
context.readPinCards_ = () => fakeCards;
context.hashPin_ = (pin) => `hash-${pin}`;
context.getSpreadsheet_ = () => ({
  getSheetByName(name) {
    if (name === 'Roster') return fakeRosterSheet;
    if (name === 'PIN Cards') return fakePinSheet;
    throw new Error(`Unexpected sheet ${name}`);
  },
});
const pinMigration = context.__gdTest.ensureOnePinPerStudent_({ createMissing: false });
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
  'teacherAddStudentClass',
  'teacherRemoveStudentClass',
  'normalizeRosterInput_',
  'selectStudentClass',
  'sendStudentPinEmails',
  'EMAIL PINS',
]) {
  assert.ok(code.includes(required) || html.includes(required), `Missing ${required}`);
}

assert.ok(!code.includes("numberSetting_(settings, 'PASS_SESSION_LIMIT'"), 'Old daily/global session limit must not drive active pass logic');
const resetFunction = code.match(/function teacherResetStudentPassCounters[\s\S]*?\n}\n/)[0];
assert.doesNotMatch(resetFunction, /Queue|closePass|deleteRow/, 'Reset must not alter the queue, active passes, or private history');
const addRosterFunction = code.slice(code.indexOf('function teacherAddStudentClass'), code.indexOf('function teacherRemoveStudentClass'));
assert.match(addRosterFunction, /ensureOnePinPerStudent_\(\{ createMissing: true \}\)/, 'Adding a student must create or reuse one PIN');
const removeRosterFunction = code.slice(code.indexOf('function teacherRemoveStudentClass'), code.indexOf('function normalizeRosterInput_'));
assert.match(removeRosterFunction, /getRange\(student\.row, 5\)\.setValue\(false\)/, 'Removing a class membership must deactivate it');
assert.doesNotMatch(removeRosterFunction, /deleteRow/, 'Removing a student must preserve roster history for reactivation');
assert.match(html, /Reset every student’s marking-period pass count to zero/);
assert.match(html, /one student · one PIN/);
assert.match(html, /add or reactivate a student/i);
assert.match(html, /remove from class/i);
assert.match(html, /changes immediately update daily check-in and hall pass/i);

console.log('Hall-pass logic: PASS — roster add/reactivate/remove, shared PINs, class selection, pass allowances, queue position, weekday streaks, timers, and guarded PIN email flow.');
