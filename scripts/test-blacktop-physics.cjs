const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: { BK: {} }, Math };
vm.createContext(sandbox);
for (const file of ['art-baller.js', 'art-court.js', 'ball-physics.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/hubs/blacktop-kings', file), 'utf8'), sandbox);
}
const A = sandbox.window.BK.art, C = A.COURT, P = sandbox.window.BK.ballPhysics;
let seed = 7;
const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const hd = (b) => Math.hypot(b.x - C.rimX, b.y - C.rimY);
function drop(b, seconds, hoop) {
  const events = [];
  for (let i = 0; i < seconds / P.SUB; i++) P.step(b, P.SUB, hoop || {}, events);
  return events;
}

// ---------- the rim, the glass, the net, the court ----------
// Straight down the middle: no iron, through the net, slowed by it, onto the floor.
let b = { x: C.rimX, y: C.rimY, z: C.rimZ + 3, vx: 0, vy: 0, vz: 0 };
let ev = drop(b, 0.6);
assert.equal(ev.filter((e) => e.kind === 'rim').length, 0, 'A ball dropped down the middle must not touch the rim');
assert.ok(b.z < C.rimZ - 1, 'A clean drop goes through the hoop');
// Onto the rim's edge: it bounces off the iron.
b = { x: C.rimX + P.RING_R, y: C.rimY, z: C.rimZ + 2, vx: 0, vy: 0, vz: 0 };
ev = drop(b, 0.5);
assert.ok(ev.some((e) => e.kind === 'rim'), 'A ball dropped on the iron must hit the rim');
// Thrown at the glass: it comes back off the board.
b = { x: C.boardX - 2, y: 0.5, z: C.rimZ + 1.5, vx: 20, vy: 0, vz: 2 };
ev = drop(b, 0.15);
assert.ok(ev.some((e) => e.kind === 'board') && b.vx < 0, 'The backboard must send the ball back');
b = { x: C.boardX - 2, y: 0.5, z: C.rimZ + 1.5, vx: 20, vy: 0, vz: 2 };
ev = drop(b, 0.15, { shattered: true });
assert.ok(!ev.some((e) => e.kind === 'board') && b.vx > 0, 'A shattered backboard must not deflect the ball');
// Dropped on the court: bounces lower each time, then rolls to a stop inside the fence.
b = { x: 20, y: 0, z: 6, vx: 8, vy: 3, vz: 0 };
ev = drop(b, 12);
const floor = ev.filter((e) => e.kind === 'floor').map((e) => e.speed);
assert.ok(floor.length >= 3, 'A dropped ball bounces several times');
for (let i = 1; i < floor.length; i++) assert.ok(floor[i] < floor[i - 1], 'Each bounce is lower than the last');
assert.ok(Math.hypot(b.vx, b.vy) < 0.5 && b.vz === 0, 'A loose ball rolls to a stop');
assert.ok(b.x >= 0.5 && b.x <= 49 && Math.abs(b.y) <= 26.5, 'The fence keeps the ball on the court');
console.log('Blacktop physics: clean drops, rim and glass contacts, shattered glass, bounces and rolling passed.');

// ---------- planned shots ----------
// The shot roll decides make or miss. The plan must always agree with it, end in or out of the
// hoop for real, and mostly look like the result it was asked for.
const flavors = {};
let plans = 0;
for (const [dist, deg, kind, bank] of [[12, 0, 'jumper'], [18, 45, 'jumper'], [23, 20, 'jumper'], [21.5, 88, 'jumper'], [3, 30, 'layup'], [3.2, 60, 'layup', true], [14, 55, 'jumper', true]]) {
  for (const made of [true, false]) for (const quality of ['perfect', 'good', 'early', 'late']) {
    for (let k = 0; k < 4; k++) {
      const a = deg * Math.PI / 180, sx = C.rimX - Math.cos(a) * dist, sy = Math.sin(a) * dist;
      const plan = P.planShot({ x: sx + Math.cos(a) * 0.6, y: sy, z: kind === 'layup' ? 9.8 : 9.3, sx, sy, made, kind, quality, bank, out: 6, hoop: {}, random });
      assert.ok(plan, `A ${made ? 'make' : 'miss'} from ${dist} ft must find a real flight`);
      assert.equal(plan.made, made, 'A planned flight must end the way the shot roll decided');
      const i = (plan.end - 1) * 6;
      const end = { x: plan.path[i], y: plan.path[i + 1], z: plan.path[i + 2] };
      if (made) assert.ok(end.z < C.rimZ && hd(end) < P.RING_R, 'A make ends below the rim, inside it');
      else assert.ok(end.z < C.rimZ && hd(end) > P.RING_R, 'A miss ends below the rim, outside it');
      assert.ok(plan.end * P.SUB < 4, 'A shot is decided within four seconds');
      flavors[plan.flavor] = (flavors[plan.flavor] || 0) + 1; plans++;
    }
  }
}
assert.ok(flavors.clean > 0 && flavors.touch > 0 && flavors.rattle > 0 && flavors.off > 0, 'Shots include swishes, rim kisses, rattles and misses off the iron');
assert.ok(!flavors.air, 'No planned miss is an air ball');
console.log(`Blacktop physics: ${plans} planned shots matched their rolls (${Object.entries(flavors).map(([k, v]) => `${k} ${v}`).join(', ')}).`);

// ---------- the players' arms ----------
// Hands overhead must bend the elbow in front of the shoulder line, never backward behind the head.
const d = A.dims(78, 'athletic');
const overhead = [['jumpshot', { t: 0.4 }], ['jumpshot', { t: 0.6, released: true }], ['block', {}], ['rebound', {}], ['hang', {}], ['dunk', { t: 0.75, style: 'twohand' }], ['dunk', { t: 0.5, style: 'reverse' }], ['layup', { t: 0.7 }]];
for (const [kind, o] of overhead) {
  const pose = A.pose(kind, Object.assign({ dims: d, time: 1 }, o));
  for (const front of [true, false]) {
    const e = A.armEnd(pose, d, front);
    const sh = e.shoulder, el = e.elbow;
    // which side of the shoulder-to-hand line the elbow sits on: in front (or on it) is natural
    const cross = (e.x - sh[0]) * (el[1] - sh[1]) - (e.y - sh[1]) * (el[0] - sh[0]);
    if (e.y > sh[1] + 0.5) assert.ok(cross <= 1e-6, `${kind}: the ${front ? 'near' : 'far'} elbow must not bend backward overhead`);
  }
}
// Running: a planted foot stays on the court and slides back under the body; the stride matches speed.
for (const speed of [0.5, 1, 1.4]) {
  const duty = A.runDuty(speed), stride = 1.0;
  let last = null;
  for (let c = 0.01; c < duty; c += 0.02) {
    const pose = A.pose('run', { dims: d, phase: c * Math.PI * 2, speed, stride });
    assert.equal(pose.footF[1], 0, 'A planted foot stays on the court');
    if (last != null) assert.ok(pose.footF[0] < last, 'A planted foot slides back under the body');
    last = pose.footF[0];
  }
}
// Blending two poses is continuous at both ends.
const a = A.pose('idle', { dims: d, time: 1 }), z = A.pose('jumpshot', { dims: d, t: 0.4 });
assert.deepEqual(A.mixPose(a, z, 0).handF, a.handF);
assert.deepEqual(A.mixPose(a, z, 1).handF, z.handF);
// A hand only chases the ball while it is within reach.
const far = A.pose('trick', { dims: d, t: 0.5, style: 'juggle', ballHand: [0.5, 14] });
assert.ok(far.handF[1] < 9, 'A hand must not stretch after a ball far over the head');
console.log('Blacktop players: natural elbows overhead, planted running feet, smooth blends and reach limits passed.');
