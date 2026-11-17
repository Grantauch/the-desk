// Bramblefen Basin: the generator gives the same map every time, every landmark can be reached from the gate, and the
// live server lets a trainer walk in from the wilds, meet wild Checklings in the reeds and walk back out.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { generateFen, FEN_SOLID } from './public/fen.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const step = (label) => console.log('  ok', label);
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'fen.json'), 'utf8'));
const t0 = performance.now();
const FEN = generateFen(CFG);
const ms = Math.round(performance.now() - t0);
const S = CFG.size;
const walkable = (x, y) => { const c = FEN.rows[y]?.[x]; return Boolean(c) && !FEN_SOLID.has(c); };

// ---------- the generator ----------
assert.equal(generateFen(CFG).hash, FEN.hash, 'same settings, same basin');
assert.notEqual(generateFen({ ...CFG, seed: CFG.seed + 1 }).hash, FEN.hash, 'another seed is another basin');
assert.equal(FEN.rows.length, S);
for (const r of FEN.rows) { assert.equal(r.length, S); assert.match(r, /^[.mMwWTGQPBKOUHE]+$/); }
step(`a ${S} by ${S} basin, the same every time (${FEN.hash}), built in ${ms} ms`);

// Everything you can stand on is reachable from the gate, and every landmark has an open side.
const seen = new Set([FEN.arrive.join(',')]), queue = [FEN.arrive];
for (let k = 0; k < queue.length; k++) {
  const [x, y] = queue[k];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
    if (seen.has(key) || !walkable(nx, ny) || FEN.rows[ny][nx] === 'E') continue;
    seen.add(key); queue.push([nx, ny]);
  }
}
let open = 0;
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (walkable(x, y) && FEN.rows[y][x] !== 'E') { open++; assert.ok(seen.has(`${x},${y}`), `tile ${x},${y} is cut off`); }
assert.ok(open > 30000, 'plenty of ground to explore');
for (const m of FEN.marks) {
  const sides = [];
  for (let y = m.y - 6; y <= m.y + 6; y++) for (let x = m.x - 6; x <= m.x + 6; x++) if (seen.has(`${x},${y}`)) sides.push(1);
  assert.ok(sides.length, `${m.id} can be reached`);
}
step(`all ${open} open tiles join up with the gate and every one of the ${FEN.marks.length} landmarks can be reached`);

for (const z of Object.keys(CFG.zones)) assert.ok(FEN.rows.some((r) => r.includes(z)), `zone ${z} is on the map`);
const [gx, gy] = FEN.arrive;
assert.equal(FEN.rows[S - 1][gx], 'E');
assert.equal(FEN.exits[0].x, gx); assert.equal(FEN.exits[0].y, S - 1);
for (const p of FEN.props) {
  assert.ok(fs.existsSync(path.join(HERE, 'public', 'art', `${p.s}.png`)), `art for ${p.s}`);
  assert.ok(FEN.signs[p.sign], `sign text for ${p.sign}`);
  for (let y = p.f[1]; y < p.f[1] + p.f[3]; y++) for (let x = p.f[0]; x < p.f[0] + p.f[2]; x++) assert.equal(FEN.rows[y][x], 'H', `${p.sign} stands on its footprint`);
}
assert.match(FEN.signs['fen-post-gate'], /Sunken Arch, north, about \d+ steps/);
step('the reeds, shallows and glowcap hollow are all there, and every landmark and signpost has art and words');

// ---------- the live server ----------
const PORT = 31000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-fen-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_KETTLE: path.join(DATA, 'no-kettle.json'),
    CHECKAVERSE_TEST_SPAWN: '12,1', CHECKAVERSE_WILD_RATE: '1', CHECKAVERSE_TURN_MS: '1500', CHECKAVERSE_WEATHER: 'off' }, stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket: null })));
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, test = () => true, ms = 5000) => {
    const end = Date.now() + ms, kinds = t.split('|');
    while (Date.now() < end) { const i = inbox.findIndex((m) => kinds.includes(m.t) && test(m)); if (i >= 0) return inbox.splice(i, 1)[0]; await sleep(20); }
    throw new Error(`timed out waiting for ${t}`);
  };
  const welcome = await next('welcome');
  const me = welcome.you;
  assert.equal(welcome.fen.hash, FEN.hash, 'the town and this test built the same basin');
  assert.equal(welcome.signs['fen-post-gate'], FEN.signs['fen-post-gate']);
  let pos = { x: 12, y: 1 }, room = welcome.room;
  const move = async (d) => {
    inbox.length = 0;
    ws.send(JSON.stringify({ t: 'move', d }));
    const m = await next('room|pos', (q) => q.t === 'room' || q.id === me);
    if (m.t === 'room') { room = m.room; const p = m.players.find((q) => q.id === me); pos = { x: p.x, y: p.y }; } else pos = { x: m.x, y: m.y };
    await sleep(120);
    return m;
  };
  assert.equal(room, 'town');
  await move('u');
  assert.equal(room, 'wilds');
  while (pos.y > 1) await move('u');
  const into = await move('u');
  assert.equal(into.t, 'room'); assert.equal(room, 'fen'); assert.equal(into.kind, 'fen');
  assert.deepEqual([pos.x, pos.y], [128, 253]);
  step('walked from town, up the wilds trail and through the gate into the basin');

  // A bramble bush, a rock or a stump stops a trainer.
  const block = (() => { for (let y = 200; y < 250; y++) for (let x = 100; x < 160; x++) if ('KOU'.includes(FEN.rows[y][x]) && seen.has(`${x},${y + 1}`)) return [x, y]; return null; })();
  assert.ok(block, 'something solid near the gate to bump into');
  // The way to the reeds and to the tile under that bush, found on this side too.
  const route = (to) => {
    const prev = new Map([[`${pos.x},${pos.y}`, null]]), q = [[pos.x, pos.y]];
    for (let k = 0; k < q.length; k++) {
      const [x, y] = q[k];
      if (x === to[0] && y === to[1]) break;
      for (const [dx, dy, d] of [[0, -1, 'u'], [1, 0, 'r'], [0, 1, 'd'], [-1, 0, 'l']]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (prev.has(key) || !walkable(nx, ny) || FEN.rows[ny][nx] === 'E' || 'Gw'.includes(FEN.rows[ny][nx]) && !(nx === to[0] && ny === to[1])) continue;
        prev.set(key, [x, y, d]); q.push([nx, ny]);
      }
    }
    const dirs = [];
    for (let p = prev.get(`${to[0]},${to[1]}`), key = `${to[0]},${to[1]}`; p; key = `${p[0]},${p[1]}`, p = prev.get(key)) dirs.unshift(p[2]);
    return dirs;
  };
  for (const d of route([block[0], block[1] + 1])) await move(d);
  await move('u');
  assert.deepEqual([pos.x, pos.y], [block[0], block[1] + 1], 'the bush did not let the trainer through');
  step(`bumped into the ${{ K: 'bramble bush', O: 'mossy rock', U: 'old stump' }[FEN.rows[block[1]][block[0]]]} at ${block[0]},${block[1]}`);

  // Wade into the nearest reeds. After the few free steps every step into a zone is a battle in this test.
  let reed = null;
  for (let r = 1; r < 60 && !reed; r++) for (let y = pos.y - r; y <= pos.y + r && !reed; y++) for (let x = pos.x - r; x <= pos.x + r; x++) {
    if (FEN.rows[y]?.[x] !== 'G' || !['l', 'r'].some((s, i) => FEN.rows[y][x + (i ? 1 : -1)] === 'G')) continue;
    if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`) && !'Gw'.includes(FEN.rows[y + dy][x + dx]))) { reed = [x, y]; break; }
  }
  assert.ok(reed, 'reeds near the gate');
  const path2 = route(reed);
  assert.ok(path2.length, 'a way to the reeds');
  for (const d of path2) await move(d);
  const side = FEN.rows[reed[1]][reed[0] + 1] === 'G' ? ['r', 'l'] : ['l', 'r'];
  let fight = null;
  for (let i = 0; i < 12 && !fight; i++) {
    ws.send(JSON.stringify({ t: 'move', d: side[i % 2] }));
    fight = await next('battle', () => true, 600).catch(() => null);
    await sleep(120);
  }
  assert.ok(fight, 'a wild Checkling came out of the reeds');
  assert.equal(fight.zone, 'Reed beds');
  const species = fight.view.sides[1].species;
  assert.ok(CFG.zones.G.table[species], `${species} lives in the reeds`);
  const lv = fight.view.sides[1].level;
  assert.ok(lv >= CFG.zones.G.levels[0] && lv <= CFG.zones.G.levels[1], 'at a basin level');
  ws.send(JSON.stringify({ t: 'run' }));
  await next('battle_end', () => true, 8000).catch(() => {});
  step(`met a wild ${species} at level ${lv} in the Reed beds and ran`);

  // And home again: back down the gate road and out through the gate to the top of the wilds trail.
  await sleep(1600);
  for (const d of route([gx, S - 2])) await move(d);
  await move('d');
  assert.equal(room, 'wilds');
  assert.deepEqual([pos.x, pos.y], CFG.exit.at);
  step('walked back out of the basin to the top of the wilds trail');

  ws.close();
  assert.ok(!/Error|uncaught/i.test(serverLog), serverLog);
  console.log('PASS bramblefen basin');
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
