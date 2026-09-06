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
  assert.equal(c.harness.properties.getProperty('WORKBOOK_SCHEMA'), '2026-09-05-session-a');
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

test('the daily cleanup trigger is installed', () => {
  const c = classroom();
  assert.ok(c.harness.state.triggers.some((trigger) => trigger.handler === 'dailyCleanup'));
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

test('checking in twice in one day does not add a second row or a second point', () => {
  const c = classroom({ now: new Date('2026-09-10T11:30:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.checkIn(PEOPLE.ada, 'Period 1');
  const rows = c.checkIns().filter((row) => row['Student Email'] === PEOPLE.ada.email);
  assert.equal(rows.length, 1, 'a repeated PIN must not create a duplicate check-in');
  assert.equal(Number(rows[0].Point), 1);
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
  c.harness.call('teacherVoidPass', passId, 'Nurse visit, not a bathroom trip');

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
  c.harness.call('teacherVoidPass', String(c.passLog()[0]['Pass ID']), 'Nurse visit');

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
  c.harness.call('teacherVoidPass', String(c.passLog()[0]['Pass ID']), 'Correcting a mistake');

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
  c.harness.call('teacherVoidPass', String(before.passes[0].passId), 'Correction');
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
  c.harness.call('teacherVoidPass', String(c.passLog()[0]['Pass ID']), 'Correction');

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
  c.harness.call('teacherRemoveStudentClass', c.key(PEOPLE.ada, 'Period 1'));

  assert.equal(c.passLog().length, before, 'history must survive a roster removal');
  assert.ok(c.passLog()[0]['Out Time'], 'the original trip is intact');
});

test('a removed membership is deactivated, not deleted', () => {
  const c = classroom();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherRemoveStudentClass', c.key(PEOPLE.ada, 'Period 1'));
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
  c.harness.call('teacherRemoveStudentClass', c.key(PEOPLE.ada, 'Period 1'));
  c.harness.newRequest();
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 1');

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
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 3');
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
  c.harness.call('teacherAddStudentClass', PEOPLE.ada.name, PEOPLE.ada.email, 'Period 3');
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


require('./lib/hall-pass-session-tests.cjs')(test, section);
report();
