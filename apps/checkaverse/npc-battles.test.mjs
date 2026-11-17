// Residents battle each other: a battle starts near a trainer, shows on the map, can be watched on the battle
// screen, holds both residents still, ends, and the residents remember it. Nothing is saved to the battles table.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 23000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-spars-'));
const SP = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'npc-battles.json'), 'utf8'));
fs.writeFileSync(path.join(DATA, 'spars.json'), JSON.stringify({ ...SP, gapSeconds: [5, 5], range: 80, seeRange: 80, turnMs: 900, maxTurns: 6 }));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_SPARS: path.join(DATA, 'spars.json') },
  stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (label) => console.log('  ok', label);
let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket: null })));
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, test = () => true, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const i = inbox.findIndex((m) => m.t === t && test(m)); if (i >= 0) return inbox.splice(i, 1)[0]; await sleep(20); }
    throw new Error(`timed out waiting for ${t}`);
  };
  const w = await next('welcome');
  assert.equal(w.kind, 'town');

  const start = await next('npc_battle', (m) => m.start, 15000);
  assert.equal(start.room, 'town');
  assert.equal(start.sides.length, 2);
  for (const sd of start.sides) {
    assert.ok(SP.residents[sd.resident], 'each side is a resident with a Checkling');
    assert.equal(sd.species, SP.residents[sd.resident].species);
    assert.equal(sd.hp, sd.maxHp);
  }
  const near = await next('battle_near', (m) => m.id === start.id);
  assert.deepEqual(near.names, start.sides.map((s) => s.name));
  step('two residents start a battle near a trainer, and the trainer hears about it');

  const snap = await next('residents', (m) => m.residents.some((r) => r.activity?.id === 'battle'), 3000);
  const fighting = snap.residents.filter((r) => r.activity?.id === 'battle').map((r) => r.id).sort();
  assert.deepEqual(fighting, start.sides.map((s) => s.resident).sort());
  assert.ok(snap.residents.filter((r) => fighting.includes(r.id)).every((r) => r.held), 'both residents hold still');
  step('the two residents stand still and say they are battling');

  ws.send(JSON.stringify({ t: 'watch', id: start.id }));
  const watch = await next('battle', (m) => m.id === start.id);
  assert.equal(watch.you, null);
  const turn = await next('battle_turn', (m) => m.id === start.id, 4000);
  assert.ok(turn.events.some((e) => e.k === 'use'));
  const upd = await next('npc_battle', (m) => m.id === start.id && !m.start, 4000);
  assert.ok(upd.moves.length > 0);
  step('a trainer can watch it on the battle screen while the map shows each move');

  const end = await next('battle_end', (m) => m.id === start.id, 12000);
  assert.ok(['knockout', 'time'].includes(end.reason));
  const mapEnd = await next('npc_battle_end', (m) => m.id === start.id, 3000);
  assert.equal(mapEnd.winner, end.winner);
  step(`the battle ends (${end.reason}) for watchers and on the map`);

  await sleep(800);
  const after = inbox.filter((m) => m.t === 'residents').at(-1);
  const res = after.residents.filter((r) => fighting.includes(r.id));
  assert.ok(res.every((r) => !r.held && r.activity.id !== 'battle'), 'both residents go back to work');
  if (end.winner === 0 || end.winner === 1) assert.ok(res.every((r) => r.memory.some((x) => /battle|beat|fight|Won|Lost|better of me/.test(x))), 'they remember the battle');
  step('the residents go back to work and remember how it went');

  const db = new DatabaseSync(path.join(DATA, 'checkaverse.db'), { readOnly: true });
  assert.equal(db.prepare('SELECT count(*) n FROM battles').get().n, 0, 'resident battles never go in the battles table');
  db.close();
  ws.close();
  console.log('PASS resident battles');
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
