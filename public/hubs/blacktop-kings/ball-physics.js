/* Blacktop Kings — the ball against the rim, the backboard, the net and the court.
   One small fixed-step simulation does two jobs. It plays out every loose ball live, and before a
   shot leaves the hand it tries a handful of slightly different releases and keeps one whose real
   bounce ends the way the shot roll already decided. Misses rattle and roll off, some makes hang on
   the rim before they drop, and nobody's shooting percentage changes.
   BK.ballPhysics.step(ball, dt, hoop, events) and BK.ballPhysics.planShot(opts). */
(function (BK) {
  'use strict';
  const C = BK.art.COURT;
  const G = 32;              // gravity, ft/s², the same as the match
  const BALL_R = 0.42;       // the radius the floor bounce has always used
  const RING_R = 0.75;       // rim centerline: an 18 inch hoop
  const TUBE_R = 0.035;      // the rim's steel
  const NET_LEN = 1.7;
  const RIM_E = 0.6, BOARD_E = 0.62, FLOOR_E = 0.74; // outdoor double rims are stiff
  const SUB = 1 / 240;       // simulation step; the match runs four of these per frame
  const BOARD = { x: C.boardX, y: 3, z0: 9.5, z1: 13 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  // Advance one step. Contacts worth hearing are pushed onto ev as { kind, speed }.
  function step(b, dt, hoop, ev) {
    b.vz -= G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // the rim: a ring of steel. The ball bounces off the nearest point on it, losing a little speed
    // along the rim to friction, so a soft touch can roll around before it drops one way or the other.
    const cx = b.x - C.rimX, cy = b.y - C.rimY, hd = Math.hypot(cx, cy);
    if (hd > 1e-6) {
      let nx = b.x - (C.rimX + cx / hd * RING_R), ny = b.y - (C.rimY + cy / hd * RING_R), nz = b.z - C.rimZ;
      const dist = Math.hypot(nx, ny, nz), min = BALL_R + TUBE_R;
      if (dist < min && dist > 1e-6) {
        nx /= dist; ny /= dist; nz /= dist;
        b.x += nx * (min - dist); b.y += ny * (min - dist); b.z += nz * (min - dist);
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) {
          const f = 0.86;
          b.vx = (b.vx - vn * nx) * f - vn * RIM_E * nx;
          b.vy = (b.vy - vn * ny) * f - vn * RIM_E * ny;
          b.vz = (b.vz - vn * nz) * f - vn * RIM_E * nz;
          if (ev && -vn > 1.2) ev.push({ kind: 'rim', speed: -vn });
        }
      }
    }
    // the backboard's face
    if (!(hoop && hoop.shattered) && b.vx > 0 && b.x + BALL_R > BOARD.x && b.x < BOARD.x + 0.3 &&
        Math.abs(b.y) < BOARD.y + BALL_R * 0.5 && b.z > BOARD.z0 - BALL_R * 0.5 && b.z < BOARD.z1 + BALL_R * 0.5) {
      if (ev && b.vx > 1.5) ev.push({ kind: 'board', speed: b.vx });
      b.x = BOARD.x - BALL_R; b.vx = -b.vx * BOARD_E; b.vy *= 0.9; b.vz *= 0.9;
    }
    // the net catches a ball on its way through and funnels it down the middle
    if (hd < RING_R && b.z < C.rimZ && b.z > C.rimZ - NET_LEN && b.vz < 0) {
      const k = Math.exp(-dt * 7);
      b.vx = b.vx * k - cx * dt * 30; b.vy = b.vy * k - cy * dt * 30; b.vz *= Math.exp(-dt * 2.2);
    }
    // the court
    if (b.z < BALL_R) {
      b.z = BALL_R;
      if (b.vz < 0) {
        if (ev && b.vz < -3) ev.push({ kind: 'floor', speed: -b.vz });
        b.vz = -b.vz * FLOOR_E; if (b.vz < 1.2) b.vz = 0;
        b.vx *= 0.88; b.vy *= 0.88;
      }
      if (b.vz === 0) { const k = Math.exp(-dt * 1.4); b.vx *= k; b.vy *= k; } // rolling
    }
    // the fence plays it back
    if (b.x < 0.5) { b.x = 0.5; b.vx = Math.abs(b.vx) * 0.5; }
    if (b.x > 49) { b.x = 49; b.vx = -Math.abs(b.vx) * 0.5; }
    if (Math.abs(b.y) > 26.5) { b.y = Math.sign(b.y) * 26.5; b.vy = -b.vy * 0.5; }
  }

  // Is a shot finished? 1: through the hoop. -1: clearly not going in. 0: still deciding.
  function verdict(b) {
    const hd = Math.hypot(b.x - C.rimX, b.y - C.rimY);
    if (b.z < C.rimZ - BALL_R * 0.9 && hd < RING_R - 0.05) return 1;
    if (b.vz < 0 && b.z < C.rimZ - 0.6 && hd > RING_R + 0.1) return -1;
    return 0;
  }

  // Release velocity that carries the ball from s to t, coming down at the given angle (degrees).
  function aim(s, t, entryDeg) {
    const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy), h = t.z - s.z;
    const T = Math.sqrt(Math.max(0.04, 2 * (d * Math.tan(entryDeg * Math.PI / 180) + h) / G));
    return { vx: dx / T, vy: dy / T, vz: h / T + 0.5 * G * T, T };
  }

  // Play a released ball out. With record, keep every step so the match can replay it exactly.
  function run(s, v, hoop, record, maxT) {
    const b = { x: s.x, y: s.y, z: s.z, vx: v.vx, vy: v.vy, vz: v.vz };
    const out = { made: false, end: 0, rim: 0, board: 0, firstT: -1, reachT: -1, events: [], path: record ? [] : null };
    const ev = [];
    const n = Math.round((maxT || 4) / SUB);
    for (let i = 1; i <= n; i++) {
      ev.length = 0;
      step(b, SUB, hoop, ev);
      if (record) out.path.push(b.x, b.y, b.z, b.vx, b.vy, b.vz);
      for (const e of ev) {
        if (e.kind === 'floor') continue;
        if (e.kind === 'rim') out.rim++; else out.board++;
        if (out.firstT < 0) out.firstT = i * SUB;
        out.events.push({ i, kind: e.kind, speed: e.speed });
      }
      if (out.reachT < 0 && Math.hypot(b.x - C.rimX, b.y - C.rimY) < 2 && b.z < C.rimZ + 2.5) out.reachT = i * SUB;
      const v2 = verdict(b);
      if (v2) { out.made = v2 > 0; out.end = i; return out; }
    }
    return null; // still sitting on the rim: not a usable shot
  }

  // How a shot plays out. Makes: 'clean' (nothing but net), 'touch' (a kiss or two), 'rattle' (it hangs
  // around before it drops). Misses: 'off' (one or two hits and away) or 'rattle' (in and out).
  function flavorOf(r, bank) {
    const hits = r.rim + (bank ? Math.max(0, r.board - 1) : r.board);
    const linger = r.firstT < 0 ? 0 : r.end * SUB - r.firstT;
    if (r.made) return hits === 0 ? 'clean' : hits <= 2 && linger < 0.35 ? 'touch' : 'rattle';
    if (hits === 0) return 'air';
    return hits >= 3 || linger > 0.45 ? 'rattle' : 'off';
  }
  function wantFlavor(o, rnd) {
    const r = rnd();
    if (!o.made) return r < 0.3 ? 'rattle' : 'off';
    if (o.quality === 'perfect') return r < 0.7 ? 'clean' : r < 0.95 ? 'touch' : 'rattle';
    if (o.quality === 'good') return r < 0.5 ? 'clean' : r < 0.85 ? 'touch' : 'rattle';
    return r < 0.35 ? 'clean' : r < 0.75 ? 'touch' : 'rattle';
  }
  // How far from the middle of the rim to aim, by the result we're after (feet).
  const SPREAD = { clean: [0, 0.22], touch: [0.2, 0.5], rattle: [0.32, 0.64], off: [0.45, 1.0] };

  // o: { x, y, z (release), sx, sy (shooter's feet), made, kind ('jumper' | 'layup'), quality, bank (bool),
  //      out (shooter's rating, 1-10), hoop, random }. Returns a recorded flight, or null if nothing fit.
  function planShot(o) {
    const rnd = o.random || Math.random;
    const want = wantFlavor(o, rnd);
    const s = { x: o.x, y: o.y, z: o.z };
    // the shot line, from the shooter toward the rim, and across it
    let ux = C.rimX - (o.sx == null ? o.x : o.sx), uy = C.rimY - (o.sy == null ? o.y : o.sy);
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const layup = o.kind === 'layup';
    const baseAngle = layup ? 58 : lerp(43, 50, clamp((o.out || 5) / 10, 0, 1));
    let best = null;
    const tries = 72;
    for (let i = 0; i < tries; i++) {
      const relax = i / tries; // the search widens the longer it looks
      const banking = o.bank && i < tries * 0.55;
      let target, angle;
      if (banking) {
        // off the glass: a spot on the board above the rim, on the shooter's side
        const side = clamp((o.y - C.rimY) * 0.18, -1.2, 1.2);
        target = { x: BOARD.x - BALL_R, y: C.rimY + side + (rnd() - 0.5) * (0.6 + relax), z: C.rimZ + lerp(0.9, 2.0, rnd()) };
        angle = lerp(25, 48, rnd());
      } else {
        const range = SPREAD[want] || SPREAD.off;
        const r = lerp(range[0], range[1], rnd()) * (1 + relax * 0.6);
        let a = rnd() * Math.PI * 2;
        // a short release tends to catch the front of the rim, a late one the back
        if (o.quality === 'early' && !o.made) a = Math.PI + (rnd() - 0.5) * 2.2;
        if (o.quality === 'late' && !o.made) a = (rnd() - 0.5) * 2.2;
        const along = Math.cos(a) * r, across = Math.sin(a) * r;
        target = { x: C.rimX + ux * along - uy * across, y: C.rimY + uy * along + ux * across, z: C.rimZ };
        angle = baseAngle + (rnd() - 0.5) * 6 - (want === 'rattle' || want === 'touch' ? rnd() * 5 : 0);
      }
      const v = aim(s, target, angle);
      const res = run(s, v, o.hoop, false);
      if (!res || res.made !== o.made) continue;
      const fl = flavorOf(res, banking);
      if (fl === 'air') continue;
      if (fl === want) { best = { v, banking }; break; }
      if (!best) best = { v, banking };
    }
    if (!best) return null;
    const rec = run(s, best.v, o.hoop, true);
    if (!rec || rec.made !== o.made) return null;
    return {
      step: SUB, path: new Float32Array(rec.path), end: rec.end, made: rec.made, events: rec.events,
      reachT: rec.reachT > 0 ? rec.reachT : rec.end * SUB, bank: best.banking && rec.board > 0, flavor: flavorOf(rec, best.banking),
    };
  }

  BK.ballPhysics = { step, planShot, verdict, aim, SUB, BALL_R, RING_R };
})(window.BK = window.BK || {});
