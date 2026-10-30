// End to end check: starts a throwaway server, connects two players, walks, talks, challenges, answers.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-test-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_TEST_SPAWN: '5,6;6,6', CHECKAVERSE_ORIGINS: `http://localhost:${PORT}` }, stdio: 'pipe',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(origin = `http://localhost:${PORT}`) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin });
  const inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const i = inbox.findIndex((m) => m.t === t);
      if (i >= 0) return inbox.splice(i, 1)[0];
      await sleep(20);
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  return { ws, inbox, next, send: (m) => ws.send(JSON.stringify(m)), open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }

  const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  assert.equal(health.ok, true); assert.equal(health.service, 'checkaverse');
  const page = await fetch(`http://127.0.0.1:${PORT}/`);
  assert.equal(page.status, 200); assert.match(await page.text(), /Checkaverse/);
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/../server.mjs`)).status, 404);

  const a = client(); await a.open; const wa = await a.next('welcome');
  const b = client(); await b.open; const wb = await b.next('welcome');
  assert.equal(wb.players.length, 2, 'second player sees both trainers');
  await a.next('join');
  assert.ok(wa.map.length > 0 && wa.phrases.length > 0);

  // Side by side: challenge, answer yes, both hear the result.
  a.send({ t: 'challenge', to: wb.you });
  assert.match((await a.next('notice')).msg, /Challenge sent/);
  const ask = await b.next('challenged');
  assert.equal(ask.from, wa.you);
  b.send({ t: 'answer', from: wa.you, ok: true });
  assert.equal((await a.next('challenge_result')).ok, true);
  assert.equal((await b.next('challenge_result')).ok, true);

  // Busy blocks challenges.
  b.send({ t: 'busy', v: true });
  await a.next('busy');
  a.send({ t: 'challenge', to: wb.you });
  assert.match((await a.next('notice')).msg, /Busy/);

  // Walking away: the other player sees the move, and a far challenge is refused.
  a.send({ t: 'move', d: 'l' });
  const pos = await b.next('pos');
  assert.equal(pos.id, wa.you); assert.equal(pos.x, 4);
  b.send({ t: 'busy', v: false });
  await a.next('busy');
  a.send({ t: 'challenge', to: wb.you });
  assert.match((await a.next('notice')).msg, /Walk up/);

  // Walls hold: the top row is trees, so walking up from (4,1) stays put.
  a.send({ t: 'say', p: 0 });
  assert.equal((await b.next('say')).p, 0);

  const bad = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: 'https://evil.example' });
  const refused = await new Promise((r) => { bad.on('error', () => r(true)); bad.on('open', () => r(false)); });
  assert.equal(refused, true, 'unknown origins are refused');

  b.ws.close();
  assert.equal((await a.next('leave')).id, wb.you);
  a.ws.close();
  console.log('PASS checkaverse end to end');
} catch (err) {
  failed = true;
  console.error('FAIL', err.message);
} finally {
  child.kill();
  await sleep(300);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
