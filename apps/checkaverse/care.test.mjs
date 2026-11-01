// The Checkling body: content checks, the care balance the bible asks for, and death, graves and eggs in the store.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as C from './care.mjs';
import * as A from './accounts.mjs';
import * as Battle from './battle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = C.loadCare(path.join(HERE, 'content'));
const rng = (seed) => A.seeded('test', seed);

// ---------- content ----------
assert.throws(() => C.checkCare({ ...r, diseases: { ...r.diseases, cold: { ...r.diseases.cold, death: { base: 2, perDay: 0, cap: 0 } } } }), /between 0 and 1/);
assert.throws(() => C.checkCare({ ...r, conditions: { ...r.conditions, odd: { name: 'Odd', tip: 'x', when: { stat: 'sparkle', atLeast: 1 } } } }), /unknown stat/);
assert.throws(() => C.checkCare({ ...r, epitaphs: { ...r.epitaphs, heart_trouble: ['one'] } }), /two epitaphs/);
console.log('  ok broken care content is refused');

// ---------- the calendar ----------
assert.equal(C.isSchoolDay(r, '2026-11-02'), true, 'a Monday');
assert.equal(C.isSchoolDay(r, '2026-11-01'), false, 'a Sunday');
assert.equal(C.isSchoolDay(r, '2026-11-03'), false, 'no school on the district calendar');
assert.equal(C.isSchoolDay(r, '2026-11-26'), false, 'Thanksgiving');
assert.deepEqual(C.owedDays(r, '2026-10-30', '2026-11-05'), ['2026-11-02', '2026-11-04'], 'weekends and the day off are skipped');
assert.deepEqual(C.owedDays(r, '2026-10-30', '2026-11-05', (d) => d !== '2026-11-02'), ['2026-11-04'], 'a day the server was down is skipped');
console.log('  ok the body clock follows the school calendar and skips outages');

// ---------- balance, played out over 60 school days ----------
const days = [];
for (let d = '2026-11-02'; days.length < 60;) {
  if (C.isSchoolDay(r, d)) days.push(d);
  const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); d = t.toISOString().slice(0, 10);
}
const styles = {
  good: (A_, b) => { if (b.fullness < 70) A_('feed'); if (b.fullness < 40) A_('feed'); if (b.hygiene < 45) A_('groom'); A_('play'); if (b.mood < 50) A_('play'); A_('rest'); if (b.disease) A_('medicine'); },
  glutton: (A_) => { A_('feed'); A_('feed'); A_('feed'); A_('treat'); A_('treat'); A_('play'); A_('rest'); },
  ignore: () => {},
};
function life(style, seed, presentRate = 1) {
  const rand = rng(seed);
  const b = C.newBody(r, days[0]);
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const present = rand() < presentRate;
    if (present) styles[style]((a) => C.act(r, b, a, d, rand), b);
    C.tick(r, b, d, present, rand);
    if (b.dead) return i + 1;
  }
  return 0;
}
const runs = (style, rate) => Array.from({ length: 300 }, (_, i) => life(style, `${style}${i}`, rate));
const deaths = (xs) => xs.filter(Boolean).length;
const median = (xs) => { const d = xs.filter(Boolean).sort((a, b) => a - b); return d[d.length >> 1]; };
assert.equal(deaths(runs('good')), 0, 'steady good care never kills');
assert.equal(deaths(runs('good', 0.7)), 0, 'good care with spotty attendance never kills');
assert.equal(deaths(runs('ignore', 0)), 0, 'being absent never kills');
const g = runs('glutton'), n = runs('ignore');
assert.ok(deaths(g) > 250 && median(g) >= 12 && median(g) <= 35, `overfeeding kills in weeks, not days (median ${median(g)})`);
assert.ok(deaths(n) > 250 && median(n) >= 12 && median(n) <= 35, `checking in and never caring kills in weeks (median ${median(n)})`);
console.log(`  ok balance: good care is safe, overfeeding dies near school day ${median(g)}, neglect near ${median(n)}`);

// ---------- care actions ----------
{
  const d = '2026-11-02';
  const b = C.newBody(r, d);
  b.fullness = 90;
  const w = b.weight;
  assert.match(C.act(r, b, 'feed', d, rng(1)).msg, /already full/);
  assert.equal(b.weight, w + 2 + 8, 'feeding a full Checkling adds the overfed weight');
  for (let i = 0; i < 3; i++) C.act(r, b, 'feed', d, rng(1));
  assert.equal(C.act(r, b, 'feed', d, rng(1)).ok, false, 'meals stop at the daily limit');
  for (let i = 0; i < 4; i++) C.act(r, b, 'play', d, rng(1));
  assert.ok(C.conditions(r, b, d).includes('wired'));
  assert.match(C.act(r, b, 'rest', d, rng(1)).msg, /too wired/i, 'a wired Checkling cannot nap');
  const healthy = C.newBody(r, d);
  C.act(r, healthy, 'medicine', d, rng(1));
  assert.ok(healthy.mood < r.start.mood && healthy.health < 100, 'medicine without a disease has side effects');
  const sick = C.newBody(r, d);
  sick.disease = { id: 'heart_trouble', days: 2, doses: 0, dosed: '' };
  assert.match(C.act(r, sick, 'medicine', d, rng(1)).msg, /2 more days/);
  assert.match(C.act(r, sick, 'medicine', d, rng(1)).msg, /already had today/);
  C.act(r, sick, 'medicine', '2026-11-04', rng(1));
  assert.match(C.act(r, sick, 'medicine', '2026-11-05', rng(1)).msg, /cured/);
  assert.equal(sick.disease, null);
  const thin = C.newBody(r, d);
  thin.weight = 10;
  thin.disease = { id: 'malnutrition', days: 1, doses: 1, dosed: '' };
  assert.match(C.act(r, thin, 'medicine', d, rng(1)).msg, /will not clear up/, 'malnutrition needs feeding as well as medicine');
}
console.log('  ok care actions, daily limits, wired, overmedicating and courses of medicine');

// ---------- battle ----------
{
  const rules = Battle.loadRules(path.join(HERE, 'content', 'battle'));
  const b = C.newBody(r, '2026-11-02');
  b.weight = 90;
  const mods = C.battleMods(r, b, '2026-11-02');
  assert.deepEqual([mods.power, mods.stamina], [1.1, 0.6]);
  const plain = Battle.createBattle(rules, [{ name: 'a', species: 'mochi', level: 20 }, { name: 'b', species: 'mochi', level: 20 }], 1);
  const heavy = Battle.createBattle(rules, [{ name: 'a', species: 'mochi', level: 20, mods }, { name: 'b', species: 'mochi', level: 20 }], 1);
  assert.ok(heavy.sides[0].power > plain.sides[0].power && heavy.sides[0].maxStamina < plain.sides[0].maxStamina, 'an obese Checkling hits harder and tires faster');
}
console.log('  ok the body carries into battle');

// ---------- store: death, the cemetery, the egg ----------
{
  const db = new DatabaseSync(':memory:');
  const gr = A.loadGrowth(path.join(HERE, 'content', 'growth.json'));
  const store = A.openStore(db, gr, r, { wasUp: () => true, speciesName: (x) => x[0].toUpperCase() + x.slice(1) });
  const t = (days, extra = {}) => ({ pid: 'pidZZZZZZZZZZZZZZZZ', hour: '2nd Hour', days, checkedIn: true, partner: { species: 'mochi', nick: 'Biscuit' }, ...extra });
  store.link(t(10), () => 'Quiet Comet', 0);
  const [mochi] = store.team('pidZZZZZZZZZZZZZZZZ');
  // A mushroom found in the grass, then eaten until it does what mushrooms do.
  let died = null;
  for (let i = 0; i < 400 && !died; i++) {
    db.prepare('UPDATE trainers SET items = ? WHERE pid = ?').run('{"glowing_mushroom":1}', 'pidZZZZZZZZZZZZZZZZ');
    const res = store.care('pidZZZZZZZZZZZZZZZZ', mochi.id, 'glowing_mushroom', 'Biscuit');
    assert.equal(res.ok, true);
    if (res.death) died = res.death;
  }
  assert.ok(died, 'the glowing mushroom eventually kills');
  assert.equal(store.team('pidZZZZZZZZZZZZZZZZ').length, 0, 'the dead leave the party');
  const [stone] = store.cemetery('2nd Hour');
  assert.equal(stone.trainer, 'Quiet Comet');
  assert.ok(stone.epitaph.length > 5 && !stone.epitaph.includes('{name}'));
  assert.deepEqual(store.egg('pidZZZZZZZZZZZZZZZZ', 10), { owed: true });
  assert.equal(store.mods('pidZZZZZZZZZZZZZZZZ', mochi.id), null, 'nobody to battle with');
  // The next ride with a check-in gives the egg. It hatches five check-ins later, never before.
  store.link(t(11), () => 'x', 0);
  assert.deepEqual(store.egg('pidZZZZZZZZZZZZZZZZ', 11), { left: 5, ready: false });
  assert.equal(store.hatchEgg('pidZZZZZZZZZZZZZZZZ', 'ember', 15), null);
  store.link(t(16), () => 'x', 0);
  const born = store.hatchEgg('pidZZZZZZZZZZZZZZZZ', 'ember', 16);
  assert.ok(born && !born.den);
  const team = store.team('pidZZZZZZZZZZZZZZZZ');
  assert.deepEqual(team.map((x) => x.species), ['ember'], 'the new Checkling is the only one, and Check-In does not bring the dead one back');
  assert.equal(store.trainer('pidZZZZZZZZZZZZZZZZ').partner, team[0].id);
  assert.equal(store.egg('pidZZZZZZZZZZZZZZZZ', 16), null);
}
console.log('  ok death leaves a headstone, an egg comes at the next check-in and hatches five later');

{
  // The body clock in the store: nights owed since the last ride run on arrival, and the Den is paused.
  const db = new DatabaseSync(':memory:');
  const gr = A.loadGrowth(path.join(HERE, 'content', 'growth.json'));
  const store = A.openStore(db, gr, r, { wasUp: () => true, speciesName: (x) => x });
  const pid = 'pidYYYYYYYYYYYYYYYY';
  store.link({ pid, hour: '6th Hour', days: 3, checkedIn: true, partner: { species: 'zee', nick: '' } }, () => 'Bold Lynx', 0);
  const [zee] = store.team(pid);
  const back = (id, days) => { const b = JSON.parse(db.prepare('SELECT body FROM checklings WHERE id = ?').get(id).body); b.clock = A.todayKey(new Date(Date.now() - days * 86_400_000)); b.today = { day: b.clock, n: {} }; db.prepare('UPDATE checklings SET body = ? WHERE id = ?').run(JSON.stringify(b), id); };
  back(zee.id, 14);
  const res = store.link({ pid, hour: '6th Hour', days: 13, checkedIn: true, partner: { species: 'zee', nick: '' } }, () => 'x', 0);
  const owed = C.owedDays(r, A.todayKey(new Date(Date.now() - 14 * 86_400_000)), A.todayKey());
  if (owed.length) {
    assert.equal(res.reports.length, 1);
    assert.ok(res.reports[0].lines.some((l) => /hungry/.test(l.text)), `two weeks away shows up on the report: ${JSON.stringify(res.reports[0].lines)}`);
  }
  const after = store.body(pid, zee.id);
  assert.ok(after.stats.fullness < r.start.fullness || !owed.length);
  const again = store.link({ pid, hour: '6th Hour', days: 13, checkedIn: true, partner: { species: 'zee', nick: '' } }, () => 'x', 0);
  assert.equal(again.reports.length, 0, 'a second ride the same day owes nothing');
}
console.log('  ok nights owed run on arrival, once');
console.log('PASS care');
