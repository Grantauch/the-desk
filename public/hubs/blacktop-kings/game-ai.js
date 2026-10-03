/* Blacktop Kings — the computer players. Each one thinks a few times a second (faster on harder
   settings) and moves every frame. Offense: attack the rim, kick it out, throw lobs, show off.
   Defense: stay between your man and the rim, help on drives, reach, and time the block. */
(function (BK) {
  'use strict';
  const C = BK.art.COURT;
  const H = () => BK.Match.prototype.helpers;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hyp = Math.hypot;
  const RIM = { x: C.rimX, y: C.rimY };
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
  function ruleAllows(m, kind, deep) { return m.pointsFor(kind, deep) > 0; }

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

    // crown time
    if (team.crown >= 1 && !team.crownActive && (team.crown >= 2 || Math.random() < 0.45)) m.activateCrown(team, p);
    const crown = team.crownActive > 0;
    const blocked = laneBlocked(p, 3.2);
    const dunkR = m.dunkRange(p, p.turbo > 0.1);
    const dunkOK = ruleAllows(m, 'dunk', false);
    // 1. take it to the rack
    if (d < dunkR && dunkOK && p.r.dnk >= 3 && (!blocked || Math.random() < 0.06 + p.r.dnk * 0.022 + (crown ? 0.25 : 0))) {
      p.wantTurbo = true; m.shootAction(p, { turbo: p.turbo > 0.1 }); return;
    }
    if (d < 8 && ruleAllows(m, 'layup', false) && (!blocked || Math.random() < 0.25)) { m.shootAction(p, { turbo: false }); return; }
    // 2. find the better shot: an open teammate with a clearly better look gets it
    const myVal = d < 8 ? 0.7 : m.shotChance(p, p.x, p.y, 'good') * m.pointsFor('jumper', C.isDeep(p.x, p.y));
    const better = p.mates.filter((t) => t.state === 'move' && m.openness(t) > 5.5).map((t) => ({ t, v: distRim(t) < 8 ? 0.75 : m.shotChance(t, t.x, t.y, 'good') * m.pointsFor('jumper', C.isDeep(t.x, t.y)) })).sort((a, c) => c.v - a.v)[0];
    if (better && better.v > myVal + 0.12 && Math.random() < 0.35 + p.r.pas * 0.04) { m.passTo(p, better.t); return; }
    // 3. the jumper
    const deep = C.isDeep(p.x, p.y);
    const value = m.pointsFor('jumper', deep);
    if (value > 0 && d > 8) {
      const pct = m.shotChance(p, p.x, p.y, 'good');
      const want = pct * value + p.ai.holdT * 0.045 + (crown ? 0.12 : 0) + (p.fire ? 0.15 : 0);
      const bar = (value === 2 ? 0.74 : 0.44) - sk * 0.05 + (m.rule === 'deep' ? -0.12 : 0);
      const openReq = 5 - p.r.out * 0.22;
      if ((near.d > openReq && want > bar && Math.random() < 0.75) || (p.ai.holdT > 7.5 && near.d > 2.5)) { m.startJumpShot(p, {}); return; }
    }
    // 3. the lob
    if (p.r.pas >= 3 && Math.random() < 0.22 + p.r.pas * 0.025) {
      const q = p.mates.find((t) => t.state === 'move' && t.r.dnk >= 5 && distRim(t) < 17 && m.openness(t) > 4.5 && (t.ai.cutT > 0 || distRim(t) < 11));
      if (q && dunkOK) { m.startOop(p, q); return; }
    }
    if (dunkOK && p.r.dnk >= 7 && d > 10 && d < 24 && !blocked && Math.random() < 0.05 + (crown ? 0.1 : 0)) { m.startSelfOop(p); return; }
    // 4. shake the defender
    if (near.d < 5 && p.cool.trick <= 0 && Math.random() < 0.16 + p.r.hnd * 0.045) {
      const r = Math.random();
      const dir = r < 0.35 ? 'fwd' : r < 0.65 ? 'side' : r < 0.85 ? 'back' : 'none';
      const flashy = p.turbo > 0.35 && p.r.hnd >= 6 && Math.random() < 0.25 + p.r.hnd * 0.04;
      m.startTrick(p, dir, flashy); return;
    }
    // 5. move the ball
    const openMate = p.mates.filter((t) => t.state === 'move').sort((a, b) => m.openness(b) - m.openness(a))[0];
    if (openMate && ((near.d < 3.6 && Math.random() < 0.28 + p.r.pas * 0.03) || (p.ai.holdT > 3.5 && Math.random() < 0.18)) && m.openness(openMate) > near.d + 1.5) {
      m.passTo(p, openMate); return;
    }
    // 6. pick a destination
    chooseIntent(m, p, near, blocked);
    followIntent(m, p, near);
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
  function offBall(m, p, dt, sk) {
    if (!canAct(p)) return;
    p.ai.spotT -= dt; p.ai.cutT -= dt;
    const holder = m.ball.holder;
    if (p.ai.cutT > 0 && p.ai.spot) { goTo(p, p.ai.spot.x, p.ai.spot.y, true, 1); return; }
    if (!p.ai.spot || p.ai.spotT <= 0) {
      p.ai.spotT = rand(1.4, 3.2);
      const cutter = p.r.dnk >= 5 && holder && distRim(holder) > 14 && Math.random() < 0.18 + p.r.dnk * 0.03 + sk * 0.05;
      if (cutter && m.pointsFor('dunk', false) > 0) {
        p.ai.spot = { x: 39.5 + rand(-1, 1), y: (p.y > 0 ? 1 : -1) * rand(1.5, 4) }; p.ai.cutT = 1.6; p.ai.spotT = 1.6;
      } else {
        const preferDeep = (p.r.out >= p.r.ins && m.rule !== 'dunks') || m.rule === 'deep';
        const pool = (preferDeep ? DEEP_SPOTS : IN_SPOTS).concat(Math.random() < 0.3 ? (preferDeep ? IN_SPOTS : DEEP_SPOTS) : []);
        let best = null, bs = -1e9;
        pool.forEach(([x, y]) => {
          let s = Math.random() * 3 - hyp(x - p.x, y - p.y) * 0.08;
          p.opps.forEach((o) => { s += Math.min(9, hyp(o.x - x, o.y - y)) * 0.35; });
          if (holder) s -= Math.max(0, 9 - hyp(holder.x - x, holder.y - y)) * 1.2;
          p.mates.forEach((q) => { if (q.ai.spot) s -= Math.max(0, 9 - hyp(q.ai.spot.x - x, q.ai.spot.y - y)) * 1.2; });
          if (s > bs) { bs = s; best = [x, y]; }
        });
        p.ai.spot = { x: best[0], y: best[1] };
      }
    }
    goTo(p, p.ai.spot.x, p.ai.spot.y, false, 2);
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
    if (holder && holder !== p.mark && distRim(holder) < 15) {
      const guard = p.mates.concat([p]).find((q) => q.mark === holder);
      const beat = !guard || guard.state === 'fallen' || guard.state === 'stumble' || distRim(guard) > distRim(holder) + 2.5;
      if (beat) {
        const helpers = p.mates.concat([p]).filter((q) => q !== guard && q.state === 'move').sort((a, c) => hyp(a.x - holder.x, a.y - holder.y) - hyp(c.x - holder.x, c.y - holder.y));
        if (helpers[0] === p) target = holder;
      }
    }
    if (target.state === 'dunk' || target.state === 'oop') { goTo(p, RIM.x - 3, RIM.y + (p.y > 0 ? 2 : -2), true, 1); return; }
    const onBall = target === holder;
    const gap = onBall ? lerp(4.2, 2.7, sk) : lerp(6.5, 5, sk);
    const dx = RIM.x - target.x, dy = RIM.y - target.y, d = hyp(dx, dy) || 1;
    let gx = target.x + dx / d * Math.min(gap, d * 0.6), gy = target.y + dy / d * Math.min(gap, d * 0.6);
    if (!onBall && holder) { gx = lerp(gx, holder.x, 0.22); gy = lerp(gy, holder.y, 0.22); }
    const far = hyp(gx - p.x, gy - p.y);
    goTo(p, gx, gy, far > 5 || (onBall && distRim(target) < distRim(p)), 1.2);
    // reach in
    p.ai.react -= dt;
    if (onBall && p.ai.react <= 0) {
      p.ai.react = lerp(0.5, 0.2, sk) * rand(0.8, 1.2);
      const dd = hyp(holder.x - p.x, holder.y - p.y);
      if (dd < 3.9 && p.cool.steal <= 0 && Math.random() < (0.05 + p.r.stl * 0.014) * (0.55 + sk * 0.9)) m.tryStealAction(p);
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
  function shotInAir(m, p, dt, sk) {
    if (p.ai.jumpAt >= 0) {
      p.ai.jumpAt -= dt;
      if (p.ai.jumpAt < 0 && p.state === 'move' && p.z === 0) { m.jump(p, 'block'); return; }
    }
    if (!canAct(p)) return;
    const b = m.ball; const f = b.flight;
    if (f && f.kind !== 'pass' && f.kind !== 'oop') {
      // crash the glass or box out
      const bigs = p.r.reb >= 6 || p.slot === 2;
      if (bigs) { goTo(p, RIM.x - 4 + rand(-1, 1), RIM.y + (p.y > 0 ? 3 : -3), true, 1); }
      else if (m.offense !== p.team) { const mk = p.mark; const dx = RIM.x - mk.x, dy = RIM.y - mk.y, d = hyp(dx, dy) || 1; goTo(p, mk.x + dx / d * 2.5, mk.y + dy / d * 2.5, false, 1); }
      else p.want = { x: 0, y: 0 };
      return;
    }
    if (m.offense === p.team) offBall(m, p, dt, sk); else defense(m, p, dt, sk);
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
      }
    },
    // Someone just went up: decide which defenders try to meet it.
    onShotStart(m, shooter) {
      const kind = shooter.state;
      shooter.opps.forEach((o) => {
        if (o.human || o.state !== 'move' || o.z > 0) return;
        const sk = skillOf(m, o);
        if (kind === 'shoot') {
          const d = hyp(o.x - shooter.x, o.y - shooter.y);
          if (d < 6 && Math.random() < 0.12 + o.r.blk * 0.04 + sk * 0.12) o.ai.jumpAt = lerp(0.2, 0.04, sk) + rand(0, 0.08);
        } else if (kind === 'layup') {
          const d = hyp(o.x - shooter.x, o.y - shooter.y);
          if (d < 7 && Math.random() < 0.3 + o.r.blk * 0.05) o.ai.jumpAt = rand(0.02, 0.14);
        } else if (kind === 'dunk' || kind === 'oop') {
          const f = shooter.fly; if (!f) return;
          const d = hyp(o.x - RIM.x, o.y - RIM.y);
          const slamT = kind === 'oop' ? f.T : f.T * 0.78;
          const reachT = d / 20;
          if (d < 12 && Math.random() < 0.25 + o.r.blk * 0.055 + sk * 0.1) o.ai.jumpAt = Math.max(0.02, slamT - 0.3 - rand(0, 0.12) + (reachT > slamT - 0.3 ? 0 : 0));
        }
      });
    },
  };
  void H;
})(window.BK = window.BK || {});
