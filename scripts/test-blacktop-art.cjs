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

// Materials must follow hoop geometry and disappear with shattered glass.
// A missing spectator retains the original drawing; night sprites are tinted once.
const A = sandbox.window.BK.art;
const images = new Map();
const material = { width: 600, height: 350 };
const fan = { width: 180, height: 480 };
let tintCanvases = 0;
function context() {
  const calls = [];
  return new Proxy({ calls }, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${key} received a non-finite coordinate`);
      calls.push({ key, args });
    };
  } });
}
sandbox.document = { createElement() {
  tintCanvases++;
  const g = context();
  return { width: 0, height: 0, getContext: () => g };
} };
sandbox.window.BK.assets = {
  fans: ['fan-ready', 'fan-failed'],
  get: (key) => images.get(key) || null,
  board: () => 'board-test',
};
const cam = A.defaultCamera(1280, 720), court = { scene: 'lot', time: 'day', accent: '#ffc629' };
const countImages = (g) => g.calls.filter((c) => c.key === 'drawImage').length;
images.set('board-test', material);
let g = context(); A.drawHoop(g, cam, {}, 'back', court, 0);
assert.equal(countImages(g), 2);
const still = g.calls.filter((c) => c.key === 'transform').map((c) => c.args);
g = context(); A.drawHoop(g, cam, { shake: 1 }, 'back', court, 0.7);
assert.notDeepEqual(g.calls.filter((c) => c.key === 'transform').map((c) => c.args), still, 'Board material must move with the shaken geometry');
g = context(); A.drawHoop(g, cam, { shattered: true }, 'back', court, 0);
assert.equal(countImages(g), 0, 'Shattered backboards must not retain the intact material');
g = context(); A.drawHoop(g, cam, {}, 'front', court, 0);
assert.equal(countImages(g), 0, 'Only the back depth pass draws the board');
const pad = { width: 64, height: 320 };
images.set('pad-vinyl', pad);
g = context(); A.drawHoop(g, cam, { shattered: true }, 'back', court, 0);
assert.equal(countImages(g), 2, 'Breaking glass leaves the protective pad intact');
assert.ok(g.calls.filter((c) => c.key === 'drawImage').every((c) => c.args[0] === pad));
images.clear(); g = context(); A.drawHoop(g, cam, {}, 'back', court, 0);
assert.equal(countImages(g), 0, 'Failed material retains the geometric board');
images.set('fan-ready', fan);
const people = [0.2, 4].map((ph) => ({ x: 10, y: -28, z: 0, h: 6, ph, hype: 1, shirt: '#ed5032', skin: '#8d5524' }));
g = context(); A.drawCrowd(g, cam, people, 0, 0.7, court);
assert.equal(countImages(g), 1, 'One ready and one failed spectator may coexist');
const night = { ...court, time: 'night' };
g = context(); A.drawCrowd(g, cam, people, 0, 0.7, night); A.drawCrowd(g, cam, people, 1, 0.8, night);
assert.equal(tintCanvases, 1, 'Night shading is cached across animated frames');
assert.equal(countImages(g), 2);
console.log('Blacktop detail art: shaking/shattered hoop, depth pass, missing-image fallback and cached night crowd passed.');
