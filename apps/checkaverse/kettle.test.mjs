// Kettle Creek end to end: a saved trainer wakes up at home, Route 1 starts wild battles, the bus runs both ways,
// and visitors never get a home town. Uses a tiny map of its own so it does not depend on content/kettle.json.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 19000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-kettle-'));
const KETTLE = path.join(DATA, 'kettle.json');
fs.writeFileSync(KETTLE, JSON.stringify({
  id: 'kettle',
  rows: [
    'TTTTTTTTTTTT',
    'T..GGGG....T',
    'T..GGGG....T',
    'T..........T',
    'T.HHH..PPH.T',
    'T.HHH..PPP.T',
    'T..P.......T',
    'TTTTTTTTTTTT',
  ],
  arrive: [[4, 6]],
  props: [
    { s: 'house-cottage', x: 2, b: 6, w: 3, f: [2, 4, 3, 2], sign: 'home' },
    { s: 'prop-bus-stop', x: 9, b: 5, w: 1, f: [9, 4, 1, 1], sign: 'bus-stop-kc' },
  ],
  doors: [{ x: 3, y: 6, place: 'home' }],
  graves: [[10, 1], [10, 2]],
  exits: [],
}));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_KETTLE: KETTLE,
    CHECKAVERSE_TURN_MS: '1200', CHECKAVERSE_WILD_RATE: '1' },
  stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(ticket = null) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket })));
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, test = () => true, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const i = inbox.findIndex((m) => m.t === t && test(m));
      if (i >= 0) return inbox.splice(i, 1)[0];
      await sleep(20);
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const send = async (m) => { ws.send(JSON.stringify(m)); await sleep(140); };
  return { ws, inbox, next, send, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}
const step = (label) => console.log('  ok', label);

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const now = Date.now();
  const ticket = signTicket(key, { v: 1, p: 'Kk7xK2mN9vR4tY8wZ3aB1c', h: '2nd Hour', d: '2026-11-02', c: true, n: 12, s: 4, b: 9,
    k: { s: 'mochi', n: '' }, iat: now, exp: now + 7_200_000, j: 'k' });

  const a = client(ticket); await a.open;
  const w = await a.next('welcome');
  assert.equal(w.saved, true);
  assert.equal(w.kind, 'kettle');
  assert.match(w.room, /^kc:/);
  assert.deepEqual(w.stones, []);
  assert.ok(w.kettle && w.kettle.rows.length === 8 && w.kettle.places.home, 'the page gets the map and the place lines');
  assert.equal(w.myPlot, 0, 'no house in the Neighborhood while at home');
  step('a saved trainer wakes up at home in Kettle Creek');

  // A visitor still arrives in the town and never sees anyone's Kettle Creek.
  const v = client(null); await v.open;
  const wv = await v.next('welcome');
  assert.equal(wv.kind, 'town');
  assert.ok(!wv.players.some((p) => p.id === w.you), 'a home town is private');
  await v.send({ t: 'bus', to: 'kettle' });
  assert.ok(!v.inbox.some((m) => m.t === 'room'), 'visitors have no home town to ride to');
  step('visitors arrive in the town and cannot ride home');

  // Walk to Route 1: right, then up into the tall grass.
  for (const d of ['r', 'u', 'u', 'u', 'u']) await a.send({ t: 'move', d });
  const wild = await a.next('battle', () => true, 4000);
  assert.ok(wild.wild);
  assert.match(wild.zone, /Route 1/);
  const lv = wild.view.sides[1].level;
  assert.ok(lv >= 3 && lv <= 6, `Route 1 Checklings are levels 3 to 6 (got ${lv})`);
  await a.send({ t: 'run' });
  await a.next('battle_end', () => true, 4000);
  step('Route 1 tall grass starts gentle wild battles');

  await a.send({ t: 'bus', to: 'town' });
  const inTown = await a.next('room', (m) => m.kind === 'town');
  assert.ok(inTown.players.some((p) => p.id === wv.you), 'the town is shared');
  const home = await a.next('home');
  assert.ok(home.myPlot > 0, 'riding into town drops the house into a plot');
  await a.send({ t: 'bus', to: 'kettle' });
  const back = await a.next('room', (m) => m.kind === 'kettle');
  assert.match(back.room, /^kc:/);
  assert.deepEqual(back.stones, []);
  step('the bus runs to the Checkaverse and back home');

  const state = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  assert.equal(state.ok, true);
  a.ws.close(); v.ws.close();
  console.log('PASS kettle creek');
} catch (err) {
  failed = true;
  console.error('FAIL', err.message);
  console.error(serverLog.split('\n').slice(-15).join('\n'));
} finally {
  child.kill();
  await sleep(300);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
