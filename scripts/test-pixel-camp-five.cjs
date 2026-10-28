// Pixel Camp 5 rules: version bridge, daily foraging, the stump ladder, friendship levels and camp goals.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../public/hubs/checkling/camp/engine.js');
require('../public/hubs/checkling/camp/camp-goals.js');
const E = globalThis.FirstTrail, G = globalThis.CampGoals;
const plain = x => JSON.parse(JSON.stringify(x));

function v1Camp() {
  const s = plain(E.toV1(E.initial()));
  s.pets.zee.discoveries = [0, 2]; s.pets.zee.battles = 1; s.decor = ['planter']; s.equipped = 'planter';
  s.pets.mochi.memories = [{id:'find-0', text:'At the seed gate, Mochi found a seed.'}];
  return s;
}
const run = (s, actions) => actions.reduce((state, a) => E.dispatch(state, a).state, s);

test('a 4.x version 1 save opens unchanged and upgrades in memory', () => {
  const old = v1Camp(), s = E.hydrate(old);
  assert.equal(s.version, 2);
  assert.deepEqual(s.pets.zee.discoveries, [0, 2]); assert.equal(s.pets.zee.battles, 1);
  assert.deepEqual(s.decor, ['planter']); assert.deepEqual(s.curios, []); assert.deepEqual(s.forage, {day:'', taken:[]});
  assert.equal(s.pets.mochi.memories.length, 1);
  const forged = plain(old); forged.pets.zee.battles = 3; forged.curios = ['key'];
  const h = E.hydrate(forged);
  assert.equal(h.pets.zee.battles, 1, 'a version 1 save cannot claim ladder badges');
  assert.deepEqual(h.curios, [], 'a version 1 save cannot carry curios');
});

test('toV1 keeps everything a 4.x page understands and drops the rest', () => {
  let s = E.hydrate(v1Camp());
  s.pets.bolt.battles = 3; s.pets.mochi.battles = 3; s.pets.ember.battles = 3; s.pets.zee.battles = 3;
  s.pets.mochi.discoveries = [0, 1, 2]; s.pets.bolt.discoveries = [0, 1, 2];
  s = run(s, [{type:'unlock', id:'shelf'}]);
  assert.equal(s.equipped, 'shelf');
  const v1 = E.toV1(s);
  assert.equal(v1.version, 1);
  for (const id of E.IDS) assert.equal(v1.pets[id].battles, 1);
  assert.equal('curios' in v1, false); assert.equal('forage' in v1, false);
  assert.ok(v1.decor.every(id => ['planter', 'lantern', 'pennants'].includes(id)));
  assert.equal(v1.equipped, '');
  assert.deepEqual(plain(E.hydrate(v1)).pets.bolt.discoveries, [0, 1, 2]);
});

test('each stop offers one curio a day, the same for everyone, from that stop', () => {
  for (const day of ['2026-10-28', '2026-11-02', '2027-01-15']) for (const stop of [0, 1, 2]) {
    const a = E.curioFor(day, stop), b = E.curioFor(day, stop);
    assert.equal(a.id, b.id); assert.equal(a.stop, stop);
  }
  assert.equal(E.curioFor('not-a-day', 0), null); assert.equal(E.curioFor('2026-10-28', 3), null);
  const seen = new Map(); let rare = 0, total = 0;
  for (let d = 0; d < 400; d++) {
    const day = new Date(Date.UTC(2026, 8, 1) + d * 864e5).toISOString().slice(0, 10);
    for (const stop of [0, 1, 2]) { const c = E.curioFor(day, stop); seen.set(c.id, (seen.get(c.id) || 0) + 1); total++; if (c.rarity === 'rare') rare++; }
  }
  assert.equal(seen.size, E.CURIOS.length, 'every curio turns up over a school year');
  assert.ok(rare / total > 0.05 && rare / total < 0.16, 'rare curios stay rare: ' + rare / total);
  assert.equal(new Set(E.CURIOS.map(c => c.cell)).size, 16, 'each curio has its own picture');
});

test('foraging works once per stop per day and starts fresh the next day', () => {
  let s = E.hydrate(E.initial());
  const day = '2026-10-28';
  let r = E.dispatch(s, {type:'forage', day});
  assert.equal(r.changed, true); s = r.state;
  const c = E.curioFor(day, 0);
  assert.deepEqual(s.curios, [c.id]); assert.deepEqual(s.forage, {day, taken:[0]});
  assert.equal(s.pets.mochi.energy, 80 - E.FORAGE_ENERGY);
  assert.ok(s.pets.mochi.memories.some(m => m.id === 'curio-' + c.id));
  r = E.dispatch(s, {type:'forage', day});
  assert.equal(r.changed, false); assert.match(r.message, /tomorrow/);
  r = E.dispatch(s, {type:'forage'});
  assert.equal(r.changed, false, 'no date, no forage');
  s = run(s, [{type:'stop', value:1}, {type:'forage', day}, {type:'stop', value:2}, {type:'forage', day}]);
  assert.deepEqual(s.forage.taken, [0, 1, 2]);
  assert.equal(E.forageOpen(s, day, 0), false); assert.equal(E.forageOpen(s, '2026-10-29', 0), true);
  s = run(s, [{type:'rest'}, {type:'stop', value:0}, {type:'forage', day:'2026-10-29'}]);
  assert.deepEqual(s.forage, {day:'2026-10-29', taken:[0]});
});

test('a tired friend rests before foraging and a duplicate curio is not counted twice', () => {
  let s = E.hydrate(E.initial()); s.pets.mochi.energy = 5;
  let r = E.dispatch(s, {type:'forage', day:'2026-10-28'});
  assert.equal(r.changed, false); assert.match(r.message, /rest/i);
  s = E.hydrate(E.initial());
  const id = E.curioFor('2026-10-28', 0).id; s.curios = [id];
  r = E.dispatch(s, {type:'forage', day:'2026-10-28'});
  assert.equal(r.changed, true); assert.deepEqual(r.state.curios, [id]); assert.match(r.message, /already on your shelf/);
});

test('the stump ladder unlocks in order and every badge is a trail stamp', () => {
  let s = E.hydrate(E.initial());
  let r = E.dispatch(s, {type:'battle-win', tier:2});
  assert.equal(r.changed, false, 'the old oak waits for the sapling');
  s = run(s, [{type:'battle-win', tier:1}, {type:'battle-win', tier:2}, {type:'battle-win', tier:3}]);
  assert.equal(s.pets.mochi.battles, 3); assert.equal(E.stamps(s), 3);
  assert.ok(s.pets.mochi.memories.some(m => m.id === 'practice-3'));
  r = E.dispatch(s, {type:'battle-win', tier:3});
  assert.equal(r.changed, false);
  const b = E.startBattle('zee', 3);
  assert.equal(b.enemy, E.TIERS[2].hp); assert.equal(b.enemyMax, E.TIERS[2].hp); assert.equal(b.tier, 3);
});

test('stump moves do what their labels say', () => {
  let b = E.startBattle('zee', 2); b.turn = 1;
  let r = E.battleMove(b, 'strike');
  assert.equal(r.battle.fighters.zee.stamina, 10 - 3 - 4, 'root snare drains 4 when not guarding');
  b = E.startBattle('zee', 2); b.turn = 1;
  r = E.battleMove(b, 'guard');
  assert.equal(r.battle.fighters.zee.stamina, 10, 'guarding the snare keeps stamina');
  b = E.startBattle('zee', 3); b.turn = 1;
  r = E.battleMove(b, 'strike');
  assert.equal(r.battle.enemy, E.TIERS[2].hp - 8, 'bark armor halves damage');
  b = E.startBattle('zee', 3); b.turn = 2;
  r = E.battleMove(b, 'strike');
  assert.equal(r.battle.fighters.zee.hp, 65 - 20, 'double swipe lands twice');
  b = E.startBattle('zee', 3); b.turn = 2;
  r = E.battleMove(b, 'guard');
  assert.equal(r.battle.fighters.zee.hp, 65 - 6, 'guard softens both swipes');
  b = E.startBattle('mochi', 3); b.turn = 2;
  r = E.battleMove(b, 'signature');
  assert.equal(r.battle.fighters.mochi.hp, 65 - 8, 'a shield is shared across both swipes');
  for (const t of E.TIERS) for (const step of t.pattern) {
    if (step.damage) assert.match(step.short, new RegExp(String(step.damage)));
    if (/Guard reduces it to (\d+)/.test(step.detail)) assert.equal(Math.ceil(step.damage * .25), +RegExp.$1);
  }
});

// A player who reads NEXT wins every tier with every lead. A button masher does not clear the elder stump.
function smart(b) {
  const it = E.intentFor(b), p = b.fighters[b.active], danger = it.damage * (it.hits || 1);
  if (danger >= 20 || it.drain) {
    const fresh = E.IDS.find(id => id !== b.active && b.fighters[id].hp > p.hp + 20 && b.fighters[id].hp > danger);
    if (p.hp <= danger * 0.25 + 2 && fresh) return ['switch', fresh];
    return ['guard'];
  }
  if (it.armor || (it.damage === 0 && p.stamina < 8)) return ['recover'];
  if (p.stamina >= 5) return ['signature'];
  if (p.stamina >= 3) return ['strike'];
  return ['recover'];
}
function naive(b) { const p = b.fighters[b.active]; return [p.stamina >= 5 ? 'signature' : p.stamina >= 3 ? 'strike' : 'recover']; }
function play(tier, lead, policy) {
  let b = E.startBattle(lead, tier), turns = 0;
  while (!b.result && turns < 200) {
    if (b.fighters[b.active].hp <= 0) { b = E.battleMove(b, 'switch', E.IDS.find(id => b.fighters[id].hp > 0)).battle; turns++; continue; }
    const [m, s] = policy(b), r = E.battleMove(b, m, s);
    b = r.changed ? r.battle : E.battleMove(b, 'recover').battle; turns++;
  }
  return b.result;
}
test('the ladder rewards reading the stump', () => {
  for (const tier of [1, 2, 3]) for (const lead of E.IDS) assert.equal(play(tier, lead, smart), 'win', 'tier ' + tier + ' with ' + lead);
  const losses = E.IDS.filter(lead => play(3, lead, naive) === 'loss').length;
  assert.ok(losses >= 2, 'mashing should usually lose to the elder stump');
});

test('friendship levels write one journal note each and report the level up', () => {
  let s = E.hydrate(E.initial()); s.pets.bolt.bond = 23; s.selected = 'bolt';
  const r = E.dispatch(s, {type:'feed'});
  assert.deepEqual(r.bondUp, {pet:'bolt', level:1});
  assert.ok(r.state.pets.bolt.memories.some(m => m.id === 'bond-1'));
  assert.equal('bondUp' in r.state, false, 'the level up is never saved into the camp');
  const again = E.dispatch(run(r.state, [{type:'rest'}]), {type:'clean'});
  assert.equal(again.bondUp, null);
  assert.equal(E.bondLevel(0), 0); assert.equal(E.bondLevel(50), 2); assert.equal(E.bondLevel(100), 4);
});

test('new decorations follow stamps and stamps are never spent', () => {
  let s = E.hydrate(E.initial());
  for (const id of E.IDS) { s.pets[id].discoveries = [0, 1, 2]; }
  assert.equal(E.stamps(s), 12);
  s = run(s, [{type:'unlock', id:'shelf'}]);
  assert.equal(s.equipped, 'shelf'); assert.equal(E.stamps(s), 12);
  const r = E.dispatch(s, {type:'unlock', id:'campfire'});
  assert.equal(r.changed, false); assert.match(r.message, /16/);
  const forged = plain(s); forged.decor = ['chimes']; forged.equipped = 'chimes';
  assert.deepEqual(E.hydrate(forged).decor, []);
});

test('camp goals add the ladder and the shelf only when the school can store them', () => {
  const s = E.hydrate(E.initial()), day = '2026-10-28';
  const old = G.read(s);
  assert.equal(old.tracks.length, 4); assert.equal(old.total, 39);
  const full = G.read(s, {full:true, today:day});
  assert.deepEqual(full.tracks.map(t => t.id), ['keeper', 'explorer', 'practice', 'decorator', 'curator']);
  assert.equal(full.tracks[2].total, 12); assert.equal(full.tracks[3].total, 6); assert.equal(full.tracks[4].total, 16);
  assert.deepEqual(full.tracks[4].next, {kind:'forage', stop:0});
  let t = run(s, [{type:'forage', day}, {type:'stop', value:1}, {type:'forage', day}, {type:'stop', value:2}, {type:'forage', day}]);
  assert.deepEqual(G.read(t, {full:true, today:day}).tracks[4].next, {kind:'forage', stop:null});
  t = run(t, [{type:'battle-win', tier:1}]);
  assert.deepEqual(G.read(t, {full:true, today:day}).tracks[2].next, {kind:'practice', pet:'mochi', tier:2});
});
