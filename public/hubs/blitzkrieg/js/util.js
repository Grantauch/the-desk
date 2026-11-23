// Shared helpers. Everything hangs off one global so the game runs from plain script tags.
(function (root) {
  const BK = (root.BK = root.BK || {});

  BK.W = 1280;
  BK.H = 720;

  BK.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BK.lerp = (a, b, t) => a + (b - a) * t;
  BK.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  BK.dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  BK.angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  BK.wrapAng = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  BK.turnTo = (a, target, maxStep) => {
    const d = BK.wrapAng(target - a);
    if (Math.abs(d) <= maxStep) return target;
    return a + Math.sign(d) * maxStep;
  };
  BK.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  BK.easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // Small seeded generator so runs, props and bot tests repeat exactly.
  BK.makeRng = function (seed) {
    let s = seed >>> 0 || 1;
    const rng = function () {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (a, b) => a + (b - a) * rng();
    rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    return rng;
  };

  // Visual randomness that never touches the game seed.
  BK.fxr = BK.makeRng(Date.now() & 0xffffff);

  BK.fmt = (n) => Math.round(n).toLocaleString("en-US");

  // Catmull-Rom through control points, then resampled so distance along the road is cheap to look up.
  BK.buildPath = function (ctrl, step) {
    step = step || 6;
    const pts = [];
    const P = (i) => ctrl[BK.clamp(i, 0, ctrl.length - 1)];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const segLen = BK.dist(p1[0], p1[1], p2[0], p2[1]);
      const n = Math.max(4, Math.ceil(segLen / 4));
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        pts.push([x, y]);
      }
    }
    pts.push(ctrl[ctrl.length - 1].slice());
    // Resample at even spacing.
    const out = [pts[0].slice()];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      let [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      let seg = BK.dist(ax, ay, bx, by);
      while (carry + seg >= step) {
        const t = (step - carry) / seg;
        ax = ax + (bx - ax) * t;
        ay = ay + (by - ay) * t;
        out.push([ax, ay]);
        seg = BK.dist(ax, ay, bx, by);
        carry = 0;
      }
      carry += seg;
    }
    out.push(pts[pts.length - 1].slice());
    const path = { pts: out, step, len: (out.length - 1) * step };
    path.at = function (d) {
      const f = BK.clamp(d / step, 0, out.length - 1.0001);
      const i = Math.floor(f), t = f - i;
      const a = out[i], b = out[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
    };
    // Shortest distance from a point to the road, used for placement rules.
    path.near = function (x, y) {
      let best = 1e9;
      for (let i = 0; i < out.length; i += 2) {
        const d = BK.dist2(x, y, out[i][0], out[i][1]);
        if (d < best) best = d;
      }
      return Math.sqrt(best);
    };
    return path;
  };
})(typeof window !== "undefined" ? window : globalThis);
