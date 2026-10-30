// End to end check: starts a throwaway server and plays it with three trainers.
// A and B start side by side on main street. C starts in front of A's house.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-test-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN,
    CHECKAVERSE_TEST_SPAWN: '14,13;15,13;29,6' },
  stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
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
  const send = async (m) => { ws.send(JSON.stringify(m)); await sleep(130); };
  return { ws, inbox, next, send, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}
const step = (label) => console.log('  ok', label);

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  assert.equal(health.ok, true);
  const page = await fetch(`http://127.0.0.1:${PORT}/`);
  assert.equal(page.status, 200); assert.match(await page.text(), /Checkaverse/);
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/../server.mjs`)).status, 404);
  step('health, page and path safety');

  // Every picture the plaza asks for is served, and the art route cannot reach anything else.
  const wanted = [...fs.readFileSync(path.join(HERE, 'public', 'plaza.js'), 'utf8').matchAll(/'((?:tile|prop|ui|hood|house|market|merge|trainer)-[a-z-]+|arena)'/g)].map((m) => m[1]);
  const town = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'town.json'), 'utf8'));
  const names = new Set([...wanted, ...town.props.map((p) => p.s)]);
  assert.ok(names.size >= 20, 'the plaza uses the Sprite Book art');
  for (const name of names) {
    const res = await fetch(`http://127.0.0.1:${PORT}/art/${name}.png`);
    assert.equal(res.status, 200, `${name}.png is served`);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.deepEqual([...new Uint8Array(await res.arrayBuffer()).slice(1, 4)], [80, 78, 71], `${name}.png is a PNG`);
  }
  for (const bad of ['/art/../server.mjs', '/art/%2e%2e%2fserver.mjs', '/art/missing.png', '/art/Trainer-A.png', '/art/x.js']) {
    assert.equal((await fetch(`http://127.0.0.1:${PORT}${bad}`)).status, 404, `${bad} is refused`);
  }
  step('sprite art is served and nothing else is');

  const a = client(); await a.open; const wa = await a.next('welcome');
  const b = client(); await b.open; const wb = await b.next('welcome');
  assert.equal(wb.players.length, 2);
  assert.ok(wa.myPlot && wb.myPlot && wa.myPlot !== wb.myPlot, 'each trainer gets their own plot');
  assert.deepEqual(wa.phrases, ['Hi!', 'Nice Checkling!', 'Want to battle?', 'Good game', 'Thanks!', 'See you tomorrow']);
  const plotsMsg = await b.next('plots', (m) => m.plots.filter((p) => p.owner).length === 2);
  assert.equal(plotsMsg.plots.find((p) => p.id === wa.myPlot).owner, wa.you);
  step('houses land on separate plots and phrases match the bible');

  await a.send({ t: 'challenge', to: wb.you });
  assert.match((await a.next('notice')).msg, /Challenge sent/);
  await b.next('challenged', (m) => m.from === wa.you);
  await b.send({ t: 'answer', from: wa.you, ok: true });
  assert.equal((await a.next('challenge_result')).ok, true);
  assert.equal((await b.next('challenge_result')).ok, true);
  step('walk up challenge accepted');

  await a.send({ t: 'challenge', to: wb.you });
  await a.next('notice', (m) => /Challenge sent/.test(m.msg));
  await b.next('challenged');
  await b.send({ t: 'answer', from: wa.you, ok: false });
  assert.equal((await a.next('challenge_result')).ok, false);
  await a.send({ t: 'challenge', to: wb.you });
  assert.match((await a.next('notice', (m) => /said no/.test(m.msg))).msg, /Try them again/);
  step('a turned down challenger has to wait');

  await b.send({ t: 'busy', v: true });
  await a.next('busy');
  assert.match((await (async () => { await a.send({ t: 'challenge', to: wb.you }); return a.next('notice', (m) => /Busy/.test(m.msg)); })()).msg, /Busy/);
  step('Busy blocks challenges');

  const before = wb.players.find((p) => p.id === wa.you)?.name;
  for (let i = 0; i < 3; i++) await a.send({ t: 'reroll' });
  const renames = [];
  for (let i = 0; i < 3; i++) renames.push(await b.next('name', (m) => m.id === wa.you));
  assert.equal(new Set([before, ...renames.map((m) => m.name)]).size >= 3, true, 'rerolls give new names');
  assert.equal(renames[2].left, 0);
  await a.send({ t: 'reroll' });
  assert.match((await a.next('notice', (m) => /last new name/.test(m.msg))).msg, /last new name/);
  const named = await b.next('plots', (m) => m.plots.find((p) => p.id === wa.myPlot).name === renames[2].name);
  assert.ok(named, 'the house sign follows the new name');
  assert.equal(typeof wa.signs['notice-board'], 'string');
  step('a trainer can reroll their name three times');

  // C stands in front of A's house (plot 1, door at 29,5).
  const c = client(); await c.open; const wc = await c.next('welcome');
  assert.equal(wa.myPlot, 1);
  await c.send({ t: 'move', d: 'u' });
  const inside = await c.next('room');
  assert.equal(inside.kind, 'house'); assert.equal(inside.owner.owner, wa.you);
  await a.next('leave', (m) => m.id === wc.you);
  step('a visitor walks into an open house');

  await c.send({ t: 'say', p: 4 });
  assert.equal((await c.next('say')).p, 4);
  assert.equal(a.inbox.some((m) => m.t === 'say' && m.id === wc.you), false, 'phrases inside a house stay inside');
  step('phrases stay in the room they were said in');

  await c.send({ t: 'move', d: 'd' });
  const out = await c.next('room');
  assert.equal(out.kind, 'town');
  step('the visitor walks back out the door');

  await a.send({ t: 'lock', v: true });
  await c.next('plots', (m) => m.plots.find((p) => p.id === 1).locked);
  await c.send({ t: 'move', d: 'u' });
  assert.match((await c.next('notice', (m) => /locked/.test(m.msg))).msg, /locked the door/);
  step('a locked door keeps visitors out');

  await a.send({ t: 'lock', v: false });
  await c.next('plots', (m) => !m.plots.find((p) => p.id === 1).locked);
  await c.send({ t: 'move', d: 'u' });
  assert.equal((await c.next('room')).kind, 'house');
  a.ws.close();
  const kicked = await c.next('room');
  assert.equal(kicked.kind, 'town');
  assert.match((await c.next('notice', (m) => /closed up/.test(m.msg))).msg, /closed up/);
  await c.next('plots', (m) => m.plots.find((p) => p.id === 1).owner === 0);
  step('when the owner leaves, visitors are walked out and the plot empties');

  const bad = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: 'https://evil.example' });
  assert.equal(await new Promise((r) => { bad.on('error', () => r(true)); bad.on('open', () => r(false)); }), true);
  step('unknown sites are refused');

  b.ws.close(); c.ws.close();
  console.log('PASS checkaverse end to end');
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
