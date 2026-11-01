// End to end check: starts a throwaway server and plays it with three trainers.
// A and B start side by side on main street. C starts in front of A's house.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { createHash } from 'node:crypto';
import { versionHtmlAssets } from './asset-versions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-test-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN,
    CHECKAVERSE_TEST_SPAWN: '14,13;15,13;14,14;29,6', CHECKAVERSE_TURN_MS: '1200' },
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
  const pageHtml = await page.text();
  assert.equal(page.status, 200); assert.match(pageHtml, /Checkaverse/);
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/../server.mjs`)).status, 404);
  step('health, page and path safety');

  // Test the actual served HTML, not just a hand-written version marker.
  const teacherHtml = await (await fetch(`http://127.0.0.1:${PORT}/teacher`)).text();
  for (const [html, name] of [[pageHtml, 'plaza.js'], [pageHtml, 'plaza.css'], [teacherHtml, 'teacher.js']]) {
    const bytes = fs.readFileSync(path.join(HERE, 'public', name));
    const revision = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const address = `/${name}?v=${revision}`;
    assert.ok(html.includes(address), `${name} uses its current content address`);
    const response = await fetch(`http://127.0.0.1:${PORT}${address}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes, 'versioned route preserves exact asset bytes');
  }
  assert.equal(await (await fetch(`http://127.0.0.1:${PORT}/`)).text(), pageHtml, 'unchanged content has stable versions');
  let current = Buffer.from('old code');
  const template = '<script src="/plaza.js"></script><a href="/unknown.js">x</a><script src="https://example.invalid/x.js"></script>';
  const load = async url => url === '/plaza.js' ? current : null;
  const oldHtml = await versionHtmlAssets(template, load);
  current = Buffer.from('new code');
  const newHtml = await versionHtmlAssets(template, load);
  assert.notEqual(oldHtml, newHtml, 'updated bytes change the HTML address without a restart');
  assert.ok(newHtml.includes('href="/unknown.js"') && newHtml.includes('src="https://example.invalid/x.js"'), 'only registered local assets are versioned');
  step('student and teacher assets have stable content versions that change with their bytes');
  const arrivals = await Promise.all(Array.from({ length: 35 }, async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), pageHtml);
  }));
  assert.equal(arrivals.length, 35);
  step('35 simultaneous page arrivals receive current asset versions');

  // Every picture the plaza asks for is served, and the art route cannot reach anything else.
  const wanted = [...fs.readFileSync(path.join(HERE, 'public', 'plaza.js'), 'utf8').matchAll(/'((?:tile|prop|ui|hood|house|market|merge|trainer)-[a-z-]+|arena)'/g)].map((m) => m[1]);
  const town = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'town.json'), 'utf8'));
  const species = Object.keys(JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'battle', 'species.json'), 'utf8')).species);
  const types = Object.keys(JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'battle', 'types.json'), 'utf8')).types);
  const battleArt = ['bg-battle-meadow', 'fx-knockout', ...species.flatMap((sp) => [`front-${sp}`, `back-${sp}`]), ...types.map((t) => `type-${t}`)];
  const names = new Set([...wanted, ...town.props.map((p) => p.s), ...battleArt]);
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

  // Trainer names have to survive a room of teenagers. No food, no body or size words, nothing that reads as an insult or a joke.
  const NAMES = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'names.json'), 'utf8'));
  const banned = /pickle|nugget|waffle|pretzel|biscuit|turnip|walrus|gopher|moose|dusty|rusty|tiny|chunky|fat|big|little|stinky|weird|nut|ball|wood|beaver|cock|stormy|blaz|weed|crusty|moist|thicc|sus/i;
  for (const w of [...NAMES.first, ...NAMES.second]) assert.doesNotMatch(w, banned, `${w} is not a safe trainer name word`);
  assert.ok(NAMES.first.length >= 20 && NAMES.second.length >= 20, 'enough words for unique names');
  step('trainer name words are kid safe');

  const a = client(); await a.open; const wa = await a.next('welcome');
  const b = client(); await b.open; const wb = await b.next('welcome');
  const v = client(); await v.open; const wv = await v.next('welcome');
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

  // Live battle: both screens open on the same state, picks resolve together, nobody walks off mid battle.
  await a.send({ t: 'partner', v: 'ember' });
  const ba = await a.next('battle'); const bb = await b.next('battle');
  assert.equal(ba.you, 0); assert.equal(bb.you, 1); assert.equal(ba.id, bb.id);
  assert.deepEqual(ba.view.sides.map((x) => x.name), bb.view.sides.map((x) => x.name));
  assert.ok(['mochi', 'bolt', 'zee', 'ember'].includes(ba.view.sides[0].species));
  assert.equal(ba.view.sides[0].moves.length, 4);
  step('an accepted challenge opens the same battle on both screens');
  const near = await v.next('battle_near');
  await v.send({ t: 'watch', id: near.id });
  const watched = await v.next('battle');
  assert.equal(watched.you, null);
  step('a trainer standing nearby can watch');
  await a.send({ t: 'pick', m: 'strike' });
  await b.next('battle_wait', (m) => m.side === 0);
  await b.send({ t: 'pick', m: 'guard' });
  const turnA = await a.next('battle_turn'); const turnB = await b.next('battle_turn'); const turnV = await v.next('battle_turn');
  assert.deepEqual(turnA.events, turnB.events); assert.deepEqual(turnA.events, turnV.events);
  assert.ok(turnA.events.some((e) => e.k === 'hit' && e.side === 1 && e.blocked));
  step('a turn plays the same on every screen and Guard blocks');
  const meA = wb.players.find((x) => x.id === wa.you);
  await a.send({ t: 'move', d: 'l' });
  const stay = await a.next('pos', (m) => m.id === wa.you);
  assert.deepEqual([stay.x, stay.y], [meA.x, meA.y]);
  await v.send({ t: 'challenge', to: wa.you });
  assert.match((await v.next('notice', (m) => /battle/.test(m.msg))).msg, /already in a battle/);
  step('trainers in a battle cannot walk off or be challenged');
  await a.send({ t: 'forfeit' });
  const endA = await a.next('battle_end'); await b.next('battle_end'); await v.next('battle_end');
  assert.equal(endA.winner, 1); assert.equal(endA.reason, 'gave up');
  assert.deepEqual((await b.next('record')).record, { w: 1, l: 0, d: 0 });
  step('giving up ends the battle and the record counts it');

  // Nobody picks: the clock Guards for them, and three missed turns in a row forfeits.
  await b.send({ t: 'challenge', to: wa.you });
  await a.next('challenged');
  await a.send({ t: 'answer', from: wb.you, ok: true });
  await a.next('battle'); await a.next('challenge_result');
  for (let i = 0; i < 2; i++) assert.ok((await a.next('battle_turn', () => true, 4000)).events.some((e) => e.k === 'use' && e.name === 'Guard'));
  const late = await a.next('battle_end', () => true, 4000);
  assert.deepEqual([late.reason, late.winner], ['timeout', 'draw'], 'both trainers walked away, so nobody wins');
  assert.deepEqual((await a.next('record', (m) => m.record.d === 1)).record, { w: 0, l: 1, d: 1 });
  step('the turn clock Guards for a trainer who does not pick, and three misses forfeits');

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

  const lookA = wb.players.find((p) => p.id === wa.you).look;
  assert.ok(Number.isInteger(lookA) && lookA >= 0 && lookA < 4);
  await a.send({ t: 'look', v: (lookA + 1) % 4 });
  assert.equal((await b.next('look', (m) => m.id === wa.you)).v, (lookA + 1) % 4);
  await a.send({ t: 'look', v: 9 }); await sleep(100);
  assert.equal(b.inbox.some((m) => m.t === 'look' && m.v === 9), false);
  step('a trainer can change outfit and others see it');

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

  await b.send({ t: 'say', p: 0 }); await b.send({ t: 'say', p: 1 }); await b.send({ t: 'say', p: 2 });
  await sleep(200);
  assert.equal(b.inbox.filter((m) => m.t === 'say' && m.id === wb.you).length, 1, 'one phrase per two seconds');
  step('phrase flooding is held back');

  const crowd = [];
  for (let i = 0; i < 14; i++) { const k = client(); await k.open; crowd.push(k); }
  const spots = await Promise.all(crowd.map(async (k) => { const w = await k.next('welcome'); const me = w.players.find((p) => p.id === w.you); return `${me.x},${me.y}`; }));
  assert.equal(new Set(spots).size, spots.length, 'a crowd arriving together gets its own tiles');
  crowd.forEach((k) => k.ws.close());
  step('a class arriving at once spreads out by the bus stop');

  // Teacher controls: wrong key refused, pause stops walking and talking, messages reach everyone, remove closes.
  const key = fs.readFileSync(path.join(DATA, 'teacher-key.txt'), 'utf8').trim();
  const tapi = (p, body, k = key) => fetch(`http://127.0.0.1:${PORT}/api/teacher/${p}`, { method: body ? 'POST' : 'GET', headers: { 'X-Teacher-Key': k, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await tapi('state', null, 'nope')).status, 403);
  assert.equal((await tapi('state', null, '')).status, 403);
  const st = await (await tapi('state')).json();
  assert.ok(st.players.some((p) => p.id === wb.you));
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/teacher`)).status, 200);
  const t1 = client(); await t1.open; const w1 = await t1.next('welcome');
  await tapi('pause', { v: true });
  await t1.next('paused', (m) => m.v === true);
  const me1 = w1.players.find((p) => p.id === w1.you);
  await t1.send({ t: 'move', d: 'r' });
  const held1 = await t1.next('pos', (m) => m.id === w1.you);
  assert.deepEqual([held1.x, held1.y], [me1.x, me1.y], 'nobody walks while paused');
  await t1.send({ t: 'say', p: 0 }); await sleep(150);
  assert.equal(t1.inbox.some((m) => m.t === 'say'), false, 'nobody talks while paused');
  await tapi('pause', { v: false });
  await t1.next('paused', (m) => m.v === false);
  await tapi('say', { msg: 'Two minutes left.' });
  assert.equal((await t1.next('teacher')).msg, 'Two minutes left.');
  await tapi('remove', { id: w1.you });
  await t1.next('removed');
  const code = await new Promise((r) => t1.ws.on('close', (c) => r(c)));
  assert.equal(code, 4001);
  step('teacher can pause, message and remove, and nobody else can');

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
