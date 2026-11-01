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
console.log('PASS accounts');
