/* Blacktop Kings — the computer players. Each one thinks a few times a second (faster on harder
   settings) and moves every frame. They play by the same rules you do: the same release timing,
   the same hands-on-the-ball blocks and steals. Offense: take it back after a stop, attack the rim
   when it's there, cross a defender who's leaning, kick it to the open man, beat the shot clock.
   Defense: stay between your man and the rim (reacting a beat late, like a person), help on drives,
   reach when the ball is exposed, contest shooters, and box out. */
(function (BK) {
  'use strict';
  const C = BK.art.COURT;
  const H = () => BK.Match.prototype.helpers;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hyp = Math.hypot;
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * Math.random()); };
  const RIM = { x: C.rimX, y: C.rimY };
  const G_JUMP = 30;
  const distRim = (o) => hyp(o.x - RIM.x, o.y - RIM.y);

  const DEEP_SPOTS = [[23, -15.5], [23, 15.5], [19.2, -7], [19.2, 7], [18.5, 0], [43.5, -22.4], [43.5, 22.4], [31, -19.5], [31, 19.5]];
  const IN_SPOTS = [[38, -7.5], [38, 7.5], [30, -7], [30, 7], [44, -11], [44, 11], [42.5, -5], [42.5, 5]];

  function skillOf(m, p) {
    const t = m.teams[p.team];
    if (t.human) return 0.62;
    return t.skill == null ? m.skill : t.skill;
  }
  function goTo(p, x, y, urgent, slowRadius) {
    const dx = x - p.x, dy = y - p.y, d = hyp(dx, dy);
    const sr = slowRadius || 1.5;
    if (d < 0.25) { p.want = { x: 0, y: 0 }; p.wantTurbo = false; return d; }
    const k = Math.min(1, d / sr);
    p.want = { x: dx / d * k, y: dy / d * k };
    p.wantTurbo = !!urgent && p.turbo > 0.25 && d > 4;
    return d;
  }
  function canAct(p) { return p.state === 'move' || p.state === 'catch'; }
  function nearestOpp(p) {
    let best = null, bd = 1e9;
    p.opps.forEach((o) => { if (o.state === 'fallen') return; const d = hyp(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } });
    return { o: best, d: bd };
  }
  // Is somebody standing in the lane between p and the rim?
  function laneBlocked(p, width) {
    const dx = RIM.x - p.x, dy = RIM.y - p.y, d = hyp(dx, dy) || 1; const ux = dx / d, uy = dy / d;
    return p.opps.some((o) => {
      if (o.state === 'fallen' || o.state === 'stumble') return false;
      const rx = o.x - p.x, ry = o.y - p.y; const along = rx * ux + ry * uy; const side = Math.abs(rx * -uy + ry * ux);
      return along > 0.5 && along < d + 1 && side < (width || 2.8);
    });
  }
  // The defender guarding the rim, if one is standing near it.
  function rimProtector(p) {
    let best = null, bd = 9;
    p.opps.forEach((o) => { if (o.state === 'fallen' || o.state === 'stumble') return; const d = distRim(o); if (d < bd) { bd = d; best = o; } });
    return best;
  }
  function ruleAllows(m, kind, deep) { return m.pointsFor(kind, deep) > 0; }
  // The nearest place behind the arc, for taking it back.
  function clearSpot(p) {
    let dx = p.x - RIM.x, dy = p.y - RIM.y; const d = hyp(dx, dy) || 1; dx /= d; dy /= d;
    let x = RIM.x + dx * (C.arcR + 2), y = RIM.y + dy * (C.arcR + 2);
    if (x >= C.cornerX) { x = Math.min(x, 44); y = Math.sign(p.y || 1) * (C.cornerY + 1.8); }
    return { x: clamp(x, 3, 45), y: clamp(y, -23.5, 23.5) };
  }

  // ---------- offense: the ball handler ----------
  function handler(m, p, dt, sk) {
    const team = m.teams[p.team];
    if (p.state === 'catch') { p.want = { x: 0, y: 0 }; return; }
    if (!canAct(p)) return;
    const d = distRim(p);
    const near = nearestOpp(p);
    p.ai.react -= dt;
    if (p.ai.react > 0) { followIntent(m, p, near); return; }
    p.ai.react = lerp(0.42, 0.14, sk) * rand(0.8, 1.25);

    // 0. after a stop, take it back behind the arc (or swing it to somebody already out there)
    if (!m.cleared) {
      const out = p.mates.filter((t) => t.state === 'move' && C.isDeep(t.x, t.y) && m.laneClear(p, t) > 0.4 && m.openness(t) > 4).sort((a, c) => m.openness(c) - m.openness(a))[0];
      if (out && Math.random() < 0.3 + p.r.pas * 0.05) { m.passTo(p, out); return; }
      const s = clearSpot(p);
      p.ai.intent = { x: s.x, y: s.y, turbo: near.d < 4 && p.turbo > 0.4 };
      followIntent(m, p, near);
      return;
    }
    // crown time
    if (team.crown >= 1 && !team.crownActive && (team.crown >= 2 || Math.random() < 0.45)) m.activateCrown(team, p);
    const crown = team.crownActive > 0;
    const clock = m.shotClock;
    const late = clock < 2.6;
    const blocked = laneBlocked(p, 3.2);
    const dunkR = m.dunkRange(p, p.turbo > 0.1);
    const dunkOK = ruleAllows(m, 'dunk', false);
    // 1. take it to the rack, unless a bigger, better shot blocker is waiting there and can get up
    // in time. Smarter players read that; the rest find out.
    // the most dangerous defender who can get to the rim before the ball does
    let prot = null, worst = 99;
    p.opps.forEach((o) => {
      if (o.state === 'fallen' || o.state === 'stumble' || o.z > 0) return;
      if (distRim(o) > 7.5 || hyp(o.x - p.x, o.y - p.y) > d + 5) return;
      const edge = p.r.dnk - o.r.blk + (p.hgtFt - o.hgtFt) * 2.2;
      if (edge < worst) { worst = edge; prot = o; }
    });
    const guarded = !!prot;
    const reads = Math.random() < lerp(0.4, 0.95, sk);
    if (d < dunkR && dunkOK && p.r.dnk >= 3) {
      const meet = guarded ? m.dunkContest(p, prot, { dist: d }) : 'poster';
      if (!reads || meet === 'poster' || late || (meet === 'rim' && Math.random() < 0.2 + (crown ? 0.4 : 0))) {
        p.wantTurbo = true; m.shootAction(p, { turbo: p.turbo > 0.1 }); return;
      }
    }
    if (d < 8 && ruleAllows(m, 'layup', false) && (!guarded || !reads || late || p.r.ins + (p.hgtFt - prot.hgtFt) * 2 > prot.r.blk + 1)) { m.shootAction(p, { turbo: false }); return; }
    // 2. find the better shot: an open teammate with a clearly better look gets it
    const myVal = d < 8 ? 0.7 : m.shotChance(p, p.x, p.y) * m.pointsFor('jumper', C.isDeep(p.x, p.y));
    const better = p.mates.filter((t) => t.state === 'move' && m.openness(t) > 5.5 && m.laneClear(p, t) > 0.3).map((t) => ({ t, v: distRim(t) < 8 ? 0.75 : m.shotChance(t, t.x, t.y) * m.pointsFor('jumper', C.isDeep(t.x, t.y)) })).sort((a, c) => c.v - a.v)[0];
    if (better && better.v > myVal + 0.12 && !late && Math.random() < 0.35 + p.r.pas * 0.04) { m.passTo(p, better.t); return; }
    // 3. the jumper, when it's worth more than what the possession usually gets
    const deep = C.isDeep(p.x, p.y);
    const value = m.pointsFor('jumper', deep);
    // (nobody pulls up with a defender draped on them unless the clock says so)
    const smothered = near.d < 2.6 && (near.o.x - p.x) * (RIM.x - p.x) + (near.o.y - p.y) * (RIM.y - p.y) > 0;
    if (value > 0 && d > 8 && (!smothered || late)) {
      const pct = m.shotChance(p, p.x, p.y);
      const want = pct * value + (crown ? 0.12 : 0) + (p.fire ? 0.15 : 0) + clamp((5 - clock) * 0.06, 0, 0.3);
      const bar = (value === 2 ? 0.86 : 0.45) - sk * 0.05 + (m.rule === 'deep' ? -0.12 : 0);
      if ((want > bar && Math.random() < 0.75) || late) { m.startJumpShot(p, {}); return; }
    }
    if (late && d < 9) { m.shootAction(p, { turbo: p.turbo > 0.1 }); return; }
    // 4. the lob, to a dunker cutting free with nobody waiting at the rim
    if (p.r.pas >= 3 && Math.random() < 0.1 + p.r.pas * 0.015) {
      const q = p.mates.find((t) => t.state === 'move' && t.r.dnk >= 5 && t.ai.cutT > 0 && distRim(t) < 15 && m.openness(t) > 5);
      const prot = rimProtector(p);
      if (q && dunkOK && (!prot || distRim(prot) > 6 || m.dunkContest(q, prot, { dist: 8 }) === 'poster')) { m.startOop(p, q); return; }
    }
    if (dunkOK && p.r.dnk >= 7 && d > 10 && d < 24 && !blocked && Math.random() < 0.05 + (crown ? 0.1 : 0)) { m.startSelfOop(p); return; }
    // 5. shake the defender: cross one who is sliding, freeze one who is flying at you
    const handle = clamp((p.r.hnd - 2) / 8, 0, 1);
    const fresh = m.time - (p.ai.moveAt || -9) > lerp(1.75, 0.85, handle);
    if (near.d < 5 && p.cool.trick <= 0 && fresh && beatWithMove(m, p, near, sk)) { p.ai.moveAt = m.time; return; }
    if (near.d < 5 && p.cool.trick <= 0 && fresh && Math.random() < 0.015 + Math.max(0, p.r.hnd - 3) * 0.028) {
      p.ai.moveAt = m.time;
      // a little showtime now and then, for the style meter
      const r = Math.random();
      const dir = r < 0.35 ? 'fwd' : r < 0.65 ? 'side' : r < 0.85 ? 'back' : 'none';
      const flashy = p.turbo > 0.35 && p.r.hnd >= 6 && Math.random() < clamp(0.12 + p.r.hnd * 0.055, 0, 0.7);
      m.startTrick(p, dir, flashy); return;
    }
    // 6. move the ball
    const openMate = p.mates.filter((t) => t.state === 'move' && m.laneClear(p, t) > 0.2).sort((a, b) => m.openness(b) - m.openness(a))[0];
    if (openMate && ((near.d < 3.6 && Math.random() < 0.28 + p.r.pas * 0.03) || (clock < 6 && Math.random() < 0.18)) && m.openness(openMate) > near.d + 1.5) {
      m.passTo(p, openMate); return;
    }
    // 7. pick a destination
    chooseIntent(m, p, near, blocked);
    followIntent(m, p, near);
  }
  // Read the defender's feet. Sliding hard one way: cross back the other. Closing out hard: hesitate
  // or spin past. Sitting still: no move beats that, so don't force one.
  function beatWithMove(m, p, near, sk) {
    const o = near.o; if (!o || (o.state !== 'move' && o.state !== 'steal')) return false;
    if (Math.random() > lerp(0.3, 0.8, sk) * (0.55 + p.r.hnd * 0.05)) return false;
    const rx = RIM.x - p.x, ry = RIM.y - p.y, rd = hyp(rx, ry) || 1;
    // how hard the defender is sliding across the line to the rim
    const lat = Math.abs(o.vx * -ry / rd + o.vy * rx / rd);
    if (o.state === 'steal' || lat > 8) {
      let ex = { x: -ry / rd, y: rx / rd };
      if (ex.x * o.vx + ex.y * o.vy > 0) ex = { x: -ex.x, y: -ex.y };
      // lean the exit a little toward the rim so the burst goes somewhere useful
      ex = { x: ex.x * 0.85 + rx / rd * 0.4, y: ex.y * 0.85 + ry / rd * 0.4 }; const el = hyp(ex.x, ex.y); ex.x /= el; ex.y /= el;
      const flashy = p.turbo > 0.35 && p.r.hnd >= 6 && Math.random() < 0.3;
      m.startTrick(p, 'side', flashy, ex);
      return true;
    }
    const closing = (o.vx * (p.x - o.x) + o.vy * (p.y - o.y)) / (near.d || 1);
    if (closing > 6) { m.startTrick(p, Math.random() < 0.5 ? 'none' : 'fwd', false, { x: rx / rd, y: ry / rd }); return true; }
    return false;
  }
  function chooseIntent(m, p, near, blocked) {
    const shooterish = p.r.out >= p.r.dnk + 2 || m.rule === 'deep';
    if (shooterish && Math.random() < 0.55) {
      let best = null, bs = -1e9;
      DEEP_SPOTS.forEach(([x, y]) => { let s = -hyp(x - p.x, y - p.y) * 0.4; p.opps.forEach((o) => { s += Math.min(8, hyp(o.x - x, o.y - y)) * 0.6; }); s += Math.random() * 3; if (s > bs) { bs = s; best = [x, y]; } });
      p.ai.intent = { x: best[0], y: best[1], turbo: false };
      return;
    }
    // attack with a weave away from the nearest defender
    let side = 0;
    if (near.o) { const cross = (RIM.x - p.x) * (near.o.y - p.y) - (RIM.y - p.y) * (near.o.x - p.x); side = cross > 0 ? -1 : 1; }
    const dx = RIM.x - p.x, dy = RIM.y - p.y, d = hyp(dx, dy) || 1;
    const off = blocked ? 6 : 2.5;
    p.ai.intent = { x: RIM.x - dx / d * 3 + -dy / d * off * side, y: RIM.y - dy / d * 3 + dx / d * off * side, turbo: p.turbo > 0.4 && Math.random() < 0.6 };
  }
  function followIntent(m, p, near) {
    const it = p.ai.intent;
    if (!it) { p.want = { x: 0, y: 0 }; return; }
    let tx = it.x, ty = it.y;
    if (near.o && near.d < 4) {
      // slide around the defender
      const ax = p.x - near.o.x, ay = p.y - near.o.y, ad = hyp(ax, ay) || 1;
      tx += ax / ad * 3; ty += ay / ad * 3;
    }
    goTo(p, tx, ty, it.turbo, 2);
  }

  // ---------- offense: everybody else ----------
  // Spacing for three on three: stay a pass away but out of the ball's way, keep the driving lane
  // empty, keep apart from your teammate, and play where you can score from. When the ball drives,
  // everybody slides to stay in its line of sight. Cut when your defender gives you the chance.
  const SPOTS = DEEP_SPOTS.map(([x, y]) => ({ x, y, deep: true })).concat(IN_SPOTS.map(([x, y]) => ({ x, y, deep: false })));
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1);
    return hyp(ax + dx * t - px, ay + dy * t - py);
  }
  function crosses(ax, ay, bx, by, cx, cy, dx, dy) {
    const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
    return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
  }
  function spotValue(m, p, s, holder) {
    let v = s.deep ? (p.r.out - 5) * 0.45 + (m.rule === 'deep' ? 3 : 0) : (Math.max(p.r.ins, p.r.dnk) - 5) * 0.45 + (m.rule === 'dunks' ? 3 : 0);
    if (!m.cleared && !s.deep) v -= 20; // taking it back: outlets live behind the arc
    if (holder) {
      const dh = hyp(s.x - holder.x, s.y - holder.y);
      v -= Math.max(0, 12 - dh) * 1.5 + Math.max(0, dh - 25) * 0.6; // a pass away, not on top of the ball
      if (distRim(holder) > 4) v -= Math.max(0, 6 - segDist(s.x, s.y, holder.x, holder.y, RIM.x, RIM.y)) * 1.6; // the driving lane stays empty
      p.opps.forEach((o) => { v -= Math.max(0, 2.5 - segDist(o.x, o.y, holder.x, holder.y, s.x, s.y)) * 1.2; }); // a clean passing line
      if (distRim(holder) > 6 && crosses(p.x, p.y, s.x, s.y, holder.x, holder.y, RIM.x, RIM.y)) v -= 3.5; // don't walk across the drive
    }
    p.mates.forEach((q) => {
      if (q === holder) return;
      const t = q.ai.spot && !q.human ? q.ai.spot : q;
      v -= Math.max(0, 13 - hyp(t.x - s.x, t.y - s.y)) * 1.1;
      if (!s.deep && t.deep === false && hyp(t.x - RIM.x, t.y - RIM.y) < 12) v -= 3; // one body inside at a time
    });
    p.opps.forEach((o) => { v += Math.min(8, hyp(o.x - s.x, o.y - s.y)) * 0.2; });
    return v - hyp(s.x - p.x, s.y - p.y) * 0.06;
  }
  function offBall(m, p, dt, sk) {
    if (!canAct(p)) return;
    p.ai.spotT -= dt; p.ai.cutT -= dt;
    const holder = m.ball.holder;
    if (p.ai.cutT > 0 && p.ai.spot) { goTo(p, p.ai.spot.x, p.ai.spot.y, true, 1); return; }
    // the ball is going downhill: re-read the floor right away
    const driving = holder && hyp(holder.vx, holder.vy) > 10 && distRim(holder) < 22;
    if (driving && p.ai.spotT > 0.3) p.ai.spotT = 0.3;
    if (!p.ai.spot || p.ai.spotT <= 0) {
      p.ai.spotT = driving ? 0.3 : rand(0.5, 0.9);
      if (m.cleared && holder && cutNow(m, p, holder, sk)) return;
      const cur = p.ai.spot ? spotValue(m, p, p.ai.spot, holder) + 1.5 : -1e9; // don't dither between spots
      let best = p.ai.spot, bs = cur;
      SPOTS.forEach((s) => { const v = spotValue(m, p, s, holder) + Math.random() * 0.6; if (v > bs) { bs = v; best = s; } });
      p.ai.spot = best;
    }
    goTo(p, p.ai.spot.x, p.ai.spot.y, !m.cleared || driving, 2);
  }
  // Cuts: backdoor when your defender is overplaying the pass, give-and-go right after you pass,
  // and now and then a dunker diving to the rim while the ball is out top.
  function cutNow(m, p, holder, sk) {
    if (m.pointsFor('layup', false) <= 0 && m.pointsFor('dunk', false) <= 0) return false;
    if (distRim(p) < 13) return false;
    const d = p.opps.find((o) => o.mark === p) || nearestOpp(p).o;
    let why = null;
    if (d && hyp(d.x - p.x, d.y - p.y) < 4.5) {
      // denying: the defender sits on the line between you and the ball
      const hx = holder.x - p.x, hy = holder.y - p.y, hl = hyp(hx, hy) || 1;
      const along = ((d.x - p.x) * hx + (d.y - p.y) * hy) / hl, off = Math.abs((d.x - p.x) * -hy + (d.y - p.y) * hx) / hl;
      if (along > 0.5 && off < 2.2) why = 'backdoor';
    }
    if (!why && m.time - (p.passedAt || -9) < 0.6 && !laneBlocked(p, 3)) why = 'giveandgo';
    if (!why && p.r.dnk >= 5 && distRim(holder) > 16 && Math.random() < 0.06 + p.r.dnk * 0.012 + sk * 0.04) why = 'dive';
    if (!why || Math.random() > lerp(0.45, 0.9, sk)) return false;
    p.ai.spot = { x: 39.2 + rand(-0.8, 0.8), y: (p.y > 0 ? 1 : -1) * rand(1.5, 3.5), deep: false }; p.ai.cutT = 1.4; p.ai.spotT = 1.4;
    goTo(p, p.ai.spot.x, p.ai.spot.y, true, 1);
    return true;
  }

  // ---------- defense ----------
  function defense(m, p, dt, sk) {
    if (p.ai.jumpAt >= 0) {
      p.ai.jumpAt -= dt;
      if (p.ai.jumpAt < 0 && p.state === 'move' && p.z === 0) { m.jump(p, 'block'); return; }
    }
    if (!canAct(p)) return;
    const b = m.ball; const holder = b.state === 'held' ? b.holder : null;
    let target = p.mark;
    // help on a drive when the on-ball defender got beat
    if (m.cleared && holder && holder !== p.mark && distRim(holder) < 16) {
      const guard = p.mates.concat([p]).find((q) => q.mark === holder);
      const beat = !guard || guard.state === 'fallen' || guard.state === 'stumble' || guard.whiff || distRim(guard) > distRim(holder) + 1 - sk;
      if (beat) {
        const helpers = p.mates.concat([p]).filter((q) => q !== guard && q.state === 'move').sort((a, c) => hyp(a.x - holder.x, a.y - holder.y) - hyp(c.x - holder.x, c.y - holder.y));
        if (helpers[0] === p) target = holder;
      }
    }
    if (target.state === 'dunk' || target.state === 'oop') { goTo(p, RIM.x - 3, RIM.y + (p.y > 0 ? 2 : -2), true, 1); return; }
    const onBall = target === holder;
    // a shooter rising: close out under control, hand up, without running into the shooter
    if (target.state === 'shoot') {
      const cx = target.x - p.x, cy = target.y - p.y, cd = hyp(cx, cy) || 1;
      if (cd > 3.2) goTo(p, target.x - cx / cd * 3, target.y - cy / cd * 3, true, 0.8); else p.want = { x: 0, y: 0 };
      return;
    }
    // what this defender has seen: where the mark was a beat ago, and where they were going
    const lag = lerp(0.24, 0.07, sk);
    const seen = m.lagged(target, lag);
    const tx = seen.x + seen.vx * lag * 0.8, ty = seen.y + seen.vy * lag * 0.8;
    let gap = onBall ? lerp(4.4, 2.8, sk) : lerp(6.5, 5, sk);
    if (onBall) {
      // crowd the shooters out by the arc, give the quick ones a step of cushion, and inside the
      // arc get up into the ball so there's no straight line to the rim
      const dr = hyp(tx - RIM.x, ty - RIM.y);
      if (dr > C.arcR - 3) gap -= (target.r.out - 5) * 0.14;
      else gap -= 0.8;
      gap += (target.r.spd - 5) * 0.08;
      if (dr > C.arcR + 5) gap += 2; // way out there: no need to press
      gap = clamp(gap, 2.2, 6.5);
    } else if (holder && distRim(holder) < C.arcR) {
      // off the ball with the ball inside the arc: sink toward the paint
      gap += 1.5;
    }
    const dx = RIM.x - tx, dy = RIM.y - ty, d = hyp(dx, dy) || 1;
    let gx = tx + dx / d * Math.min(gap, d * 0.6), gy = ty + dy / d * Math.min(gap, d * 0.6);
    if (!onBall && holder) { gx = lerp(gx, holder.x, 0.22); gy = lerp(gy, holder.y, 0.22); }
    const far = hyp(gx - p.x, gy - p.y);
    goTo(p, gx, gy, far > 5 || (onBall && distRim(target) < distRim(p)), 1.2);
    // reach in when the ball is out where you can get it; gamble once in a while when it isn't
    p.ai.react -= dt;
    if (onBall && p.ai.react <= 0) {
      p.ai.react = lerp(0.45, 0.16, sk) * rand(0.8, 1.2);
      if (p.cool.steal <= 0) {
        const ex = m.ballExposure(holder, p);
        const guard = -0.25 + holder.r.hnd * 0.05;
        if (ex.reach && ex.open && ex.cos > guard + 0.12 && Math.random() < lerp(0.15, 0.5, sk) * (0.6 + p.r.stl * 0.06)) m.tryStealAction(p);
        else if (ex.reach && !ex.open && Math.random() < lerp(0.05, 0.008, sk)) m.tryStealAction(p);
      }
    }
  }

  // ---------- loose balls and shots in the air ----------
  function landing(b) {
    if (b.state !== 'loose' && b.state !== 'shot') return { x: b.x, y: b.y };
    if (b.state === 'shot') return { x: RIM.x - 3, y: RIM.y };
    const z = b.z, vz = b.vz;
    const t = z > 6 ? (vz + Math.sqrt(Math.max(0, vz * vz + 64 * (z - 6)))) / 32 : 0.1;
    return { x: clamp(b.x + b.vx * t, 1, 46), y: clamp(b.y + b.vy * t, -24, 24) };
  }
  function chase(m, p, dt, sk) {
    if (!canAct(p)) return;
    const b = m.ball; const L = landing(b);
    const team = m.teams[p.team].players.filter((q) => canAct(q));
    team.sort((a, c) => hyp(a.x - L.x, a.y - L.y) - hyp(c.x - L.x, c.y - L.y));
    const rank = team.indexOf(p);
    if (rank === 0 || (rank === 1 && Math.random() < 0.98)) {
      goTo(p, L.x, L.y, true, 0.5);
      const dd = hyp(b.x - p.x, b.y - p.y);
      if (dd < 3 && b.z > p.reach + 0.3 && b.z < p.reach + 4.5 && b.vz < 2 && p.z === 0 && Math.random() < 0.15 + sk * 0.2) m.jump(p, 'rebound');
    } else {
      // box out: stand between your man and the rim
      const mk = p.mark; const dx = RIM.x - mk.x, dy = RIM.y - mk.y, d = hyp(dx, dy) || 1;
      goTo(p, mk.x + dx / d * 2, mk.y + dy / d * 2, false, 1);
    }
  }
  // The teammate who goes to the offensive glass on a shot: the best rebounder close enough to matter.
  function crasher(p, shooter) {
    let best = null, bs = -1e9;
    p.mates.concat([p]).forEach((q) => { if (q === shooter || distRim(q) > 16) return; const s = q.r.reb - distRim(q) * 0.3; if (s > bs) { bs = s; best = q; } });
    return best;
  }
  function shotInAir(m, p, dt, sk) {
    if (p.ai.jumpAt >= 0) {
      p.ai.jumpAt -= dt;
      if (p.ai.jumpAt < 0 && p.state === 'move' && p.z === 0) { m.jump(p, 'block'); return; }
    }
    if (!canAct(p)) return;
    const b = m.ball; const f = b.flight;
    if (f && f.kind !== 'pass' && f.kind !== 'oop') {
      // where the miss is likely to come off: long shots come off long, and away from the shooter
      const s = f.shooter; const sx = s.x - RIM.x, sy = s.y - RIM.y, sd = hyp(sx, sy) || 1;
      const r = clamp(3 + sd * 0.25, 4, 9);
      const spot = { x: clamp(RIM.x - Math.abs(sx / sd) * r * 0.7, 30, 44), y: clamp(-sy / sd * r, -14, 14) };
      if (m.offense !== p.team) {
        const mk = p.mark;
        if (mk === s) { goTo(p, spot.x, spot.y, true, 1); return; } // shooters rarely follow their own shot
        // box out: get between your man and where the ball's coming down, and hold your ground
        const dx = spot.x - mk.x, dy = spot.y - mk.y, d = hyp(dx, dy) || 1;
        goTo(p, mk.x + dx / d * Math.min(2.4, d * 0.6), mk.y + dy / d * Math.min(2.4, d * 0.6), true, 0.6);
      } else if (p !== s && (crasher(p, s) === p || distRim(p) < 7)) {
        goTo(p, spot.x, spot.y, true, 1); // one player crashes the glass (plus anybody already inside)
      } else p.want = { x: 0, y: 0 };
      return;
    }
    if (m.offense === p.team) offBall(m, p, dt, sk); else defense(m, p, dt, sk);
  }

  // Run around people, not through them. Bodies ahead in your path push your line sideways and slow
  // you up; teammates get a wide berth. The one contact left alone on purpose: the defender on the
  // ball holding their spot in front of the dribbler.
  function steer(m, p) {
    const w = p.want; if (!w) return;
    const wl = hyp(w.x, w.y); if (wl < 0.2) return;
    const ux = w.x / wl, uy = w.y / wl;
    let side = 0, slow = 1;
    const holder = m.ball.holder, onD = p.team !== m.offense;
    // the faster you're going, the further ahead you have to look (you can't swerve at full tilt)
    const look = 3.5 + hyp(p.vx, p.vy) * 0.3;
    for (const q of m.players) {
      if (q === p || q.state === 'fallen') continue;
      if (onD && (q === p.mark || q === holder)) continue; // a defender holds ground on their man
      const rx = q.x - p.x, ry = q.y - p.y;
      const along = rx * ux + ry * uy; if (along <= 0 || along > look) continue;
      const lat = -rx * uy + ry * ux; const room = q.team === p.team ? 2.8 : 2.3;
      if (Math.abs(lat) > room) continue;
      const k = (1 - along / look) * (1 - Math.abs(lat) / room);
      side += (lat > 0 ? -1 : 1) * k * (q.team === p.team ? 1.6 : 1.2);
      if (along < 3) slow = Math.min(slow, 0.45 + along * 0.18);
    }
    if (!side && slow === 1) return;
    const nx = ux - uy * side, ny = uy + ux * side, nl = hyp(nx, ny) || 1;
    p.want = { x: nx / nl * wl * slow, y: ny / nl * wl * slow };
  }

  BK.AI = {
    update(m, dt) {
      if (m.phase !== 'live') return;
      const b = m.ball;
      for (const p of m.players) {
        if (p.human) continue;
        const sk = skillOf(m, p);
        if (b.state === 'held' && b.holder) {
          if (b.holder === p) handler(m, p, dt, sk);
          else if (b.holder.team === p.team) offBall(m, p, dt, sk);
          else defense(m, p, dt, sk);
        } else if (b.state === 'loose') chase(m, p, dt, sk);
        else shotInAir(m, p, dt, sk);
        if (b.state === 'held' || b.state === 'shot' || b.state === 'pass') steer(m, p);
      }
    },
    // Someone just went up: decide which defenders leave the floor and when. Good timing puts the
    // hand at its highest just as the ball gets there; a late reaction gets there after it's gone.
    onShotStart(m, shooter) {
      const kind = shooter.state;
      shooter.opps.forEach((o) => {
        if (o.human || o.state !== 'move' || o.z > 0) return;
        const sk = skillOf(m, o);
        const rise = o.jumpV / G_JUMP; // seconds to the top of the jump
        const react = lerp(0.2, 0.06, sk) + Math.abs(gauss()) * lerp(0.1, 0.035, sk);
        if (kind === 'shoot') {
          const d = hyp(o.x - shooter.x, o.y - shooter.y);
          if (d < 3.4 && Math.random() < 0.2 + o.r.blk * 0.03 + sk * 0.15) {
            const release = shooter.shot ? shooter.shot.apex : 0.4;
            o.ai.jumpAt = Math.max(react, release - rise * 0.75 + gauss() * lerp(0.1, 0.04, sk));
          }
        } else if (kind === 'layup') {
          const f = shooter.fly; if (!f) return;
          const d = hyp(o.x - f.ex, o.y - f.ey);
          if (d < 7 && Math.random() < 0.3 + o.r.blk * 0.05) o.ai.jumpAt = Math.max(react * 0.7, f.T * 0.45 - rise * 0.8 + gauss() * lerp(0.1, 0.04, sk));
        } else if (kind === 'dunk' || kind === 'oop') {
          const f = shooter.fly; if (!f) return;
          const d = hyp(o.x - RIM.x, o.y - RIM.y);
          const slamT = kind === 'oop' ? f.T : f.T * 0.78;
          if (d < 12 && Math.random() < 0.25 + o.r.blk * 0.055 + sk * 0.1) o.ai.jumpAt = Math.max(0.02, slamT - rise * 0.9 + gauss() * lerp(0.2, 0.08, sk));
        }
      });
    },
  };
  void H;
})(window.BK = window.BK || {});
