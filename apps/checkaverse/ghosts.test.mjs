// Ghosts: the rules on their own, then end to end in a tiny Kettle Creek. Grave moss comes off headstones, the
// apothecary brews Spirit Sight, a classmate's ghost can be battled but not caught, your own can be caught and
// joins the party as a ghost that never eats, and a ghost fades on its fading turns.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';
import * as Battle from './battle.mjs';
import * as Care from './care.mjs';
import * as Ghosts from './ghosts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const step = (label) => console.log('  ok', label);
const RULES = Battle.loadRules(path.join(HERE, 'content', 'battle'));
const CARE = Care.loadCare(path.join(HERE, 'content'));
const G = Ghosts.loadGhosts(path.join(HERE, 'content', 'ghosts.json'), CARE, RULES);

// ---------- the rules ----------
assert.equal(Ghosts.temperOf(G, 'malnutrition', 10), 'angry');
assert.equal(Ghosts.temperOf(G, 'glowing_mushroom', 3), 'calm');
assert.equal(Ghosts.temperOf(G, 'heart_trouble', 10), 'restless');
assert.equal(Ghosts.temperOf(G, 'malnutrition', 90), 'calm', 'a long life leaves a calm ghost');
step('how a Checkling died decides its ghost temperament');

{
  // A Monday in the school calendar, with deaths a week back and yesterday.
  const day = Object.keys(CARE.calendar.noSchool).length ? CARE.calendar.start : '2026-09-08';
  let monday = day;
  for (let i = 0; i < 30 && !(Care.isSchoolDay(CARE, monday) && new Date(`${monday}T12:00:00Z`).getUTCDay() === 1); i++) {
    const d = new Date(`${monday}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); monday = d.toISOString().slice(0, 10);
  }
  const later = (n) => { let d = monday; for (let k = 0; k < n;) { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); if (Care.isSchoolDay(CARE, d)) k++; } return d; };
  const today = later(12);
  const old = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, died: `${monday}T15:00:00Z`, x: i, y: 0 }));
  const fresh = [{ id: 99, died: `${today}T08:00:00Z`, x: 50, y: 0 }];
  const out = Ghosts.presentToday(G, CARE, [...old, ...fresh], today);
  assert.ok(out.length > 0 && out.length <= G.maxPerDay, `at most ${G.maxPerDay} ghosts a day (got ${out.length})`);
  assert.ok(!out.some((st) => st.id === 99), 'a fresh death has no ghost yet');
  assert.deepEqual(Ghosts.presentToday(G, CARE, old, today).map((s) => s.id), out.map((s) => s.id), 'every classmate sees the same ghosts');
  const held = new Set(out.map((s) => s.id));
  assert.ok(!Ghosts.presentToday(G, CARE, old, today, held).some((s) => held.has(s.id)), 'a caught ghost is not in the cemetery');
  let sat = today; while (Care.isSchoolDay(CARE, sat)) { const x = new Date(`${sat}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); sat = x.toISOString().slice(0, 10); }
  assert.equal(Ghosts.presentToday(G, CARE, old, sat).length, 0, 'ghosts only come out on school days');
  assert.ok(Ghosts.schoolDaysSince(CARE, `${monday}T15:00:00Z`, later(G.waitSchoolDays)) >= G.waitSchoolDays);
  const placed = Ghosts.placeGhosts([{ x: 1, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 1 }], (x, y) => y === 2);
  assert.equal(new Set(placed.map((g) => `${g.x},${g.y}`)).size, placed.length, 'two ghosts never share a tile');
  step('ghosts wait five school days, a few come out each school day, and never two to a tile');
}

{
  const ghost = Ghosts.ghostSide(G, 'angry');
  const b = Battle.createBattle(RULES, [{ name: 'A', species: 'mochi', level: 10 }, { name: 'Ghost', species: 'bolt', level: 10, ghost }], 7);
  const v = Battle.view(RULES, b);
  assert.equal(v.sides[1].type, 'shade');
  assert.ok(v.sides[1].ghost);
  assert.ok(v.sides[1].moves.some((m) => m.id === 'wail') && !v.sides[1].moves.some((m) => m.id === 'recover'), 'Wail takes the place of Recover');
  assert.equal(v.sides[1].fadeNext, false);
  Battle.resolveTurn(RULES, b, ['strike', 'guard']);
  assert.equal(Battle.view(RULES, b).sides[1].fadeNext, true, 'the screen warns before a fading turn');
  const before = b.sides[1].hp;
  const t = Battle.resolveTurn(RULES, b, ['strike', 'guard']);
  assert.ok(t.events.some((e) => e.k === 'fade' && e.side === 1));
  assert.equal(b.sides[1].hp, before, 'attacks pass through on the fading turn');
  assert.ok(Battle.canUse(RULES, b, 1, 'wail') && !Battle.canUse(RULES, b, 1, 'recover'));
  // Same seed, same battle.
  const again = Battle.createBattle(RULES, [{ name: 'A', species: 'mochi', level: 10 }, { name: 'Ghost', species: 'bolt', level: 10, ghost }], 7);
  Battle.resolveTurn(RULES, again, ['strike', 'guard']); Battle.resolveTurn(RULES, again, ['strike', 'guard']);
  assert.deepEqual(again.sides, b.sides);
  step('a ghost is Shade type, knows Wail, warns before it fades and lets attacks pass through');
}

{
  // The store's side of ghosts, without a server: one ghost in the party, no evolving, and fading after a while away.
  const { openStore, loadGrowth, todayKey } = await import('./accounts.mjs');
  const growth = loadGrowth(path.join(HERE, 'content', 'growth.json'));
  const db = new DatabaseSync(':memory:');
  const store = openStore(db, growth, CARE, { wasUp: () => true, speciesName: (x) => x, ghostKeep: 2, ghostParty: 1,
    evolve: (id, level, body) => Battle.nextForm(RULES, id, level, body), root: (id) => Battle.lineRoot(RULES, id) });
  const t = { pid: 'storeghostpid0000001', hour: '1st Hour', days: 0, partner: { species: 'mochi', nick: '' } };
  store.link(t, () => 'Bright Star', 0);
  const one = store.addGhost(t.pid, { species: 'bolt', level: 14, temper: 'calm' });
  assert.ok(one.party);
  const two = store.addGhost(t.pid, { species: 'zee', level: 5, temper: 'angry' });
  assert.equal(two.party, false, 'a second ghost waits in the Den');
  assert.match(store.moveDen(t.pid, two.id, true).msg, /Only one ghost/);
  assert.equal(store.battleXp(t.pid, one.id, 90).evolved, null, 'ghosts never evolve, even past their change level');
  assert.equal(store.mods(t.pid, one.id), null);
  assert.equal(store.care(t.pid, one.id, 'feed', 'x').ok, false);
  // Send the second ghost far back in time in the Den. If enough school days have passed since, it fades.
  const back = '2026-09-02';
  db.prepare('UPDATE checklings SET ghost = ? WHERE id = ?').run(JSON.stringify({ temper: 'angry', away: 0, clock: back }), two.id);
  const owed = Care.owedDays(CARE, back, todayKey()).length;
  const after = store.link(t, () => 'Bright Star', 0);
  if (owed >= 2) {
    assert.equal(after.faded.length, 1);
    assert.ok(!store.team(t.pid).some((r) => r.id === two.id), 'a ghost left out too long fades back to the cemetery');
  }
  assert.ok(store.team(t.pid).some((r) => r.id === one.id), 'a ghost kept in the party stays');
  step('one ghost travels at a time, ghosts never evolve or eat, and one left in the Den fades');
}

// ---------- end to end ----------
const PORT = 21000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-ghosts-'));
const KETTLE = path.join(DATA, 'kettle.json');
fs.writeFileSync(KETTLE, JSON.stringify({
  id: 'kettle',
  rows: [
    'TTTTTTTTTTTT',
    'T..........T',
    'T..........T',
    'T..........T',
    'T.HHH......T',
    'T.HHH......T',
    'T..........T',
    'TTTTTTTTTTTT',
  ],
  arrive: [[4, 6]],
  props: [
    { s: 'house-cottage', x: 2, b: 6, w: 3, f: [2, 4, 3, 2], sign: 'home' },
    { s: 'prop-bus-stop', x: 1, b: 2, w: 1, f: [1, 1, 1, 1], sign: 'bus-stop-kc' },
  ],
  doors: [{ x: 3, y: 6, place: 'home' }, { x: 5, y: 6, place: 'apothecary' }],
  graves: [[8, 1], [10, 1]],
  exits: [],
}));
const GFILE = path.join(DATA, 'ghosts.json');
fs.writeFileSync(GFILE, JSON.stringify({ ...G, schoolDaysOnly: false, waitSchoolDays: 0, dailyChance: 1, wanderer: { ...G.wanderer, chance: 1 } }));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_KETTLE: KETTLE,
    CHECKAVERSE_GHOSTS: GFILE, CHECKAVERSE_TURN_MS: '1500', CHECKAVERSE_CATCH_CHANCE: '1' },
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
  const walk = async (dirs) => { for (const d of dirs) await send({ t: 'move', d }); };
  return { ws, inbox, next, send, walk, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const now = Date.now();
  const pid = 'Gh0stTrainerPid0000001';
  const ticket = signTicket(key, { v: 1, p: pid, h: '2nd Hour', d: '2026-11-02', c: true, n: 12, s: 4, b: 9,
    k: { s: 'mochi', n: '' }, iat: now, exp: now + 7_200_000, j: 'g' });

  // First ride makes the trainer. Then two Checklings from the class are buried: a classmate's, then this trainer's.
  const first = client(ticket); await first.open; await first.next('welcome'); first.ws.close(); await sleep(300);
  const db = new DatabaseSync(path.join(DATA, 'checkaverse.db'));
  const cid = Number(db.prepare("INSERT INTO checklings (pid, species, nick, xp, party, hatched, origin, born, died) VALUES (?, 'bolt', 'Biscuit', 900, 0, 0, 'egg', '2026-09-01T12:00:00Z', 'malnutrition')").run(pid).lastInsertRowid);
  const grave = db.prepare('INSERT INTO graves (hour, trainer, species, level, days, cause, epitaph, died, pid, cid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  grave.run('2nd Hour', 'Quiet Comet', 'zee', 7, 12, 'cold', 'It sneezed its last.', '2026-10-01T12:00:00Z', 'SomeoneElsePid00000001', 0);
  grave.run('2nd Hour', 'Brave Otter', 'bolt', 6, 20, 'malnutrition', 'Should have eaten.', '2026-10-02T12:00:00Z', pid, cid);
  db.close();

  const a = client(ticket); await a.open;
  const w = await a.next('welcome');
  assert.equal(w.stones.length, 2);
  const g0 = await a.next('ghosts');
  assert.equal(g0.sight, 0);
  assert.equal(g0.ghosts.length, 0, 'ghosts are hidden without Spirit Sight');
  assert.deepEqual(g0.frost.map(String).sort(), ['10,1', '8,1'], 'stones with a hidden ghost show frost');
  step('a trainer at home sees frost on the stones whose ghosts are out, but not the ghosts');

  await a.walk(['r', 'r', 'r', 'r', 'u', 'u', 'u']); // to (8,3)
  await a.send({ t: 'stone', x: 8, y: 1 });
  const look1 = await a.next('notice', (m) => /Brave Otter/.test(m.msg));
  assert.ok(G.clues.some((c) => look1.msg.includes(c)), 'looking at the stone gives a clue');
  assert.match(look1.msg, /grave moss/);
  await sleep(350);
  await a.send({ t: 'stone', x: 8, y: 1 });
  const again = await a.next('notice', (m) => /Brave Otter/.test(m.msg));
  assert.ok(!/scrape/.test(again.msg), 'the same stone gives moss once a day');
  await a.walk(['r', 'r']); // to (10,3)
  await a.send({ t: 'stone', x: 10, y: 1 });
  const look2 = await a.next('notice', (m) => /Quiet Comet/.test(m.msg));
  assert.match(look2.msg, /You have 2/);
  step('each headstone gives a little grave moss once a day');

  await a.walk(['l', 'l', 'd', 'd', 'd', 'l', 'l', 'l']); // to the apothecary door (5,6)
  await a.send({ t: 'apothecary' });
  const shop = await a.next('apothecary');
  assert.equal(shop.moss, 2); assert.equal(shop.need, G.sight.moss); assert.equal(shop.sight, 0);
  await sleep(450);
  await a.send({ t: 'apothecary', brew: true });
  await a.next('notice', (m) => /Spirit Sight/.test(m.msg));
  const g1 = await a.next('ghosts');
  assert.ok(g1.sight > 0);
  assert.equal(g1.ghosts.length, 3, 'two stone ghosts and a wanderer');
  assert.ok(g1.ghosts.some((g) => g.mine) && g1.ghosts.some((g) => g.wander));
  assert.ok(!JSON.stringify(g1).includes('Quiet Comet') && !JSON.stringify(g1).includes('SomeoneElse'), 'a ghost never carries another trainer\'s name or ID');
  await sleep(450);
  await a.send({ t: 'apothecary', brew: true });
  await a.next('notice', (m) => /already see ghosts/.test(m.msg));
  step('the apothecary brews Spirit Sight from grave moss, and the ghosts appear');

  const theirs = g1.ghosts.find((g) => !g.mine && !g.wander);
  assert.deepEqual([theirs.x, theirs.y], [10, 2]);
  await a.walk(['r', 'r', 'r', 'r', 'r', 'u', 'u', 'u', 'u']); // into (10,2)
  const b1 = await a.next('battle', () => true, 4000);
  assert.ok(b1.ghost && !b1.ghost.canCatch && !b1.ghost.mine);
  assert.equal(b1.ghost.temper, 'restless');
  assert.equal(b1.view.sides[1].type, 'shade');
  await a.send({ t: 'charm' });
  await a.next('notice', (m) => /only answers to the trainer who raised it/.test(m.msg));
  await a.send({ t: 'run' });
  await a.next('battle_end', (m) => m.reason === 'ran');
  step('a classmate\'s ghost can be battled but not caught');

  await a.walk(['l', 'l']); // into (8,2)
  const b2 = await a.next('battle', () => true, 4000);
  assert.ok(b2.ghost.canCatch && b2.ghost.mine);
  assert.equal(b2.ghost.temper, 'angry');
  assert.equal(b2.ghost.name, 'Biscuit');
  await a.send({ t: 'charm' });
  const end = await a.next('battle_end', (m) => m.reason === 'caught', 4000);
  assert.equal(end.kept, 'party');
  const team = await a.next('team', (m) => m.team.some((c) => c.ghost));
  const ghost = team.team.find((c) => c.ghost);
  assert.equal(ghost.nick, 'Biscuit');
  assert.equal(ghost.species, 'bolt');
  await sleep(250);
  const g2 = a.inbox.filter((m) => m.t === 'ghosts').at(-1);
  assert.ok(!g2.ghosts.some((g) => g.mine), 'a caught ghost leaves the cemetery');
  assert.equal(g2.frost.length, 1);
  step('your own Checkling\'s ghost can be caught and comes back under its old name');

  await a.send({ t: 'care', id: ghost.v, a: 'feed' });
  const cared = await a.next('cared');
  assert.equal(cared.ok, false);
  assert.match(cared.msg, /Ghosts do not eat/);
  await a.send({ t: 'body', id: ghost.v });
  const body = await a.next('body');
  assert.ok(body.body.ghost);
  step('a caught ghost never eats and has no body clock');

  const db2 = new DatabaseSync(path.join(DATA, 'checkaverse.db'));
  const rows = db2.prepare("SELECT origin, ghost, died FROM checklings WHERE pid = ? AND origin LIKE 'ghost:%'").all(pid);
  db2.close();
  assert.equal(rows.length, 1);
  assert.match(rows[0].origin, /^ghost:\d+$/);
  assert.equal(JSON.parse(rows[0].ghost).temper, 'angry');
  step('the ghost is saved with its grave and temperament');

  a.ws.close();
  console.log('PASS ghosts');
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
