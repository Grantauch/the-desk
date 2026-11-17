// Battle rules check: every content entry loads, the type chart is fair, and battles replay exactly from their seed.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from './battle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = B.loadRules(path.join(HERE, 'content', 'battle'));
const ok = (label) => console.log('  ok', label);
const S = Object.keys(R.species.species);

// Content
assert.equal(Object.keys(R.types.types).length, 8, 'eight types');
for (const sp of S) assert.ok(R.species.species[sp].moves.length <= 4);
const loop = [['ember', 'meadow'], ['meadow', 'gear'], ['gear', 'cosmic'], ['cosmic', 'ember']];
for (const [a, b] of loop) assert.equal(B.typeMultiplier(R, a, b), R.types.strong, `${a} beats ${b}`);
for (const [a, b] of loop) assert.equal(B.typeMultiplier(R, b, a), R.types.weak, `${b} is weak into ${a}`);
assert.equal(B.typeMultiplier(R, null, 'ember'), 1);
ok('content loads and the founder loop holds');

// The checker refuses broken content.
const broken = (fn) => { const c = structuredClone(R); fn(c); assert.throws(() => B.checkRules(c)); };
broken((c) => { c.types.types.meadow.beats = ['gear']; });
broken((c) => { c.types.types.gear.beats = ['meadow', 'tide']; });
broken((c) => { c.species.species.mochi.moves.push('strike', 'orbit'); });
broken((c) => { c.species.species.mochi.moves = ['strike', 'nope']; });
broken((c) => { c.moves.strike.damage = 500; });
broken((c) => { c.moves.strike.typo = 1; });
broken((c) => { c.species.species.bolt.traits = []; });
broken((c) => { c.species.species.zee.type = 'plasma'; });
ok('broken content is refused before a student sees it');

// Same seed, same battle.
const play = (seed) => {
  const b = B.createBattle(R, [{ name: 'A', species: 'ember' }, { name: 'B', species: 'zee' }], seed);
  const log = [];
  const moves = ['strike', 'banked_heat', 'recover', 'guard'];
  for (let i = 0; !b.over; i++) log.push(B.resolveTurn(R, b, [moves[i % 4], i % 3 ? 'orbit' : 'strike']).events);
  return JSON.stringify([log, b.winner]);
};
assert.equal(play(42), play(42));
assert.notEqual(play(42), play(43));
ok('a seed replays a battle exactly');

// Guard cuts a hit to a quarter, stamina is spent and refused when short, knockouts end the match.
{
  const b = B.createBattle(R, [{ name: 'A', species: 'mochi' }, { name: 'B', species: 'bolt' }], 1);
  const hp = b.sides[1].hp;
  B.resolveTurn(R, b, ['strike', 'guard']);
  assert.ok(hp - b.sides[1].hp <= 4 && hp - b.sides[1].hp >= 1, 'guarded strike lands small');
  assert.equal(b.sides[1].counters.charge, 1, 'Bolt stores a charge when it blocks');
  b.sides[0].stamina = 1;
  assert.equal(B.canUse(R, b, 0, 'strike'), false);
  const r = B.resolveTurn(R, b, ['strike', 'strike']);
  assert.equal(r.picks[0], 'guard', 'a move you cannot afford falls back to Guard');
  b.sides[0].hp = 1;
  B.resolveTurn(R, b, ['guard', 'salvage_charge']);
  assert.equal(b.over, true); assert.equal(b.winner, 1); assert.equal(b.reason, 'knockout');
  assert.throws(() => B.resolveTurn(R, b, ['strike', 'strike']));
}
ok('guard, stamina and knockouts follow the rules');

// Ember banks heat on Recover, then spends it. Zee alternates Orbit.
{
  const b = B.createBattle(R, [{ name: 'A', species: 'ember' }, { name: 'B', species: 'zee' }], 9);
  B.resolveTurn(R, b, ['recover', 'guard']);
  assert.equal(b.sides[0].counters.heat, 1);
  B.resolveTurn(R, b, ['banked_heat', 'orbit']);
  assert.equal(b.sides[0].counters.heat, 0);
  assert.equal(b.sides[1].phase.orbit, 1, 'Orbit moves to its second step');
  const v = B.view(R, b);
  assert.equal(v.sides[1].moves.find((m) => m.id === 'orbit').next, 12, 'the screen shows the next Orbit step');
}
ok('signature moves work from their content entries');

// Forfeit and the turn limit.
{
  const b = B.createBattle(R, [{ name: 'A', species: 'mochi' }, { name: 'B', species: 'mochi' }], 3);
  B.forfeit(b, 0, 'left');
  assert.deepEqual([b.over, b.winner, b.reason], [true, 1, 'left']);
  const c = B.createBattle(R, [{ name: 'A', species: 'mochi' }, { name: 'B', species: 'mochi' }], 3);
  while (!c.over) B.resolveTurn(R, c, ['guard', 'guard']);
  assert.equal(c.turn, R.settings.maxTurns); assert.equal(c.winner, 'draw'); assert.equal(c.reason, 'time');
}
ok('forfeits and the turn limit end a match');

// Evolution: level lines change at their level, morphs read the body, and every form knows its line.
assert.equal(B.nextForm(R, 'mochi', 14, {}), null);
assert.equal(B.nextForm(R, 'mochi', 15, {}), 'thicket');
assert.equal(B.nextForm(R, 'thicket', 30, {}), 'elderbough');
assert.equal(B.nextForm(R, 'elderbough', 50, {}), null);
assert.equal(B.nextForm(R, 'bramble', 20, { weight: 50, mood: 70, health: 100 }), 'thornbloom');
assert.equal(B.nextForm(R, 'bramble', 20, { weight: 85, mood: 70, health: 100 }), 'berryhold');
assert.equal(B.nextForm(R, 'bramble', 20, { weight: 20, mood: 70, health: 100 }), 'briarwisp');
assert.equal(B.nextForm(R, 'bramble', 20, { weight: 50, mood: 10, health: 100 }), 'briarwisp');
assert.equal(B.lineRoot(R, 'elderbough'), 'mochi');
assert.equal(B.lineRoot(R, 'riptail'), 'reedling');
assert.deepEqual(R.species.starters, ['mochi', 'bolt', 'zee', 'ember']);
broken((c) => { c.species.species.mochi.evolves = [{ level: 15, into: 'nope' }]; });
broken((c) => { c.species.species.elderbough.evolves = [{ level: 40, into: 'mochi' }]; });
broken((c) => { c.species.species.bramble.evolves.pop(); });
broken((c) => { c.species.starters = ['plasma']; });
ok('evolution follows levels and care');

// Every matchup finishes, and no species wins or loses everything against another form at the same stage.
const stage = (id) => { let n = 1; for (let at = id; B.lineRoot(R, at) !== at; n++) at = Object.keys(R.species.species).find((k) => (R.species.species[k].evolves || []).some((e) => e.into === at)); return n; };
const pairs = [];
for (const a of S) for (const c of S) if (stage(a) === stage(c)) pairs.push([a, c]);
for (const [a, c] of pairs) {
  let w = 0;
  for (let k = 0; k < 200; k++) {
    const b = B.createBattle(R, [{ name: 'A', species: a }, { name: 'B', species: c }], 1000 + k);
    let s = k * 97 + 5;
    const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const pick = (i) => { const sig = R.species.species[b.sides[i].species].moves[3], x = r();
      return B.canUse(R, b, i, sig) && x < 0.45 ? sig : B.canUse(R, b, i, 'strike') && x < 0.8 ? 'strike' : x < 0.9 ? 'guard' : 'recover'; };
    while (!b.over) B.resolveTurn(R, b, [pick(0), pick(1)]);
    if (b.winner === 0) w++;
  }
  assert.ok(w > 20 && w < 180, `${a} vs ${c} won ${w} of 200, too one sided`);
}
ok(`no matchup between forms at the same stage is one sided (${pairs.length} pairs)`);
console.log('PASS battle rules');
