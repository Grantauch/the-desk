// Growth curve, battle XP cap and ticket checks, without a server.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as A from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const g = A.loadGrowth(path.join(HERE, 'content', 'growth.json'));

// The curve the bible asks for: first evolution level near six weeks, second near the end of first semester.
const daysTo = (lv) => Math.ceil(A.xpFor(g, lv) / g.dayXp);
assert.ok(daysTo(15) >= 25 && daysTo(15) <= 32, `level 15 after ${daysTo(15)} check-ins`);
assert.ok(daysTo(30) >= 75 && daysTo(30) <= 90, `level 30 after ${daysTo(30)} check-ins`);
assert.ok(daysTo(50) >= 170 && daysTo(50) <= 185, `level 50 after ${daysTo(50)} check-ins`);
for (let lv = 1; lv <= 50; lv++) {
  assert.equal(A.levelFor(g, A.xpFor(g, lv)), lv);
  if (lv > 1) assert.equal(A.levelFor(g, A.xpFor(g, lv) - 1), lv - 1);
}
assert.equal(A.levelFor(g, 10 ** 9), 50);
console.log('  ok the level curve matches the bible');

// Battle XP stops at the daily cap.
const db = new DatabaseSync(':memory:');
const store = A.openStore(db, g);
const t = { pid: 'abcdefghijklmnop', hour: '2nd Hour', days: 0, partner: { species: 'zee', nick: 'Quill' } };
store.link(t, () => 'Swift Hawk', 0);
const id = store.team(t.pid)[0].id;
let total = 0, capped = false;
for (let i = 0; i < 10; i++) { const r = store.battleXp(t.pid, id, g.battleXp.win); total += r.xp; capped ||= r.capped; }
assert.equal(total, g.dailyBattleXpCap);
assert.ok(capped);
console.log('  ok battle XP stops at the daily cap');

// Tickets: a good one passes, anything changed fails.
const key = 'k'.repeat(43);
const body = { v: 1, p: 'Pq7xK2mN9vR4tY8wZ3aB1c', h: '6th Hour', d: '2026-11-02', c: true, n: 3, s: 3, b: 3, k: { s: 'ember', n: 'Toast\u0007' }, iat: Date.now(), exp: Date.now() + 60_000, j: 'x' };
const ok = A.verifyTicket(key, A.signTicket(key, body), { species: ['ember'] });
assert.equal(ok.ok, true);
assert.equal(ok.t.partner.nick, 'Toast', 'control characters are stripped');
assert.equal(A.verifyTicket(key, A.signTicket(key, { ...body, p: 'short' }), { species: ['ember'] }).ok, false);
assert.equal(A.verifyTicket(key, A.signTicket(key, { ...body, n: -1 }), { species: ['ember'] }).ok, false);
assert.equal(A.verifyTicket('', A.signTicket(key, body), { species: ['ember'] }).ok, false);
assert.equal(A.verifyTicket(key, 'x'.repeat(3000), { species: ['ember'] }).ok, false);
console.log('  ok tickets are checked');
// Weekly ranks: wins 3, ties 1, the same pair counts 3 times a day, other hours and last week stay off.
assert.equal(A.weekOf('2026-11-01'), '2026-10-26', 'Sunday belongs to the week that began Monday');
assert.equal(A.weekOf('2026-11-02'), '2026-11-02');
db.exec(`CREATE TABLE battles (id INTEGER PRIMARY KEY, started TEXT, ended TEXT, seed INTEGER, a_trainer TEXT, a_species TEXT, b_trainer TEXT, b_species TEXT, winner TEXT, reason TEXT, turns INTEGER, picks TEXT, a_pid TEXT, b_pid TEXT)`);
const mk = (pid, name, hour) => store.link({ pid, hour, days: 0, partner: { species: 'zee', nick: '' } }, () => name, 0);
mk('pidAAAAAAAAAAAAAAA', 'Iron Hawk', '2nd Hour'); mk('pidBBBBBBBBBBBBBBB', 'Bold Lynx', '2nd Hour'); mk('pidCCCCCCCCCCCCCCC', 'Nova Orca', '6th Hour');
const fight = (when, a, b, an, bn, winner, reason = 'ko') => db.prepare(`INSERT INTO battles (started, ended, seed, a_trainer, a_species, b_trainer, b_species, winner, reason, turns, picks, a_pid, b_pid) VALUES (?, ?, 1, ?, 'zee', ?, 'zee', ?, ?, 3, '[]', ?, ?)`).run(when, when, an, bn, winner, reason, a, b);
const now = new Date('2026-11-04T17:00:00Z'); // a Wednesday
for (let i = 0; i < 5; i++) fight(`2026-11-04T15:0${i}:00Z`, 'pidAAAAAAAAAAAAAAA', 'pidBBBBBBBBBBBBBBB', 'Iron Hawk', 'Bold Lynx', 'Iron Hawk');
fight('2026-11-03T15:00:00Z', 'pidBBBBBBBBBBBBBBB', 'pidAAAAAAAAAAAAAAA', 'Bold Lynx', 'Iron Hawk', 'draw', 'time');
fight('2026-11-03T15:10:00Z', 'pidBBBBBBBBBBBBBBB', 'pidAAAAAAAAAAAAAAA', 'Bold Lynx', 'Iron Hawk', 'draw', 'timeout');
fight('2026-10-30T15:00:00Z', 'pidBBBBBBBBBBBBBBB', 'pidAAAAAAAAAAAAAAA', 'Bold Lynx', 'Iron Hawk', 'Bold Lynx');
fight('2026-11-04T16:00:00Z', 'pidCCCCCCCCCCCCCCC', 'pidBBBBBBBBBBBBBBB', 'Nova Orca', 'Bold Lynx', 'Nova Orca');
const two = A.weeklyRanks(db, g.ranks, '2nd Hour', now);
assert.equal(two.week, '2026-11-02');
assert.deepEqual(two.list.map((x) => [x.rank, x.name, x.points, x.w, x.l, x.d]), [[1, 'Iron Hawk', 10, 3, 0, 1], [2, 'Bold Lynx', 1, 0, 4, 1]]);
assert.deepEqual(A.weeklyRanks(db, g.ranks, '6th Hour', now).list.map((x) => [x.name, x.points]), [['Nova Orca', 3]]);
console.log('  ok weekly ranks count fairly and stay in their class hour');
console.log('PASS accounts');
