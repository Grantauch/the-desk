const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: { BK: {} }, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/hubs/blacktop-kings/art-baller.js'), 'utf8'), sandbox);
const A = sandbox.window.BK.art;

// Imported from PR #174: the rig must keep natural overhead elbows, planted running feet,
// continuous pose blends, and bounded hand reach.
const d = A.dims(78, 'athletic');
const overhead = [
  ['jumpshot', { t: 0.4 }],
  ['jumpshot', { t: 0.6, released: true }],
  ['block', {}],
  ['rebound', {}],
  ['hang', {}],
  ['dunk', { t: 0.75, style: 'twohand' }],
  ['dunk', { t: 0.5, style: 'reverse' }],
  ['layup', { t: 0.7 }],
];
for (const [kind, o] of overhead) {
  const pose = A.pose(kind, Object.assign({ dims: d, time: 1 }, o));
  for (const front of [true, false]) {
    const e = A.armEnd(pose, d, front);
    const sh = e.shoulder, el = e.elbow;
    const cross = (e.x - sh[0]) * (el[1] - sh[1]) - (e.y - sh[1]) * (el[0] - sh[0]);
    if (e.y > sh[1] + 0.5) {
      assert.ok(cross <= 1e-6, `${kind}: the ${front ? 'near' : 'far'} elbow must not bend backward overhead`);
    }
  }
}

for (const speed of [0.5, 1, 1.4]) {
  const duty = A.runDuty(speed), stride = 1;
  let last = null;
  for (let c = 0.01; c < duty; c += 0.02) {
    const pose = A.pose('run', { dims: d, phase: c * Math.PI * 2, speed, stride });
    assert.equal(pose.footF[1], 0, 'A planted foot stays on the court');
    if (last != null) assert.ok(pose.footF[0] < last, 'A planted foot slides back under the body');
    last = pose.footF[0];
  }
}

const idle = A.pose('idle', { dims: d, time: 1 });
const shot = A.pose('jumpshot', { dims: d, t: 0.4 });
assert.deepEqual(A.mixPose(idle, shot, 0).handF, idle.handF);
assert.deepEqual(A.mixPose(idle, shot, 1).handF, shot.handF);

const far = A.pose('trick', { dims: d, t: 0.5, style: 'juggle', ballHand: [0.5, 14] });
assert.ok(far.handF[1] < 9, 'A hand must not stretch after a ball far over the head');

console.log('Blacktop poses: natural elbows, planted running feet, smooth blends and reach limits passed.');
