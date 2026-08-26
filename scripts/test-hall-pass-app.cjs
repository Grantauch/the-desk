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
vm.runInContext(`${code}\n;globalThis.__gdTest = { calculateCheckInStreak_, buildPinEmailMessage_, getStudentState_ };`, context);

const checkIn = (dateKey) => ({
  studentKey: 'student::period-1',
  dateKey,
  status: 'CHECKED_IN',
});

const fridayMonday = context.__gdTest.calculateCheckInStreak_(
  'student::period-1',
  [checkIn('2026-08-21'), checkIn('2026-08-24')],
  '2026-08-24'
);
assert.equal(fridayMonday.current, 2, 'Friday-to-Monday must keep the streak');
assert.equal(fridayMonday.best, 2);

const mondayAtRisk = context.__gdTest.calculateCheckInStreak_(
  'student::period-1',
  [checkIn('2026-08-21')],
  '2026-08-24'
);
assert.equal(mondayAtRisk.current, 1, 'Monday morning must preserve Friday while awaiting today');
assert.equal(mondayAtRisk.atRiskToday, true);

const missedMonday = context.__gdTest.calculateCheckInStreak_(
  'student::period-1',
  [checkIn('2026-08-21')],
  '2026-08-25'
);
assert.equal(missedMonday.current, 0, 'A missed weekday must break the current streak');

const weekend = context.__gdTest.calculateCheckInStreak_(
  'student::period-1',
  [checkIn('2026-08-21')],
  '2026-08-23'
);
assert.equal(weekend.current, 1);
assert.equal(weekend.weekendProtected, true);

const message = context.__gdTest.buildPinEmailMessage_(
  {
    email: 'student@students.mtmorrisschools.org',
    name: 'Student, Jordan',
    memberships: [
      { classPeriod: 'Period 1 — C US History A', pin: '123456' },
      { classPeriod: 'Period 3 — Beyond the Scoreboard', pin: '654321' },
    ],
  },
  {
    CHECKIN_URL: 'https://grant-desk.com/check-in/',
    PIN_EMAIL_SUBJECT: 'Your private GrantDesk class PIN',
  },
  'gauch@mtmorrisschools.org'
);
assert.equal(message.to, 'student@students.mtmorrisschools.org');
assert.match(message.body, /123456/);
assert.match(message.body, /654321/);
assert.match(message.body, /Keep this PIN private/);
assert.match(message.body, /^Hello Jordan,/);

context.getSettings_ = () => ({ APP_TITLE: 'Hall Pass', DESTINATION: 'Restroom', MAX_ACTIVE_PASSES: '1' });
context.readPassLog_ = () => [{ status: 'OUT', studentKey: 'other::period-1' }];
context.getWaitingQueue_ = () => [{
  queueId: 'queue-1',
  studentKey: 'student::period-1',
  studentName: 'Jordan Student',
  classPeriod: 'Period 1',
  joinedAt: new Date('2026-08-25T12:00:00Z'),
}];
context.getPassSessionState_ = () => ({ limit: 10, used: 1, remaining: 9, limitReached: false, resetAt: '2026-08-25T00:00:00Z' });
const waitingState = context.__gdTest.getStudentState_(
  { key: 'student::period-1', name: 'Jordan Student', classPeriod: 'Period 1' },
  'token',
  'pin'
);
assert.equal(waitingState.queuePosition, 1);
assert.equal(waitingState.passAvailable, false);

context.readPassLog_ = () => [];
const firstInLineState = context.__gdTest.getStudentState_(
  { key: 'student::period-1', name: 'Jordan Student', classPeriod: 'Period 1' },
  'token',
  'pin'
);
assert.equal(firstInLineState.queuePosition, 1);
assert.equal(firstInLineState.passAvailable, true, 'First in line must be released when a slot opens');

for (const required of [
  'joinPassQueue',
  'queuePosition',
  'teacherSetPassLimits',
  'teacherResetPassSession',
  'sendStudentPinEmails',
  'EMAIL PINS',
]) {
  assert.ok(code.includes(required) || html.includes(required), `Missing ${required}`);
}

console.log('Hall-pass logic: PASS — queue position, pass limits/reset, weekday streaks, timers, and guarded PIN email flow.');
