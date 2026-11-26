'use strict';
const assert = require('node:assert/strict');
const { createHarness } = require('./lib/gas-harness.cjs');
const CONTRACT = '2026-09-22-all-teacher-rpcs';
const workbooks = new Map();
const now = new Date('2026-09-10T11:50:00Z');
function room(id, teacher) {
  const h = createHarness({ spreadsheetId: id, activeEmail: teacher, now, workbooks });
  workbooks.set(id, h.spreadsheet); h.call('ensureWorkbookReady_'); h.properties.setProperty('PIN_SALT', 'synthetic-' + id); return h;
}
const master = room('synthetic-owner-workbook-000', 'directory@mtmorrisschools.org');
const schoolList = '012345\nByron, Ada\n54321\nTuring, Alan\n98765\nHopper, Grace';
const mapping = '012345,ada@students.mtmorrisschools.org\n54321,alan@students.mtmorrisschools.org';
const preview = master.call('teacherImportSchoolDirectory', schoolList, '', '', '', CONTRACT);
assert.equal(preview.preview.total, 3); assert.equal(preview.preview.withoutEmail, 3);
assert.equal(workbooks.size, 1, 'Preview creates no workbook');
assert.throws(() => master.call('teacherImportSchoolDirectory', schoolList, '', 'IMPORT SCHOOL DIRECTORY', 'stale', CONTRACT), /Preview|changed/);
const imported = master.call('teacherImportSchoolDirectory', schoolList, '', 'IMPORT SCHOOL DIRECTORY', preview.preview.revision, CONTRACT);
assert.equal(imported.applied, true); assert.equal(master.sheet('Roster').getLastRow(), 1);
const state = master.call('teacherGetSchoolDirectoryState', CONTRACT);
assert.equal(state.students, 3); assert.equal(state.withoutEmail, 3);
const directory = workbooks.get(state.ownedId).getSheetByName('School Directory');
assert.equal(directory.getRange(2, 1).getValue(), '012345');
assert.equal(directory.getRange(1, 5).getValue(), 'Credential Generation');
assert.equal(directory.getRange(2, 5).getValue(), '1');
assert.equal(typeof directory.getRange(2, 5).getValue(), 'string');
const p2 = master.call('teacherImportSchoolDirectory', schoolList, mapping, '', '', CONTRACT);
master.call('teacherImportSchoolDirectory', schoolList, mapping, 'IMPORT SCHOOL DIRECTORY', p2.preview.revision, CONTRACT);
assert.equal(master.call('teacherGetSchoolDirectoryState', CONTRACT).students, 3, 'Repeat imports are idempotent');
for (const bad of ['1234\nName', '12345\nOne\n12345\nTwo', '12345\n=IMPORTXML("x")', '12345']) {
 assert.throws(() => master.call('teacherImportSchoolDirectory', bad, '', '', '', CONTRACT));
}
assert.throws(() => master.call('teacherImportSchoolDirectory', schoolList, '012345,nope@example.com', '', '', CONTRACT), /school email domain/);
assert.throws(() => master.call('teacherImportSchoolDirectory', schoolList, mapping + '\n98765,ada@students.mtmorrisschools.org', '', '', CONTRACT), /same email/);
const a = room('synthetic-teacher-a-workbook', 'teacher.a@mtmorrisschools.org');
const b = room('synthetic-teacher-b-workbook', 'teacher.b@mtmorrisschools.org');
function enrollOld(h, email) {
 h.sheet('Roster').appendRow([email, 'Ada Byron', 'Period 1', '', true, false, '']); h.newRequest();
 h.call('ensureOnePinPerStudent_', { createMissing: true });
}
enrollOld(a, 'ada@students.mtmorrisschools.org'); enrollOld(b, 'ada@students.mtmorrisschools.org');
const oldA = a.call('readPinCards_')[0].pin;
function connect(h) {
 h.newRequest(); const p = h.call('teacherConnectSchoolDirectory', state.ownedId, '', '', CONTRACT);
 assert.equal(p.preview.unmatched.length, 0);
 return h.call('teacherConnectSchoolDirectory', state.ownedId, 'USE SCHOOL DIRECTORY', p.preview.revision, CONTRACT);
}
connect(a); connect(b);
assert.notEqual(a.properties.getProperty('PIN_SALT'), b.properties.getProperty('PIN_SALT'), 'Independent teacher salts');
for (const h of [a,b]) {
 h.signOut(); h.newRequest();
 assert.equal(h.call('identifyWithPin', '012345', 'device1').student.key, h.call('getRoster_').find((row) => row.email === 'ada@students.mtmorrisschools.org').key);
 // The same lunch number without its leading zero still reaches the same student.
 assert.equal(h.call('identifyWithPin', '12345', 'device1').student.key, h.call('getRoster_').find((row) => row.email === 'ada@students.mtmorrisschools.org').key);
 assert.throws(() => h.call('identifyWithPin', '112345', 'device1'), /did not match/, 'Only a leading zero is forgiven');
 assert.throws(() => h.call('identifyWithPin', '54321', 'device1'), /did not match/, 'Unassigned schoolwide student cannot enter');
 assert.throws(() => h.call('identifyWithPin', oldA, 'device1'), /did not match/);
}
a.signInAs('teacher.a@mtmorrisschools.org'); a.newRequest();
assert.throws(() => a.call('teacherResetStudentPin', 'ada@students.mtmorrisschools.org', 'test', CONTRACT), /school lunch number/);
a.call('teacherEnrollSchoolStudent', '54321', 'Period 1', CONTRACT);
assert.equal(a.call('getRoster_').length, 2); assert.equal(b.call('getRoster_').length, 1);
a.signOut(); a.newRequest();
assert.equal(a.call('identifyWithPin', '54321', 'device2').student.key, a.call('getRoster_').find((row) => row.email === 'alan@students.mtmorrisschools.org').key);
// Stored without its zero, typed the way the lunch line shows it.
a.newRequest(); assert.equal(a.call('identifyWithPin', '054321', 'device2b').student.key, a.call('getRoster_').find((row) => row.email === 'alan@students.mtmorrisschools.org').key);
assert.throws(() => a.call('teacherGetSchoolDirectoryState', CONTRACT), /teacher|Only|authorized|staff/i);
const adaBefore = a.call('identifyWithPin', '012345', 'gen-a');
const adaBeforeB = b.call('identifyWithPin', '012345', 'gen-b');
const alanBefore = a.call('identifyWithPin', '54321', 'gen-alan');
const bumpPreview = master.call('teacherBumpDirectoryCredentialGeneration', '012345', '', '', CONTRACT);
assert.equal(bumpPreview.preview.pinChanged, false);
assert.equal(bumpPreview.preview.generation, '2');
master.call('teacherBumpDirectoryCredentialGeneration', '012345', 'BUMP CREDENTIAL GENERATION', bumpPreview.preview.revision, CONTRACT);
assert.equal(directory.getRange(2, 1).getValue(), '012345', 'Generation bump keeps the exact digit string');
assert.equal(directory.getRange(2, 5).getValue(), '2');
for (const pair of [[a, adaBefore.pinToken], [b, adaBeforeB.pinToken]]) {
 pair[0].newRequest();
 assert.throws(() => pair[0].call('readPinSession_', pair[1]), /changed|again|expired/i);
}
a.newRequest();
assert.equal(a.call('readPinSession_', alanBefore.pinToken).email, 'alan@students.mtmorrisschools.org');
assert.throws(() => master.call('teacherCorrectDirectoryPinByName', 'Byron, Ada', '99999', CONTRACT), /name-only/i);
assert.equal(directory.getRange(2, 1).getValue(), '012345');
a.newRequest(); const signed = a.call('identifyWithPin', '012345', 'device3');
// A directory correction must invalidate both rooms and previously issued proofs.
directory.getRange(2,1).setValue('023456');
for (const h of [a,b]) {
 h.newRequest(); assert.throws(() => h.call('identifyWithPin', '012345', 'device4'), /did not match/);
 assert.equal(h.call('identifyWithPin', '023456', 'device4').student.key, h.call('getRoster_').find((row) => row.email === 'ada@students.mtmorrisschools.org').key);
}
a.newRequest(); assert.throws(() => a.call('readPinSession_', signed.pinToken), /changed|again|expired/i);
directory.getRange(2,4).setValue('DISABLED');
a.newRequest(); assert.throws(() => a.call('identifyWithPin', '023456', 'device5'), /did not match/);
assert.equal(a.sheet('Pass Log').getLastRow(), 1); assert.equal(b.sheet('Pass Log').getLastRow(), 1);
// Numeric storage is rejected rather than silently reconstructing a missing zero.
directory.getRange(2,1).setValue(23456); a.newRequest();
assert.throws(() => a.call('readSchoolDirectory_', state.ownedId), /stored as text/);
const c = room('synthetic-teacher-c-workbook', 'teacher.c@mtmorrisschools.org');
enrollOld(c, 'unmapped@students.mtmorrisschools.org');
directory.getRange(2,1).setValue('023456'); directory.getRange(2,4).setValue('AVAILABLE');
const blocked = c.call('teacherConnectSchoolDirectory', state.ownedId, '', '', CONTRACT);
assert.equal(blocked.preview.unmatched.length, 1);
assert.throws(() => c.call('teacherConnectSchoolDirectory', state.ownedId, 'USE SCHOOL DIRECTORY', blocked.preview.revision, CONTRACT), /verified school number/);
assert.equal(c.properties.getProperty('SCHOOL_DIRECTORY_SOURCE_ID'), null);
// Clearing the cache and rotating browser nonces cannot evade the server budget.
const guard = room('synthetic-budget-workbook', 'teacher.guard@mtmorrisschools.org'); guard.signOut();
for (let i=0;i<60;i++) { guard.state.cache.clear(); guard.newRequest(); assert.throws(() => guard.call('identifyWithPin', '99999', `rotated-${i}`), /did not match/); }
guard.state.cache.clear(); guard.newRequest(); assert.throws(() => guard.call('identifyWithPin', '99999', 'brand-new'), /Too many/);
guard.clock.advanceMinutes(16); guard.newRequest(); assert.throws(() => guard.call('identifyWithPin', '99999', 'brand-new'), /did not match/);
const smoke = room('synthetic-smoke-workbook', 'gauch@mtmorrisschools.org');
smoke.properties.setProperty('SCHOOL_DIRECTORY_SOURCE_ID', 'unavailable-directory-id');
const beforeSmoke = smoke.properties.getProperty('SCHOOL_DIRECTORY_SOURCE_ID');
assert.equal(smoke.call('releaseRunSyntheticSmoke', CONTRACT).ok, true);
assert.equal(smoke.properties.getProperty('SCHOOL_DIRECTORY_SOURCE_ID'), beforeSmoke, 'Protected synthetic smoke preserves the production directory pointer');
// Speed: a connected room once read the property store several times per roster
// row on every PIN entry (over a thousand reads for 150 students), which stalled
// the whole class. Property reads per request must not grow with the roster.
const big = room('synthetic-big-roster-workbook', 'teacher.big@mtmorrisschools.org');
const bigList = [], bigMap = [];
for (let i = 0; i < 400; i++) { const id = String(200000 + i); bigList.push(id, `Last${i}, First${i}`); bigMap.push(`${id},big${i}@students.mtmorrisschools.org`); }
const bigPreview = big.call('teacherImportSchoolDirectory', bigList.join('\n'), bigMap.join('\n'), '', '', CONTRACT);
big.call('teacherImportSchoolDirectory', bigList.join('\n'), bigMap.join('\n'), 'IMPORT SCHOOL DIRECTORY', bigPreview.preview.revision, CONTRACT);
const bigDirectory = big.call('teacherGetSchoolDirectoryState', CONTRACT).ownedId;
for (let i = 0; i < 400; i++) big.sheet('Roster').appendRow([`big${i}@students.mtmorrisschools.org`, `First${i} Last${i}`, `Period ${1 + (i % 6)}`, '', i < 150, false, '']);
big.newRequest(); const bigConnect = big.call('teacherConnectSchoolDirectory', bigDirectory, '', '', CONTRACT);
big.call('teacherConnectSchoolDirectory', bigDirectory, 'USE SCHOOL DIRECTORY', bigConnect.preview.revision, CONTRACT);
let propertyReads = 0; const realGet = big.properties.getProperty;
big.properties.getProperty = (key) => { propertyReads += 1; return realGet(key); };
big.signOut(); big.newRequest();
try { big.call('identifyWithPin', '200003', 'speed-device'); } catch (error) { assert.doesNotMatch(error.message, /did not match/, 'Directory PIN still matches'); }
big.properties.getProperty = realGet;
assert.ok(propertyReads <= 20, `One PIN entry read the property store ${propertyReads} times with 400 roster rows`);
const reviewRoom = room('synthetic-review-workbook', 'directory.review@mtmorrisschools.org');
const twins = '13579\nNorth, Avery\n24680\nNorth, Avery';
const twinMap = '13579,avery.one@students.mtmorrisschools.org\n24680,avery.two@students.mtmorrisschools.org';
const twinPreview = reviewRoom.call('teacherImportSchoolDirectory', twins, twinMap, '', '', CONTRACT);
assert.equal(twinPreview.preview.membershipsCreated, 0);
assert.equal(twinPreview.preview.reviewOpen, 2);
const twinImported = reviewRoom.call('teacherImportSchoolDirectory', twins, twinMap, 'IMPORT SCHOOL DIRECTORY', twinPreview.preview.revision, CONTRACT);
assert.equal(twinImported.applied, true);
assert.equal(reviewRoom.sheet('Roster').getLastRow(), 1);
const reviewState = reviewRoom.call('teacherGetSchoolDirectoryState', CONTRACT);
assert.equal(reviewState.reviewOpen, 2);
assert.equal(reviewState.applicationVersion, '1.0.0-rc.1');
assert.equal(reviewState.packageVersion, '1.0.0-rc.2');
assert.equal(reviewState.automaticSoftwareUpdates, false);
const reviewSheet = workbooks.get(reviewState.ownedId).getSheetByName('Directory Review');
const reviewRows = reviewSheet.dataRows().filter((row) => row[1]);
assert.equal(reviewRows.length, 2);
assert.ok(reviewRows.every((row) => row[0] === 'DUPLICATE_DISPLAY_NAME' && row[3] === 'OPEN'));
const reviewClass = room('synthetic-review-class', 'teacher.review@mtmorrisschools.org');
const reviewConnect = reviewClass.call('teacherConnectSchoolDirectory', reviewState.ownedId, '', '', CONTRACT);
reviewClass.call('teacherConnectSchoolDirectory', reviewState.ownedId, 'USE SCHOOL DIRECTORY', reviewConnect.preview.revision, CONTRACT);
assert.throws(() => reviewClass.call('teacherEnrollSchoolStudent', '13579', 'Period 1', CONTRACT), /review/);
reviewClass.signOut(); reviewClass.newRequest();
assert.throws(() => reviewClass.call('identifyWithPin', '13579', 'review-device'), /did not match/);
assert.throws(() => reviewClass.call('identifyWithPin', '24680', 'review-device-2'), /did not match/);
const keptId = workbooks.get(reviewState.ownedId).getSheetByName('School Directory').getRange(2, 1).getValue();
assert.throws(() => reviewRoom.call('teacherCorrectDirectoryPinByName', 'North, Avery', '11111', CONTRACT), /name-only/i);
assert.equal(workbooks.get(reviewState.ownedId).getSheetByName('School Directory').getRange(2, 1).getValue(), keptId);
const resolvePreview = reviewRoom.call('teacherResolveDirectoryReview', '13579', '', '', CONTRACT);
reviewRoom.call('teacherResolveDirectoryReview', '13579', 'RESOLVE DIRECTORY REVIEW', resolvePreview.preview.revision, CONTRACT);
assert.equal(reviewRoom.call('teacherGetSchoolDirectoryState', CONTRACT).reviewOpen, 1);
reviewClass.signInAs('teacher.review@mtmorrisschools.org'); reviewClass.newRequest();
reviewClass.call('teacherEnrollSchoolStudent', '13579', 'Period 1', CONTRACT);
assert.throws(() => reviewClass.call('teacherEnrollSchoolStudent', '24680', 'Period 1', CONTRACT), /review/);
reviewClass.signOut(); reviewClass.newRequest();
assert.equal(reviewClass.call('identifyWithPin', '13579', 'review-ok').student.key, reviewClass.call('getRoster_').find((row) => row.email === 'avery.one@students.mtmorrisschools.org').key);
assert.throws(() => reviewClass.call('identifyWithPin', '24680', 'review-still'), /did not match/);
console.log('PASS: school directory import, exact text IDs, credential generation, duplicate-name review, two independent rooms, inactive membership, corrections, revocation, privacy, stale previews, nonce-resistant persistent throttling and roster-independent request cost.');
