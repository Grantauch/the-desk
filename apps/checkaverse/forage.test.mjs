// Forage: two trainers get the same ingredient from one spot on the same school day, and a second look does not grant another.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 32000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-forage-'));
const KETTLE = path.join(DATA, 'kettle.json');
fs.writeFileSync(KETTLE, JSON.stringify({
  id: 'kettle',
  rows: ['TTTTTT', 'T....T', 'T....T', 'TTTTTT'],
  arrive: [[2, 2]],
  props: [{ s: 'prop-bush', x: 3, b: 2, w: 1, f: [3, 2, 1, 1], sign: 'forage-berry-patch' }, { s: 'prop-bus-stop', x: 4, b: 2, w: 1, f: [4, 2, 1, 1], sign: 'bus-stop-kc' }],
  doors: [],
  graves: [[1, 1]],
  forage: [{ id: 'berry-patch', x: 3, y: 2 }],
  exits: [],
}));
const FORAGE = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'forage.json'), 'utf8'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_KETTLE: KETTLE, CHECKAVERSE_WEATHER: 'off' },
  stdio: 'pipe',
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
  const next = async (t, test = () => true, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const i = inbox.findIndex((m) => m.t === t && test(m));
      if (i >= 0) return inbox.splice(i, 1)[0];
      await sleep(20);
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const send = async (m) => { ws.send(JSON.stringify(m)); await sleep(350); };
  return { ws, inbox, next, send, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const now = Date.now();
  const ticket = (pid) => signTicket(key, { v: 1, p: pid, h: '1st Hour', d: '2026-11-02', c: true, n: 2, s: 1, b: 1, k: { s: 'mochi', n: '' }, iat: now, exp: now + 7_200_000, j: pid.slice(0, 8) });
  const a = client(ticket('ForageTrainerA0000001')); await a.open;
  const wa = await a.next('welcome');
  const b = client(ticket('ForageTrainerB0000002')); await b.open; await b.next('welcome');
  await a.send({ t: 'forage', id: 'berry-patch' });
  const first = await a.next('forage');
  await b.send({ t: 'forage', id: 'berry-patch' });
  const second = await b.next('forage');
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.id, second.id, 'both trainers find the same ingredient today');
  assert.ok(FORAGE.spots['berry-patch'].finds.includes(first.id));
  assert.equal(first.count, 1);
  assert.equal(second.count, 1);
  console.log(`  ok both trainers find ${first.name}`);
  await a.send({ t: 'forage', id: 'berry-patch' });
  const third = await a.next('forage');
  assert.equal(third.already, true);
  assert.match(third.msg, /already gathered/);
  assert.equal(third.count, undefined);
  await a.send({ t: 'body', id: wa.partner });
  const body = await a.next('body');
  assert.equal(body.body.foraged[first.name], 1, 'the third tap did not add another');
  console.log('  ok a second look does not grant another');
  console.log('PASS forage');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(serverLog.split('\n').slice(-20).join('\n'));
} finally {
  child.kill();
  await sleep(200);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
