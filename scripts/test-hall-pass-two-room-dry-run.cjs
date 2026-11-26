'use strict';
// Synthetic two-room dry run. Prints pass/fail counts only. No live Google account.
const assert = require('node:assert/strict');
const { createHarness } = require('./lib/gas-harness.cjs');
const CONTRACT = '2026-09-22-all-teacher-rpcs';
const cases = [];
function check(name, fn) {
  try { fn(); cases.push({ name, ok: true }); }
  catch (error) { cases.push({ name, ok: false, message: String(error && error.message || error).split('\n')[0] }); }
}
const workbooks = new Map();
const now = new Date('2026-09-10T11:50:00Z');
function room(id, teacher) {
  const h = createHarness({ spreadsheetId: id, activeEmail: teacher, now, workbooks });
  workbooks.set(id, h.spreadsheet);
  h.call('ensureWorkbookReady_');
  h.properties.setProperty('PIN_SALT', 'synthetic-' + id);
  return h;
}
const owner = room('synthetic-dry-owner', 'directory@mtmorrisschools.org');
const list = '012345\nByron, Ada\n54321\nTuring, Alan\n98765\nHopper, Grace';
const mapping = '012345,ada@students.mtmorrisschools.org\n54321,alan@students.mtmorrisschools.org\n98765,grace@students.mtmorrisschools.org';
const preview = owner.call('teacherImportSchoolDirectory', list, mapping, '', '', CONTRACT);
owner.call('teacherImportSchoolDirectory', list, mapping, 'IMPORT SCHOOL DIRECTORY', preview.preview.revision, CONTRACT);
const ownedId = owner.call('teacherGetSchoolDirectoryState', CONTRACT).ownedId;
const a = room('synthetic-dry-room-a', 'teacher.a@mtmorrisschools.org');
const b = room('synthetic-dry-room-b', 'teacher.b@mtmorrisschools.org');
function enrollOld(h, email, name) {
  h.sheet('Roster').appendRow([email, name, 'Period 1', '', true, false, '']);
  h.newRequest();
  h.call('ensureOnePinPerStudent_', { createMissing: true });
}
enrollOld(a, 'ada@students.mtmorrisschools.org', 'Ada Byron');
enrollOld(b, 'ada@students.mtmorrisschools.org', 'Ada Byron');
const oldPin = a.call('readPinCards_')[0].pin;
function connect(h) {
  h.newRequest();
  const seen = h.call('teacherConnectSchoolDirectory', ownedId, '', '', CONTRACT);
  return h.call('teacherConnectSchoolDirectory', ownedId, 'USE SCHOOL DIRECTORY', seen.preview.revision, CONTRACT);
}
a.signInAs('teacher.a@mtmorrisschools.org');
b.signInAs('teacher.b@mtmorrisschools.org');
connect(a); connect(b);
const adaKey = () => a.call('getRoster_').find((row) => row.email === 'ada@students.mtmorrisschools.org').key;

check('directory outage fails closed for the old PIN and the current PIN', () => {
  const book = workbooks.get(ownedId);
  workbooks.delete(ownedId);
  try {
    a.signOut(); a.newRequest();
    assert.throws(() => a.call('identifyWithPin', oldPin, 'outage-old'), /unavailable|did not match/);
    a.newRequest();
    assert.throws(() => a.call('identifyWithPin', '012345', 'outage-new'), /unavailable|did not match/);
  } finally {
    workbooks.set(ownedId, book);
  }
});

check('a shared student pass in room A stays out of room B', () => {
  const beforeB = b.sheet('Pass Log').getLastRow();
  a.signInAs('teacher.a@mtmorrisschools.org'); a.newRequest();
  a.call('teacherStartPass', adaKey(), 'synthetic drill', CONTRACT);
  assert.ok(a.sheet('Pass Log').getLastRow() > 1);
  assert.equal(b.sheet('Pass Log').getLastRow(), beforeB);
  const passId = a.sheet('Pass Log').getRange(2, 1).getValue();
  a.call('teacherEndPass', passId, 'synthetic return', CONTRACT);
  assert.equal(b.sheet('Pass Log').getLastRow(), beforeB);
  const stateA = a.call('getTeacherState_', { includePinStatus: false });
  b.signInAs('teacher.b@mtmorrisschools.org'); b.newRequest();
  const stateB = b.call('getTeacherState_', { includePinStatus: false });
  const idsA = (stateA.today || []).map((row) => row.passId);
  const idsB = (stateB.today || []).map((row) => row.passId);
  assert.ok(idsA.includes(passId));
  assert.ok(!idsB.includes(passId));
});

check('a directory PIN correction invalidates both rooms', () => {
  a.signOut(); a.newRequest();
  const tokenA = a.call('identifyWithPin', '012345', 'dry-a').pinToken;
  b.signOut(); b.newRequest();
  const tokenB = b.call('identifyWithPin', '012345', 'dry-b').pinToken;
  const sheet = workbooks.get(ownedId).getSheetByName('School Directory');
  const row = sheet.dataRows().findIndex((cells) => cells[0] === '012345') + 2;
  sheet.getRange(row, 1).setValue('023456');
  a.newRequest();
  assert.throws(() => a.call('readPinSession_', tokenA), /changed|again|expired/i);
  b.newRequest();
  assert.throws(() => b.call('readPinSession_', tokenB), /changed|again|expired/i);
  a.newRequest();
  assert.throws(() => a.call('identifyWithPin', '012345', 'dry-old'), /did not match/);
  const returned = a.call('identifyWithPin', '023456', 'dry-new');
  assert.equal(returned.student.key, a.call('getRoster_').find((row) => row.email === 'ada@students.mtmorrisschools.org').key);
  sheet.getRange(row, 1).setValue('012345');
});

check('a duplicate id never creates a second active directory row', () => {
  const before = owner.call('teacherGetSchoolDirectoryState', CONTRACT).students;
  const rosterBefore = a.sheet('Roster').getLastRow();
  assert.throws(() => owner.call('teacherImportSchoolDirectory', '012345\nByron, Ada\n012345\nOther, Name', '', '', '', CONTRACT));
  assert.equal(owner.call('teacherGetSchoolDirectoryState', CONTRACT).students, before);
  assert.equal(a.sheet('Roster').getLastRow(), rosterBefore);
});

check('existing pass history survives a later enrollment', () => {
  const history = a.sheet('Pass Log').getLastRow();
  assert.ok(history > 1);
  a.signInAs('teacher.a@mtmorrisschools.org'); a.newRequest();
  a.call('teacherEnrollSchoolStudent', '98765', 'Period 2', CONTRACT);
  assert.equal(a.sheet('Pass Log').getLastRow(), history);
  assert.equal(b.sheet('Pass Log').getLastRow(), 1);
});

check('teacher A cannot read teacher B state', () => {
  b.signInAs('teacher.b@mtmorrisschools.org'); b.newRequest();
  const key = b.call('getRoster_').find((row) => row.email === 'ada@students.mtmorrisschools.org').key;
  b.call('teacherStartPass', key, 'room b only', CONTRACT);
  const passId = b.sheet('Pass Log').dataRows().map((row) => row[0]).find(Boolean);
  a.signInAs('teacher.a@mtmorrisschools.org'); a.newRequest();
  const stateA = a.call('getTeacherState_', { includePinStatus: false });
  const visible = JSON.stringify(stateA.active || []) + JSON.stringify(stateA.today || []);
  assert.ok(!visible.includes(passId));
  assert.notEqual(a.spreadsheet.getId(), b.spreadsheet.getId());
});

const failed = cases.filter((entry) => !entry.ok);
console.log(`Hall Pass two-room dry run: ${failed.length ? 'FAIL' : 'PASS'} — ${cases.length - failed.length} passed, ${failed.length} failed.`);
failed.forEach((entry) => console.log(`FAIL ${entry.name}`));
if (failed.length) process.exitCode = 1;
