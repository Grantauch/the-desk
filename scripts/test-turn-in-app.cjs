/**
 * the desk · Turn In web app suite.
 *
 * Runs apps-script/turn-in/Code.gs inside the same fake Apps Script runtime the
 * Hall Pass suite uses. The roster comes from the Hall Pass fixtures, so every
 * PIN below was generated and hashed by the real Hall Pass code. That makes the
 * first test a true compatibility check: a PIN that works for a hall pass must
 * work for Turn In. Every student is invented and nothing contacts Google.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { world, PEOPLE, CODE } = require('./lib/turn-in-harness.cjs');

const MANIFEST = path.join(__dirname, '..', 'apps-script', 'turn-in', 'appsscript.json');

let failures = 0;
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${name}`);
    String(error && error.stack || error).split('\n').slice(0, 6).forEach((line) => console.log(`      ${line}`));
  }
}

const answers = (...pairs) => pairs.map(([k, q, a]) => ({ k, q, a }));
const ONE = answers(['id:q1', 'What did Robinson promise Rickey?', 'Three years of silence.'], ['id:q2', 'Who led the abuse?', '']);

/* ------------------------------------------------------------------ tests -- */

test('manifest serves anonymous visitors and runs as the teacher', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.timeZone, 'America/Detroit');
});

test('setup refuses to run before the roster and salt are filled in', () => {
  const w = world({ configure: false });
  assert.throws(() => w.sandbox.setup(), /ROSTER_SPREADSHEET_ID/);
  w.h.properties.setProperty('ROSTER_SPREADSHEET_ID', 'roster-book');
  assert.throws(() => w.sandbox.setup(), /PIN_SALT/);
  const health = JSON.parse(w.sandbox.doGet().text);
  assert.equal(health.ready, false);
});

test('setup builds the private workbook, its tabs and the nightly cleanup', () => {
  const w = world();
  const names = w.book().getSheets().map((s) => s.getName());
  assert.deepEqual(names.sort(), ['Classroom Links', 'Drafts', 'Load Test', 'Load Test Progress', 'Progress', 'Review Roster', 'Turn Ins']);
  assert.equal(w.book().getSheetByName('Turn Ins').getRange(1, 1, 1, 12).getValues()[0][8], 'Answers');
  assert.equal(w.h.state.triggers.filter((t) => t.handler === 'pruneDrafts').length, 1);
  w.sandbox.setup();
  assert.equal(w.h.state.triggers.filter((t) => t.handler === 'pruneDrafts').length, 1, 'running setup twice keeps one trigger');
  assert.equal(JSON.parse(w.sandbox.doGet().text).ready, true);
});

test('a PIN made by Hall Pass signs a student in to Turn In', () => {
  const w = world();
  const result = w.post({ action: 'signin', pin: w.pin(PEOPLE.ada), hub: 'bts-the-bargain', course: 'bts', device: 'cb-1' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.firstName, 'Ada');
  assert.equal(result.classPeriod, 'Period 1');
  assert.deepEqual(result.classes, ['Period 1']);
  assert.equal(result.draft, null);
  assert.ok(result.token);
});

test('a wrong PIN is refused, and repeated misses slow that Chromebook only', () => {
  const w = world();
  const real = w.pin(PEOPLE.ada);
  const wrong = real === '111111' ? '222222' : '111111';
  const first = w.post({ action: 'signin', pin: wrong, hub: 'x', device: 'cb-9' });
  assert.equal(first.ok, false);
  assert.equal(first.code, 'bad_pin');
  for (let i = 0; i < 7; i += 1) w.post({ action: 'signin', pin: wrong, hub: 'x', device: 'cb-9' });
  const locked = w.post({ action: 'signin', pin: real, hub: 'x', device: 'cb-9' });
  assert.equal(locked.code, 'slow_down');
  assert.equal(w.post({ action: 'signin', pin: real, hub: 'x', device: 'cb-2' }).ok, true);
  w.clock.advanceMinutes(11);
  assert.equal(w.post({ action: 'signin', pin: real, hub: 'x', device: 'cb-9' }).ok, true, 'the pause ends');
});

test('a flood of wrong PINs across devices pauses Turn In for everyone', () => {
  const w = world();
  const real = w.pin(PEOPLE.grace);
  const wrong = real === '333333' ? '444444' : '333333';
  for (let i = 0; i < 60; i += 1) w.post({ action: 'signin', pin: wrong, hub: 'x', device: `d${i}` });
  assert.equal(w.post({ action: 'signin', pin: real, hub: 'x', device: 'fresh' }).code, 'slow_down');
});

test('a student marked inactive on the roster cannot turn in', () => {
  const w = world();
  const pin = w.pin(PEOPLE.katherine);
  const roster = w.school.harness.sheet('Roster');
  const row = roster.getRange(2, 1, roster.getLastRow() - 1, 1).getValues().findIndex((r) => r[0] === PEOPLE.katherine.email) + 2;
  roster.getRange(row, 5).setValue(false);
  w.h.state.cache.clear();
  assert.equal(w.post({ action: 'signin', pin, hub: 'x', device: 'a' }).ok, false);
  const result = w.post({ action: 'turnin', pin, hub: 'x', submissionId: 'k', answers: ONE, device: 'a' });
  assert.equal(result.ok, false);
  assert.equal(w.rows('Turn Ins').length, 0);
});

test('Turn In writes one complete row the teacher can read', () => {
  const w = world();
  const result = w.post({
    action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'bts-the-bargain', course: 'bts', title: 'The Bargain',
    page: '/hubs/bts-the-bargain.html', submissionId: 'sub-1', answers: ONE, device: 'a',
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.firstName, 'Ada');
  assert.equal(result.classPeriod, 'Period 1');
  assert.equal(result.answered, 1);
  const [row] = w.rows('Turn Ins');
  assert.equal(row['Student Name'], 'Byron, Ada');
  assert.equal(row['Student Email'], PEOPLE.ada.email);
  assert.equal(row['Class / Period'], 'Period 1');
  assert.equal(row.Hub, 'bts-the-bargain');
  assert.equal(row['Hub Title'], 'The Bargain');
  assert.equal(row.Answered, '1 of 2');
  assert.equal(row.Words, 4);
  assert.match(row.Answers, /1\. What did Robinson promise Rickey\?\nThree years of silence\./);
  assert.match(row.Answers, /2\. Who led the abuse\?\n\(blank\)/);
  assert.ok(row['Turned In'] instanceof Date);
});

test('a retried Turn In with the same submission id never makes a second row', () => {
  const w = world();
  const body = { action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'same', answers: ONE, device: 'a' };
  const a = w.post(body);
  const b = w.post(body);
  assert.equal(a.ok, true);
  assert.deepEqual(b, a);
  assert.equal(w.rows('Turn Ins').length, 1);
  w.post({ ...body, submissionId: 'new-version' });
  assert.equal(w.rows('Turn Ins').length, 2, 'a real second turn in is kept');
});

test('a busy sheet refuses cleanly, writes nothing, and the same press works on retry', () => {
  const w = world();
  const body = { action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'busy-1', answers: ONE, device: 'a' };
  w.h.state.lock.held = true;
  const busy = w.post(body);
  w.h.state.lock.held = false;
  assert.equal(busy.code, 'busy', JSON.stringify(busy));
  assert.equal(w.rows('Turn Ins').length, 0);
  assert.equal(w.post(body).ok, true);
  assert.equal(w.rows('Turn Ins').length, 1);
});

test('every sheet write happens under the script lock', () => {
  const source = fs.readFileSync(CODE, 'utf8');
  const body = source.slice(source.indexOf('function saveDraft_'), source.indexOf('/* --------------------------------------------------------------- identity'));
  assert.ok(body.indexOf('tryLock') < body.indexOf('drafts.appendRow'), 'draft write is locked');
  assert.ok(body.indexOf('tryLock(TI_TURNIN_LOCK_MS)') < body.indexOf('turnInRow_(sheet,'), 'turn in write is locked');
  assert.match(source, /function turnInRow_[^}]*SpreadsheetApp\.flush\(\)/);
});

test('a student in two classes is asked which one, then lands in the right one', () => {
  const w = world();
  const base = { action: 'turnin', pin: w.pin(PEOPLE.alan), hub: 'h', submissionId: 's', answers: ONE, device: 'a' };
  const ask = w.post(base);
  assert.equal(ask.ok, false);
  assert.equal(ask.code, 'pick_class');
  assert.deepEqual(ask.classes, ['Period 1', 'Period 5']);
  assert.equal(w.rows('Turn Ins').length, 0);
  const done = w.post({ ...base, classPeriod: 'Period 5' });
  assert.equal(done.ok, true);
  assert.equal(w.rows('Turn Ins')[0]['Class / Period'], 'Period 5');
  const forged = w.post({ ...base, submissionId: 's2', classPeriod: 'Period 9' });
  assert.equal(forged.code, 'pick_class', 'a class the student is not in is ignored');
});

test('the hub course picks the class when the class names say which course they are', () => {
  const w = world({ memberships: [[PEOPLE.ada, '2nd Hour US History'], [PEOPLE.ada, '6th Hour Hidden History']] });
  const r = w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'hh-room-1018a', course: 'hh', submissionId: 's', answers: ONE, device: 'a' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.classPeriod, '6th Hour Hidden History');
});

test('autosaved work comes back on another Chromebook, from cache and from the sheet', () => {
  const w = world();
  const pin = w.pin(PEOPLE.grace);
  const signin = w.post({ action: 'signin', pin, hub: 'ush9-the-jungle', device: 'cart-a' });
  const saved = w.post({ action: 'save', token: signin.token, hub: 'ush9-the-jungle', answers: answers(['id:q1', 'Q', 'Draft one']) });
  assert.equal(saved.ok, true);
  assert.equal(w.rows('Drafts').length, 1);

  const back = w.post({ action: 'signin', pin, hub: 'ush9-the-jungle', device: 'cart-b' });
  assert.equal(back.draft.answers[0].a, 'Draft one');

  w.h.state.cache.clear();
  const tomorrow = w.post({ action: 'signin', pin, hub: 'ush9-the-jungle', device: 'cart-c' });
  assert.equal(tomorrow.draft.answers[0].a, 'Draft one', 'falls back to the Drafts sheet after the cache expires');

  const other = w.post({ action: 'signin', pin, hub: 'ush9-the-other-half', device: 'cart-c' });
  assert.equal(other.draft, null, 'drafts are per hub');
});

test('the newest of draft and turn in is what comes back', () => {
  const w = world();
  const pin = w.pin(PEOPLE.ada);
  const s = w.post({ action: 'signin', pin, hub: 'h', device: 'a' });
  w.post({ action: 'save', token: s.token, hub: 'h', answers: answers(['k', 'Q', 'older draft']) });
  w.clock.advanceMinutes(5);
  w.post({ action: 'turnin', pin, hub: 'h', submissionId: 'z', answers: answers(['k', 'Q', 'final answer']), device: 'a' });
  w.h.state.cache.clear();
  const back = w.post({ action: 'signin', pin, hub: 'h', device: 'b' });
  assert.equal(back.draft.answers[0].a, 'final answer');
  assert.equal(back.draft.turnedIn, true);
});

test('a forged or expired token cannot save', () => {
  const w = world();
  const s = w.post({ action: 'signin', pin: w.pin(PEOPLE.ada), hub: 'h', device: 'a' });
  const [body, sig] = s.token.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ e: PEOPLE.grace.email, t: 0, x: 9999999999 })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(w.post({ action: 'save', token: `${forgedBody}.${sig}`, hub: 'h', answers: ONE }).code, 'signed_out');
  assert.equal(w.post({ action: 'save', token: `${body}.x${sig}`, hub: 'h', answers: ONE }).code, 'signed_out');
  w.clock.advanceMinutes(4 * 60 + 1);
  assert.equal(w.post({ action: 'save', token: s.token, hub: 'h', answers: ONE }).code, 'signed_out');
  assert.equal(w.rows('Drafts').length, 0);
});

test('oversized or malformed requests get a plain answer, not a crash', () => {
  const w = world();
  assert.equal(w.post('{not json').code, 'bad_request');
  assert.equal(w.post({ action: 'explode' }).code, 'bad_request');
  assert.equal(w.post({ action: 'signin', pin: w.pin(PEOPLE.ada), hub: '../../etc', device: 'a' }).code, 'bad_request');
  const many = Array.from({ length: 81 }, (_, i) => ({ k: `k${i}`, q: 'q', a: 'a' }));
  assert.equal(w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'm', answers: many, device: 'a' }).code, 'too_big');
  const long = Array.from({ length: 10 }, (_, i) => ({ k: `k${i}`, q: 'q', a: 'x'.repeat(5000) }));
  assert.equal(w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'l', answers: long, device: 'a' }).code, 'too_big');
  const fine = Array.from({ length: 8 }, (_, i) => ({ k: `k${i}`, q: 'q', a: 'word '.repeat(150) }));
  assert.equal(w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'f', answers: fine, device: 'a' }).ok, true, 'eight 150 word answers fit');
});

test('the load test writes only to its own tab and only while switched on', () => {
  const w = world();
  const off = w.post({ action: 'turnin', pin: '900001', test: 'nope', hub: 'h', submissionId: 'a', answers: ONE, device: 'a' });
  assert.equal(off.ok, false);
  const key = w.sandbox.startLoadTest();
  const on = w.post({ action: 'turnin', pin: '900001', test: key, hub: 'h', submissionId: 'b', answers: ONE, device: 'a' });
  assert.equal(on.ok, true, JSON.stringify(on));
  assert.equal(w.rows('Load Test').length, 1);
  assert.equal(w.rows('Turn Ins').length, 0);
  assert.equal(w.rows('Drafts').length, 0);
  w.sandbox.stopLoadTest();
  assert.equal(w.post({ action: 'turnin', pin: '900002', test: key, hub: 'h', submissionId: 'c', answers: ONE, device: 'a' }).ok, false);
});

test('nightly cleanup drops old drafts and never touches turn ins', () => {
  const w = world();
  const pin = w.pin(PEOPLE.ada);
  const s = w.post({ action: 'signin', pin, hub: 'h', device: 'a' });
  w.post({ action: 'save', token: s.token, hub: 'h', answers: ONE });
  w.post({ action: 'turnin', pin, hub: 'h', submissionId: 'q', answers: ONE, device: 'a' });
  w.clock.advanceDays(31);
  const s2 = w.post({ action: 'signin', pin, hub: 'h', device: 'a' });
  w.post({ action: 'save', token: s2.token, hub: 'h', answers: answers(['k', 'Q', 'new']) });
  w.sandbox.pruneDrafts();
  assert.equal(w.rows('Drafts').length, 1);
  assert.equal(w.rows('Turn Ins').length, 1);
});

function savedDraft(w, person = PEOPLE.ada, text = 'Forgot the button', extra = {}) {
  const login = w.post({ action: 'signin', pin: w.pin(person), hub: 'h', device: 'test' });
  const request = { action: 'save', token: login.token, hub: 'h', title: 'Test Hub', page: '/hubs/h.html', answers: answers(['k', 'Question?', text]), ...extra };
  const result = w.post(request);
  assert.equal(result.ok, true, JSON.stringify(result));
  return request;
}

test('setup removes automatic finishing and preserves saved work across repeated setup', () => {
  const w = world();
  w.sandbox.ScriptApp.newTrigger('autoTurnIn').timeBased().everyMinutes(15).create();
  savedDraft(w);
  w.sandbox.setup();
  w.sandbox.setup();
  assert.equal(w.h.state.triggers.filter(t => t.handler === 'autoTurnIn').length, 0);
  assert.equal(w.rows('Progress')[0].Status, 'In progress');
  assert.equal(w.rows('Drafts').length, 1);
  assert.equal(w.sandbox.autoTurnIn(), 0);
});

test('progress updates one row, survives cache eviction and never declares finished after closing', () => {
  const w = world();
  savedDraft(w);
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.ada, 'More work');
  w.h.state.cache.clear();
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.ada, 'Latest work');
  assert.equal(w.rows('Progress').length, 1);
  assert.match(w.rows('Progress')[0].Answers, /Latest work/);
  w.clock.advanceMinutes(31);
  assert.equal(w.sandbox.autoTurnIn(), 0);
  assert.equal(w.rows('Turn Ins').length, 0);
  const back = w.post({ action: 'signin', pin: w.pin(PEOPLE.ada), hub: 'h' });
  assert.equal(back.draft.turnedIn, false);
  assert.equal(back.draft.answers[0].a, 'Latest work');
});

test('finished snapshots survive further progress and a second deliberate submission', () => {
  const w = world();
  const request = savedDraft(w);
  const turn = { action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', classPeriod: 'Period 1', submissionId: 'manual', answers: request.answers };
  assert.equal(w.post(turn).ok, true);
  assert.equal(w.rows('Progress')[0].Status, 'Finished');
  const finishedAt = JSON.parse(w.rows('Progress')[0].Data).finishedAt;
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.ada, 'Revised answer');
  assert.equal(w.rows('Progress')[0].Status, 'In progress');
  assert.equal(JSON.parse(w.rows('Progress')[0].Data).finishedAt, finishedAt);
  assert.match(w.rows('Turn Ins')[0].Answers, /Forgot the button/);
  assert.equal(w.rows('Turn Ins').length, 1);
  w.h.state.cache.clear();
  assert.equal(w.post(turn).ok, true); // delayed retry must not erase newer progress
  assert.match(w.rows('Progress')[0].Answers, /Revised answer/);
  assert.equal(w.rows('Progress')[0].Status, 'In progress');
  assert.equal(w.post({ ...turn, submissionId: 'manual-2', answers: answers(['k', 'Question?', 'Revised answer']) }).ok, true);
  assert.equal(w.rows('Turn Ins').length, 2);
  assert.equal(w.rows('Progress').length, 1);
  assert.equal(w.rows('Progress')[0].Status, 'Finished');
});

test('unchanged autosave after finishing keeps Finished and records the original finish time', () => {
  const w = world();
  const request = savedDraft(w);
  w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'manual', answers: request.answers });
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.ada, '', { answers: [...request.answers, { k: 'hidden', q: 'Hidden', a: '' }] });
  assert.equal(w.rows('Progress')[0].Status, 'Finished');
  assert.equal(w.rows('Turn Ins').length, 1);
  const back = w.post({ action: 'signin', pin: w.pin(PEOPLE.ada), hub: 'h' });
  assert.equal(back.draft.turnedIn, true);
  assert.notEqual(back.draft.savedAt, back.draft.finishedAt);
});

test('blank and unassigned work stays draft; clearing existing work updates current progress', () => {
  const w = world();
  savedDraft(w, PEOPLE.ada, '   ');
  savedDraft(w, PEOPLE.alan);
  assert.equal(w.rows('Progress').length, 0);
  savedDraft(w, PEOPLE.ada, 'Something');
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.ada, '');
  assert.equal(w.rows('Progress').length, 1);
  assert.equal(w.rows('Progress')[0].Answered, '0 of 1');
  assert.equal(w.rows('Progress')[0].Status, 'In progress');
});

test('only enrolled classes produce progress and each class has its own row', () => {
  const w = world();
  savedDraft(w, PEOPLE.alan, 'Work', { classPeriod: 'Period 99' });
  assert.equal(w.rows('Progress').length, 0);
  savedDraft(w, PEOPLE.alan, 'Work', { classPeriod: 'Period 5' });
  savedDraft(w, PEOPLE.alan, 'Other class', { classPeriod: 'Period 1' });
  assert.equal(w.rows('Progress').length, 2);
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.alan, 'Newest first row', { classPeriod: 'Period 5' });
  w.h.state.cache.clear();
  const back = w.post({ action: 'signin', pin: w.pin(PEOPLE.alan), hub: 'h' });
  assert.equal(back.draft.answers[0].a, 'Newest first row');
});

test('35 students update current progress without duplicate rows after interrupted writes', () => {
  const { crowd } = require('./lib/turn-in-harness.cjs');
  const students = crowd(35);
  const w = world({ memberships: students });
  students.forEach(([person]) => savedDraft(w, person));
  w.clock.advanceMinutes(1);
  students.forEach(([person]) => savedDraft(w, person, 'Revised'));
  assert.equal(w.rows('Progress').length, 35);
  assert.equal(w.rows('Turn Ins').length, 0);
  assert.equal(new Set(w.rows('Progress').map(row => row['Student Email'])).size, 35);
  const original = w.sandbox.SpreadsheetApp.flush;
  w.sandbox.SpreadsheetApp.flush = () => { throw new Error('lost response'); };
  assert.throws(() => savedDraft(w, students[0][0], 'Interrupted'));
  w.sandbox.SpreadsheetApp.flush = original;
  w.h.state.cache.clear();
  savedDraft(w, students[0][0], 'Interrupted');
  assert.equal(w.rows('Progress').length, 35);
});

test('first upgrade migrates latest drafts and manual finishes without changing original history', () => {
  const w = world();
  const request = savedDraft(w);
  w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'manual', answers: request.answers });
  w.clock.advanceMinutes(1);
  savedDraft(w, PEOPLE.ada, 'New draft');
  w.book().getSheetByName('Progress').getRange(2, 1, 1, 14).clearContent();
  w.h.properties.deleteProperty('PROGRESS_V7_MIGRATED');
  w.h.state.cache.clear();
  w.sandbox.setup();
  const current = w.rows('Progress').filter(row => row.Status);
  assert.equal(current.length, 1);
  assert.equal(current[0].Status, 'In progress');
  assert.match(current[0].Answers, /New draft/);
  assert.ok(current[0]['Last Finished']);
  assert.equal(w.rows('Turn Ins').length, 1);
  assert.equal(w.rows('Drafts').length, 2);
});

test('large finished answers keep progress metadata below the Sheets cell limit', () => {
  const w = world();
  const large = Array.from({ length: 7 }, (_, i) => ({ k: 'q' + i, q: 'Question', a: 'x'.repeat(6000) }));
  assert.equal(w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'h', submissionId: 'large-finish', answers: large }).ok, true);
  assert.ok(w.rows('Progress')[0].Data.length < 50000);
  assert.equal(w.rows('Progress')[0].Status, 'Finished');
});

test('editor release proof stays isolated from student progress and submissions', () => {
  const w = world();
  w.sandbox.verifyProgressRelease();
  assert.equal(w.rows('Load Test Progress').length, 35);
  assert.equal(w.rows('Load Test').length, 35);
  assert.equal(w.rows('Progress').length, 0);
  assert.equal(w.rows('Turn Ins').length, 0);
  assert.equal(w.h.properties.getProperty('LOAD_TEST_KEY'), null);
});

test('student facing messages avoid hyphens and semicolons', () => {
  const source = fs.readFileSync(CODE, 'utf8');
  const messages = [...source.matchAll(/refuse_\('[a-z_]+', '([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(messages.length >= 8);
  messages.forEach((m) => assert.doesNotMatch(m, /[;—–]| - /, m));
});

/* --------------------------------------------------- hubs load the saver -- */

test('a busy draft is not reported as saved and never reaches cache', () => {
  const w = world();
  const session = w.post({action:'signin',pin:w.pin(PEOPLE.ada),hub:'h'});
  w.h.state.lock.held = true;
  assert.equal(w.post({action:'save',token:session.token,hub:'h',answers:ONE}).code,'busy');
  w.h.state.lock.held = false;
  assert.equal(w.rows('Drafts').length,0);
  assert.equal(w.post({action:'signin',pin:w.pin(PEOPLE.ada),hub:'h'}).draft,null);
  assert.equal(w.post({action:'save',token:session.token,hub:'h',answers:ONE}).ok,true);
  w.h.state.cache.clear();
  assert.equal(w.post({action:'signin',pin:w.pin(PEOPLE.ada),hub:'h'}).draft.answers[0].a,ONE[0].a);
});

test('retrying after cache eviction remains durable and authenticates the student', () => {
  const w = world();
  const body={action:'turnin',pin:w.pin(PEOPLE.ada),hub:'h',submissionId:'durable',answers:ONE};
  assert.equal(w.post(body).ok,true);
  assert.equal(w.post({...body,pin:'not-a-pin'}).ok,false);
  w.h.state.cache.clear();
  assert.equal(w.post(body).ok,true);
  assert.equal(w.rows('Turn Ins').length,1);
  assert.equal(w.post({...body,pin:w.pin(PEOPLE.grace)}).ok,false);
  assert.equal(w.rows('Turn Ins').length,1);
});

test('oversized single answers and duplicate field keys cannot be silently truncated', () => {
  const w = world(),base={action:'turnin',pin:w.pin(PEOPLE.ada),hub:'h',submissionId:'big'};
  assert.equal(w.post({...base,answers:answers(['a','Q','x'.repeat(6001)])}).code,'too_big');
  assert.equal(w.post({...base,answers:answers(['a','Q','ok'],['a','Q2','also'])}).code,'bad_request');
  assert.equal(w.rows('Turn Ins').length,0);
});

test('spreadsheet titles beginning with equals remain literal text', () => {
  const w=world();
  assert.equal(w.post({action:'turnin',pin:w.pin(PEOPLE.ada),hub:'h',title:'=1+1',submissionId:'formula',answers:ONE}).ok,true);
  assert.equal(w.rows('Turn Ins')[0]['Hub Title'],"'=1+1");
});

const HUBS = path.join(__dirname, '..', 'public', 'hubs');
// Game boards whose text boxes are team names or scores, not student answers.
const NOT_ANSWER_PAGES = new Set(['classroom-jeopardy.html', 'jeopardy-hidden-history-unit1.html', 'jeopardy-scoreboard-unit1.html']);

test('every hub with answer boxes loads desk-save.js', () => {
  const missing = fs.readdirSync(HUBS)
    .filter((name) => name.endsWith('.html') && !NOT_ANSWER_PAGES.has(name))
    .filter((name) => /<textarea\b/i.test(fs.readFileSync(path.join(HUBS, name), 'utf8')))
    .filter((name) => !/<script src="\/hubs\/desk-save\.js" defer><\/script>/.test(fs.readFileSync(path.join(HUBS, name), 'utf8')));
  assert.deepEqual(missing, [], 'Add <script src="/hubs/desk-save.js" defer></script> before </body> in these hubs');
});

test('desk-save.js points at an Apps Script web app or at nothing', () => {
  const source = fs.readFileSync(path.join(HUBS, 'desk-save.js'), 'utf8');
  const match = source.match(/var ENDPOINT = '([^']*)';/);
  assert.ok(match, 'ENDPOINT line is present');
  assert.match(match[1], /^(|https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec)$/);
});

test('Classroom handoff uses the exact enrolled class and never writes Classroom status', () => {
  const w = world();
  const links = w.book().getSheetByName('Classroom Links');
  links.appendRow(['Period 1', 'bts-the-bargain', 'https://classroom.google.com/c/COURSE1/a/ASSIGNMENT1/details', 'The Bargain']);
  links.appendRow(['Period 5', 'bts-the-bargain', 'https://classroom.google.com/c/COURSE5/a/ASSIGNMENT5/details', 'The Bargain']);
  assert.equal(w.post({ action: 'signin', pin: w.pin(PEOPLE.ada), hub: 'bts-the-bargain' }).classroomUrl, 'https://classroom.google.com/c/COURSE1/a/ASSIGNMENT1/details');
  const result = w.post({ action: 'turnin', pin: w.pin(PEOPLE.alan), hub: 'bts-the-bargain', classPeriod: 'Period 5', submissionId: 'classroom-proof-1', answers: ONE });
  assert.equal(result.ok, true);
  assert.equal(result.classroomUrl, 'https://classroom.google.com/c/COURSE5/a/ASSIGNMENT5/details');
  assert.equal(w.rows('Turn Ins')[0]['Class / Period'], 'Period 5');
  assert.equal(w.post({ action: 'classroom-links', token: result.token }).ok, false, 'student routes cannot edit teacher configuration');
});

test('ambiguous and unsafe Classroom links are omitted while finished work still lands', () => {
  const w = world();
  const links = w.book().getSheetByName('Classroom Links');
  links.appendRow(['Period 1', 'bts-the-bargain', 'https://classroom.google.com/c/ONE/a/ONE/details']);
  links.appendRow(['Period 1', 'bts-the-bargain', 'https://classroom.google.com/c/TWO/a/TWO/details']);
  links.appendRow(['Period 1', 'hh-test', 'https://classroom.google.com.evil.example/c/ONE/a/ONE/details']);
  assert.equal(w.sandbox.classroomLink_('bts-the-bargain', 'Period 1'), '');
  assert.equal(w.sandbox.classroomLink_('hh-test', 'Period 1'), '');
  assert.equal(w.sandbox.classroomLink_('bts-the-bargain', 'Period 2'), '');
  const result = w.post({ action: 'turnin', pin: w.pin(PEOPLE.ada), hub: 'bts-the-bargain', submissionId: 'classroom-proof-2', answers: ONE });
  assert.equal(result.ok, true);
  assert.equal(result.classroomUrl, '');
  assert.equal(w.rows('Turn Ins').length, 1);
});

test('review membership refreshes from the active roster without changing source or student work', () => {
  const w = world();
  const original = JSON.stringify(w.school.harness.spreadsheet.getSheetByName('Roster').records());
  assert.equal(w.rows('Review Roster').length, 5);
  w.book().getSheetByName('Classroom Links').appendRow(['Period 1', 'bts-the-bargain', 'https://classroom.google.com/c/ONE/a/ONE/details']);
  w.sandbox.setup();
  w.sandbox.refreshTeacherReview();
  assert.equal(w.rows('Review Roster').length, 5, 'refresh does not append duplicate memberships');
  assert.equal(JSON.stringify(w.school.harness.spreadsheet.getSheetByName('Roster').records()), original);
  assert.equal(w.rows('Classroom Links').length, 1, 'setup preserves teacher links');
  assert.equal(w.h.state.triggers.filter((t) => t.handler === 'refreshTeacherReview').length, 1);
});

console.log(`${failures ? 'FAIL' : 'PASS'}  turn in web app  (${passed}/${passed + failures})`);
if (failures) process.exit(1);
