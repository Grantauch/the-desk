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
import { signTicket, xpFor, loadGrowth } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-test-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN,
    CHECKAVERSE_TEST_SPAWN: '14,13;15,13;14,14;29,6', CHECKAVERSE_TURN_MS: '1200', CHECKAVERSE_WILD_RATE: '1', CHECKAVERSE_CATCH_CHANCE: '1' },
  stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every page says hello first, with a bus ticket from Check-In or without one as a visitor.
function client(ticket = null, hello = true) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  if (hello) ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket })));
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

  // The wilds: out the town gate and back, then a wild Checkling in the tall grass, caught and used as a partner.
  const x = client(); await x.open; const wx = await x.next('welcome');
  assert.ok(wx.wilds && wx.wilds.rows.length > 20 && wx.town.exits.length === 1, 'the wilds map arrives with the welcome');
  const solid = new Set(['T', 'W', 'H', 'S']);
  const route = (rows, from, to) => {
    const key = (p) => `${p[0]},${p[1]}`, prev = new Map([[key(from), null]]), q = [from];
    while (q.length) {
      const cur = q.shift();
      if (key(cur) === key(to)) break;
      for (const [d, dx, dy] of [['u', 0, -1], ['d', 0, 1], ['l', -1, 0], ['r', 1, 0]]) {
        const nx = cur[0] + dx, ny = cur[1] + dy, ch = rows[ny]?.[nx];
        if (!ch || solid.has(ch) || prev.has(`${nx},${ny}`)) continue;
        prev.set(`${nx},${ny}`, [cur, d]); q.push([nx, ny]);
      }
    }
    const steps = [];
    for (let k = key(to); prev.get(k); k = key(prev.get(k)[0])) steps.unshift(prev.get(k)[1]);
    return steps;
  };
  const meX = wx.players.find((q) => q.id === wx.you);
  const toGate = route(wx.town.rows, [meX.x, meX.y], [12, 1]);
  assert.ok(toGate.length > 0, 'there is a way from the bus stop to the gate');
  for (const d of toGate) await x.send({ t: 'move', d });
  await x.send({ t: 'move', d: 'u' });
  const outside = await x.next('room', (m) => m.room === 'wilds');
  assert.equal(outside.kind, 'wilds');
  await x.send({ t: 'move', d: 'd' }); await x.send({ t: 'move', d: 'd' });
  assert.equal((await x.next('room', (m) => m.room === 'town')).kind, 'town');
  await x.send({ t: 'move', d: 'u' });
  await x.next('room', (m) => m.room === 'wilds');
  step('the town gate leads to the wilds and back');
  // From the trail into the tall grass: a few free steps, then every step can rouse a wild one (rate 1 in tests).
  for (const d of route(wx.wilds.rows, [28, 41], [17, 30])) await x.send({ t: 'move', d });
  for (let i = 0; i < 8 && !x.inbox.some((m) => m.t === 'battle'); i++) await x.send({ t: 'move', d: 'l' });
  const wb2 = await x.next('battle');
  assert.equal(wb2.wild, true); assert.equal(wb2.zone, 'Tall grass');
  assert.ok(wb2.view.sides[1].level >= 5 && wb2.view.sides[1].level <= 9);
  assert.equal(wb2.charms, 5);
  step('tall grass starts a wild battle with a Checkling from its table');
  await x.send({ t: 'pick', m: 'strike' });
  assert.ok((await x.next('battle_turn')).events.some((e) => e.k === 'use' && e.side === 1), 'the wild one moves right away');
  await x.send({ t: 'charm' });
  const thrown = await x.next('battle_turn');
  assert.deepEqual(thrown.events[0], { k: 'charm', ok: true, shakes: 3, left: 4 });
  assert.equal((await x.next('battle_end')).reason, 'caught');
  const party = await x.next('team', (m) => m.team.some((c) => c.caught));
  const got = party.team.find((c) => c.caught);
  assert.equal(got.species, wb2.view.sides[1].species);
  assert.equal(party.saved, false, 'a visitor keeps catches only for the visit');
  await x.send({ t: 'partner', v: got.v });
  assert.equal((await x.next('partner')).v, 'c0');
  step('a weakened wild Checkling is caught and becomes a battle partner');
  for (let i = 0; i < 12 && !x.inbox.some((m) => m.t === 'battle'); i++) await x.send({ t: 'move', d: i % 2 ? 'l' : 'r' });
  const again = await x.next('battle');
  assert.equal(again.view.sides[0].species, got.species, 'the caught Checkling battles at its own level');
  assert.equal(again.view.sides[0].level, got.level);
  await x.send({ t: 'run' });
  assert.equal((await x.next('battle_end')).reason, 'ran');
  step('running from a wild battle always works');
  x.ws.close();

  // ---------- bus tickets from Check-In ----------
  const GROWTH = loadGrowth(path.join(HERE, 'content', 'growth.json'));
  const tkey = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  assert.ok(tkey.length >= 40, 'the server made a ticket key on first start');
  const now = Date.now();
  const ticket = (over = {}, key = tkey) => signTicket(key, { v: 1, p: 'Pq7xK2mN9vR4tY8wZ3aB1c', h: '2nd Hour', d: '2026-11-02', c: true, n: 30, s: 4, b: 9,
    k: { s: 'bolt', n: 'Sprocket' }, iat: now, exp: now + 7_200_000, j: 'abc', ...over });
  const s1 = client(ticket()); await s1.open; const ws1 = await s1.next('welcome');
  assert.equal(ws1.saved, true);
  assert.equal(ws1.team.length, 1);
  const hatched = ws1.team[0];
  assert.deepEqual([hatched.species, hatched.nick, hatched.hatched, hatched.den], ['bolt', 'Sprocket', true, false]);
  assert.equal(hatched.level, 15, '30 check-ins of XP puts the hatched Checkling at level 15');
  assert.equal(ws1.partner, hatched.v);
  const arrival = (await s1.next('notice', (m) => /rode the bus/.test(m.msg))).msg;
  assert.match(arrival, /Sprocket the Bolt rode the bus with you\. 30 check-ins since your last ride: Sprocket the Bolt earned 3000 XP and grew to level 15/);
  const savedName = ws1.players.find((q) => q.id === ws1.you).name;
  assert.equal(ws1.players.find((q) => q.id === ws1.you).pt, 'bolt', 'others see the species, never the nickname');
  assert.ok(!JSON.stringify(ws1.players).includes('Sprocket'));
  step('a bus ticket loads a saved trainer with the hatched Checkling, grown by attendance');

  // The same student opening a second tab closes the first one.
  const s1closed = new Promise((r) => s1.ws.on('close', (c) => r(c)));
  const s2 = client(ticket()); await s2.open; const ws2 = await s2.next('welcome');
  assert.equal(await s1closed, 4002);
  assert.ok(s1.inbox.some((m) => m.t === 'elsewhere'), 'the first tab is told why');
  assert.equal(ws2.players.find((q) => q.id === ws2.you).name, savedName, 'the trainer name is kept');
  assert.equal(s2.inbox.some((m) => m.t === 'notice' && /since your last ride/.test(m.msg)), false, 'the same check-ins are never paid twice');
  step('one trainer, one screen, and check-ins are paid once');

  // Out to the tall grass with a saved trainer: the catch is kept, and charms do not refill on a reload.
  const meS = ws2.players.find((q) => q.id === ws2.you);
  for (const d of route(ws2.town.rows, [meS.x, meS.y], [12, 1])) await s2.send({ t: 'move', d });
  await s2.send({ t: 'move', d: 'u' });
  await s2.next('room', (m) => m.room === 'wilds');
  for (const d of route(ws2.wilds.rows, [28, 41], [17, 30])) await s2.send({ t: 'move', d });
  for (let i = 0; i < 8 && !s2.inbox.some((m) => m.t === 'battle'); i++) await s2.send({ t: 'move', d: 'l' });
  const wild2 = await s2.next('battle');
  assert.equal(wild2.view.sides[0].level, 15, 'the saved partner battles at its own level');
  assert.equal(wild2.charms, 5);
  await s2.send({ t: 'charm' });
  assert.equal((await s2.next('battle_turn')).events[0].left, 4);
  const end2 = await s2.next('battle_end');
  assert.deepEqual([end2.reason, end2.kept], ['caught', 'party']);
  const team2 = await s2.next('team', (m) => m.team.length === 2);
  assert.equal(team2.saved, true);
  assert.match((await s2.next('notice', (m) => /XP/.test(m.msg))).msg, /Sprocket the Bolt earned 15 XP/);
  s2.ws.close(); await sleep(200);
  step('a saved trainer keeps a catch and the partner earns battle XP');

  // Next ride: one more check-in. The catch is still there and today's charms stay spent.
  const s3 = client(ticket({ n: 31, iat: Date.now() })); await s3.open; const ws3 = await s3.next('welcome');
  assert.equal(ws3.team.length, 2);
  assert.equal(ws3.charms, 4, 'charms are counted per day, not per visit');
  assert.equal(ws3.team.find((c) => c.hatched).level, 15);
  assert.equal(ws3.team.find((c) => c.hatched).xp, 3000 + 15 + 100 - xpFor(GROWTH, 15));
  assert.match((await s3.next('notice', (m) => /since your last ride/.test(m.msg))).msg, /One check-in since your last ride: Sprocket the Bolt earned 100 XP\./);
  const caughtOne = ws3.team.find((c) => !c.hatched);
  await s3.send({ t: 'partner', v: caughtOne.v });
  assert.equal((await s3.next('partner')).v, caughtOne.v);
  step('the next ride keeps the catch, pays one new check-in and lets the catch be the partner');

  // Party and Den: rest the current partner and the job passes on. The last one in the party stays.
  await s3.send({ t: 'den', v: caughtOne.v, party: false });
  const rested = await s3.next('team', (m) => m.team.find((c) => c.v === caughtOne.v).den);
  assert.equal(rested.partner, hatched.v, 'resting the partner hands the job to the next in the party');
  await s3.send({ t: 'den', v: hatched.v, party: false });
  assert.match((await s3.next('notice', (m) => /at least one/.test(m.msg))).msg, /Keep at least one/);
  await s3.send({ t: 'partner', v: caughtOne.v }); await sleep(150);
  assert.equal(s3.inbox.some((m) => m.t === 'partner' && m.v === caughtOne.v), false, 'a Checkling in the Den cannot battle');
  await s3.send({ t: 'den', v: caughtOne.v, party: true });
  await s3.next('team', (m) => !m.team.find((c) => c.v === caughtOne.v).den);
  await s3.send({ t: 'den', v: 'k999', party: true }); await sleep(100);
  step('party and Den moves follow the rules');

  // Renames are saved and limited per day.
  await s3.send({ t: 'reroll' });
  const renamed = await s3.next('name', (m) => m.id === ws3.you);
  assert.equal(renamed.left, 2);
  s3.ws.close(); await sleep(200);
  const s4 = client(ticket({ iat: Date.now() })); await s4.open; const ws4 = await s4.next('welcome');
  assert.equal(ws4.players.find((q) => q.id === ws4.you).name, renamed.name);
  assert.equal(ws4.rerolls, 2);
  await s4.send({ t: 'ranks' });
  const board = await s4.next('ranks');
  assert.deepEqual([board.saved, board.hour, board.top.length, board.mine], [true, '2nd Hour', 0, null]);
  assert.ok(!JSON.stringify(board).includes('Pq7xK2'), 'player IDs never reach a page');
  s4.ws.close();
  step('a new trainer name is kept and renames are counted per day');

  // Bad tickets fall back to visiting: expired, forged, tampered, wrong partner.
  const tries = [
    [ticket({ iat: now - 7_300_000, exp: now - 100_000 }), /ran out/],
    [ticket({}, 'not-the-real-key-not-the-real-key-000000'), /did not work/],
    [ticket().replace(/^./, (ch) => (ch === 'e' ? 'f' : 'e')), /did not work/],
    [ticket({ k: { s: 'dragon', n: 'X' } }), /did not work/],
    [ticket({ exp: now + 9 * 3_600_000 }), /did not work/],
  ];
  for (const [tk, why] of tries) {
    const g = client(tk); await g.open; const wg = await g.next('welcome');
    assert.equal(wg.saved, false);
    assert.match((await g.next('notice', (m) => /visiting/.test(m.msg))).msg, why);
    g.ws.close();
  }
  // A page that never says hello is let in as a visitor after a short wait.
  const quiet = client(null, false); await quiet.open; const wq = await quiet.next('welcome', () => true, 5000);
  assert.equal(wq.saved, false);
  await quiet.send({ t: 'ranks' });
  assert.equal((await quiet.next('ranks')).saved, false, 'visitors are not ranked');
  quiet.ws.close();
  step('expired, forged and tampered tickets visit without saving, and old pages still get in');

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
