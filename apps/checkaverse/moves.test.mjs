// Learning and forgetting moves: the rules, a level up offer on the bus ride, the learn card, and the gym's mini game
// rounds earning points until a move can be taught.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';
import * as Battle from './battle.mjs';
import * as Moves from './moves.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const step = (label) => console.log('  ok', label);
const RULES = Battle.loadRules(path.join(HERE, 'content', 'battle'));
const L = Moves.loadLearnsets(path.join(HERE, 'content', 'learnsets.json'), RULES);

// ---------- the rules ----------
assert.ok(Moves.canLearn(L, RULES, 'mochi', 'vine_lash'));
assert.ok(!Moves.canLearn(L, RULES, 'mochi', 'spark_jab'), 'an ember move is not for a meadow Checkling');
assert.ok(Moves.canLearn(L, RULES, 'ember', 'quick_jab'), 'universal moves are for everyone');
assert.deepEqual(Moves.levelOffers(L, RULES, 'mochi', 7, 16), ['vine_lash', 'soothing_sap']);
assert.deepEqual(Moves.levelOffers(L, RULES, 'mochi', 8, 15), []);
const four = ['strike', 'guard', 'recover', 'comfort_blanket'];
assert.equal(Moves.learn(L, RULES, four, 'vine_lash', null).ok, false, 'a full list needs a move to forget');
assert.deepEqual(Moves.learn(L, RULES, four, 'vine_lash', 'strike').known, ['vine_lash', 'guard', 'recover', 'comfort_blanket']);
const oneFree = ['strike', 'guard', 'petal_storm', 'comfort_blanket'];
assert.equal(Moves.learn(L, RULES, oneFree, 'vine_lash', 'guard').ok, false, 'the last free move stays');
assert.ok(Moves.learn(L, RULES, oneFree, 'deep_breath', 'guard').ok, 'a free move can replace the last free move');
assert.equal(Moves.roundPoints(100), 10); assert.equal(Moves.roundPoints(44), 4);
for (const g of L.gym.moves) assert.ok(L.games[g.game]);
for (const type of Object.keys(RULES.types.types)) assert.equal(L.gym.moves.filter((g) => RULES.moves[g.move].type === type).length, 3, `${type} has three gym moves`);
step('moves follow type, level ups offer the right ones, and a Checkling always keeps a free move');

{
  // A Checkling battles with the moves it knows.
  const b = Battle.createBattle(RULES, [{ name: 'A', species: 'mochi', level: 10, moves: ['vine_lash', 'guard', 'recover', 'comfort_blanket'] }, { name: 'B', species: 'bolt', level: 10 }], 3);
  assert.ok(Battle.canUse(RULES, b, 0, 'vine_lash') && !Battle.canUse(RULES, b, 0, 'strike'));
  const stuck = Battle.createBattle(RULES, [{ name: 'A', species: 'mochi', level: 10, moves: ['vine_lash', 'petal_storm'] }, { name: 'B', species: 'bolt', level: 10 }], 3);
  assert.ok(Battle.view(RULES, stuck).sides[0].moves.some((m) => m.cost === 0), 'a list with no free move gets Guard');
  step('a Checkling battles with its own moves and never gets stuck');
}

// ---------- end to end ----------
const PORT = 25000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-moves-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN, CHECKAVERSE_GYM_MIN_MS: '400', CHECKAVERSE_TEST_SPAWN: '9,7;9,8;10,7;10,8;9,7;11,7' },
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
    while (Date.now() < end) { const i = inbox.findIndex((m) => m.t === t && test(m)); if (i >= 0) return inbox.splice(i, 1)[0]; await sleep(20); }
    throw new Error(`timed out waiting for ${t}`);
  };
  const send = async (m) => { ws.send(JSON.stringify(m)); await sleep(300); };
  return { ws, inbox, next, send, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}
let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const pid = 'MovesTrainerPid0000001';
  const ticket = (n) => { const now = Date.now(); return signTicket(key, { v: 1, p: pid, h: '3rd Hour', d: '2026-11-02', c: true, n, s: 4, b: 9, k: { s: 'mochi', n: '' }, iat: now, exp: now + 7_200_000, j: `m${n}` }); };

  // First ride at 1 check-in, then a ride after 40 more check-ins: the partner passes level 8 and is offered Vine lash.
  const first = client(ticket(1)); await first.open; await first.next('welcome'); first.ws.close(); await sleep(300);
  const a = client(ticket(41)); await a.open;
  const w = await a.next('welcome');
  const mine = w.team.find((c) => c.hatched);
  assert.ok(mine.level >= 8, `the partner grew past level 8 (level ${mine.level})`);
  const offer = await a.next('learn_offer', () => true, 4000);
  assert.equal(offer.move.id, 'vine_lash');
  assert.equal(offer.known.length, 4);
  step('a level up past 8 offers a meadow Checkling Vine lash on the next ride');

  await a.send({ t: 'learn', id: offer.id, move: 'vine_lash', forget: 'strike' });
  await a.next('notice', (m) => /learned Vine lash/.test(m.msg));
  step('the student forgets Strike to learn Vine lash');

  // Visitors cannot train. The saved trainer rides into town by the arena and opens the gym.
  const v = client(null); await v.open; await v.next('welcome');
  await v.send({ t: 'gym' });
  await v.next('notice', (m) => /Ride the bus/.test(m.msg));
  await a.send({ t: 'bus', to: 'town' });
  await a.next('room', (m) => m.kind === 'town');
  await a.send({ t: 'gym' });
  const gym = await a.next('gym');
  assert.ok(gym.known.some((k) => k.id === 'vine_lash') && !gym.known.some((k) => k.id === 'strike'));
  assert.ok(gym.moves.every((m) => m.type === 'meadow' || L.universal.includes(m.id)), 'the gym offers meadow and universal moves');
  const jab = gym.moves.find((m) => m.id === 'quick_jab');
  assert.equal(jab.points, 0); assert.equal(jab.game, 'aim');
  step('the gym lists moves for the partner\'s type with their mini games');

  // A round that ends too fast earns nothing. Real rounds earn score / 10.
  await a.send({ t: 'gym_start', move: 'quick_jab' });
  const r0 = await a.next('gym_round');
  assert.equal(r0.game, 'aim');
  a.ws.send(JSON.stringify({ t: 'gym_finish', round: r0.round, score: 100 }));
  const quick = await a.next('gym_result');
  assert.equal(quick.earned, 0); assert.ok(quick.quick);
  let points = 0;
  for (const score of [100, 90, 100]) {
    await sleep(300);
    await a.send({ t: 'gym_start', move: 'quick_jab' });
    const r = await a.next('gym_round');
    await sleep(450);
    await a.send({ t: 'gym_finish', round: r.round, score });
    const res = await a.next('gym_result');
    assert.equal(res.earned, Math.round(score / 10));
    points = res.points;
  }
  assert.equal(points, 29);
  await a.send({ t: 'gym_finish', round: 'made-up', score: 100 });
  assert.ok(!a.inbox.some((m) => m.t === 'gym_result'), 'a made up round earns nothing');
  await a.send({ t: 'gym_teach', move: 'quick_jab', forget: 'recover' });
  await a.next('notice', (m) => /Train a little more first/.test(m.msg));
  await a.send({ t: 'gym_start', move: 'quick_jab' });
  const r4 = await a.next('gym_round'); await sleep(450);
  await a.send({ t: 'gym_finish', round: r4.round, score: 30 });
  const full = await a.next('gym_result');
  assert.equal(full.points, 30, 'points stop at the price');
  step('mini game rounds earn points by score, and too quick or made up rounds earn nothing');

  await a.send({ t: 'gym_teach', move: 'quick_jab', forget: 'recover' });
  await a.next('notice', (m) => /learned Quick jab/.test(m.msg));
  const after = await a.next('gym', (m) => m.known.some((k) => k.id === 'quick_jab'));
  assert.ok(!after.known.some((k) => k.id === 'recover'));
  assert.equal(after.moves.find((m) => m.id === 'quick_jab').known, true);
  assert.equal(after.moves.find((m) => m.id === 'quick_jab').points, 0, 'teaching spends the points');
  step('a fully trained move is taught, forgetting the move the student picked');

  a.ws.close(); v.ws.close();
  console.log('PASS moves and gym');
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
