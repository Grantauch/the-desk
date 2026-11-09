// The Square Deal rules check: card data is sound, every game ends in 1918, and the sides stay balanced.
// Run with: npm run square-deal:test
const assert = require('node:assert');
global.window = {};
require('../public/hubs/ush9-square-deal-engine.js');
const SD = window.SD;

const ids = new Set();
for (const c of SD.R.concat(SD.M)) {
  assert(!ids.has(c.id), 'duplicate card ' + c.id); ids.add(c.id);
  assert(c.cost >= 1 && c.cost <= 6, c.id + ' cost');
  assert(c.fact && c.fact.length < 220, c.id + ' needs a short fact');
  assert(!/[;()—–]/.test(c.name + c.fact), c.id + ' writing style');
  if (c.need) assert(['law', 'amend'].includes(c.kind), c.id + ' only laws need outrage');
}
assert.equal(SD.R.length, 25); assert.equal(SD.M.length, 25);

function game(seed, lr, lm) {
  const st = SD.newGame(seed), rand = SD.rng(seed * 7 + 3);
  for (let guard = 0; !st.over && guard < 100; guard++) {
    let pick, n = 0;
    while ((pick = SD.aiPick(st, st.turn === 'R' ? lr : lm, rand)) && n++ < 10) pick.rally ? SD.rally(st, st.turn, pick.id) : SD.play(st, st.turn, pick.id, pick.target);
    SD.endTurn(st);
  }
  assert(st.over && st.round === SD.ROUNDS, 'game ' + seed + ' did not finish');
  Object.values(st.fronts).forEach(f => assert(Math.abs(f.m) <= SD.MAXM && f.out >= 0));
  return st;
}
const N = 120, rate = (lr, lm) => { let r = 0; for (let s = 1; s <= N; s++) if (game(s, lr, lm).winner === 'R') r++; return r / N; };
const even = rate('normal', 'normal'), strongR = rate('hard', 'easy'), strongM = rate('easy', 'hard');
assert(even > 0.4 && even < 0.75, 'even match should be close, Reform won ' + even);
assert(strongR > 0.8, 'Legend Reformers should beat Rookie Machine, won ' + strongR);
assert(strongM < 0.25, 'Legend Machine should beat Rookie Reformers, Reform won ' + strongM);
// Courts cannot strike amendments.
const st = SD.newGame(9); st.fronts.vote.laws = ['am17']; st.fronts.factory.laws = ['keating']; st.turn = 'M'; st.inf.M = 6; st.hand.M = ['lochner', 'hammer'];
assert.deepEqual(SD.targetsFor(st, 'M', 'lochner'), ['factory']);
console.log(`Square Deal: 50 cards valid, ${N * 3} games finished. Even match Reform ${Math.round(even * 100)}%, Legend vs Rookie ${Math.round(strongR * 100)}% and ${Math.round((1 - strongM) * 100)}%. Amendments are safe from courts.`);
