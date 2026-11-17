// Weather and the teacher's reward events: the sky reaches every screen, a rare spawn really changes what is in
// the grass, and rewards end when the teacher stops them.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 29000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-events-'));
const KETTLE = path.join(DATA, 'kettle.json');
fs.writeFileSync(KETTLE, JSON.stringify({
  id: 'kettle',
  rows: ['TTTTTTTTTTTT', 'T..GGGG....T', 'T..GGGG....T', 'T..........T', 'T.HHH......T', 'T.HHH......T', 'T..P.......T', 'TTTTTTTTTTTT'],
  arrive: [[4, 6]],
  props: [{ s: 'house-cottage', x: 2, b: 6, w: 3, f: [2, 4, 3, 2], sign: 'home' }, { s: 'prop-bus-stop', x: 9, b: 5, w: 1, f: [9, 4, 1, 1], sign: 'bus-stop-kc' }],
  doors: [{ x: 3, y: 6, place: 'home' }], graves: [[10, 1]], exits: [],
}));
const RARE = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'events.json'), 'utf8')).kinds.rare.species;
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_KETTLE: KETTLE, CHECKAVERSE_WEATHER: 'rain',
    CHECKAVERSE_WILD_RATE: '1', CHECKAVERSE_TURN_MS: '1500', CHECKAVERSE_TEACHER_KEY: 'test-key' }, stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (label) => console.log('  ok', label);
const teacher = async (action, body) => (await fetch(`http://127.0.0.1:${PORT}/api/teacher/${action}`, { method: body ? 'POST' : 'GET', headers: { 'x-teacher-key': 'test-key', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const now = Date.now();
  const ticket = signTicket(key, { v: 1, p: 'EventsTrainerPid000001', h: '1st Hour', d: '2026-11-02', c: true, n: 5, s: 4, b: 9, k: { s: 'mochi', n: '' }, iat: now, exp: now + 7_200_000, j: 'e' });
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket })));
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, test = () => true, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const i = inbox.findIndex((m) => m.t === t && test(m)); if (i >= 0) return inbox.splice(i, 1)[0]; await sleep(20); }
    throw new Error(`timed out waiting for ${t}`);
  };
  const send = async (m) => { ws.send(JSON.stringify(m)); await sleep(150); };
  await next('welcome');
  const sky = await next('weather');
  assert.equal(sky.kind, 'rain'); assert.match(sky.line, /Tide/);
  assert.deepEqual((await next('events')).events, []);
  const st = await teacher('state');
  assert.equal(st.weather.kind, 'rain');
  assert.deepEqual(st.events.map((e) => e.kind).sort(), ['doubleXp', 'festival', 'rare']);
  step('the Mt. Morris sky reaches every screen and the teacher page');

  // Count what turns up in Route 1's tall grass: step in, run, step out, repeat.
  async function sample(n) {
    const seen = [];
    for (let i = 0; i < n; i++) {
      await send({ t: 'move', d: i % 2 ? 'u' : 'd' });
      const b = inbox.find((m) => m.t === 'battle');
      if (b) { inbox.splice(inbox.indexOf(b), 1); seen.push(b.view.sides[1].species); await send({ t: 'run' }); await next('battle_end'); await sleep(50); }
    }
    return seen;
  }
  for (const d of ['r', 'u', 'u', 'u', 'u']) await send({ t: 'move', d });
  inbox.splice(0); await send({ t: 'run' });
  const before = await sample(50);
  assert.ok(before.length >= 4, `wild battles happen (${before.length})`);
  assert.ok(!before.some((s) => RARE.includes(s)), 'no rare Checklings on Route 1 normally');
  await teacher('event', { start: 'rare' });
  const ann = await next('teacher', (m) => /Rare Checklings/.test(m.msg));
  assert.ok(ann);
  assert.ok((await next('events')).events.some((e) => e.kind === 'rare' && e.left > 29 * 60_000));
  const during = await sample(90);
  const rare = during.filter((s) => RARE.includes(s)).length;
  assert.ok(rare >= 3, `a rare spawn brings rare Checklings into the grass (${rare} of ${during.length})`);
  step(`a rare spawn changes the grass: ${rare} of ${during.length} encounters were rare`);

  await teacher('event', { stop: 'rare' });
  assert.deepEqual((await next('events', (m) => !m.events.length)).events, []);
  await teacher('event', { start: 'festival' });
  await teacher('event', { start: 'doubleXp' });
  const both = await teacher('state');
  assert.ok(both.events.filter((e) => e.until > Date.now()).length === 2);
  assert.equal((await teacher('event', { start: 'nonsense' })).ok, true, 'an unknown event is refused quietly');
  step('the teacher can start and stop rewards, and several can run at once');
  ws.close();
  console.log('PASS weather and events');
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
