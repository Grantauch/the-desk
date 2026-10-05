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
  assert.deepEqual(names.sort(), ['Drafts', 'Load Test', 'Turn Ins']);
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

test('student facing messages avoid hyphens and semicolons', () => {
  const source = fs.readFileSync(CODE, 'utf8');
  const messages = [...source.matchAll(/refuse_\('[a-z_]+', '([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(messages.length >= 8);
  messages.forEach((m) => assert.doesNotMatch(m, /[;—–]| - /, m));
});

/* --------------------------------------------------- hubs load the saver -- */

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

console.log(`${failures ? 'FAIL' : 'PASS'}  turn in web app  (${passed}/${passed + failures})`);
if (failures) process.exit(1);
