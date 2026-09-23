/**
 * GrantDesk hall pass — behavioral suite.
 *
 * The companion suite, test-hall-pass-app.cjs, asserts things about the source
 * text: that a constant holds a value, that a function exists, that a payload
 * never mentions a PIN. Those checks are cheap and they catch real regressions.
 * They cannot catch a function that is present, named correctly, and wrong.
 *
 * Version 16 shipped exactly that. `authorizeStudentAction` validated the
 * requested action before translating the client's AUTO_PASS sentinel into a
 * real one, so every bathroom request in production was rejected while daily
 * check-in kept working. The suite passed. The release smoke passed, because it
 * was run without submitting a PIN and nothing past that function executes
 * until a PIN is accepted.
 *
 * So this suite runs the application. Code.gs is loaded into a fake Apps Script
 * runtime with an in-memory workbook, and each test performs a classroom
 * action and then reads the rows that action wrote. Every student, address and
 * credential is invented; nothing here touches the live workbook.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classroom, PEOPLE, TEACHER, TEACHER_CONTRACT, setNoSchoolDays } = require('./lib/hall-pass-fixtures.cjs');

/* ------------------------------------------------------------------ runner -- */

const results = [];
let currentSection = '';
let failures = 0;

function section(name) { currentSection = name; }

function test(name, fn) {
  try {
    fn();
    results.push({ section: currentSection, name, ok: true });
  } catch (error) {
    failures += 1;
    results.push({ section: currentSection, name, ok: false, error });
  }
}

function report() {
  const bySection = new Map();
  results.forEach((entry) => {
    if (!bySection.has(entry.section)) bySection.set(entry.section, []);
    bySection.get(entry.section).push(entry);
  });

  for (const [name, entries] of bySection) {
    const failed = entries.filter((entry) => !entry.ok);
    const mark = failed.length ? 'FAIL' : 'PASS';
    console.log(`${mark}  ${name}  (${entries.length - failed.length}/${entries.length})`);
    failed.forEach((entry) => {
      console.log(`      ✗ ${entry.name}`);
      const message = String(entry.error && entry.error.message || entry.error).split('\n').slice(0, 6);
      message.forEach((line) => console.log(`        ${line}`));
    });
  }

  console.log('');
  if (failures) {
    console.log(`GrantDesk hall-pass runtime: FAIL — ${failures} of ${results.length} checks failed.`);
    process.exitCode = 1;
  } else {
    console.log(`GrantDesk hall-pass runtime: PASS — ${results.length} behavioral checks across ${bySection.size} areas.`);
  }
}

const outcomeOf = (result) => (result.state && result.state.actionOutcome) || {};

/* ------------------------------------------------- 1. workbook and schema --- */

section('Workbook, schema and first-run repair');

test('a fresh project builds every sheet the app depends on', () => {
  const c = classroom();
  const names = c.harness.spreadsheet.getSheets().map((sheet) => sheet.getName());
  ['Roster', 'Pass Log', 'Pass Audit', 'Daily Check-ins', 'Pass Queue', 'Settings', 'PIN Cards', 'Unmatched Sign-ins', 'School Calendar', 'Instructions']
    .forEach((name) => assert.ok(names.includes(name), `missing sheet ${name}`));
});

test('the schema version is recorded so later requests skip the repair', () => {
  const c = classroom();
  assert.equal(c.harness.properties.getProperty('WORKBOOK_SCHEMA'), '2026-09-21-backend-b');
});

test('repair runs once, not on every request', () => {
  const c = classroom();
  const before = c.harness.state.lock.acquisitions;
  c.harness.newRequest();
  c.harness.call('ensureWorkbookReady_');
  assert.equal(c.harness.state.lock.acquisitions, before, 'a settled schema must not take the shared lock again');
});

test('Pass Log carries the full expanded column set', () => {
  const c = classroom();
  const headers = c.harness.sheet('Pass Log').getRange(1, 1, 1, 21).getValues()[0].filter(Boolean);
  ['Pass ID', 'Student Email', 'Out Time', 'Return Time', 'Minutes Out', 'Status', 'Countability', 'Countability Reason', 'Authorization Method', 'Voided By', 'Void Reason']
    .forEach((column) => assert.ok(headers.includes(column), `Pass Log is missing ${column}`));
});

test('schema repair refuses a nonblank shifted or renamed fixed-position header', () => {
  const c = classroom();
  const roster = c.harness.sheet('Roster');
  const originalStudent = roster.getRange(2, 2).getValue();
  roster.getRange(1, 2).setValue('Display Name');
  c.harness.properties.deleteProperty('WORKBOOK_SCHEMA');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('ensureWorkbookReady_'),
    /unexpected column 2 header.*Student Name/i
  );
  assert.equal(roster.getRange(2, 2).getValue(), originalStudent, 'failed repair must not move roster data');
});

test('duplicate Settings keys fail closed instead of silently using the last row', () => {
  const c = classroom();
  c.harness.sheet('Settings').appendRow(['MAX_ACTIVE_PASSES', '9', 'synthetic duplicate']);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('getSettings_'),
    /duplicate key "MAX_ACTIVE_PASSES"/i
  );
});

test('duplicate School Calendar dates fail closed instead of silently overriding a day', () => {
  const c = classroom();
  c.harness.sheet('School Calendar').appendRow(['2026-09-02', false, 'synthetic duplicate', 'test', 'test', '']);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('getSchoolCalendarIndex_'),
    /duplicate date 2026-09-02/i
  );
});

test('duplicate active roster memberships fail closed instead of selecting an arbitrary row', () => {
  const c = classroom();
  const roster = c.harness.sheet('Roster');
  const duplicate = roster.getRange(2, 1, 1, 7).getValues()[0];
  roster.appendRow(duplicate);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('getRoster_'),
    /duplicate active membership/i
  );
});

test('workbook setup refuses an active PIN email batch before mutating workbook state', () => {
  const c = classroom();
  const settings = c.harness.sheet('Settings');
  const before = JSON.stringify(settings.records());
  c.harness.properties.setProperty('PIN_EMAIL_RUNNING', String(new Date('2026-09-10T11:50:00Z').getTime()));
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('setupWorkbook_'),
    /PIN records cannot be changed while a PIN email batch is running/
  );
  assert.equal(JSON.stringify(settings.records()), before, 'setup must fail before changing workbook state');
});

test('setup removes obsolete calendar-source settings that never controlled runtime', () => {
  const c = classroom();
  const settings = c.harness.sheet('Settings');
  settings.appendRow(['SCHOOL_CALENDAR_FILE_ID', 'legacy-file', 'obsolete']);
  settings.appendRow(['SCHOOL_CALENDAR_FALLBACK_URL', 'https://example.invalid/', 'obsolete']);
  c.harness.newRequest();
  c.harness.call('setupWorkbook_');
  const keys = settings.records().map((row) => String(row.Key || ''));
  assert.ok(!keys.includes('SCHOOL_CALENDAR_FILE_ID'));
  assert.ok(!keys.includes('SCHOOL_CALENDAR_FALLBACK_URL'));
});

test('date-tail reader falls back to the full ledger when a delayed older row breaks chronological order', () => {
  const c = classroom();
  const sheet = c.harness.sheet('Daily Check-ins');
  const rows = [];
  for (let i = 0; i < 650; i += 1) {
    rows.push([
      `today-${i}`,
      '2026-09-10',
      new Date('2026-09-10T11:30:00Z'),
      `student-${i}@students.mtmorrisschools.org`,
      `Student ${i}`,
      'Period 1',
      'PIN',
      1,
      'CHECKED_IN',
      '',
    ]);
  }
  rows.push([
    'delayed-yesterday',
    '2026-09-09',
    new Date('2026-09-09T11:30:00Z'),
    'delayed@students.mtmorrisschools.org',
    'Delayed Student',
    'Period 1',
    'PIN',
    1,
    'CHECKED_IN',
    '',
  ]);
  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
  c.harness.newRequest();

  const today = c.harness.call('readCheckInsForDate_', '2026-09-10');
  assert.equal(today.length, 650, 'out-of-order tail rows must not truncate the target date');
});

test('the daily cleanup trigger is installed', () => {
  const c = classroom();
  assert.ok(c.harness.state.triggers.some((trigger) => trigger.handler === 'dailyCleanup'));
});

test('cleanup trigger repair collapses duplicate daily cleanup triggers to one', () => {
  const c = classroom();
  c.harness.state.triggers.push(
    { handler: 'dailyCleanup', id: 'duplicate-cleanup-1' },
    { handler: 'dailyCleanup', id: 'duplicate-cleanup-2' },
  );
  c.harness.call('installCleanupTrigger_');
  assert.equal(
    c.harness.state.triggers.filter((trigger) => trigger.handler === 'dailyCleanup').length,
    1,
    'repair must leave exactly one daily cleanup trigger'
  );
});

test('daily cleanup rejects a trigger UID owned by a different handler', () => {
  const c = classroom();
  const wrong = c.harness.state.triggers.find((entry) => entry.handler === 'flushPendingCheckIns');
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(
    () => c.harness.call('dailyCleanup', { triggerUid: wrong.id }),
    /limited to the teacher/
  );
  const cleanup = c.harness.state.triggers.find((entry) => entry.handler === 'dailyCleanup');
  assert.doesNotThrow(() => c.harness.call('dailyCleanup', { triggerUid: cleanup.id }));
});

test('teacher bootstrap repairs a missing daily cleanup trigger', () => {
  const c = classroom();
  c.harness.state.triggers = c.harness.state.triggers.filter((trigger) => trigger.handler !== 'dailyCleanup');
  c.harness.signInAs(TEACHER);
  c.harness.newRequest();
  c.harness.call('getBootstrap', 'teacher', TEACHER_CONTRACT);
  assert.equal(
    c.harness.state.triggers.filter((trigger) => trigger.handler === 'dailyCleanup').length,
    1,
    'opening Teacher mode must restore the daily cleanup trigger'
  );
});

test('routine teacher polling audits project triggers at most once per hour', () => {
  const c = classroom();
  c.harness.signInAs(TEACHER);
  c.harness.newRequest();
  c.harness.call('getBootstrap', 'teacher', TEACHER_CONTRACT);
  const afterBootstrap = c.harness.state.triggerReads;
  assert.ok(afterBootstrap >= 2, 'bootstrap should verify both background trigger classes');

  c.harness.newRequest();
  c.harness.call('getTeacherState_', { includePinStatus: false });
  c.harness.newRequest();
  c.harness.call('getTeacherState_', { includePinStatus: false });
  assert.equal(c.harness.state.triggerReads, afterBootstrap,
    'dashboard polling inside the audit window must not enumerate project triggers again');

  c.harness.clock.advanceMinutes(61);
  c.harness.newRequest();
  c.harness.call('getTeacherState_', { includePinStatus: false });
  assert.ok(c.harness.state.triggerReads > afterBootstrap,
    'the background trigger audit should run again after the one-hour window');
});

test('the durable check-in inbox has one minute flusher trigger', () => {
  const c = classroom();
  assert.equal(c.harness.state.triggers.filter((trigger) => trigger.handler === 'flushPendingCheckIns').length, 1);
  c.harness.call('ensureCheckInFlushTrigger_');
  assert.equal(c.harness.state.triggers.filter((trigger) => trigger.handler === 'flushPendingCheckIns').length, 1);
});

test('only the owned minute trigger or teacher can invoke a manual inbox flush', () => {
  const c = classroom();
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(() => c.harness.call('flushPendingCheckIns', {}), /limited to the teacher/);
  const trigger = c.harness.state.triggers.find((entry) => entry.handler === 'flushPendingCheckIns');
  assert.doesNotThrow(() => c.harness.call('flushPendingCheckIns', { triggerUid: trigger.id }));
});


test('owned background trigger IDs authenticate without enumerating project triggers', () => {
  const c = classroom();
  const flush = c.harness.state.triggers.find((entry) => entry.handler === 'flushPendingCheckIns');
  const cleanup = c.harness.state.triggers.find((entry) => entry.handler === 'dailyCleanup');
  const beforeFlush = c.harness.state.triggerReads;
  const flushResult = c.harness.call('flushPendingCheckIns', { triggerUid: flush.id });
  assert.equal(c.harness.state.triggerReads, beforeFlush,
    'known minute trigger ID should validate from Script Properties');
  assert.equal(flushResult.idle, true);

  const beforeCleanup = c.harness.state.triggerReads;
  assert.doesNotThrow(() => c.harness.call('dailyCleanup', { triggerUid: cleanup.id }));
  assert.equal(c.harness.state.triggerReads, beforeCleanup,
    'known daily cleanup trigger ID should validate from Script Properties');
});

test('empty teacher polling does not acquire the shared transaction lock', () => {
  const c = classroom();
  c.harness.signInAs(TEACHER);
  c.harness.newRequest();
  c.harness.call('getBootstrap', 'teacher', TEACHER_CONTRACT);
  const before = c.harness.state.lock.acquisitions;
  c.harness.newRequest();
  c.harness.call('getTeacherState_', { includePinStatus: false });
  assert.equal(c.harness.state.lock.acquisitions, before,
    'an empty durable Check-In inbox must not touch the shared transaction lock');
});

test('idle minute flusher returns before shared lock or Pass Log work', () => {
  const c = classroom();
  const trigger = c.harness.state.triggers.find((entry) => entry.handler === 'flushPendingCheckIns');
  const beforeLocks = c.harness.state.lock.acquisitions;
  const originalSnapshot = c.harness.sandbox.getPassSnapshot_;
  c.harness.sandbox.getPassSnapshot_ = () => { throw new Error('Pass snapshot should not be read on idle minute tick'); };
  try {
    const result = c.harness.call('flushPendingCheckIns', { triggerUid: trigger.id });
    assert.equal(result.idle, true);
    assert.equal(c.harness.state.lock.acquisitions, beforeLocks);
  } finally {
    c.harness.sandbox.getPassSnapshot_ = originalSnapshot;
  }
});


test('minute durability trigger resumes queue settlement after a committed return', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 5 } });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  assert.equal(outcomeOf(c.requestPass(PEOPLE.alan, 'Period 1')).kind, 'QUEUED');
  const adaPass = c.passLog().find((row) => row['Student Email'] === PEOPLE.ada.email && String(row.Status) === 'OUT');

  c.harness.newRequest();
  c.harness.call('closePassById_', String(adaPass['Pass ID']), PEOPLE.ada.email, 'Synthetic committed return before settlement');
  assert.ok(c.queue().some((row) => row['Student Email'] === PEOPLE.alan.email && String(row.Status) === 'WAITING'));

  const trigger = c.harness.state.triggers.find((entry) => entry.handler === 'flushPendingCheckIns');
  c.harness.newRequest();
  c.harness.call('flushPendingCheckIns', { triggerUid: trigger.id });

  assert.equal(c.queue().filter((row) => row['Student Email'] === PEOPLE.alan.email && String(row.Status) === 'WAITING').length, 0);
  assert.ok(c.passLog().some((row) => row['Student Email'] === PEOPLE.alan.email && String(row.Status) === 'OUT'),
    'the timer must promote the waiting verified request into the newly open slot');
});


test('Daily Check-ins starts with safe row headroom and repairs a stale flusher flag', () => {
  const c = classroom();
  assert.ok(c.harness.sheet('Daily Check-ins').getMaxRows() >= 5000, 'setup must pre-grow the check-in sheet');
  c.harness.state.triggers = c.harness.state.triggers.filter((trigger) => trigger.handler !== 'flushPendingCheckIns');
  assert.equal(c.harness.properties.getProperty('CHECKIN_FLUSH_TRIGGER_INSTALLED'), '1', 'the stale flag should still exist');
  c.harness.call('ensureCheckInFlushTrigger_');
  assert.equal(c.harness.state.triggers.filter((trigger) => trigger.handler === 'flushPendingCheckIns').length, 1,
    'the trigger must be recreated even when the property flag was stale');
});

test('a deduplicated recovery flush repairs the secondary Check-In index before clearing the inbox', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');

  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'index-recovery');

  c.harness.newRequest();
  c.harness.refuseLocks(1);
  c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);

  const pending = c.harness.call('readPendingCheckIns_')[0];
  assert.ok(pending, 'the simulated failed flush must leave a durable inbox entry');

  const row = Array.from(c.harness.call('checkInEntryRow_', pending));
  c.harness.sheet('Daily Check-ins').appendRow(row);
  c.harness.newRequest();

  const summaryKey = c.harness.call('checkInSummaryPropertyKey_', key);
  c.harness.properties.deleteProperty(summaryKey);
  assert.equal(c.harness.properties.getProperty(summaryKey), null, 'the secondary index is intentionally missing');

  c.harness.call('flushPendingCheckInsLocked_');

  assert.ok(c.harness.properties.getProperty(summaryKey), 'deduplicated recovery must rebuild the missing student summary');
  assert.equal(c.harness.properties.getProperty(pending.pendingPropertyKey), null, 'the durable inbox clears only after index repair');
  assert.equal(c.checkIns().filter((entry) => entry['Student Email'] === PEOPLE.ada.email).length, 1,
    'recovery must not duplicate the authoritative attendance row');
});

test('a full 1000-row check-in grid grows before the next inbox flush', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const sheet = c.harness.sheet('Daily Check-ins');
  sheet.maxRows = 1000;
  sheet.getRange(1000, 1).setValue('synthetic-legacy-tail');
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'row-capacity');
  c.harness.newRequest();
  c.harness.refuseLocks(1);
  const state = c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);
  assert.equal(state.checkedIn, true);
  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');
  assert.ok(sheet.getMaxRows() > 1000, 'flush must expand the grid rather than fail at row 1001');
  assert.ok(sheet.getLastRow() >= 1001, 'the staged arrival must be persisted after expansion');
});

/* ------------------------------------------------------- 2. credentials ----- */

section('Credentials: one student, one PIN');

test('a student in two classes gets one shared PIN, not one per class', () => {
  const c = classroom({
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.ada, 'Period 3'], [PEOPLE.alan, 'Period 1']],
  });
  const cards = c.pinCards().filter((card) => card['Student Email'] === PEOPLE.ada.email);
  assert.equal(cards.length, 2, 'one card per membership');
  assert.equal(cards[0].PIN, cards[1].PIN, 'both memberships must show the same PIN');
});

test('both memberships store the same hash on the roster', () => {
  const c = classroom({
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.ada, 'Period 3']],
  });
  const hashes = new Set(c.rosterRows().map((row) => String(row['PIN Hash'])));
  assert.equal(hashes.size, 1);
  assert.notEqual([...hashes][0], '');
});

test('different students never share a PIN', () => {
  const c = classroom();
  const pins = new Set([c.pin(PEOPLE.ada), c.pin(PEOPLE.alan), c.pin(PEOPLE.grace)]);
  assert.equal(pins.size, 3);
});

test('no plaintext PIN is ever written to the Roster', () => {
  const c = classroom();
  const plain = [c.pin(PEOPLE.ada), c.pin(PEOPLE.alan), c.pin(PEOPLE.grace)];
  const rosterText = JSON.stringify(c.rosterRows());
  plain.forEach((pin) => assert.ok(!rosterText.includes(pin), 'a plaintext PIN reached the Roster'));
});


test('teacher PIN reset rotates one student across every class and preserves recovery cards', () => {
  const c = classroom({ memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.ada, 'Period 3'], [PEOPLE.alan, 'Period 1']] });
  const oldPin = c.pin(PEOPLE.ada);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const state = c.harness.call('teacherResetStudentPin', PEOPLE.ada.email, 'Student reported a compromised PIN', TEACHER_CONTRACT);
  const cards = c.pinCards().filter((card) => card['Student Email'] === PEOPLE.ada.email);
  const pins = new Set(cards.map((card) => String(card.PIN)));
  assert.equal(cards.length, 2);
  assert.equal(pins.size, 1, 'all memberships must receive the same replacement PIN');
  const newPin = [...pins][0];
  assert.notEqual(newPin, oldPin);
  assert.ok(cards.every((card) => String(card['Email Status']) === 'NEEDS_RESEND'));
  const ready = c.harness.call('buildPinEmailGroups_').readyGroups;
  assert.ok(ready.some((group) => group.email === PEOPLE.ada.email), 'the reset student must be ready for private PIN redelivery');
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(() => c.harness.call('authorizeStudentAction', oldPin, 'AUTO_PASS', key, 'old-pin'), /did not match/);
  c.harness.newRequest();
  assert.doesNotThrow(() => c.harness.call('authorizeStudentAction', newPin, 'AUTO_PASS', key, 'new-pin'));
});

test('resetting a compromised PIN immediately revokes previously issued session and action proof', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const stale = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'before-reset');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherResetStudentPin', PEOPLE.ada.email, 'Compromised credential', TEACHER_CONTRACT);

  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('requestBathroomPass', stale.actionProof, key, stale.pinToken),
    /PIN changed|current PIN|credentials changed/i,
    'an outstanding one-use proof must die when the PIN rotates'
  );
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('refreshStudentState', stale.pinToken),
    /PIN changed|current PIN|credentials changed/i,
    'the one-hour identity token must die when the PIN rotates'
  );
  assert.equal(c.passLog().length, 0);
});

test('legacy cache-only PIN sessions are rejected even if a stale cache entry still exists', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.cache.put('pin:legacy-session-token', JSON.stringify({
    email: PEOPLE.ada.email,
    key,
    method: 'pin',
    pinVerified: true,
  }), 3600);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('refreshStudentState', 'legacy-session-token'),
    /expired|current PIN/i
  );
});

test('the obsolete clear-PIN command fails closed without deleting recovery records', () => {
  const c = classroom();
  const before = c.pinCards().length;
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  assert.throws(() => c.harness.call('clearPinCards'), /no longer deletes PIN recovery records/);
  assert.equal(c.pinCards().length, before);
});

/* ------------------------------------------- 3. authorization and proofs ---- */

section('Fresh-PIN authorization and one-use action proofs');

test('AUTO_PASS resolves to a pass request rather than being rejected', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');
  assert.equal(authorized.authorizedAction, 'PASS_REQUEST');
});

test('AUTO_PASS resolves to a return once the student is out', () => {
  const c = classroom();
  c.requestPass(PEOPLE.ada, 'Period 1');
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');
  assert.equal(authorized.authorizedAction, 'RETURN');
});

test('an unknown action still fails closed', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'TELEPORT', key, 'n'),
    /Refresh this page/
  );
});

test('a wrong PIN is refused', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('authorizeStudentAction', '000000', 'AUTO_PASS', key, 'n'),
    /did not match an active student/
  );
});

test('one student cannot act under another student key', () => {
  const c = classroom();
  const alanKey = c.key(PEOPLE.alan, 'Period 1');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', alanKey, 'n'),
    /different student/
  );
});

test('an action proof is single use and cannot be replayed', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');
  c.harness.newRequest();
  c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken),
    /already used|expired/
  );
  assert.equal(c.passLog().length, 1, 'a replayed proof must not create a second pass');
});

test('a check-in proof cannot authorize a bathroom pass', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'n');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken),
    /different action/
  );
});

test('an action proof expires', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');
  c.harness.clock.advanceSeconds(200);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken),
    /expired|Enter your PIN/
  );
});

test('a forged proof is rejected', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('requestBathroomPass', 'eyJmYWtlIjoxfQ.bogus-signature', key, ''),
    /PIN/
  );
});

test('a signed-in Google identity alone cannot start a pass', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(() => c.harness.call('requestBathroomPass', '', key, ''), /PIN/);
  assert.equal(c.passLog().length, 0);
});

/* --------------------------------------------------- 4. daily check-in ------ */

section('Daily check-in and streaks');

test('a fresh PIN records exactly one check-in', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const rows = c.checkIns();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Student Email'], PEOPLE.ada.email);
  assert.equal(String(rows[0].Status), 'CHECKED_IN');
});

test('two independently authorized check-in submissions converge on one canonical event ID', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');

  c.harness.newRequest();
  const first = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'device-a');
  c.harness.newRequest();
  const second = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'device-b');

  c.harness.newRequest();
  c.harness.refuseLocks(1);
  const firstState = c.harness.call('submitDailyCheckIn', first.actionProof, key, first.pinToken);
  c.harness.newRequest();
  const secondState = c.harness.call('submitDailyCheckIn', second.actionProof, key, second.pinToken);
  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');

  const rows = c.checkIns().filter((row) => row['Student Email'] === PEOPLE.ada.email);
  assert.equal(rows.length, 1);
  assert.match(String(rows[0]['Check-in ID']), /^CI-20260910-/);
  assert.equal(firstState.actionOutcome.id, String(rows[0]['Check-in ID']));
  assert.equal(secondState.actionOutcome.id, String(rows[0]['Check-in ID']));
});


test('the teacher-configured on-time window changes when a check-in becomes late', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:40:00Z'),
    settings: { CHECKIN_WINDOW_MINUTES: 15 },
  });
  const result = c.checkIn(PEOPLE.ada, 'Period 1');
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'CHECKED_IN');
  assert.equal(Number(row.Point), 1);
  assert.equal(outcomeOf(result).kind, 'CHECKED_IN');
});

test('a student after the on-time window is recorded late instead of denied', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:40:00Z'),
    settings: { CHECKIN_WINDOW_MINUTES: 5 },
  });
  const result = c.checkIn(PEOPLE.ada, 'Period 1');
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_PENDING');
  assert.equal(Number(row.Point), 0);
  assert.equal(outcomeOf(result).kind, 'LATE_CHECK_IN_RECORDED');
  assert.equal(result.state.checkedIn, true);
  assert.equal(result.state.lateCheckIn, true);
});

test('student self-check-in closes when the selected class ends', () => {
  const c = classroom({ now: new Date('2026-09-10T13:00:00Z') });
  assert.throws(() => c.checkIn(PEOPLE.ada, 'Period 1'), /class has ended|not available right now/i);
  assert.equal(c.checkIns().length, 0);
});

test('a late self-check-in clears an earlier teacher absence while preserving both audit rows', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherMarkStudentAbsent', key, TEACHER_CONTRACT);
  c.checkIn(PEOPLE.ada, 'Period 1');
  const rows = c.checkIns();
  assert.equal(rows.length, 2);
  assert.equal(String(rows[0].Status), 'CLEARED');
  assert.match(String(rows[0].Note), /Cleared when late student check-in was recorded/);
  assert.equal(String(rows[1].Status), 'LATE_PENDING');
  const state = c.teacherState();
  assert.equal(state.absentToday.length, 0, 'a late-present student must not remain in the active absence list');
  assert.ok(state.pendingLateCheckIns.some((entry) => entry.checkInId === String(rows[1]['Check-in ID'])));
});

test('deduplicated recovery clears an old absence after the late Check-In row committed first', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherMarkStudentAbsent', key, TEACHER_CONTRACT);

  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'absence-recovery');
  c.harness.newRequest();
  c.harness.refuseLocks(1);
  c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);

  const pending = c.harness.call('readPendingCheckIns_')[0];
  assert.ok(pending, 'late arrival must remain in the durable inbox when the immediate flush is busy');
  c.harness.sheet('Daily Check-ins').appendRow(Array.from(c.harness.call('checkInEntryRow_', pending)));

  c.harness.newRequest();
  c.harness.call('flushPendingCheckInsLocked_');

  const rows = c.checkIns();
  assert.equal(rows.filter((row) => String(row.Status) === 'LATE_PENDING').length, 1);
  assert.equal(rows.filter((row) => String(row.Status) === 'CLEARED').length, 1);
  assert.equal(rows.filter((row) => String(row.Status) === 'ABSENT').length, 0);
  assert.equal(c.harness.properties.getProperty(pending.pendingPropertyKey), null,
    'recovery state clears only after absence and secondary-state repair complete');
});

test('the teacher can award the point for a late sign-in and it then counts for the streak', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const state = c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_APPROVED');
  assert.equal(Number(row.Point), 1);
  const teacherRow = state.lateCheckInsToday.find((entry) => entry.checkInId === id);
  assert.equal(teacherRow.status, 'LATE_APPROVED');
  assert.equal(teacherRow.streak.current, 1);
});


test('an unresolved late arrival remains in teacher review on the next school day', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.clock.advanceDays(1);
  const nextDay = c.teacherState();
  assert.ok(nextDay.pendingLateCheckIns.some((entry) => entry.checkInId === id),
    'yesterday\'s LATE_PENDING row must remain actionable');
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const reviewed = c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  assert.ok(!reviewed.pendingLateCheckIns.some((entry) => entry.checkInId === id),
    'the review index must clear only after a teacher decision');
  assert.equal(String(c.checkIns().find((row) => String(row['Check-in ID']) === id).Status), 'LATE_APPROVED');
});

test('the teacher can keep a late sign-in at zero without removing the arrival record', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const state = c.harness.call('teacherReviewLateCheckIn', id, 'KEEP_NO_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_NO_POINT');
  assert.equal(Number(row.Point), 0);
  const teacherRow = state.lateCheckInsToday.find((entry) => entry.checkInId === id);
  assert.equal(teacherRow.status, 'LATE_NO_POINT');
  assert.equal(teacherRow.streak.current, 0);
});

test('changing an awarded late point back to zero also removes that date from the compact streak index', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  let state = c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  assert.equal(state.lateCheckInsToday.find((entry) => entry.checkInId === id).streak.current, 1);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  state = c.harness.call('teacherReviewLateCheckIn', id, 'KEEP_NO_POINT', TEACHER_CONTRACT);
  assert.equal(state.lateCheckInsToday.find((entry) => entry.checkInId === id).streak.current, 0);
});

test('the teacher can change a reviewed late decision while the original sign-in time remains', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const first = c.checkIns()[0];
  const id = String(first['Check-in ID']);
  const originalTime = first['Check-in Time'].getTime();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'KEEP_NO_POINT', TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_APPROVED');
  assert.equal(Number(row.Point), 1);
  assert.equal(row['Check-in Time'].getTime(), originalTime);
});

test('checking in twice in one day does not add a second row or a second point', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.checkIn(PEOPLE.ada, 'Period 1');
  const rows = c.checkIns().filter((row) => row['Student Email'] === PEOPLE.ada.email);
  assert.equal(rows.length, 1, 'a repeated PIN must not create a duplicate check-in');
  assert.equal(Number(rows[0].Point), 1);
});

test('a busy workbook lock cannot block or lose a daily check-in', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'busy-checkin');
  c.harness.newRequest();
  c.harness.refuseLocks(1);
  const state = c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);

  assert.equal(state.checkedIn, true, 'the student must receive a recorded result immediately');
  assert.equal(outcomeOf({ state }).kind, 'CHECKED_IN');
  assert.equal(c.checkIns().length, 0, 'a busy workbook must be skipped, not waited on');
  assert.equal(c.harness.call('getPendingCheckInSummary_').pendingCount, 1, 'the durable inbox must retain the arrival');
  assert.equal(c.harness.call('getLockContentionSummary_').retrySignals, 0, 'check-in must not become a shared-lock retry signal');

  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');
  assert.equal(c.checkIns().length, 1, 'the next idle lock must batch the saved arrival into the workbook');
  assert.equal(c.harness.call('getPendingCheckInSummary_').pendingCount, 0);
});

test('an interrupted check-in response can safely replay the same consumed proof', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'timeout-replay');
  c.harness.newRequest();
  c.harness.refuseLocks(1);
  const first = c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);
  c.harness.newRequest();
  c.harness.refuseLocks(1);
  const replay = c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);
  assert.equal(first.actionOutcome.id, replay.actionOutcome.id);
  assert.equal(replay.checkedIn, true);
  assert.equal(c.harness.call('getPendingCheckInSummary_').pendingCount, 1);
  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');
  assert.equal(c.checkIns().length, 1);
});

test('a thirty-student burst remains visible to the teacher before the workbook catches up', () => {
  const students = Array.from({ length: 30 }, (_, index) => ({
    email: `burst.student.${String(index + 1).padStart(2, '0')}@students.mtmorrisschools.org`,
    name: `Student, Burst ${String(index + 1).padStart(2, '0')}`,
  }));
  const c = classroom({
    now: new Date('2026-09-10T11:30:00Z'),
    memberships: students.map((person) => [person, 'Period 1']),
  });
  students.forEach((person) => {
    const key = c.key(person, 'Period 1');
    c.harness.newRequest();
    c.harness.signInAs(person.email);
    const authorized = c.harness.call('authorizeStudentAction', c.pin(person), 'CHECKIN', key, `burst-${person.name}`);
    c.harness.newRequest();
    c.harness.refuseLocks(1);
    const state = c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);
    assert.equal(state.checkedIn, true);
  });

  assert.equal(c.checkIns().length, 0);
  assert.equal(c.harness.call('getPendingCheckInSummary_').pendingCount, 30);
  c.harness.refuseLocks(1);
  const teacher = c.teacherState();
  assert.equal(teacher.checkInsToday.length, 30, 'dashboard totals must merge the durable inbox');
  assert.equal(teacher.checkInSummary[0].checkedIn, 30);

  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');
  assert.equal(c.checkIns().length, 30);
  assert.equal(c.harness.call('getPendingCheckInSummary_').pendingCount, 0);
});

test('inbox flushing is idempotent even if an already-written event reappears', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'idempotent-checkin');
  c.harness.newRequest();
  c.harness.refuseLocks(1);
  c.harness.call('submitDailyCheckIn', authorized.actionProof, key, authorized.pinToken);
  const pending = Object.entries(c.harness.properties.getProperties())
    .find(([propertyKey]) => propertyKey.startsWith('pending-checkin:'));
  assert.ok(pending, 'the synthetic check-in must be staged');

  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');
  assert.equal(c.checkIns().length, 1);
  c.harness.properties.setProperty(pending[0], pending[1]);
  c.harness.newRequest();
  c.harness.call('tryFlushPendingCheckIns_');
  assert.equal(c.checkIns().length, 1, 'a replayed inbox event must not append a duplicate row');
  assert.equal(c.harness.call('getPendingCheckInSummary_').pendingCount, 0);
});

test('attendance is per class, so two classes each record their own check-in', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:30:00Z'),
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.ada, 'Period 3']],
  });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.harness.clock.set(new Date('2026-09-10T14:05:00Z'));
  c.checkIn(PEOPLE.ada, 'Period 3');
  const periods = c.checkIns().map((row) => String(row['Class / Period'])).sort();
  assert.deepEqual(periods, ['Period 1', 'Period 3']);
});

test('a check-in on the next school day extends the streak', () => {
  // Tue Sep 8 into Wed Sep 9. Both are school days on the seeded district calendar.
  const c = classroom({ now: new Date('2026-09-08T11:30:00Z') });
  const first = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(first.state.streak.current, 1);
  c.harness.clock.advanceDays(1);
  const second = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(second.state.streak.current, 2, 'consecutive school days must build the streak');
  assert.equal(second.state.streak.best, 2);
});

test('a weekend gap does not break the streak', () => {
  // Friday Sep 11 into Monday Sep 14.
  const c = classroom({ now: new Date('2026-09-11T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.harness.clock.set(new Date('2026-09-14T11:30:00Z'));
  const monday = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(monday.state.streak.current, 2, 'Saturday and Sunday are not required days');
});

test('an official no-school weekday does not break the streak', () => {
  // Thu Sep 10, then the district calendar is told Fri Sep 11 is closed,
  // so returning on Mon Sep 14 must still read as consecutive.
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  setNoSchoolDays(c.harness, ['2026-09-11']);
  c.harness.clock.set(new Date('2026-09-14T11:30:00Z'));
  const monday = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(monday.state.streak.current, 2, 'a calendar no-school day must not break a streak');
});

test('a streak is reported as protected, not at risk, on a no-school day', () => {
  const c = classroom({ now: new Date('2026-09-11T11:30:00Z') }); // Friday
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.harness.clock.set(new Date('2026-09-12T11:30:00Z')); // Saturday
  c.harness.newRequest();
  const state = c.harness.call('getCheckInState_', c.harness.call('getStudentByKey_', c.key(PEOPLE.ada, 'Period 1')), '', 'pin');
  assert.equal(state.streak.nonSchoolDayProtected, true, 'a closed day must read as protected');
  assert.equal(state.streak.atRiskToday, false, 'a closed day must never be at risk');
  assert.equal(state.streak.current, 1);
});

test('a streak is flagged at risk on a school day before the student checks in', () => {
  const c = classroom({ now: new Date('2026-09-08T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.harness.clock.set(new Date('2026-09-09T11:30:00Z'));
  c.harness.newRequest();
  const state = c.harness.call('identifyCheckInWithPin', c.pin(PEOPLE.ada), 'n');
  assert.equal(state.streak.atRiskToday, true, 'an open day with no check-in yet is at risk');
  assert.equal(state.streak.checkedInToday, false);
});

test('a missed school day does break the streak', () => {
  // Tue Sep 8, nothing on Wed Sep 9, back on Thu Sep 10. All three are school days.
  const c = classroom({ now: new Date('2026-09-08T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.harness.clock.set(new Date('2026-09-10T11:30:00Z'));
  const thursday = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(thursday.state.streak.current, 1, 'a skipped school day must reset the streak');
  assert.equal(thursday.state.streak.best, 1);
});

test('a reduced day still counts as a school day', () => {
  // Wed Sep 16 is marked "Reduced day" on the official calendar.
  const c = classroom({ now: new Date('2026-09-15T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.harness.clock.set(new Date('2026-09-16T11:30:00Z'));
  const reduced = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(reduced.state.streak.current, 2, 'a reduced day is still a required day');
});

test('the seeded calendar carries the official district dates', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const rows = c.calendar();
  const laborDay = rows.find((row) => String(row.Date) === '2026-09-07');
  assert.ok(laborDay, 'Labor Day must be present on the calendar');
  assert.equal(laborDay['School Day'], false);
});


/* ------------------------------------------- 5. passes, capacity, queue ----- */

section('Pass requests, room capacity and the waiting line');

test('a pass starts immediately when a slot is open', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  const result = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(result).kind, 'STARTED');
  const log = c.passLog();
  assert.equal(log.length, 1);
  assert.equal(String(log[0].Status), 'OUT');
  assert.equal(String(log[0]['Student Email']), PEOPLE.ada.email);
});

test('the room fills to the configured capacity', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  assert.equal(outcomeOf(c.requestPass(PEOPLE.alan, 'Period 1')).kind, 'STARTED');
  assert.equal(c.passLog().filter((row) => String(row.Status) === 'OUT').length, 2);
});


test('an unresolved earlier-period pass stays visible without blocking the current class', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:50:00Z'),
    settings: { MAX_ACTIVE_PASSES: 1 },
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.alan, 'Period 3']],
  });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  c.harness.clock.advanceSeconds(146 * 60); // 7:50 AM -> 10:16 AM local; Period 3 requests are open.
  c.harness.newRequest();
  const before = c.teacherState();
  assert.equal(before.active.length, 1, 'the forgotten pass must remain visible for follow-up');
  assert.equal(before.active[0].blocksCurrentCapacity, false, 'the earlier class must release current-room capacity');
  assert.equal(before.capacityUsed, 0);
  assert.equal(before.currentPeriod, 3);
  assert.equal(outcomeOf(c.requestPass(PEOPLE.alan, 'Period 3')).kind, 'STARTED');
  assert.equal(c.passLog().filter((row) => String(row.Status) === 'OUT').length, 2, 'audit state preserves both unresolved/current passes');
  const after = c.teacherState();
  assert.equal(after.capacityUsed, 1, 'only the current-period pass consumes the configured slot');
});

test('a request past capacity queues automatically instead of failing', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const queued = c.requestPass(PEOPLE.alan, 'Period 1');
  assert.equal(outcomeOf(queued).kind, 'QUEUED', 'a full room must queue the verified request');
  const line = c.queue().filter((row) => String(row.Status) === 'WAITING');
  assert.equal(line.length, 1);
  assert.equal(String(line[0]['Student Email']), PEOPLE.alan.email);
});

test('queueing consumes the same PIN, so no second PIN is demanded', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const queued = c.requestPass(PEOPLE.alan, 'Period 1');
  assert.equal(outcomeOf(queued).kind, 'QUEUED');
  // The queue row is the authorized request itself, carrying its authorization.
  const line = c.queue().find((row) => String(row['Student Email']) === PEOPLE.alan.email);
  assert.equal(String(line['Authorization Method']), 'PIN');
  assert.ok(String(line['Authorized At']), 'the queue entry must retain when the PIN was verified');
});

test('the queued student takes the slot when it opens, with no further PIN', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1, PASS_COOLDOWN_MINUTES: 0 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  c.requestPass(PEOPLE.alan, 'Period 1');
  c.harness.clock.advanceSeconds(60);
  c.returnPass(PEOPLE.ada, 'Period 1');

  const out = c.passLog().filter((row) => String(row.Status) === 'OUT');
  assert.equal(out.length, 1, 'the line must advance into the open slot');
  assert.equal(String(out[0]['Student Email']), PEOPLE.alan.email);
  const stillWaiting = c.queue().filter((row) => String(row.Status) === 'WAITING');
  assert.equal(stillWaiting.length, 0, 'the promoted entry must leave the line');
});

test('a student already out cannot open a second concurrent pass', () => {
  // AUTO_PASS would sensibly read the second tap as a return, so ask for a
  // pass request explicitly to prove the server refuses the double booking.
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 3 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const second = c.act(PEOPLE.ada, 'Period 1', 'PASS_REQUEST', 'requestBathroomPass');
  assert.notEqual(outcomeOf(second).kind, 'STARTED');
  assert.equal(c.passLog().filter((row) => String(row.Status) === 'OUT').length, 1);
});

test('each class membership has its own marking-period allowance', () => {
  const c = classroom({
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.ada, 'Period 3']],
    settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 },
  });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.harness.clock.set(new Date('2026-09-10T14:30:00Z'));
  const secondClass = c.requestPass(PEOPLE.ada, 'Period 3');
  assert.equal(outcomeOf(secondClass).kind, 'STARTED', 'each class has its own allowance');
});

/* ------------------------------------- 6. cooldown, limits, lockout ---------- */

section('Cooldown, configured limits and lockout evidence');

test('the five-minute cooldown blocks an immediate second trip', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 5 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const tooSoon = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.notEqual(outcomeOf(tooSoon).kind, 'STARTED', 'a return must start a cooldown');
});

test('the cooldown clears once it has elapsed', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 5 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.harness.clock.advanceMinutes(6);
  const later = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(later).kind, 'STARTED');
});

test('the configured marking-period limit is enforced and is not hardcoded', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 3 } });
  for (let i = 0; i < 3; i += 1) c.trip(PEOPLE.ada, 'Period 1', 60);
  const fourth = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.notEqual(outcomeOf(fourth).kind, 'STARTED', 'the fourth trip must be blocked at a limit of 3');
});

test('raising the limit reopens access with no code change', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 3 } });
  for (let i = 0; i < 3; i += 1) c.trip(PEOPLE.ada, 'Period 1', 60);
  assert.notEqual(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  c.settings({ STUDENT_PASS_LIMIT: 5 });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
});

test('a blocked student is shown the exact trips responsible', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 2 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const blocked = c.requestPass(PEOPLE.ada, 'Period 1');

  assert.equal(outcomeOf(blocked).kind, 'BLOCKED');
  assert.equal(outcomeOf(blocked).blockedReason, 'MARKING_PERIOD_LIMIT');

  const allowance = blocked.state.passAllowance;
  assert.equal(Number(allowance.used), 2);
  assert.equal(Number(allowance.remaining), 0);
  assert.equal(allowance.limitReached, true);

  // The evidence must be the same records the block was decided from.
  assert.equal(allowance.blockedEvidence.length, 2, 'both responsible trips must be shown');
  const loggedIds = c.passLog().map((row) => String(row['Pass ID'])).sort();
  const shownIds = allowance.blockedEvidence.map((entry) => String(entry.passId)).sort();
  assert.deepEqual(shownIds, loggedIds, 'the evidence must match the recorded passes exactly');
  allowance.blockedEvidence.forEach((entry) => {
    assert.ok(entry.schoolTime, 'each trip needs a school-timezone timestamp the student can read');
    assert.ok(Number(entry.durationSeconds) > 0);
  });
});

test('lockout evidence is stamped in school time, not UTC', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:50:00Z'), // 7:50 AM in Detroit
    settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 },
  });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const blocked = c.requestPass(PEOPLE.ada, 'Period 1');
  const first = blocked.state.passAllowance.blockedEvidence[0];
  assert.match(String(first.schoolTime), /7:50 AM/, 'a UTC clock would read 11:50 AM and confuse the student');
});

test('remaining never displays as a negative number', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 4 } });
  for (let i = 0; i < 4; i += 1) c.trip(PEOPLE.ada, 'Period 1', 60);
  c.settings({ STUDENT_PASS_LIMIT: 2 });
  const blocked = c.requestPass(PEOPLE.ada, 'Period 1');
  const allowance = blocked.state.passAllowance;
  assert.ok(Number(allowance.remaining) >= 0, `remaining went negative: ${allowance.remaining}`);
  assert.ok(Number(allowance.used) > Number(allowance.limit), 'used above the limit must be supported');
});

test('an unlimited student is exempt without advertising the exemption', () => {
  const c = classroom({
    memberships: [[PEOPLE.katherine, 'Period 1', { unlimited: true }]],
    settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 },
  });
  c.trip(PEOPLE.katherine, 'Period 1', 60);
  const second = c.requestPass(PEOPLE.katherine, 'Period 1');
  assert.equal(outcomeOf(second).kind, 'STARTED', 'an exempt student is not capped');
  const allowance = second.state.passAllowance || {};
  assert.equal(Object.hasOwn(allowance, 'unlimited'), false, 'the private exemption flag must not be exposed');
});

/* ------------------------------- 7. duration and the countability boundary --- */

section('Trip duration and the 3.0-second countability boundary');

test('a trip at or above three seconds counts', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  c.trip(PEOPLE.ada, 'Period 1', 3);
  const row = c.passLog()[0];
  assert.equal(String(row.Countability), 'COUNTABLE');
});

test('a trip below three seconds does not count but is still recorded', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  c.trip(PEOPLE.ada, 'Period 1', 2);
  const row = c.passLog()[0];
  assert.equal(String(row.Countability), 'NON_COUNTABLE');
  assert.equal(String(row.Status), 'RETURNED', 'the transaction stays on the record');
  assert.ok(String(row['Countability Reason']).length, 'the reason must be preserved');
});

test('a non-countable trip consumes no allowance', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 } });
  c.trip(PEOPLE.ada, 'Period 1', 2);
  const next = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(next).kind, 'STARTED', 'a sub-threshold trip must not use up the allowance');
});

test('a non-countable trip starts no cooldown', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 5 } });
  c.trip(PEOPLE.ada, 'Period 1', 1);
  const next = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(next).kind, 'STARTED', 'a trip that did not count must not trigger cooldown');
});

test('the student is told plainly that the trip did not count', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  const { back } = c.trip(PEOPLE.ada, 'Period 1', 1);
  assert.equal(outcomeOf(back).kind, 'RETURNED_NON_COUNTABLE');
});

test('duration comes from the timestamps, not from rounded minutes', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  c.trip(PEOPLE.ada, 'Period 1', 2);
  const row = c.passLog()[0];
  assert.equal(Number(row['Minutes Out']), 0, 'two seconds rounds to zero minutes');
  assert.equal(String(row.Countability), 'NON_COUNTABLE', 'yet the second-level truth decides countability');
});



/* ------------------------------------ 8. teacher corrections and voiding ---- */

section('Teacher corrections, voiding and permanent audit');

test('voiding preserves the original transaction rather than deleting it', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 2 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const original = c.passLog()[0];
  const passId = String(original['Pass ID']);

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherVoidPass', passId, 'Nurse visit, not a bathroom trip', TEACHER_CONTRACT);

  const after = c.passLog();
  assert.equal(after.length, 1, 'Delete Pass must never destroy the row');
  assert.equal(String(after[0]['Pass ID']), passId);
  assert.ok(after[0]['Out Time'], 'the original sign-out survives');
  assert.ok(after[0]['Return Time'], 'the original return survives');
});

test('a void records who corrected it, when and why', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 2 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherVoidPass', String(c.passLog()[0]['Pass ID']), 'Nurse visit', TEACHER_CONTRACT);

  const row = c.passLog()[0];
  assert.equal(String(row['Voided By']), TEACHER);
  assert.equal(String(row['Void Reason']), 'Nurse visit');
  assert.ok(String(row['Voided At']), 'the correction needs its own timestamp');
});

test('a void immediately returns the allowance to the student', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  assert.notEqual(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED', 'the limit should bite first');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherVoidPass', String(c.passLog()[0]['Pass ID']), 'Correcting a mistake', TEACHER_CONTRACT);

  const afterVoid = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(afterVoid).kind, 'STARTED', 'voiding must unlock the student at once');
});

test('a voided trip stops counting toward the marking period', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 5 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.trip(PEOPLE.ada, 'Period 1', 60);

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const before = c.harness.call('teacherGetMembershipPasses', c.key(PEOPLE.ada, 'Period 1'), TEACHER_CONTRACT);
  assert.equal(before.used, 2);

  c.harness.newRequest();
  c.harness.call('teacherVoidPass', String(before.passes[0].passId), 'Correction', TEACHER_CONTRACT);
  c.harness.newRequest();
  const after = c.harness.call('teacherGetMembershipPasses', c.key(PEOPLE.ada, 'Period 1'), TEACHER_CONTRACT);
  assert.equal(after.used, 1, 'the voided trip must drop out of the count');
});

test('a void clears the cooldown it had created', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 30 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  assert.notEqual(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherVoidPass', String(c.passLog()[0]['Pass ID']), 'Correction', TEACHER_CONTRACT);

  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED', 'a voided return must not hold a cooldown');
});

test('teacher history is available on demand and matches the log', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 5 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const history = c.harness.call('teacherGetMembershipPasses', c.key(PEOPLE.ada, 'Period 1'), TEACHER_CONTRACT);
  assert.equal(history.passes.length, 2);
  history.passes.forEach((entry) => {
    assert.equal(entry.countability, 'COUNTABLE');
    assert.ok(entry.schoolTime);
  });
});

test('a teacher override starts a pass past the limit', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  assert.notEqual(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherStartPass', c.key(PEOPLE.ada, 'Period 1'), 'Synthetic teacher backup', TEACHER_CONTRACT);
  const out = c.passLog().filter((row) => String(row.Status) === 'OUT');
  assert.equal(out.length, 1, 'the teacher can always let a student leave');
});

test('an overridden trip still obeys the countability rules', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0 } });
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherStartPass', c.key(PEOPLE.ada, 'Period 1'), 'Synthetic teacher backup', TEACHER_CONTRACT);
  const started = c.passLog().find((row) => String(row.Status) === 'OUT');

  c.harness.clock.advanceSeconds(1);
  c.harness.newRequest();
  c.harness.call('teacherEndPass', String(started['Pass ID']), 'ended by teacher', TEACHER_CONTRACT);

  const row = c.passLog().find((entry) => String(entry['Pass ID']) === String(started['Pass ID']));
  assert.equal(String(row.Countability), 'NON_COUNTABLE', 'a one-second override trip is still under the minimum');
});

test('completed passes move into permanent audit rather than vanishing', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, RETENTION_DAYS: 1 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const passId = String(c.passLog()[0]['Pass ID']);

  c.harness.clock.advanceDays(3);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('dailyCleanup');

  const audit = c.passAudit();
  assert.ok(
    audit.some((row) => String(row['Pass ID']) === passId),
    'an aged-out pass must be preserved in Pass Audit'
  );
});

/* ------------------------------------------------- 9. overnight rollover ---- */

section('Overnight rollover');

test('a pass left open overnight cannot hold the next day’s slot', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1, PASS_COOLDOWN_MINUTES: 0 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(c.passLog().filter((row) => String(row.Status) === 'OUT').length, 1);

  c.harness.clock.advanceDays(1);
  const nextDay = c.requestPass(PEOPLE.alan, 'Period 1');
  assert.equal(outcomeOf(nextDay).kind, 'STARTED', 'yesterday’s forgotten pass must not block the room');
});

test('the forgotten pass is classified as rolled over, not silently closed', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1, PASS_COOLDOWN_MINUTES: 0 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const passId = String(c.passLog()[0]['Pass ID']);
  c.harness.clock.advanceDays(1);
  c.requestPass(PEOPLE.alan, 'Period 1');

  const original = c.passLog().find((row) => String(row['Pass ID']) === passId);
  assert.equal(String(original.Status), 'ROLLED_OVER');
});

test('returning today closes today’s pass, never yesterday’s', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const staleId = String(c.passLog()[0]['Pass ID']);

  c.harness.clock.advanceDays(1);
  c.requestPass(PEOPLE.ada, 'Period 1');
  c.harness.clock.advanceSeconds(60);
  c.returnPass(PEOPLE.ada, 'Period 1');

  const stale = c.passLog().find((row) => String(row['Pass ID']) === staleId);
  assert.equal(String(stale.Status), 'ROLLED_OVER', 'the prior-day record must not be the one that closes');
  const todays = c.passLog().filter((row) => String(row['Pass ID']) !== staleId);
  assert.equal(todays.length, 1);
  assert.equal(String(todays[0].Status), 'RETURNED');
});

test('the prior-day scan runs once a day, not once per request', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 3, PASS_COOLDOWN_MINUTES: 0 } });
  c.harness.newRequest();
  const marker = () => c.harness.properties.getProperty('LAST_ROLLOVER');
  c.requestPass(PEOPLE.ada, 'Period 1');
  const first = marker();
  assert.ok(first, 'the first student action of the day records the rollover marker');
  c.requestPass(PEOPLE.alan, 'Period 1');
  assert.equal(marker(), first, 'later requests on the same day must reuse the marker');
});



/* ------------------------------------------- 10. teacher dashboard bounds --- */

section('Teacher dashboard payload and bounds');

test('the dashboard reports the room, the line and today at a glance', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1, PASS_COOLDOWN_MINUTES: 0 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  c.requestPass(PEOPLE.alan, 'Period 1');
  const state = c.teacherState();
  assert.equal(state.active.length, 1);
  assert.equal(state.queue.length, 1);
  assert.equal(Number(state.maxActivePasses), 1);
  assert.ok(Array.isArray(state.today));
});

test('a routine teacher poll does not ship the permanent lifetime audit', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, RETENTION_DAYS: 1 } });
  for (let day = 0; day < 4; day += 1) {
    c.harness.clock.set(new Date(['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'][day] + 'T11:50:00Z'));
    c.trip(PEOPLE.ada, 'Period 1', 60);
    c.harness.clock.advanceDays(1);
  }
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('dailyCleanup');

  const archived = c.passAudit();
  assert.ok(archived.length > 0, 'the fixture needs archived history to be meaningful');

  const state = c.teacherState();
  const payload = JSON.stringify(state);
  const archivedOnly = archived
    .map((row) => String(row['Pass ID']))
    .filter((id) => !c.passLog().some((row) => String(row['Pass ID']) === id));
  assert.ok(archivedOnly.length > 0, 'the fixture needs passes that live only in the audit');
  archivedOnly.forEach((id) => {
    assert.ok(!payload.includes(id), 'archived history must stay out of the routine poll');
  });
});

test('the dashboard surfaces lock contention without identifying anyone', () => {
  const c = classroom();
  const state = c.teacherState();
  assert.ok(state.lockContention, 'the retry signal card must be present');
  const contention = JSON.stringify(state.lockContention);
  assert.ok(!contention.includes(PEOPLE.ada.email), 'the traffic card must never carry a student identity');
  assert.ok(!/\d{6}/.test(contention), 'the traffic card must never carry anything PIN-shaped');
});

test('per-class check-in summaries are reported for each period', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:30:00Z'),
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.alan, 'Period 1'], [PEOPLE.grace, 'Period 3']],
  });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const state = c.teacherState();
  assert.ok(Array.isArray(state.checkInSummary));
  // The payload is built inside the sandbox realm, so copy it into this one
  // before a strict deep comparison, which also checks prototypes.
  const periods = Array.from(state.checkInSummary, (entry) => String(entry.classPeriod)).sort();
  assert.deepEqual(periods, ['Period 1', 'Period 3']);
});

/* -------------------------------------- 11. roster changes and identity ----- */

section('Roster changes and identity continuity');

test('removing a class membership never destroys pass history', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const before = c.passLog().length;

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', c.key(PEOPLE.ada, 'Period 1'), TEACHER_CONTRACT);

  assert.equal(c.passLog().length, before, 'history must survive a roster removal');
  assert.ok(c.passLog()[0]['Out Time'], 'the original trip is intact');
});

test('a removed membership is deactivated, not deleted', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', c.key(PEOPLE.ada, 'Period 1'), TEACHER_CONTRACT);
  const row = c.rosterRows().find((entry) => String(entry['Student Email']) === PEOPLE.ada.email);
  assert.ok(row, 'the roster row must remain for continuity');
  assert.equal(row.Active === false || String(row.Active).toUpperCase() === 'FALSE', true);
});

test('re-adding a student keeps the PIN they already have', () => {
  const c = classroom();
  const originalPin = c.pin(PEOPLE.ada);
  const originalHash = c.rosterRows().find((r) => String(r['Student Email']) === PEOPLE.ada.email)['PIN Hash'];

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', c.key(PEOPLE.ada, 'Period 1'), TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 1', TEACHER_CONTRACT);

  const row = c.rosterRows().find((r) => String(r['Student Email']) === PEOPLE.ada.email);
  assert.equal(String(row['PIN Hash']), String(originalHash), 'a returning student keeps their credential');

  // And it still works.
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', originalPin, 'AUTO_PASS', c.key(PEOPLE.ada, 'Period 1'), 'n');
  assert.equal(authorized.authorizedAction, 'PASS_REQUEST');
});

test('adding a student to a second class does not create a second identity', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 3', TEACHER_CONTRACT);
  const rows = c.rosterRows().filter((r) => String(r['Student Email']) === PEOPLE.ada.email);
  assert.equal(rows.length, 2, 'two memberships');
  const hashes = new Set(rows.map((r) => String(r['PIN Hash'])));
  assert.equal(hashes.size, 1, 'one credential across both');
});

test('adding a class gives that membership its own marking-period allowance', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 1 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 3', TEACHER_CONTRACT);
  c.harness.clock.set(new Date('2026-09-10T14:30:00Z'));
  const inOtherClass = c.requestPass(PEOPLE.ada, 'Period 3');
  assert.equal(outcomeOf(inOtherClass).kind, 'STARTED', 'the new membership has its own allowance');
});

/* ---------------------------------------------------------- 12. privacy ----- */

section('Student privacy boundaries');

test('a student payload never carries a PIN or a hash', () => {
  const c = classroom();
  const result = c.requestPass(PEOPLE.ada, 'Period 1');
  const payload = JSON.stringify(result.state);
  assert.ok(!payload.includes(c.pin(PEOPLE.ada)), 'the plaintext PIN must never be echoed');
  const hash = String(c.rosterRows().find((r) => String(r['Student Email']) === PEOPLE.ada.email)['PIN Hash']);
  assert.ok(hash.length > 0);
  assert.ok(!payload.includes(hash), 'the credential hash must never be echoed');
});

test('a student payload never carries another student', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const queued = c.requestPass(PEOPLE.alan, 'Period 1');
  const payload = JSON.stringify(queued.state);
  assert.ok(!payload.includes(PEOPLE.ada.email), 'the waiting student must not learn who is out');
  assert.ok(!payload.includes(PEOPLE.ada.name), 'not by name either');
});

test('a queued student sees only their own position', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 1 } });
  c.requestPass(PEOPLE.ada, 'Period 1');
  const queued = c.requestPass(PEOPLE.alan, 'Period 1');
  assert.equal(Number(queued.state.queuePosition), 1);
  assert.ok(!Array.isArray(queued.state.queue), 'the student view must not receive the roster of the line');
});

test('the pre-PIN bootstrap exposes no pass history', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0 } });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  const boot = c.harness.call('getBootstrap', 'student');
  const payload = JSON.stringify(boot);
  assert.ok(!/periodEvidence|blockedEvidence|passId/i.test(payload), 'history must wait for a fresh PIN');
});

test('a student cannot read the teacher dashboard', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(() => c.harness.call('refreshTeacherState'), /.+/, 'teacher mode must be staff only');
});

/* ------------------------------------- 13. shared lock and contention ------- */

section('Shared lock contention and recovery');

test('a refused lock produces the traffic message, not a credential error', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');

  c.harness.refuseLocks(1);
  c.harness.newRequest();
  let message = '';
  try {
    c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken);
  } catch (error) {
    message = String(error.message);
  }
  assert.match(message, /handling other students right now/, 'contention must read as traffic, not a bad PIN');
});

test('a refused lock writes nothing at all', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');
  c.harness.refuseLocks(1);
  c.harness.newRequest();
  try { c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken); } catch (error) { /* expected */ }
  assert.equal(c.passLog().length, 0, 'the protected section must never have begun');
});

test('a refused lock leaves the one-use proof still valid, so the retry works', () => {
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'n');

  c.harness.refuseLocks(1);
  c.harness.newRequest();
  try { c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken); } catch (error) { /* expected */ }

  c.harness.newRequest();
  const retried = c.harness.call('requestBathroomPass', authorized.actionProof, key, authorized.pinToken);
  assert.equal((retried.actionOutcome || {}).kind, 'STARTED', 'the student must not be asked for the PIN again');
  assert.equal(c.passLog().length, 1, 'and the retry must create exactly one pass');
});

test('student writes take a short lock wait so a class at the bell recovers', () => {
  const c = classroom();
  c.harness.state.lock.waits.length = 0;
  c.requestPass(PEOPLE.ada, 'Period 1');
  const studentWaits = c.harness.state.lock.waits.map((entry) => entry.timeoutMs);
  assert.ok(studentWaits.includes(5000), `expected a 5000ms student wait, saw ${studentWaits.join(',')}`);
});

/* -------------------------------------- 14. client and server contract ------ */

section('Client and server contract');

const clientHtml = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'hall-pass', 'Index.html'),
  'utf8'
);

test('every server function the client calls actually exists', () => {
  const c = classroom();
  const called = [...clientHtml.matchAll(/call(?:WithBusyRetry)?\(\s*'([A-Za-z_][A-Za-z0-9_]*)'/g)]
    .map((match) => match[1]);
  const unique = [...new Set(called)];
  assert.ok(unique.length >= 20, `expected the client to call many endpoints, found ${unique.length}`);
  const missing = unique.filter((name) => typeof c.harness.sandbox[name] !== 'function');
  assert.deepEqual(missing, [], `the client calls server functions that do not exist: ${missing.join(', ')}`);
});

test('every action literal the client can send is accepted by the server', () => {
  // This is the general form of the Version 16 fault. AUTO_PASS was a literal
  // the client sent and the server rejected, and nothing checked the pairing.
  const c = classroom();
  const key = c.key(PEOPLE.ada, 'Period 1');
  const literals = [...clientHtml.matchAll(/renderActionPin\(\s*'([A-Z_]+)'/g)].map((m) => m[1]);
  const ternaries = [...clientHtml.matchAll(/renderActionPin\([^)]*\?\s*'([A-Z_]+)'\s*:\s*'([A-Z_]+)'/g)]
    .flatMap((m) => [m[1], m[2]]);
  const actions = [...new Set([...literals, ...ternaries])];

  assert.ok(actions.includes('AUTO_PASS'), 'the client still sends the AUTO_PASS sentinel');
  assert.ok(actions.length >= 4, `expected the client's four action literals, found ${actions.join(',')}`);

  actions.forEach((action) => {
    c.harness.clock.set(new Date(action === 'CHECKIN' ? '2026-09-10T11:30:00Z' : '2026-09-10T11:50:00Z'));
    c.harness.newRequest();
    const authorized = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), action, key, `n-${action}`);
    assert.ok(
      ['CHECKIN', 'PASS_REQUEST', 'RETURN'].includes(authorized.authorizedAction),
      `${action} resolved to ${authorized.authorizedAction}, which the client cannot complete`
    );
  });
});

test('every action the server can authorize, the client can complete', () => {
  const completed = [...clientHtml.matchAll(/action === '([A-Z_]+)'/g)].map((m) => m[1]);
  ['CHECKIN', 'PASS_REQUEST', 'RETURN'].forEach((action) => {
    assert.ok(completed.includes(action), `the client has no branch for the authorized action ${action}`);
  });
});



/* ------------------------------------------- 15. shipped policy defaults ---- */

section('Shipped policy defaults');

// Mutation testing found this gap: every policy test above sets the setting it
// exercises, so all of them still passed when a shipped default was changed.
// These read the defaults a fresh workbook is actually built with.

test('a fresh workbook ships the approved five-minute cooldown', () => {
  const c = classroom({ settings: {} });
  const row = c.harness.sheet('Settings').records()
    .find((entry) => String(entry.Key) === 'PASS_COOLDOWN_MINUTES');
  assert.equal(String(row.Value), '5', 'the five-minute cooldown is approved policy');
});

test('a fresh workbook ships the official school-year calendar bounds', () => {
  const c = classroom({ settings: {} });
  const rows = c.harness.sheet('Settings').records();
  const value = (key) => String((rows.find((entry) => String(entry.Key) === key) || {}).Value || '');
  assert.equal(value('SCHOOL_YEAR_START'), '2026-08-25');
  assert.equal(value('SCHOOL_YEAR_END'), '2027-06-08');
});

test('capacity, limits and cooldown all read from Settings rather than the source', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 3, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 0 } });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  assert.equal(outcomeOf(c.requestPass(PEOPLE.alan, 'Period 1')).kind, 'STARTED');
  assert.equal(outcomeOf(c.requestPass(PEOPLE.grace, 'Period 1')).kind, 'STARTED');
  assert.equal(Number(c.teacherState().maxActivePasses), 3, 'the dashboard must reflect the configured capacity');
});

test('a daily limit is enforced independently of the marking-period limit', () => {
  const c = classroom({
    settings: { MAX_ACTIVE_PASSES: 2, PASS_COOLDOWN_MINUTES: 0, STUDENT_PASS_LIMIT: 0, DAILY_PASS_LIMIT: 1 },
  });
  c.trip(PEOPLE.ada, 'Period 1', 60);
  const second = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.notEqual(outcomeOf(second).kind, 'STARTED', 'the daily cap must bite on its own');

  c.harness.clock.advanceDays(1);
  const tomorrow = c.requestPass(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(tomorrow).kind, 'STARTED', 'and it must reset with the school day');
});


section('Issue 73 duplicate-action guard');

test('a duplicate generic PIN submit cannot turn a just-started pass into a return', () => {
  const c = classroom();
  const nonce = 'same-device-issue-73';
  c.harness.newRequest();
  const first = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), nonce);
  const key = first.student.key;
  assert.equal(first.authorizedAction, 'PASS_REQUEST');
  c.harness.newRequest();
  const started = c.harness.call('requestBathroomPass', first.actionProof, key, first.pinToken);
  assert.equal((started.actionOutcome || {}).kind, 'STARTED');
  c.harness.newRequest();
  const duplicate = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), nonce);
  assert.equal(duplicate.authorizedAction, 'PASS_REQUEST');
  c.harness.newRequest();
  const replayedIntent = c.harness.call('requestBathroomPass', duplicate.actionProof, key, duplicate.pinToken);
  assert.equal((replayedIntent.actionOutcome || {}).kind, 'ALREADY_ACTIVE');
  const rows = c.passLog();
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0].Status), 'OUT');
});

test('an explicit return still works immediately while generic intent is stabilized', () => {
  const c = classroom();
  const nonce = 'same-device-explicit-return';
  c.harness.newRequest();
  const first = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), nonce);
  const key = first.student.key;
  c.harness.newRequest();
  c.harness.call('requestBathroomPass', first.actionProof, key, first.pinToken);
  c.harness.newRequest();
  const returning = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'RETURN', key, nonce);
  assert.equal(returning.authorizedAction, 'RETURN');
  c.harness.newRequest();
  c.harness.call('returnPass', returning.actionProof, key, returning.pinToken);
  assert.equal(String(c.passLog()[0].Status), 'RETURNED');
});

test('replaying the same late-attendance decision is idempotent', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_APPROVED');
  assert.equal((String(row.Note).match(/Late check-in point awarded by/g) || []).length, 1);
});



section('Configured session messaging');

test('pass-window denial text reflects configured first/last protection values', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:31:00Z'),
    settings: { PASS_PROTECT_FIRST_MINUTES: 5, PASS_PROTECT_LAST_MINUTES: 7 },
  });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'AUTO_PASS', key, 'custom-window'),
    /configured pass window.*5 minutes after class starts.*7 minutes before class ends/i
  );
});

section('Operational index lifecycle');

test('removing a class membership prunes its live Check-In summary but preserves unresolved late review', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.checkIn(PEOPLE.ada, 'Period 1');

  const lateId = String(c.checkIns()[0]['Check-in ID']);
  const summaryKey = c.harness.call('checkInSummaryPropertyKey_', key);
  assert.ok(c.harness.properties.getProperty(summaryKey), 'active membership should have a live summary');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const state = c.harness.call('teacherRemoveStudentClass', key, TEACHER_CONTRACT);

  assert.equal(c.harness.properties.getProperty(summaryKey), null, 'inactive membership should release its live summary property');
  assert.ok(state.pendingLateCheckIns.some((entry) => entry.checkInId === lateId),
    'unresolved late evidence must survive membership removal');
});

test('a calendar amendment invalidates and rebuilds cached streak summaries', () => {
  const c = classroom({ now: new Date('2026-09-09T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.checkIn(PEOPLE.ada, 'Period 1');

  c.harness.clock.advanceDays(1);
  c.checkIn(PEOPLE.ada, 'Period 1');

  const summaryKey = c.harness.call('checkInSummaryPropertyKey_', key);
  let summary = JSON.parse(c.harness.properties.getProperty(summaryKey));
  assert.equal(summary.current, 2, 'the two recorded school days initially form a two-day streak');
  const beforeVersion = c.harness.properties.getProperty('CHECKIN_INDEX_SCHEMA');

  setNoSchoolDays(c.harness, ['2026-09-10']);
  c.harness.newRequest();
  c.harness.call('readCheckInSummaryMap_');

  const afterVersion = c.harness.properties.getProperty('CHECKIN_INDEX_SCHEMA');
  summary = JSON.parse(c.harness.properties.getProperty(summaryKey));
  assert.notEqual(afterVersion, beforeVersion, 'calendar changes must invalidate the compact index fingerprint');
  assert.equal(summary.current, 1, 'a date later declared no-school must be removed from the streak count');
  assert.equal(summary.lastCountedDate, '2026-09-09');
});

test('rebuilding the operational index ignores historical inactive memberships and reactivation restores history', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.checkIn(PEOPLE.ada, 'Period 1');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', key, TEACHER_CONTRACT);

  const summaryKey = c.harness.call('checkInSummaryPropertyKey_', key);
  c.harness.properties.deleteProperty('CHECKIN_INDEX_SCHEMA');
  c.harness.newRequest();
  c.harness.call('rebuildCheckInOperationalIndex_');
  assert.equal(c.harness.properties.getProperty(summaryKey), null,
    'historical inactive memberships must not be recreated in the live summary index');

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 1', TEACHER_CONTRACT);
  const restored = JSON.parse(c.harness.properties.getProperty(summaryKey));
  assert.equal(restored.current, 1, 'reactivation should rebuild the student summary from authoritative attendance history');
  assert.equal(restored.lastCountedDate, '2026-09-10');
});

section('GoClassroom roster bridge');

test('authorized teacher can read only active roster identity fields through the bridge', () => {
  const c = classroom({
    memberships: [
      [PEOPLE.ada, 'Period 1'],
      [PEOPLE.alan, 'Period 1', { active: false }],
      [PEOPLE.grace, 'Period 3'],
    ],
  });
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const beforeRoster = JSON.stringify(c.rosterRows());
  const beforePins = JSON.stringify(c.pinCards());
  const beforeCheckIns = JSON.stringify(c.checkIns());
  const beforePasses = JSON.stringify(c.passLog());
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.bridgeContract, '2026-09-22-roster-sync-v1');
  assert.equal(snapshot.writeContract, '2026-09-22-roster-write-v1');
  assert.match(snapshot.revision, /^[A-Za-z0-9_-]{20,80}$/);
  c.harness.newRequest();
  const repeated = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  assert.equal(repeated.revision, snapshot.revision, 'unchanged active roster must have a stable sync revision');
  assert.deepEqual(snapshot.roster.map((row) => row.studentEmail).sort(), [PEOPLE.ada.email, PEOPLE.grace.email].sort());
  snapshot.roster.forEach((row) => {
    assert.deepEqual(Object.keys(row).sort(), ['active', 'classPeriod', 'studentEmail', 'studentName'].sort());
    assert.equal(row.active, true);
  });
  assert.equal(JSON.stringify(c.rosterRows()), beforeRoster, 'bridge read must not change roster rows');
  assert.equal(JSON.stringify(c.pinCards()), beforePins, 'bridge read must not change PIN records');
  assert.equal(JSON.stringify(c.checkIns()), beforeCheckIns, 'bridge read must not change Check-In history');
  assert.equal(JSON.stringify(c.passLog()), beforePasses, 'bridge read must not change pass history');
});

test('roster bridge rejects students and stale GoClassroom contracts', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(
    () => c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1'),
    /limited to the teacher/i
  );
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  assert.throws(
    () => c.harness.call('getRosterSyncSnapshot', 'old-roster-contract'),
    /Update GoClassroom/i
  );
});

test('approved roster sync adds a membership, corrects a name, creates a PIN, audits the work, and replays safely', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-safe-apply-001',
    baseRevision: snapshot.revision,
    add: [{
      studentEmail: 'new.student@students.mtmorrisschools.org',
      studentName: 'Student, New',
      classPeriod: 'Period 3',
    }],
    updateName: [{
      studentEmail: PEOPLE.ada.email,
      studentName: 'Byron, Ada Updated',
      beforeName: PEOPLE.ada.name,
      classPeriod: 'Period 1',
    }],
  };

  const beforeRosterCount = c.rosterRows().length;
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(result.requestId, request.requestId);
  assert.equal(result.counts.added, 1);
  assert.equal(result.counts.reactivated, 0);
  assert.ok(result.counts.nameRowsUpdated >= 1);
  assert.equal(result.counts.requestedNameUpdates, 1);
  assert.equal(result.counts.createdPins, 1);
  assert.match(result.revision, /^[A-Za-z0-9_-]{20,80}$/);
  assert.notEqual(result.revision, snapshot.revision);

  const roster = c.rosterRows();
  assert.equal(roster.length, beforeRosterCount + 1);
  assert.ok(roster.some((row) => String(row['Student Email']) === 'new.student@students.mtmorrisschools.org' &&
    String(row['Class / Period']) === 'Period 3' && String(row.Active).toLowerCase() !== 'false'));
  assert.ok(roster.filter((row) => String(row['Student Email']) === PEOPLE.ada.email)
    .every((row) => String(row['Student Name']) === 'Byron, Ada Updated'));

  const newCards = c.pinCards().filter((row) => String(row['Student Email']) === 'new.student@students.mtmorrisschools.org');
  assert.equal(newCards.length, 1);
  assert.match(String(newCards[0].PIN), /^\d{6}$/);
  assert.notEqual(String(newCards[0]['Email Status'] || '').toUpperCase(), 'SENT',
    'roster sync may create a credential but must never email it automatically');

  const actions = c.harness.sheet('Teacher Actions').records();
  assert.ok(actions.some((row) => String(row.Action) === 'GOCLASSROOM_ROSTER_MEMBERSHIP_ADDED' &&
    String(row['Reference ID']) === request.requestId));
  assert.ok(actions.some((row) => String(row.Action) === 'GOCLASSROOM_ROSTER_NAME_UPDATED' &&
    String(row['Reference ID']) === request.requestId));

  c.harness.newRequest();
  const replay = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.deepEqual(replay, result, 'a retry after an uncertain browser response must return the stored result');
  assert.equal(c.rosterRows().length, beforeRosterCount + 1, 'replay must not add the membership twice');
});

test('roster sync resumes safely after a failure that occurs after roster rows were already changed', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-partial-recovery-001',
    baseRevision: snapshot.revision,
    add: [{
      studentEmail: 'resume.student@students.mtmorrisschools.org',
      studentName: 'Student, Resume',
      classPeriod: 'Period 3',
    }],
    updateName: [{
      studentEmail: PEOPLE.ada.email,
      studentName: 'Byron, Ada Resume',
      beforeName: PEOPLE.ada.name,
      classPeriod: 'Period 1',
    }],
  };

  const originalPinRepair = c.harness.sandbox.ensureOnePinPerStudent_;
  let injected = true;
  c.harness.sandbox.ensureOnePinPerStudent_ = function(options) {
    if (injected) {
      injected = false;
      throw new Error('synthetic interruption after roster mutations');
    }
    return originalPinRepair(options);
  };

  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /synthetic interruption/
  );
  assert.ok(c.rosterRows().some((row) =>
    String(row['Student Email']) === 'resume.student@students.mtmorrisschools.org' &&
    String(row['Class / Period']) === 'Period 3'
  ), 'the injected failure should occur after the new membership exists');
  assert.equal(
    String(c.rosterRows().find((row) =>
      String(row['Student Email']) === PEOPLE.ada.email &&
      String(row['Class / Period']) === 'Period 1'
    )['Student Name']),
    'Byron, Ada Resume',
    'the injected failure should occur after the approved name correction'
  );

  const requestKey = c.harness.call('rosterSyncRequestKey_', request.requestId);
  const pending = JSON.parse(c.harness.properties.getProperty(requestKey));
  assert.equal(pending.status, 'PENDING', 'the server must retain resumable evidence before mutating the roster');

  c.harness.sandbox.ensureOnePinPerStudent_ = originalPinRepair;
  c.harness.newRequest();
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(result.counts.added, 1);
  assert.equal(result.counts.requestedNameUpdates, 1);
  assert.equal(c.rosterRows().filter((row) =>
    String(row['Student Email']) === 'resume.student@students.mtmorrisschools.org' &&
    String(row['Class / Period']) === 'Period 3'
  ).length, 1, 'resuming must not duplicate a membership that was already written');

  const finalRecord = JSON.parse(c.harness.properties.getProperty(requestKey));
  assert.equal(finalRecord.status, 'DONE');
  const actions = c.harness.sheet('Teacher Actions').records().filter((row) => String(row['Reference ID']) === request.requestId);
  assert.equal(actions.filter((row) => String(row.Action) === 'GOCLASSROOM_ROSTER_MEMBERSHIP_ADDED').length, 1);
  assert.equal(actions.filter((row) => String(row.Action) === 'GOCLASSROOM_ROSTER_NAME_UPDATED').length, 1);
});

test('roster sync recovers a PIN-card append failure before reporting the batch complete', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const target = {
    email: 'pin.retry@students.mtmorrisschools.org',
    name: 'Student, PIN Retry',
    period: 'Period 3',
  };
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-pin-card-recovery-001',
    baseRevision: snapshot.revision,
    add: [{ studentEmail: target.email, studentName: target.name, classPeriod: target.period }],
    updateName: [],
  };

  const pinSheet = c.harness.sheet('PIN Cards');
  const originalAppendRow = pinSheet.appendRow.bind(pinSheet);
  let injected = true;
  pinSheet.appendRow = function appendRowWithOneFailure(values) {
    if (injected && String(values && values[0] || '') === target.email) {
      injected = false;
      throw new Error('synthetic PIN-card append failure');
    }
    return originalAppendRow(values);
  };

  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /synthetic PIN-card append failure/
  );
  const afterFailure = c.rosterRows().find((row) =>
    String(row['Student Email']) === target.email && String(row['Class / Period']) === target.period
  );
  assert.ok(afterFailure, 'the injected failure must occur after the membership row is written');
  assert.ok(String(afterFailure['PIN Hash'] || ''), 'the first attempt must leave the exact orphaned-hash state from the audit');
  assert.equal(c.pinCards().filter((row) => String(row['Student Email']) === target.email).length, 0,
    'the first attempt must have no usable PIN card');
  const requestKey = c.harness.call('rosterSyncRequestKey_', request.requestId);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'PENDING',
    'credential provisioning failure must remain recoverable instead of becoming DONE');

  pinSheet.appendRow = originalAppendRow;
  c.harness.newRequest();
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(result.counts.verifiedCredentialMemberships, 1,
    'completion must prove usable credential material for the approved membership');
  const cards = c.pinCards().filter((row) => String(row['Student Email']) === target.email && String(row['Class / Period']) === target.period);
  assert.equal(cards.length, 1, 'retry must create exactly one missing PIN card');
  assert.match(String(cards[0].PIN), /^\d{6}$/);
  const finalRoster = c.rosterRows().find((row) =>
    String(row['Student Email']) === target.email && String(row['Class / Period']) === target.period
  );
  assert.equal(String(finalRoster['PIN Hash']), c.harness.call('hashPin_', String(cards[0].PIN)),
    'the recovered PIN card must match the roster credential hash');
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'DONE');
});

function prepareReactivation(c, { correctedName = 'Turing, Alan Corrected', removeCard = false } = {}) {
  const rosterSheet = c.harness.sheet('Roster');
  const pinSheet = c.harness.sheet('PIN Cards');
  const rosterRow = rosterSheet.records().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  const originalCard = pinSheet.records().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  assert.ok(rosterRow && originalCard, 'reactivation fixture requires an existing membership and PIN card');
  const originalPin = String(originalCard.PIN);
  rosterSheet.getRange(rosterRow.__row, 5).setValue(false);
  if (removeCard) pinSheet.deleteRow(originalCard.__row);

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: `sync-reactivate-name-${String(correctedName).replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}`,
    baseRevision: snapshot.revision,
    add: [{
      studentEmail: PEOPLE.alan.email,
      studentName: correctedName,
      classPeriod: 'Period 1',
    }],
    updateName: [],
  };
  return { request, correctedName, originalPin, originalCard };
}

test('reactivating a renamed student updates and verifies the existing PIN-card name', () => {
  const c = classroom();
  const { request, correctedName, originalPin } = prepareReactivation(c);
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(result.counts.reactivated, 1);
  assert.equal(result.counts.verifiedCredentialMemberships, 1);

  const membership = c.rosterRows().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  const card = c.pinCards().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  assert.equal(String(membership['Student Name']), correctedName);
  assert.equal(String(card['Student Name']), correctedName,
    'the existing PIN card must be corrected before reactivation is reported complete');
  assert.equal(String(card.PIN), originalPin, 'a name correction must not rotate an otherwise valid PIN');
  assert.equal(String(membership['PIN Hash']), c.harness.call('hashPin_', String(card.PIN)));

  const requestKey = c.harness.call('rosterSyncRequestKey_', request.requestId);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'DONE');
});

test('reactivation with an unchanged name preserves the existing PIN card and credential', () => {
  const c = classroom();
  const { request, originalPin } = prepareReactivation(c, { correctedName: PEOPLE.alan.name });
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(result.counts.reactivated, 1);
  const cards = c.pinCards().filter((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  assert.equal(cards.length, 1);
  assert.equal(String(cards[0]['Student Name']), PEOPLE.alan.name);
  assert.equal(String(cards[0].PIN), originalPin);
});

test('reactivation with a missing PIN card recreates a correctly named credential card', () => {
  const c = classroom();
  const { request, correctedName } = prepareReactivation(c, { removeCard: true });
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(result.counts.reactivated, 1);
  assert.equal(result.counts.verifiedCredentialMemberships, 1);
  const cards = c.pinCards().filter((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  assert.equal(cards.length, 1);
  assert.equal(String(cards[0]['Student Name']), correctedName);
  assert.match(String(cards[0].PIN), /^\d{6}$/);
  const membership = c.rosterRows().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  );
  assert.equal(String(membership['PIN Hash']), c.harness.call('hashPin_', String(cards[0].PIN)));
});

test('a PIN-card name write failure leaves reactivation pending and the same request repairs on retry', () => {
  const c = classroom();
  const { request, correctedName, originalCard } = prepareReactivation(c);
  const pinSheet = c.harness.sheet('PIN Cards');
  const originalGetRange = pinSheet.getRange.bind(pinSheet);
  let injected = true;
  pinSheet.getRange = function getRangeWithNameWriteFailure(a, b, d, e) {
    const range = originalGetRange(a, b, d, e);
    if (Number(a) === originalCard.__row && Number(b) === 2) {
      const originalSetValue = range.setValue.bind(range);
      range.setValue = function setValueWithOneFailure(value) {
        if (injected) {
          injected = false;
          throw new Error('synthetic PIN-card name update failure');
        }
        return originalSetValue(value);
      };
    }
    return range;
  };

  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /synthetic PIN-card name update failure/
  );
  const requestKey = c.harness.call('rosterSyncRequestKey_', request.requestId);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'PENDING');
  assert.equal(String(c.pinCards().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  )['Student Name']), PEOPLE.alan.name);

  pinSheet.getRange = originalGetRange;
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const retried = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(retried.ok, true);
  assert.equal(String(c.pinCards().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  )['Student Name']), correctedName);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'DONE');
});

test('a PIN-card name verification failure cannot falsely complete reactivation', () => {
  const c = classroom();
  const { request, correctedName, originalCard } = prepareReactivation(c);
  const pinSheet = c.harness.sheet('PIN Cards');
  const originalGetRange = pinSheet.getRange.bind(pinSheet);
  let suppressOnce = true;
  pinSheet.getRange = function getRangeWithSilentNameWriteLoss(a, b, d, e) {
    const range = originalGetRange(a, b, d, e);
    if (Number(a) === originalCard.__row && Number(b) === 2) {
      const originalSetValue = range.setValue.bind(range);
      range.setValue = function setValueWithOneSilentLoss(value) {
        if (suppressOnce) {
          suppressOnce = false;
          return range;
        }
        return originalSetValue(value);
      };
    }
    return range;
  };

  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /could not verify the corrected PIN-card name/i
  );
  const requestKey = c.harness.call('rosterSyncRequestKey_', request.requestId);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'PENDING',
    'unverified card identity must keep the exact approved transaction recoverable');
  assert.equal(String(c.pinCards().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  )['Student Name']), PEOPLE.alan.name);

  pinSheet.getRange = originalGetRange;
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const retried = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(retried.ok, true);
  assert.equal(String(c.pinCards().find((row) =>
    String(row['Student Email']) === PEOPLE.alan.email && String(row['Class / Period']) === 'Period 1'
  )['Student Name']), correctedName);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'DONE');
});

test('pre-write STARTED recovery requires explicit teacher review and then resumes the exact approved addition', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const target = { email: 'prewrite.retry@students.mtmorrisschools.org', name: 'Student, Prewrite Retry', period: 'Period 4' };
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-prewrite-recovery-001',
    baseRevision: snapshot.revision,
    add: [{ studentEmail: target.email, studentName: target.name, classPeriod: target.period }],
    updateName: [],
  };
  const roster = c.harness.sheet('Roster'), originalAppendRow = roster.appendRow.bind(roster);
  let injected = true, appendAttempts = 0;
  roster.appendRow = function appendRowWithOneFailure(values) {
    if (String(values && values[0] || '') === target.email) {
      appendAttempts += 1;
      if (injected) { injected = false; throw new Error('synthetic pre-write roster append failure'); }
    }
    return originalAppendRow(values);
  };

  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /synthetic pre-write roster append failure/
  );
  const requestKey = c.harness.call('rosterSyncRequestKey_', request.requestId);
  const pending = JSON.parse(c.harness.properties.getProperty(requestKey));
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.plan.addActions[0].stage, 'STARTED');
  assert.equal(c.rosterRows().filter((row) => String(row['Student Email']) === target.email).length, 0,
    'the injected failure must happen before the membership row exists');

  c.harness.newRequest();
  const review = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(review.ok, false);
  assert.equal(review.status, 'RECOVERY_REVIEW_REQUIRED');
  assert.equal(review.reviewCounts.additions, 1);
  assert.match(String(review.recoveryToken), /^[A-Za-z0-9_-]{20,80}$/);
  assert.equal(appendAttempts, 1, 'ordinary retry must not guess by replaying an ambiguous STARTED write');
  assert.equal(c.rosterRows().filter((row) => String(row['Student Email']) === target.email).length, 0);

  c.harness.newRequest();
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1', {
    confirmation: 'REAPPLY REVIEWED PREWRITE CHANGES',
    token: review.recoveryToken,
  });
  assert.equal(result.ok, true);
  assert.equal(result.counts.added, 1);
  assert.equal(result.counts.verifiedCredentialMemberships, 1);
  assert.equal(appendAttempts, 2);
  assert.equal(c.rosterRows().filter((row) =>
    String(row['Student Email']) === target.email && String(row['Class / Period']) === target.period
  ).length, 1);
  assert.equal(JSON.parse(c.harness.properties.getProperty(requestKey)).status, 'DONE');
  c.harness.newRequest();
  const replay = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.deepEqual(replay, result);
  assert.equal(c.rosterRows().filter((row) => String(row['Student Email']) === target.email).length, 1);
  assert.equal(c.pinCards().filter((row) => String(row['Student Email']) === target.email && String(row['Class / Period']) === target.period).length, 1);
  assert.equal(c.harness.sheet('Teacher Actions').records().filter((row) => String(row['Reference ID']) === request.requestId && String(row.Action) === 'GOCLASSROOM_ROSTER_MEMBERSHIP_ADDED').length, 1);
});

test('pre-write STARTED reactivation resumes only after review without duplicating the retained membership', () => {
  const returning = { email: 'prewrite.reactivate@students.mtmorrisschools.org', name: 'Student, Returning' };
  const c = classroom({ memberships: [[PEOPLE.ada, 'Period 1'], [returning, 'Period 4', { active: false }]] });
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = { confirmation: 'APPLY SAFE ROSTER CHANGES', requestId: 'sync-prewrite-reactivate-001',
    baseRevision: snapshot.revision, add: [{ studentEmail: returning.email, studentName: returning.name, classPeriod: 'Period 4' }], updateName: [] };
  const roster = c.harness.sheet('Roster'), originalGetRange = roster.getRange.bind(roster);
  const retainedRow = c.rosterRows().findIndex((row) => String(row['Student Email']) === returning.email) + 2;
  let injected = true;
  roster.getRange = function (row, column, ...rest) {
    if (injected && row === retainedRow && column === 1 && rest[0] === 1 && rest[1] === 7) {
      injected = false;
      throw new Error('synthetic pre-write reactivation failure');
    }
    return originalGetRange(row, column, ...rest);
  };
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), /synthetic pre-write/);
  roster.getRange = originalGetRange;
  const state = JSON.parse(c.harness.properties.getProperty(c.harness.call('rosterSyncRequestKey_', request.requestId)));
  assert.equal(state.plan.addActions[0].stage, 'STARTED');
  assert.equal(String(c.rosterRows().find((row) => String(row['Student Email']) === returning.email).Active).toLowerCase(), 'false');
  c.harness.newRequest();
  const review = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(review.reviewCounts.reactivations, 1);
  c.harness.newRequest();
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1', {
    confirmation: 'REAPPLY REVIEWED PREWRITE CHANGES', token: review.recoveryToken,
  });
  assert.equal(result.counts.reactivated, 1);
  c.harness.newRequest();
  assert.deepEqual(c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), result);
  assert.equal(c.rosterRows().filter((row) => String(row['Student Email']) === returning.email && String(row['Class / Period']) === 'Period 4').length, 1);
  assert.equal(c.harness.sheet('Teacher Actions').records().filter((row) => String(row['Reference ID']) === request.requestId && String(row.Action) === 'GOCLASSROOM_ROSTER_MEMBERSHIP_REACTIVATED').length, 1);
});

test('pre-write STARTED name correction requires review and does not repeat its audit action', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = { confirmation: 'APPLY SAFE ROSTER CHANGES', requestId: 'sync-prewrite-name-001',
    baseRevision: snapshot.revision, add: [], updateName: [{ studentEmail: PEOPLE.ada.email,
      studentName: 'Byron, Ada Corrected', beforeName: PEOPLE.ada.name, classPeriod: 'Period 1' }] };
  const roster = c.harness.sheet('Roster'), originalGetRange = roster.getRange.bind(roster);
  let injected = true;
  roster.getRange = function (row, column, ...rest) {
    if (injected && row > 1 && column === 2 && rest.length === 0) {
      injected = false;
      throw new Error('synthetic pre-write name failure');
    }
    return originalGetRange(row, column, ...rest);
  };
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), /synthetic pre-write/);
  roster.getRange = originalGetRange;
  const state = JSON.parse(c.harness.properties.getProperty(c.harness.call('rosterSyncRequestKey_', request.requestId)));
  assert.equal(state.plan.nameActions[0].stage, 'STARTED');
  c.harness.newRequest();
  const review = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(review.reviewCounts.nameUpdates, 1);
  c.harness.newRequest();
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1', {
    confirmation: 'REAPPLY REVIEWED PREWRITE CHANGES', token: review.recoveryToken,
  });
  assert.equal(result.counts.nameRowsUpdated, 1);
  c.harness.newRequest();
  assert.deepEqual(c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), result);
  assert.equal(c.harness.sheet('Teacher Actions').records().filter((row) => String(row['Reference ID']) === request.requestId && String(row.Action) === 'GOCLASSROOM_ROSTER_NAME_UPDATED').length, 1);
});

test('STARTED addition already written resumes without a second append or review', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const target = { email: 'postwrite.started@students.mtmorrisschools.org', name: 'Student, Postwrite', period: 'Period 4' };
  const request = { confirmation: 'APPLY SAFE ROSTER CHANGES', requestId: 'sync-started-postwrite-001',
    baseRevision: snapshot.revision, add: [{ studentEmail: target.email, studentName: target.name, classPeriod: target.period }], updateName: [] };
  const roster = c.harness.sheet('Roster'), originalGetRange = roster.getRange.bind(roster), originalAppend = roster.appendRow.bind(roster);
  let injected = true, appends = 0;
  roster.appendRow = function (values) {
    if (String(values[0]) === target.email) appends += 1;
    return originalAppend(values);
  };
  roster.getRange = function (row, column, ...rest) {
    if (injected && row === roster.getLastRow() && column === 6 && c.rosterRows().some((entry) => String(entry['Student Email']) === target.email)) {
      injected = false;
      throw new Error('synthetic interruption after membership append');
    }
    return originalGetRange(row, column, ...rest);
  };
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), /synthetic interruption/);
  roster.getRange = originalGetRange;
  const state = JSON.parse(c.harness.properties.getProperty(c.harness.call('rosterSyncRequestKey_', request.requestId)));
  assert.equal(state.plan.addActions[0].stage, 'STARTED');
  assert.equal(appends, 1);
  c.harness.newRequest();
  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.equal(appends, 1, 'recovery must not append the already-applied membership again');
  assert.equal(c.pinCards().filter((row) => String(row['Student Email']) === target.email).length, 1);
  assert.equal(c.harness.sheet('Teacher Actions').records().filter((row) => String(row['Reference ID']) === request.requestId && String(row.Action) === 'GOCLASSROOM_ROSTER_MEMBERSHIP_ADDED').length, 1);
});

test('reviewed pre-write recovery refuses to overwrite a later teacher membership change', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const target = { email: 'prewrite.conflict@students.mtmorrisschools.org', name: 'Student, Intended', period: 'Period 5' };
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-prewrite-conflict-001',
    baseRevision: snapshot.revision,
    add: [{ studentEmail: target.email, studentName: target.name, classPeriod: target.period }],
    updateName: [],
  };
  const roster = c.harness.sheet('Roster'), originalAppendRow = roster.appendRow.bind(roster);
  let injected = true;
  roster.appendRow = function appendRowWithOneFailure(values) {
    if (injected && String(values && values[0] || '') === target.email) {
      injected = false;
      throw new Error('synthetic pre-write roster append failure');
    }
    return originalAppendRow(values);
  };
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), /synthetic pre-write/);
  roster.appendRow = originalAppendRow;
  c.harness.newRequest();
  const review = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(review.status, 'RECOVERY_REVIEW_REQUIRED');

  roster.appendRow([target.email, 'Student, Later Teacher Edit', target.period, '', true, false, 'STANDARD']);
  c.harness.newRequest();
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1', {
      confirmation: 'REAPPLY REVIEWED PREWRITE CHANGES',
      token: review.recoveryToken,
    }),
    /preserve the newer teacher decision/i
  );
  const row = c.rosterRows().find((entry) => String(entry['Student Email']) === target.email && String(entry['Class / Period']) === target.period);
  assert.equal(String(row['Student Name']), 'Student, Later Teacher Edit');
});

test('hash-only PIN state is not rotated when missing-card creation is disabled', () => {
  const c = classroom();
  const email = 'hash.only@students.mtmorrisschools.org';
  const originalHash = c.harness.call('hashPin_', '654321');
  c.harness.sheet('Roster').appendRow([email, 'Student, Hash Only', 'Period 2', originalHash, true, false, 'STANDARD']);
  c.harness.newRequest();
  const result = c.harness.call('ensureOnePinPerStudent_', { createMissing: false, studentEmails: [email] });
  const row = c.rosterRows().find((entry) => String(entry['Student Email']) === email);
  assert.equal(String(row['PIN Hash']), originalHash, 'non-provisioning repair must preserve the existing hash');
  assert.equal(c.pinCards().filter((entry) => String(entry['Student Email']) === email).length, 0,
    'createMissing=false must not mint or expose a new credential');
  assert.equal(result.createdPins, 0);
  assert.equal(result.createdCards, 0);
});

test('roster sync name correction changes only the explicitly approved class membership', () => {
  const c = classroom({
    memberships: [
      [PEOPLE.ada, 'Period 1'],
      [PEOPLE.ada, 'Period 3'],
      [PEOPLE.grace, 'Period 1'],
    ],
  });
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-exact-membership-001',
    baseRevision: snapshot.revision,
    add: [],
    updateName: [{
      studentEmail: PEOPLE.ada.email,
      studentName: 'Byron, Ada Period One',
      beforeName: PEOPLE.ada.name,
      classPeriod: 'Period 1',
    }],
  };

  const result = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(result.counts.requestedNameUpdates, 1);
  assert.equal(result.counts.nameRowsUpdated, 1);

  const memberships = c.rosterRows().filter((row) => String(row['Student Email']) === PEOPLE.ada.email);
  assert.equal(String(memberships.find((row) => String(row['Class / Period']) === 'Period 1')['Student Name']), 'Byron, Ada Period One');
  assert.equal(String(memberships.find((row) => String(row['Class / Period']) === 'Period 3')['Student Name']), PEOPLE.ada.name,
    'a name correction approved for Period 1 must not silently rewrite Period 3');

  const cards = c.pinCards().filter((row) => String(row['Student Email']) === PEOPLE.ada.email);
  assert.equal(String(cards.find((row) => String(row['Class / Period']) === 'Period 1')['Student Name']), 'Byron, Ada Period One');
  assert.equal(String(cards.find((row) => String(row['Class / Period']) === 'Period 3')['Student Name']), PEOPLE.ada.name,
    'PIN Card display names must change only for the approved membership');
});

test('roster sync rejects a stale comparison before applying any requested change', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  c.harness.sheet('Roster').appendRow([
    'drift.student@students.mtmorrisschools.org', 'Student, Drift', 'Period 2', '', true, false, 'STANDARD',
  ]);
  c.harness.newRequest();

  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-stale-001',
    baseRevision: snapshot.revision,
    add: [{
      studentEmail: 'should.not.apply@students.mtmorrisschools.org',
      studentName: 'Student, Blocked',
      classPeriod: 'Period 3',
    }],
    updateName: [],
  };
  const rejected = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 'REJECTED_NO_ROSTER_EFFECTS');
  assert.equal(rejected.code, 'STALE_ROSTER_REVISION');
  assert.ok(!c.rosterRows().some((row) => String(row['Student Email']) === 'should.not.apply@students.mtmorrisschools.org'));
});

test('roster sync prevalidates the whole batch so one stale name prevents an otherwise valid addition', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-atomic-validation-001',
    baseRevision: snapshot.revision,
    add: [{
      studentEmail: 'held.student@students.mtmorrisschools.org',
      studentName: 'Student, Held',
      classPeriod: 'Period 4',
    }],
    updateName: [{
      studentEmail: PEOPLE.ada.email,
      studentName: 'Byron, Ada Updated',
      beforeName: 'Wrong Previous Name',
      classPeriod: 'Period 1',
    }],
  };
  const rejected = c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 'REJECTED_NO_ROSTER_EFFECTS');
  assert.equal(rejected.code, 'ROSTER_PRECONDITION_CHANGED');
  assert.ok(!c.rosterRows().some((row) => String(row['Student Email']) === 'held.student@students.mtmorrisschools.org'),
    'valid additions must remain unapplied when any request item fails prevalidation');
});

test('roster sync refuses removals, wrong contracts, missing approval, wrong-domain students, and non-teachers', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const base = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-guardrails-001',
    baseRevision: snapshot.revision,
    add: [],
    updateName: [],
  };

  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', { ...base, deactivate: [{ studentEmail: PEOPLE.ada.email }] }, '2026-09-22-roster-write-v1'),
    /does not remove students automatically/i
  );
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', base, 'old-write-contract'),
    /write contract has changed/i
  );
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', { ...base, requestId: 'sync-guardrails-002', confirmation: '' }, '2026-09-22-roster-write-v1'),
    /Confirm the safe roster changes/i
  );
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', {
      ...base,
      requestId: 'sync-guardrails-003',
      add: [{ studentEmail: 'student@outside.example', studentName: 'Outside, Student', classPeriod: 'Period 2' }],
    }, '2026-09-22-roster-write-v1'),
    /Student email must end in/i
  );

  c.harness.newRequest();
  c.harness.signInAs(PEOPLE.ada.email);
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', { ...base, requestId: 'sync-guardrails-004' }, '2026-09-22-roster-write-v1'),
    /limited to the teacher/i
  );
});

test('a roster sync request ID cannot be reused for different changes', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const first = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-reuse-001',
    baseRevision: snapshot.revision,
    add: [],
    updateName: [],
  };
  c.harness.call('applyRosterSyncChanges', first, '2026-09-22-roster-write-v1');

  c.harness.newRequest();
  const latest = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const changed = {
    ...first,
    baseRevision: latest.revision,
    add: [{ studentEmail: 'other.student@students.mtmorrisschools.org', studentName: 'Student, Other', classPeriod: 'Period 2' }],
  };
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', changed, '2026-09-22-roster-write-v1'),
    /request ID was already used for different data/i
  );
  assert.ok(!c.rosterRows().some((row) => String(row['Student Email']) === 'other.student@students.mtmorrisschools.org'));
});

test('roster sync replay records are age-pruned and count-bounded', () => {
  const c = classroom();
  const properties = c.harness.properties;
  const oldKey = c.harness.call('rosterSyncRequestKey_', 'old-roster-sync-request');
  properties.setProperty(oldKey, JSON.stringify({
    v: 1,
    status: 'DONE',
    at: '2026-08-01T12:00:00.000Z',
    payloadDigest: 'old',
    result: { ok: true },
  }));
  const unresolvedKey = c.harness.call('rosterSyncRequestKey_', 'old-pending-roster-sync-request');
  properties.setProperty(unresolvedKey, JSON.stringify({
    v: 2,
    status: 'PENDING',
    at: '2026-08-01T12:00:00.000Z',
    payloadDigest: 'pending-old',
    plan: { v: 2, addActions: [], nameActions: [] },
  }));
  for (let index = 0; index < 105; index += 1) {
    const key = c.harness.call('rosterSyncRequestKey_', `fresh-roster-sync-${index}`);
    properties.setProperty(key, JSON.stringify({
      v: 1,
      status: 'DONE',
      at: new Date(2026, 8, 10, 7, 30, index % 60).toISOString(),
      payloadDigest: `fresh-${index}`,
      result: { ok: true },
    }));
  }

  c.harness.call('pruneRosterSyncRequests_', 0);
  const retained = Object.keys(properties.getProperties()).filter((key) => key.startsWith('roster-sync-request:'));
  assert.ok(retained.length <= 101, 'completed replay retention must stay bounded without deleting unresolved recovery evidence');
  assert.equal(properties.getProperty(oldKey), null, 'expired completed replay evidence must be removed');
  assert.notEqual(properties.getProperty(unresolvedKey), null, 'an unresolved PENDING request must never be age-pruned');
});

test('roster sync rejects an oversized recoverable batch before any roster mutation', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const additions = Array.from({ length: 200 }, (_, index) => ({
    studentEmail: `bulk.student.${String(index).padStart(3, '0')}@students.mtmorrisschools.org`,
    studentName: `Student, Bulk ${String(index).padStart(3, '0')}`,
    classPeriod: `Period ${(index % 6) + 1}`,
  }));
  const before = c.rosterRows().length;
  const result = c.harness.call('applyRosterSyncChanges', {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-oversized-ledger-001',
    baseRevision: snapshot.revision,
    add: additions,
    updateName: [],
  }, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'REJECTED_NO_ROSTER_EFFECTS');
  assert.equal(result.code, 'ROSTER_BATCH_TOO_LARGE');
  assert.equal(c.rosterRows().length, before, 'oversized ledger rejection must occur before roster rows change');
});

test('roster sync PIN repair is limited to students in the approved additions', () => {
  const c = classroom();
  const unrelatedEmail = 'unrelated.pin@students.mtmorrisschools.org';
  c.harness.sheet('Roster').appendRow([unrelatedEmail, 'Student, Unrelated', 'Period 2', '', true, false, 'STANDARD']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const result = c.harness.call('applyRosterSyncChanges', {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-pin-scope-001',
    baseRevision: snapshot.revision,
    add: [{
      studentEmail: 'approved.pin@students.mtmorrisschools.org',
      studentName: 'Student, Approved',
      classPeriod: 'Period 3',
    }],
    updateName: [],
  }, '2026-09-22-roster-write-v1');
  assert.equal(result.ok, true);
  assert.ok(c.pinCards().some((row) => String(row['Student Email']) === 'approved.pin@students.mtmorrisschools.org'));
  assert.ok(!c.pinCards().some((row) => String(row['Student Email']) === unrelatedEmail),
    'an approved change for one student must not create PIN material for an unrelated roster student');
});

test('pending recovery never reactivates a membership after a later teacher deactivation', () => {
  const returning = { email: 'returning.student@students.mtmorrisschools.org', name: 'Student, Returning' };
  const c = classroom({ memberships: [[PEOPLE.ada, 'Period 1'], [returning, 'Period 3', { active: false }]] });
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES',
    requestId: 'sync-teacher-edit-conflict-001',
    baseRevision: snapshot.revision,
    add: [{ studentEmail: returning.email, studentName: returning.name, classPeriod: 'Period 3' }],
    updateName: [],
  };
  const originalPinRepair = c.harness.sandbox.ensureOnePinPerStudent_;
  let injected = true;
  c.harness.sandbox.ensureOnePinPerStudent_ = function(options) {
    if (injected) { injected = false; throw new Error('synthetic interruption before PIN completion'); }
    return originalPinRepair(options);
  };
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), /synthetic interruption/);
  c.harness.sandbox.ensureOnePinPerStudent_ = originalPinRepair;

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const key = c.key(returning, 'Period 3');
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', key, TEACHER_CONTRACT);

  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  assert.throws(
    () => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /preserve the newer teacher decision/i
  );
  const row = c.rosterRows().find((entry) =>
    String(entry['Student Email']) === returning.email && String(entry['Class / Period']) === 'Period 3'
  );
  assert.equal(String(row.Active).toLowerCase(), 'false', 'retry must not undo the later teacher deactivation');
});

test('a STARTED reactivation cannot reverse a later teacher deactivation even with a stale recovery approval', () => {
  const returning = { email: 'started.later.edit@students.mtmorrisschools.org', name: 'Student, Returning' };
  const c = classroom({ memberships: [[PEOPLE.ada, 'Period 1'], [returning, 'Period 3', { active: false }]] });
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const snapshot = c.harness.call('getRosterSyncSnapshot', '2026-09-22-roster-sync-v1');
  const request = {
    confirmation: 'APPLY SAFE ROSTER CHANGES', requestId: 'sync-started-later-edit-001',
    baseRevision: snapshot.revision,
    add: [{ studentEmail: returning.email, studentName: returning.name, classPeriod: 'Period 3' }],
    updateName: [],
  };
  const roster = c.harness.sheet('Roster');
  const originalGetRange = roster.getRange.bind(roster);
  let injected = true;
  roster.getRange = function (row, column, ...rest) {
    if (injected && column === 6 && row > 1) {
      injected = false;
      throw new Error('synthetic interruption after reactivation write');
    }
    return originalGetRange(row, column, ...rest);
  };
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'), /synthetic interruption/);
  roster.getRange = originalGetRange;
  const key = c.key(returning, 'Period 3');
  const state = JSON.parse(c.harness.properties.getProperty(c.harness.call('rosterSyncRequestKey_', request.requestId)));
  assert.equal(state.plan.addActions[0].stage, 'STARTED');
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', key, TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1'),
    /preserve the newer teacher decision/i);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  assert.throws(() => c.harness.call('applyRosterSyncChanges', request, '2026-09-22-roster-write-v1', {
    confirmation: 'REAPPLY REVIEWED PREWRITE CHANGES', token: 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  }), /preserve the newer teacher decision/i);
  assert.equal(String(c.rosterRows().find((r) => String(r['Student Email']) === returning.email).Active).toLowerCase(), 'false');
});

section('Backend repair guardrails');

test('teacher roster entry rejects a class label the bell engine cannot schedule', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  assert.throws(
    () => c.harness.call('teacherAddStudentClass', 'Example, Student', 'example.student@students.mtmorrisschools.org', 'American History', TEACHER_CONTRACT),
    /Period 1 through Period 6/
  );
});

test('teacher policy changes leave central audit evidence', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherSetCheckInWindow', 10, TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.call('teacherSetPassRules', 2, 3, 1, 5, 8, 15, TEACHER_CONTRACT);
  const actions = c.harness.sheet('Teacher Actions').records().map((row) => String(row.Action));
  assert.ok(actions.includes('CHECKIN_WINDOW_CHANGED'));
  assert.ok(actions.includes('PASS_RULES_CHANGED'));
});

require('./lib/hall-pass-session-tests.cjs')(test, section);
report();
