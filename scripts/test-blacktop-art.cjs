const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: { BK: {} }, Math };
vm.createContext(sandbox);
for (const file of ['art-baller.js', 'art-court.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/hubs/blacktop-kings', file), 'utf8'), sandbox);
}
const C = sandbox.window.BK.art.COURT;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);
// Corner joins must run parallel to the sideline, never diagonally across the lane.
for (const side of [-1, 1]) {
  const arc = C.deepArc(side);
  near(arc[0][0], side * C.cornerX);
  near(arc[0][1], -C.cornerY);
  near(arc.at(-1)[0], side * C.cornerX);
  near(arc.at(-1)[1], C.cornerY);
  for (let i = 0; i < arc.length; i++) {
    const [x, y] = arc[i];
    near(Math.hypot(x - side * C.rimX, y), C.arcR);
    if (i) assert.ok(y > arc[i - 1][1], 'Arc must follow the corners without doubling back');
    assert.ok(side * x <= C.cornerX + 1e-8, 'Arc must bow toward center court');
  }
}
// Painting and scoring share the same curve. One foot to each side of it must
// still score as inside/outside; the visual correction must not change balance.
for (const theta of [-Math.PI / 3, 0, Math.PI / 3]) {
  const point = (radius) => [C.rimX - Math.cos(theta) * radius, Math.sin(theta) * radius];
  assert.equal(C.isDeep(...point(C.arcR - 1)), false);
  assert.equal(C.isDeep(...point(C.arcR + 1)), true);
}
assert.equal(C.isDeep(44, C.cornerY - 0.5), false);
assert.equal(C.isDeep(44, C.cornerY + 0.5), true);
assert.equal(C.arcR, 22);
assert.equal(C.cornerY, 21);
console.log('Blacktop art: corner joins, arc continuity, mirrored geometry and scoring boundaries passed.');
