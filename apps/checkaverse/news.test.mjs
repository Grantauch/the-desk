// The living world's news: the director's checks (against a fake model), the Gazette's naming rules, residents'
// letters, and the whole thing end to end, including the teacher's pause switch.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';
import { checkLine, factsFrom, runDirector } from './director.mjs';
import { composeGazette, composeMail, loadNewsContent, openNews } from './town-news.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const step = (label) => console.log('  ok', label);
const read = (f) => JSON.parse(fs.readFileSync(path.join(HERE, 'content', f), 'utf8'));
const D = read('director.json'), WORLD = read('world.json'), SPECIES = read('battle/species.json').species;
const NC = loadNewsContent(path.join(HERE, 'content'));
const names = new Set(['Nell', 'Bram', 'Mochi']);

// ---------- the line checks ----------
assert.equal(checkLine('The roses loved all that rain yesterday.', D, names), '');
assert.equal(checkLine('Bram and I watered the garden before the bus came.', D, names), '');
assert.equal(checkLine("The creek was calm, and I'm ready for another day.", D, names), '', "I'm is not a name");
assert.match(checkLine('That was a stupid battle.', D, names), /blocked/);
assert.match(checkLine('I hope nobody got sick out there today.', D, names), /blocked/);
assert.match(checkLine('Did you see Jake catch one yesterday?', D, names), /unknown name/);
assert.match(checkLine('We caught 12 of them!', D, names), /numbers/);
assert.match(checkLine('Hi.', D, names), /short/);
assert.match(checkLine('x'.repeat(200), D, names), /long/);
assert.match(checkLine('Great day <script>', D, names), /characters/);
const facts = factsFrom([{ kind: 'catch', data: {} }, { kind: 'death', data: { species: 'mochi' } }, { kind: 'spar', data: { a: 'Bram', b: 'Tess', winner: 'Bram' } }], (s) => s);
assert.ok(!/die|death|lost/i.test(facts), 'the model never hears about deaths');
assert.match(facts, /Bram beat Tess/);
step('every director line is checked for length, characters, numbers, blocked words and names');

// ---------- the director, against a fake model ----------
{
  const answers = [];
  const fake = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => { const p = JSON.parse(body); const a = answers.shift() ?? 'NO'; res.end(JSON.stringify({ response: p.think === false ? a : 'thinking' })); });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${fake.address().port}/api/generate`;
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)');
  openNews(db, () => '2026-11-17').record('catch', { trainer: 'Brave Otter', species: 'zee', level: 4 });
  db.prepare("UPDATE world_events SET day = '2026-11-16'").run();
  // Three residents: one good line that passes the mock test, one with a blocked word, one the mock test catches.
  answers.push('The tall grass was busy with catches yesterday!', 'NO', 'That was a dumb day at the market.', 'What a great day for the bus route.', 'YES');
  const quiet = () => {};
  const r = await runDirector({ db, D: { ...D, url, quotes: 3 }, world: WORLD, species: SPECIES, day: '2026-11-17', log: quiet, rand: () => 0.5 });
  assert.deepEqual(r.lines.map((l) => l.status), ['live', 'dropped', 'dropped']);
  assert.match(r.lines[1].reason, /blocked/);
  assert.match(r.lines[2].reason, /mock test/);
  const news = openNews(db, () => '2026-11-17');
  assert.equal(news.liveLines('2026-11-17').length, 1);
  assert.equal((await runDirector({ db, D: { ...D, url }, world: WORLD, species: SPECIES, day: '2026-11-17', log: quiet })).lines.length, 0, 'it runs once a night');
  db.prepare("INSERT INTO meta (key, value) VALUES ('director:paused', '1')").run();
  assert.ok((await runDirector({ db, D: { ...D, url }, world: WORLD, species: SPECIES, day: '2026-11-18', log: quiet })).paused);
  assert.equal(news.lines('2026-11-18').length, 0, 'a paused director writes nothing');
  fake.close();
  step('the director keeps only lines that pass every check and the mock test, runs once a night, and stops when paused');
}

// ---------- the paper and the letters ----------
{
  const ev = (kind, data) => ({ kind, data });
  const paper = composeGazette(NC.gazette, [
    ev('death', { species: 'mochi', hour: '2nd Hour' }), ev('death', { species: 'zee', hour: '2nd Hour' }),
    ev('catch', { trainer: 'Brave Otter', species: 'zee', level: 4 }), ev('catch', { trainer: 'Quiet Comet', species: 'bolt', level: 9 }),
    ev('evolve', { trainer: 'Swift Fox', from: 'mochi', to: 'thicket' }), ev('win', { trainer: 'Quiet Comet' }), ev('win', { trainer: 'Quiet Comet' }),
    ev('spar', { a: 'Bram', b: 'Tess', winner: 'Bram' }),
  ], [], { day: '2026-11-17', speciesName: (s) => SPECIES[s].name, rand: () => 0 });
  const death = paper.stories.find((s) => s.kind === 'death');
  assert.match(death.title, /2/);
  assert.ok(!/Otter|Comet|Fox/.test(death.title + death.body), 'deaths never carry a name');
  assert.match(paper.stories.find((s) => s.kind === 'catch').body, /Quiet Comet's level 9 Bolt/);
  assert.match(paper.stories.find((s) => s.kind === 'win').title, /Quiet Comet/);
  assert.ok(paper.stories.some((s) => s.kind === 'spar' && /Bram won 1 of 1/.test(s.body)));
  const quiet = composeGazette(NC.gazette, [], [], { day: '2026-11-17', speciesName: (s) => s });
  assert.equal(quiet.stories[0].kind, 'quiet');
  const letters = composeMail(NC.mail, { firstDay: true, flag: 'sick', nick: 'Pip', species: 'Mochi', gymClose: null, gymNever: true, frost: false, evolveSoon: false }, () => false);
  assert.deepEqual(letters.map((l) => l.rule), ['welcome', 'sick']);
  assert.match(letters[1].text, /Pip did not look well/);
  const later = composeMail(NC.mail, { firstDay: false, flag: '', nick: 'Pip', gymClose: { move: 'Vine lash', points: 20, price: 30 }, gymNever: false, frost: true, evolveSoon: false }, () => true);
  assert.deepEqual(later.map((l) => l.rule), ['gymClose', 'frost']);
  step('the paper names trainers only for good news, and letters follow each trainer\'s own Checklings');
}

// ---------- end to end ----------
const PORT = 27000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-news-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_TEACHER_KEY: 'test-key' }, stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(ticket) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket })));
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, test = () => true, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const i = inbox.findIndex((m) => m.t === t && test(m)); if (i >= 0) return inbox.splice(i, 1)[0]; await sleep(20); }
    throw new Error(`timed out waiting for ${t}`);
  };
  return { ws, inbox, next, send: async (m) => { ws.send(JSON.stringify(m)); await sleep(1100); }, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}
const teacher = async (action, body) => (await fetch(`http://127.0.0.1:${PORT}/api/teacher/${action}`, { method: body ? 'POST' : 'GET', headers: { 'x-teacher-key': 'test-key', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  // Yesterday's news and today's director lines, written straight into the database.
  const db = new DatabaseSync(path.join(DATA, 'checkaverse.db'));
  db.exec('PRAGMA busy_timeout = 3000');
  const { todayKey } = await import('./accounts.mjs');
  const day = todayKey();
  const ins = db.prepare('INSERT INTO world_events (at, day, kind, data) VALUES (?, ?, ?, ?)');
  ins.run(new Date().toISOString(), '2020-01-01', 'catch', JSON.stringify({ trainer: 'Brave Otter', species: 'zee', level: 6 }));
  ins.run(new Date().toISOString(), '2020-01-01', 'death', JSON.stringify({ species: 'mochi', hour: '2nd Hour' }));
  db.prepare('INSERT INTO director_lines (day, who, text, status, made) VALUES (?, ?, ?, ?, ?)').run(day, 'nell', 'The garden is blooming after all that rain.', 'live', new Date().toISOString());
  db.prepare('INSERT INTO director_lines (day, who, text, status, made) VALUES (?, ?, ?, ?, ?)').run(day, 'bram', 'This line failed a check.', 'dropped', new Date().toISOString());
  db.close();

  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const now = Date.now();
  const ticket = signTicket(key, { v: 1, p: 'NewsTrainerPid00000001', h: '2nd Hour', d: '2026-11-02', c: true, n: 3, s: 4, b: 9, k: { s: 'mochi', n: 'Pip' }, iat: now, exp: now + 7_200_000, j: 'n' });
  const a = client(ticket); await a.open;
  await a.next('welcome');
  const mail = await a.next('mail');
  assert.ok(mail.unread >= 1);
  assert.equal(mail.letters.at(-1).sender, 'Orin', 'the first letter is the welcome');
  const paper = await a.next('gazette', (m) => m.fresh, 6000);
  assert.equal(paper.paper.masthead, 'The Checkaverse Gazette');
  assert.ok(paper.paper.stories.some((s) => /Brave Otter's level 6 Zee/.test(s.body)));
  assert.ok(paper.paper.stories.some((s) => s.kind === 'death' && !/Otter/.test(s.title + s.body)));
  assert.deepEqual(paper.paper.quotes, [{ who: 'Nell', text: 'The garden is blooming after all that rain.' }], 'only live lines reach students');
  step('the first ride of the day brings letters and opens the paper, with only live director lines');

  await a.send({ t: 'mail_read' });
  assert.equal((await a.next('mail')).unread, 0);
  const st = await teacher('state');
  assert.equal(st.director.paused, false);
  assert.equal(st.director.lines.length, 2);
  const live = st.director.lines.find((l) => l.status === 'live');
  await teacher('director', { v: true });
  await a.send({ t: 'gazette' });
  assert.deepEqual((await a.next('gazette')).paper.quotes, [], 'pausing the director takes its lines off the paper at once');
  await teacher('director', { v: false });
  await teacher('director', { drop: live.id });
  await a.send({ t: 'gazette' });
  assert.deepEqual((await a.next('gazette')).paper.quotes, [], 'a removed line is gone');
  step('the teacher can pause the director or remove a line, and students stop seeing it right away');

  // A second ride the same day: no new letters, and the paper waits in the menu.
  a.ws.close(); await sleep(300);
  const b = client(ticket); await b.open; await b.next('welcome');
  const again = await b.next('mail');
  assert.equal(again.unread, 0);
  await sleep(3000);
  assert.ok(!b.inbox.some((m) => m.t === 'gazette'), 'the paper opens by itself once a day');
  b.ws.close();
  step('letters come once a day and the paper opens by itself only on the first ride');
  console.log('PASS news');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(serverLog.split('\n').slice(-20).join('\n'));
} finally {
  child.kill();
  await sleep(300);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
