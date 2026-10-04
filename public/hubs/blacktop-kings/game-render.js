/* Blacktop Kings — drawing a match: the court, everybody on it sorted by depth, the ball and its
   trail, the effects, and the scoreboard. Everything is drawn in a 1280x720 frame and scaled. */
(function (BK) {
  'use strict';
  const A = BK.art, C = A.COURT;
  const M = BK.Match.prototype;
  const W = 1280, H = 720, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  M.render = function () {
    const ctx = this.ctx; const cam = this.cam;
    const dpr = this.pixelRatio();
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; this.paintBackground(); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const wt = this.fx.worldTransform(this.cameraBase());
    ctx.fillStyle = this.court.ground; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(wt.ox, wt.oy); ctx.scale(wt.z, wt.z);
    ctx.drawImage(this.bg, 0, 0, W, H);
    A.drawCrowd(ctx, cam, this.crowd, this.time, this.excite, this.court);
    A.drawSideline(ctx, cam, this.court);
    this.fx.drawGround(ctx);
    this.drawShadows(ctx);
    this.drawClearLine(ctx);
    this.drawRings(ctx);
    // depth sort
    const ents = this.players.map((p) => ({ y: p.y, t: 'p', p }));
    ents.push({ y: -0.9, t: 'hoopBack' }, { y: 0.9, t: 'hoopFront' });
    const b = this.ball;
    ents.push({ y: b.y + (b.state === 'held' ? 0.05 : 0), t: 'ball' });
    ents.sort((a, c) => a.y - c.y);
    for (const e of ents) {
      if (e.t === 'p') this.drawPlayer(ctx, e.p);
      else if (e.t === 'ball') this.drawBallNow(ctx);
      else A.drawHoop(ctx, cam, this.hoop, e.t === 'hoopBack' ? 'back' : 'front', this.court, this.time);
    }
    // a dribble on the far side of the body would vanish behind it: keep a faint outline on top
    if (b.state === 'held' && b.holder && b.y < b.holder.y - 0.12) {
      const g = cam.project(b.x, b.y, b.z);
      ctx.save(); ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.strokeStyle = '#ffb066';
      ctx.beginPath(); ctx.arc(g.x, g.y, Math.max(3, g.s * 0.5), 0, TAU); ctx.stroke(); ctx.restore();
    }
    this.fx.drawAir(ctx);
    A.drawGlows(ctx, cam, this.court, this.time);
    ctx.restore();
    this.fx.drawScreen(ctx, this.time);
    if (!this.attract) this.drawHUD(ctx);
    this.fx.drawCalls(ctx);
  };

  // Soft contact shadows: a radial gradient squashed onto the floor, smaller and fainter in the air.
  function softShadow(ctx, x, y, rx, ry, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
  M.drawShadows = function (ctx) {
    const cam = this.cam; const night = this.court.time === 'night' || this.court.time === 'indoor';
    const base = night ? 0.6 : 0.42;
    for (const p of this.players) {
      const g = cam.project(p.x, p.y, 0); const k = 1 / (1 + p.z * 0.12);
      softShadow(ctx, g.x, g.y, g.s * 1.55 * k * (p.state === 'fallen' ? 1.7 : 1), g.s * 0.5 * k, base * (0.55 + 0.45 * k));
    }
    const b = this.ball; const g = cam.project(b.x, b.y, 0); const k = 1 / (1 + b.z * 0.1);
    softShadow(ctx, g.x, g.y, g.s * 0.62 * k, g.s * 0.22 * k, base * k);
  };

  // While your crew has to take it back, the line you have to get behind glows on the floor.
  M.drawClearLine = function (ctx) {
    if (this.cleared || this.phase !== 'live' || !this.humans.some((h) => h.team === this.offense)) return;
    const cam = this.cam; const k = 0.55 + Math.sin(this.time * 6) * 0.25;
    const pts = [[47, -C.cornerY]].concat(C.deepArc(1)).concat([[47, C.cornerY]]);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, a] of [[9, 0.18 * k], [3.5, 0.75 * k]]) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const q = cam.project(x, y, 0.02); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      ctx.lineWidth = w; ctx.strokeStyle = `rgba(255,154,31,${a})`; ctx.stroke();
    }
    ctx.restore();
  };

  M.drawRings = function (ctx) {
    const cam = this.cam;
    for (const p of this.players) {
      const team = this.teams[p.team];
      const g = cam.project(p.x, p.y, 0);
      if (p.human) {
        const pulse = 0.8 + Math.sin(this.time * 6) * 0.2;
        ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = team.colors.pri; ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.s * 1.5 * pulse, g.s * 0.5 * pulse, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      } else if (this.ball.holder === p && this.ball.state === 'held') {
        ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = team.colors.pri; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.s * 1.3, g.s * 0.45, 0, 0, TAU); ctx.stroke(); ctx.restore();
      } else if (!this.attract) {
        // everybody gets a faint footprint in their crew color, so a crowd under the rim stays readable
        ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = team.colors.pri; ctx.globalAlpha = 0.32;
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.s * 1.05, g.s * 0.36, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
  };

  M.drawPlayer = function (ctx, p) {
    if (!p.pose) return;
    const cam = this.cam; const team = this.teams[p.team];
    const s = cam.project(p.x, p.y, p.z);
    const crown = team.crownActive && this.offense === p.team;
    const glow = p.fire ? '#ff6a13' : crown ? '#ffd23f' : (p.data.look && p.data.look.aura === 'royal') ? 'rgba(255,210,63,0.6)' : null;
    if (glow && !this.fx.reduced) {
      // a halo behind the body (the body itself stays crisp)
      const cy = s.y - p.hgtFt * s.s * 0.5, r = p.hgtFt * s.s * 0.75;
      const pulse = 0.85 + Math.sin(this.time * 8 + p.slot) * 0.15;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(s.x, cy, r * 0.15, s.x, cy, r);
      const c = p.fire ? '255,106,19' : '255,200,50';
      gg.addColorStop(0, `rgba(${c},${0.42 * pulse})`); gg.addColorStop(0.6, `rgba(${c},${0.16 * pulse})`); gg.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(s.x, cy, r * 0.7, r, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    A.drawBaller(ctx, {
      x: s.x, y: s.y, scale: s.s, hgt: p.data.hgt, build: p.data.build, look: p.data.look, num: p.data.num,
      colors: team.colors, facing: p.facing, spin: p.spin, pose: p.pose, dims: p.dims, time: this.time + p.slot,
    });
    // dizzy stars over a fallen defender
    if (p.state === 'fallen' || p.state === 'stumble') {
      const hz = p.state === 'fallen' ? 2.2 : p.hgtFt + 0.6; const h = cam.project(p.x, p.y, hz);
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + i * TAU / 3; const x = h.x + Math.cos(a) * h.s * 0.9, y = h.y + Math.sin(a) * h.s * 0.3;
        star(ctx, x, y, h.s * 0.28, '#ffe14d');
      }
    }
    if (p.human && this.humans.length) {
      // a marker over the head: label plate and a chevron in the crew color
      const bob = Math.sin(this.time * 5 + p.slot) * 2.5;
      const top = cam.project(p.x, p.y, p.z + p.hgtFt + 1.3);
      const label = p.human.label; const pri = team.colors.pri;
      const ink = A.luminance(pri) > 0.6 ? INK : '#ffffff';
      ctx.save(); ctx.font = COND(900, 17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 22, ty = top.y - 30 + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; slab(ctx, top.x - w / 2 + 3, ty + 3, w, 21, 6); ctx.fill();
      slab(ctx, top.x - w / 2, ty, w, 21, 6); celFill(ctx, pri, ty, 21, 0.25); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(top.x - 8, ty + 24); ctx.lineTo(top.x + 8, ty + 24); ctx.lineTo(top.x, ty + 33); ctx.closePath(); ctx.fillStyle = pri; ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillText(label, top.x, ty + 11.5);
      ctx.restore();
      // turbo meter under the feet: five slanted cells
      const g = cam.project(p.x, p.y, 0);
      ctx.save(); const bw = 54, bh = 7, cells = 5, gap = 2, cwid = (bw - gap * (cells - 1)) / cells;
      const col = p.turbo > 0.25 ? (p.turboOn ? GOLD : '#38c9ff') : '#ff4a2b';
      for (let i = 0; i < cells; i++) {
        const cx3 = g.x - bw / 2 + i * (cwid + gap), cy3 = g.y + g.s * 0.62;
        const f = clamp(p.turbo * cells - i, 0, 1);
        slab(ctx, cx3, cy3, cwid, bh, 2.5); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
        if (f > 0) { ctx.save(); slab(ctx, cx3, cy3, cwid, bh, 2.5); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(cx3, cy3, cwid * f, bh); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx3, cy3, cwid * f, bh * 0.42); ctx.restore(); }
      }
      ctx.restore();
      // shot timing meter: the green window is live, so it shrinks as a defender closes out
      if (p.state === 'shoot' && p.shot && p.shot.human && !p.shot.released) {
        const span = p.shot.apex + 0.24; const k = clamp(p.st / span, 0, 1);
        const mx = s.x + s.s * 2.2, my = s.y - p.hgtFt * s.s * 0.4; const mh = 78, mw = 14;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(mx - mw / 2 + 3, my - mh + 3, mw, mh);
        ctx.fillStyle = '#10131c'; ctx.fillRect(mx - mw / 2, my - mh, mw, mh);
        const win = p.shot.win || 0.05;
        const gz = (p.shot.apex / span) * mh; const gw = Math.max(2, (win * 2) / span * mh);
        ctx.fillStyle = 'rgba(94,227,138,0.22)'; ctx.fillRect(mx - mw / 2 + 1, my - gz - gw, mw - 2, gw * 2);
        ctx.shadowColor = '#5ee38a'; ctx.shadowBlur = 10; ctx.fillStyle = '#5ee38a'; ctx.fillRect(mx - mw / 2 + 1, my - gz - gw / 2, mw - 2, gw); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(mx - mw / 2 + 1, my - gz - gw / 2, mw - 2, gw * 0.4);
        ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(mx - mw / 2, my - mh, mw, mh);
        const ny = my - k * mh;
        ctx.beginPath(); ctx.moveTo(mx - mw / 2 - 6, ny - 4); ctx.lineTo(mx + mw / 2 + 6, ny - 4); ctx.lineTo(mx + mw / 2 + 6, ny + 2); ctx.lineTo(mx - mw / 2 - 6, ny + 2); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
    }
  };
  function star(ctx, x, y, r, c) {
    ctx.fillStyle = c; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  M.drawBallNow = function (ctx) {
    const b = this.ball; const cam = this.cam;
    const owner = b.state === 'held' ? b.holder : b.flight ? (b.flight.shooter || b.flight.passer) : null;
    const team = owner ? this.teams[owner.team] : null;
    const crown = team && team.crownActive;
    const look = owner && owner.data.look || {};
    const fire = owner && owner.fire;
    const trailStyle = crown ? 'crown' : fire ? 'fire' : look.trail && look.trail !== 'none' ? look.trail : null;
    const fast = b.state === 'shot' || b.state === 'pass' || (b.state === 'loose' && Math.hypot(b.vx, b.vy, b.vz) > 12);
    if (b.trail.length > 2 && (trailStyle || fast)) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < b.trail.length; i++) {
        const a = cam.project(b.trail[i - 1].x, b.trail[i - 1].y, b.trail[i - 1].z), c = cam.project(b.trail[i].x, b.trail[i].y, b.trail[i].z);
        const k = i / b.trail.length;
        let col;
        if (trailStyle === 'fire') col = `rgba(255,${Math.round(80 + k * 120)},0,${k * 0.8})`;
        else if (trailStyle === 'crown') col = `rgba(255,210,63,${k * 0.9})`;
        else if (trailStyle === 'rainbow') col = `hsla(${(i * 30 + this.time * 300) % 360},100%,60%,${k * 0.8})`;
        else if (trailStyle === 'comet') col = `rgba(160,220,255,${k * 0.8})`;
        else if (trailStyle === 'lightning') col = `rgba(190,240,255,${k})`;
        else col = `rgba(255,255,255,${k * 0.25})`;
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, c.s * (trailStyle ? 0.75 : 0.4) * k);
        ctx.beginPath(); ctx.moveTo(a.x + (trailStyle === 'lightning' ? (Math.random() - 0.5) * 8 : 0), a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.restore();
      if ((trailStyle === 'fire' || trailStyle === 'crown') && Math.random() < 0.6 && !this.fx.reduced) this.fx.add({ kind: 'fire', x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 1, life: 0.4, age: 0, size: 0.5, color: trailStyle === 'crown' ? '#ffd23f' : '#ff6a13', g: -2, rot: 0, vr: 0, drag: 0.5 });
    }
    const p = cam.project(b.x, b.y, b.z);
    A.drawBall(ctx, p.x, p.y, Math.max(3, p.s * 0.5), b.rot, crown ? { color: '#f5a623' } : null);
    if (crown || fire) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 1.6); g.addColorStop(0, crown ? 'rgba(255,210,63,0.6)' : 'rgba(255,106,19,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 1.6, 0, TAU); ctx.fill(); ctx.restore();
    }
  };

  // ---------- HUD ----------
  // A broadcast scorebug drawn cel style: flat color, one hard light band, ink edges, hard shadows.
  const COND = (w, px) => `italic ${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const NUM = (px) => `400 ${px}px Anton, Impact, sans-serif`;
  const INK = '#07080c', GOLD = '#ffc629', GOLD_HI = '#ffe27a', BACK = '#ff9a1f';
  const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const easeBack = (k) => { k = clamp(k, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  // A parallelogram: x,y is the top-left of the box it leans inside; sl is how far the top shifts right.
  function slab(ctx, x, y, w, h, sl) { ctx.beginPath(); ctx.moveTo(x + sl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - sl, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
  // Fill the current path flat, with a hard lighter band across the top.
  function celFill(ctx, color, y, h, band) {
    ctx.fillStyle = color; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,' + (band == null ? 0.16 : band) + ')'; ctx.fillRect(0, y, W * 2, h * 0.44);
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, y + h * 0.8, W * 2, h * 0.2); ctx.restore();
  }
  function inkText(ctx, text, x, y, fill, lw) {
    ctx.lineJoin = 'round'; ctx.lineWidth = lw || 4; ctx.strokeStyle = INK; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function crownGlyph(ctx, x, y, s, fill) {
    ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.55); ctx.lineTo(x - s * 1.1, y - s * 0.55); ctx.lineTo(x - s * 0.45, y); ctx.lineTo(x, y - s * 0.85); ctx.lineTo(x + s * 0.45, y); ctx.lineTo(x + s * 1.1, y - s * 0.55); ctx.lineTo(x + s, y + s * 0.55); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  }
  function keycap(ctx, label, x, y) {
    ctx.font = COND(800, 13); const w = Math.max(24, ctx.measureText(label).width + 12), h = 20;
    ctx.fillStyle = INK; A.roundRect(ctx, x + 1, y + 2, w, h, 3); ctx.fill();
    ctx.fillStyle = '#d4d8e2'; A.roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h * 0.5); ctx.restore();
    ctx.lineWidth = 1.2; ctx.strokeStyle = INK; A.roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    return w;
  }

  M.drawHUD = function (ctx) {
    const [t0, t1] = this.teams;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // scorebug
    const top = 12, ph = 58, cw = 108, tw = 328, cx = W / 2;
    const x0 = cx - cw / 2 - tw, x1 = cx + cw / 2 + tw;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; slab(ctx, x0 - 14 + 6, top + 6, x1 - x0 + 28, ph, 14); ctx.fill();
    ctx.fillStyle = INK; slab(ctx, x0 - 16, top - 2, x1 - x0 + 32, ph + 4, 14); ctx.fill();
    panel(ctx, x0, top, tw, ph, t0, 'left', this);
    panel(ctx, cx + cw / 2, top, tw, ph, t1, 'right', this);
    // center: first-to
    ctx.fillStyle = '#0d1019'; ctx.fillRect(cx - cw / 2, top, cw, ph);
    ctx.fillStyle = '#161a26'; ctx.fillRect(cx - cw / 2, top, cw, ph * 0.44);
    ctx.fillStyle = GOLD; ctx.fillRect(cx - cw / 2, top, cw, 4);
    ctx.textAlign = 'center';
    ctx.font = COND(800, 12); ctx.fillStyle = GOLD; ctx.fillText('FIRST TO', cx, top + 20);
    ctx.font = NUM(28); ctx.fillStyle = '#ffffff'; ctx.fillText(String(this.target), cx, top + 50);
    // shot clock, hanging under the center of the bug
    if (this.phase === 'live' || this.phase === 'check') {
      const sc = Math.max(0, this.shotClock), low = sc < 5 && this.phase === 'live';
      const txt = low ? sc.toFixed(1) : String(Math.ceil(sc));
      const sw = 64, sh = 30, sy = top + ph + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; slab(ctx, cx - sw / 2 + 4, sy + 4, sw, sh, 8); ctx.fill();
      slab(ctx, cx - sw / 2, sy, sw, sh, 8); ctx.fillStyle = low ? '#3a0d08' : '#0d1019'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = low ? '#ff6a13' : 'rgba(255,255,255,0.25)'; ctx.stroke();
      ctx.font = NUM(22); ctx.fillStyle = low ? '#ff8a4a' : '#ffffff'; ctx.fillText(txt, cx, sy + 24);
    }
    // under the bug: crown state per team
    this.teams.forEach((t, i) => {
      const left = i === 0; const bx = left ? x0 + tw - 8 : cx + cw / 2 + 8;
      let label = null, hot = false;
      const back = !this.cleared && this.offense === i && this.phase === 'live' && this.humans.some((hh) => hh.team === i);
      if (back) label = 'TAKE IT BACK · GET BEHIND THE ARC';
      else if (t.crownActive) { label = t.crownActive === 2 ? 'DOUBLE CROWN ACTIVE' : 'CROWN ACTIVE'; hot = true; }
      else {
        const h = this.humans.find((hh) => hh.team === i);
        if (h && t.crown >= 1) {
          const key = h.ctrl.lastSource === 'pad' ? 'LB' : (h.ctrl.layout === null ? 'CROWN' : BK.KEYS[h.keyLayout || 'solo'].crown.split(' ')[0]);
          label = this.offense === i ? `CROWN READY · PRESS ${key}` : 'CROWN READY · GET THE BALL';
        }
      }
      if (!label) return;
      ctx.font = COND(900, 14); const lw = ctx.measureText(label).width + 30; const ly = top + ph + 8;
      const lx = left ? bx - lw : bx;
      // a rule you must act on gets a solid plate; a reminder pulses
      const pulse = hot ? 1 : back ? 0.88 + Math.sin(this.time * 7) * 0.12 : 0.65 + Math.sin(this.time * 7) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; slab(ctx, lx + 3, ly + 3, lw, 24, 8); ctx.fill();
      slab(ctx, lx, ly, lw, 24, 8);
      if (back) celFill(ctx, BACK, ly, 24, 0.3); else if (hot) celFill(ctx, GOLD, ly, 24, 0.3); else { ctx.fillStyle = INK; ctx.fill(); }
      const solid = hot || back;
      ctx.lineWidth = 1.5; ctx.strokeStyle = solid ? INK : GOLD; ctx.stroke();
      if (back) { ctx.beginPath(); ctx.moveTo(lx + 19, ly + 7); ctx.lineTo(lx + 12, ly + 12); ctx.lineTo(lx + 19, ly + 17); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
      else crownGlyph(ctx, lx + 15, ly + 12, 5, hot ? INK : GOLD);
      ctx.textAlign = 'left'; ctx.fillStyle = solid ? INK : GOLD; ctx.fillText(label, lx + 24, ly + 17);
      ctx.globalAlpha = 1;
    });
    // lower third: the court, and the rule if it isn't the standard one
    const rule = BK.data.RULES[this.rule];
    ctx.font = COND(900, 16); const court = this.court.name.toUpperCase();
    const cwid = ctx.measureText(court).width + 34; const ly = H - 44;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; slab(ctx, 18, ly + 4, cwid, 28, 9); ctx.fill();
    slab(ctx, 14, ly, cwid, 28, 9); celFill(ctx, GOLD, ly, 28, 0.32); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.fillText(court, 30, ly + 20);
    if (this.rule !== 'standard') {
      ctx.font = COND(800, 14); const rn = rule.name.toUpperCase(); const rw = ctx.measureText(rn).width + 30;
      slab(ctx, 14 + cwid - 6, ly + 2, rw, 24, 8); ctx.fillStyle = 'rgba(7,8,12,0.9)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillText(rn, 14 + cwid + 10, ly + 19);
    }
    // style meter
    const off = this.teams[this.offense];
    if (off.pot > 0 && this.phase === 'live') {
      const hot = off.combo > 2;
      ctx.font = NUM(30); const num = off.pot.toLocaleString(); const nw = ctx.measureText(num).width;
      const mult = off.combo > 1 ? `×${off.combo}` : '';
      ctx.font = NUM(22); const mw = mult ? ctx.measureText(mult).width + 22 : 0;
      const bw = 92 + nw + mw, bh = 44, bx = cx - bw / 2, by = H - 62;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; slab(ctx, bx + 5, by + 5, bw, bh, 12); ctx.fill();
      slab(ctx, bx, by, bw, bh, 12); celFill(ctx, '#10131c', by, bh, 0.07); ctx.lineWidth = 2; ctx.strokeStyle = hot ? GOLD : 'rgba(255,255,255,0.3)'; ctx.stroke();
      ctx.font = COND(900, 15); ctx.textAlign = 'left'; ctx.fillStyle = GOLD; ctx.fillText('STYLE', bx + 22, by + 28);
      ctx.font = NUM(30); ctx.fillStyle = hot ? GOLD_HI : '#ffffff'; ctx.fillText(num, bx + 76, by + 35);
      if (mult) {
        const mx = bx + 76 + nw + 10;
        slab(ctx, mx, by + 8, mw, bh - 16, 6); celFill(ctx, hot ? GOLD : '#ffffff', by + 8, bh - 16, 0.3);
        ctx.font = NUM(20); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(mult, mx + mw / 2, by + 30);
      }
    }
    // intro: the matchup splash
    if (this.phase === 'intro') this.drawIntro(ctx, rule);
    if (this.drawCoach) this.drawCoach(ctx);
    // first-game control hint
    if (this.hint > 0 && this.humans.length === 1 && !(BK.input && BK.input.touchVisible())) {
      const h = this.humans[0]; const K = BK.KEYS[h.keyLayout || 'solo'];
      const pad = h.ctrl.lastSource === 'pad'; const P = BK.KEYS.pad;
      const keys = (s) => s.replace(/\s*\([^)]*\)/g, '').split(/ or | \/ /).map((k) => k.toUpperCase());
      const rows = pad ? [['MOVE', P.move], ['SHOOT · BLOCK', P.shoot], ['PASS · SWITCH', P.pass], ['TRICK · STEAL', P.trick], ['ALLEY-OOP', P.oop], ['TURBO', P.turbo]]
        : [['MOVE', K.move], ['SHOOT · BLOCK', K.shoot], ['PASS · SWITCH', K.pass], ['TRICK · STEAL', K.trick], ['ALLEY-OOP', K.oop], ['TURBO', K.turbo]];
      const pw = 290, phh = 36 + rows.length * 26, px = W - pw - 16, py = H - phh - 16;
      ctx.globalAlpha = clamp(this.hint, 0, 1) * 0.95;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 5, py + 5, pw, phh);
      ctx.fillStyle = 'rgba(10,12,18,0.92)'; ctx.fillRect(px, py, pw, phh);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(px, py, pw, 28);
      ctx.fillStyle = GOLD; ctx.fillRect(px, py, 52, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, phh - 1);
      ctx.font = COND(900, 14); ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.fillText('CONTROLS', px + 14, py + 20);
      rows.forEach(([label, k], i) => {
        const ry = py + 36 + i * 26;
        ctx.font = COND(800, 14); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c9cdd8'; ctx.fillText(label, px + 14, ry + 10);
        let kx = px + 130;
        keys(k).forEach((kk, j) => { if (j) { ctx.font = COND(700, 12); ctx.textAlign = 'left'; ctx.fillStyle = '#747b8f'; ctx.fillText('/', kx + 2, ry + 10); kx += 12; } kx += keycap(ctx, kk, kx, ry) + 4; });
        ctx.textBaseline = 'alphabetic';
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  // The coach's tip of the moment: a plate under the scorebug, words and keycaps in a row.
  M.drawCoach = function (ctx) {
    const c = this.coach && this.coach.cur; if (!c) return;
    const a = clamp(Math.min(c.t / 0.25, (c.life - c.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.textBaseline = 'middle';
    const font = COND(800, 17), tagFont = COND(900, 13);
    ctx.font = font;
    const gap = 7, items = c.parts.map((w) => {
      if (typeof w === 'string') { ctx.font = font; return { w: ctx.measureText(w).width, text: w }; }
      ctx.font = COND(800, 13); return { w: Math.max(24, ctx.measureText(w.key).width + 12), key: w.key };
    });
    ctx.font = tagFont; const tagW = ctx.measureText('COACH').width + 22;
    const inner = items.reduce((s, it) => s + it.w, 0) + gap * (items.length - 1);
    const pw = Math.min(W - 40, tagW + inner + 30), phh = 36, px = W / 2 - pw / 2, py = 108 + (1 - a) * -8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; slab(ctx, px + 4, py + 4, pw, phh, 10); ctx.fill();
    slab(ctx, px, py, pw, phh, 10); celFill(ctx, '#10131c', py, phh, 0.06);
    ctx.lineWidth = 1.5; ctx.strokeStyle = GOLD; ctx.stroke();
    slab(ctx, px, py, tagW + 8, phh, 10); celFill(ctx, GOLD, py, phh, 0.3);
    ctx.font = tagFont; ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.fillText('COACH', px + 14, py + phh / 2 + 1);
    let x = px + tagW + 20;
    items.forEach((it) => {
      if (it.key) { keycap(ctx, it.key, x, py + phh / 2 - 10); ctx.textBaseline = 'middle'; }
      else { ctx.font = font; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.fillText(it.text, x, py + phh / 2 + 1); }
      x += it.w + gap;
    });
    ctx.restore();
  };

  // Two crew slabs slam in from the sides, a VS plate pops between them, the court reads underneath.
  M.drawIntro = function (ctx, rule) {
    const t = this.phaseT, total = 2.4;
    const kin = easeBack(t / 0.42), kout = clamp((total - t) / 0.3, 0, 1);
    const cy = H * 0.44, sh = 96;
    ctx.save(); ctx.globalAlpha = kout;
    ctx.fillStyle = 'rgba(5,6,9,0.72)'; ctx.fillRect(0, cy - sh / 2 - 34, W, sh + 128);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = -10; i < 50; i++) { slab(ctx, i * 34, cy - sh / 2 - 34, 10, sh + 128, 26); ctx.fill(); }
    [0, 1].forEach((i) => {
      const tm = this.teams[i]; const left = i === 0; const pri = tm.colors.pri, sec = tm.colors.sec;
      const sw = W / 2 - 60; const slide = (1 - kin) * (W * 0.6) * (left ? -1 : 1);
      const sx = (left ? 0 : W / 2 + 60) + slide;
      ctx.fillStyle = INK; slab(ctx, sx + 8, cy - sh / 2 + 8, sw, sh, 28); ctx.fill();
      slab(ctx, sx, cy - sh / 2, sw, sh, 28); celFill(ctx, pri, cy - sh / 2, sh, 0.18);
      ctx.save(); ctx.clip(); ctx.fillStyle = sec === pri ? A.shade(pri, 0.4) : sec; ctx.fillRect(sx - 40, cy + sh / 2 - 8, sw + 80, 8); ctx.restore();
      slab(ctx, sx, cy - sh / 2, sw, sh, 28); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      const lx = left ? sx + sw - 80 : sx + 80;
      A.drawLogo(ctx, tm.logo, lx, cy - 2, 36, sec === pri ? '#ffffff' : sec, A.shade(pri, -0.45));
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(lx, cy - 2, 36, 0, TAU); ctx.stroke();
      const name = tm.name.toUpperCase(); const room = sw - 170;
      let fs = 56; ctx.font = COND(900, fs);
      while (fs > 24 && ctx.measureText(name).width > room) { fs -= 2; ctx.font = COND(900, fs); }
      ctx.textAlign = left ? 'right' : 'left'; ctx.textBaseline = 'middle';
      const ink = A.luminance(pri) > 0.6 ? INK : '#ffffff';
      const nx = left ? lx - 54 : lx + 54;
      if (ink === '#ffffff') { ctx.fillStyle = INK; ctx.fillText(name, nx + 3, cy + 1); }
      ctx.fillStyle = ink; ctx.fillText(name, nx, cy - 2);
    });
    // VS plate
    const vk = easeBack((t - 0.3) / 0.3);
    if (vk > 0) {
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(vk, vk); ctx.rotate(-0.06);
      ctx.fillStyle = INK; slab(ctx, -48 + 6, -38 + 6, 96, 76, 16); ctx.fill();
      slab(ctx, -48, -38, 96, 76, 16); celFill(ctx, GOLD, -38, 76, 0.35); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.font = NUM(50); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText('VS', 0, 3);
      ctx.restore();
    }
    // the court underneath
    const lk = ease((t - 0.45) / 0.35);
    if (lk > 0) {
      ctx.globalAlpha = kout * lk; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = COND(900, 26); ctx.fillStyle = GOLD;
      ctx.fillText(`${this.court.name.toUpperCase()}   /   FIRST TO ${this.target}   /   ${rule.name.toUpperCase()}`, W / 2, cy + sh / 2 + 46 - (1 - lk) * 10);
      ctx.font = COND(700, 18); ctx.fillStyle = '#d4d8e2';
      ctx.fillText(rule.blurb.toUpperCase(), W / 2, cy + sh / 2 + 74 - (1 - lk) * 10);
    }
    ctx.restore();
  };

  function panel(ctx, x, y, w, h, t, side, m) {
    const pri = t.colors.pri, sec = t.colors.sec;
    const left = side === 'left';
    const sbw = 82; // score box
    const nx = left ? x : x + sbw, nw = w - sbw; // name panel
    ctx.save();
    // name panel in the crew color, slanted on its outer edge
    ctx.beginPath();
    if (left) { ctx.moveTo(nx + 14, y); ctx.lineTo(nx + nw, y); ctx.lineTo(nx + nw, y + h); ctx.lineTo(nx, y + h); }
    else { ctx.moveTo(nx, y); ctx.lineTo(nx + nw - 14, y); ctx.lineTo(nx + nw, y + h); ctx.lineTo(nx, y + h); }
    ctx.closePath(); celFill(ctx, pri, y, h, 0.2);
    ctx.save(); ctx.clip(); ctx.fillStyle = sec === pri ? A.shade(pri, 0.4) : sec; ctx.fillRect(nx - 20, y + h - 5, nw + 40, 5); ctx.restore();
    // score box
    const sx = left ? x + w - sbw : x;
    ctx.fillStyle = '#10131c'; ctx.fillRect(sx, y, sbw, h);
    ctx.fillStyle = '#1a1e2b'; ctx.fillRect(sx, y, sbw, h * 0.44);
    ctx.fillStyle = INK; ctx.fillRect(left ? sx : sx + sbw - 2, y, 2, h);
    // possession: a ball tucked into the score box of the crew with it
    if (m.offense === t.i && (m.phase === 'live' || m.phase === 'check')) {
      ctx.fillStyle = GOLD; ctx.fillRect(sx, y + h - 4, sbw, 4);
      A.drawBall(ctx, left ? sx + sbw - 11 : sx + 11, y + 11, 6.5, 0.4);
    }
    const light = A.luminance(pri) > 0.6;
    const logoX = left ? nx + 38 : nx + nw - 38;
    A.drawLogo(ctx, t.logo, logoX, y + h / 2 - 2, 19, sec === pri ? '#ffffff' : sec, A.shade(pri, -0.45));
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(logoX, y + h / 2 - 2, 19, 0, TAU); ctx.stroke();
    ctx.textAlign = left ? 'left' : 'right';
    const nameX = left ? nx + 66 : nx + nw - 66;
    const name = t.name.toUpperCase(); const room = nw - 66 - 14;
    let fs = 24; ctx.font = COND(900, fs);
    while (fs > 12 && ctx.measureText(name).width > room) { fs -= 1; ctx.font = COND(900, fs); }
    if (!light) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(name, nameX + 2, y + 27); }
    ctx.fillStyle = light ? INK : '#ffffff'; ctx.fillText(name, nameX, y + 25);
    // crown meter: two slanted cells and a crown at the end
    const mw = Math.min(150, room - 22), my = y + 34, ch = 10;
    const mx = left ? nameX : nameX - mw - 22;
    for (let i = 0; i < 2; i++) {
      const cx2 = mx + i * (mw / 2 + 3); const fill = clamp(t.crown - i, 0, 1); const cw2 = mw / 2 - 3;
      slab(ctx, cx2, my, cw2, ch, 4); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
      if (fill > 0) {
        const ready = fill >= 1;
        ctx.save(); slab(ctx, cx2, my, cw2, ch, 4); ctx.clip();
        ctx.fillStyle = ready ? GOLD : '#d9a100'; ctx.fillRect(cx2, my, cw2 * fill, ch);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(cx2, my, cw2 * fill, ch * 0.42);
        ctx.restore();
        if (ready) { const pulse = 0.5 + Math.sin(m.time * 9 + i) * 0.5; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + pulse * 0.35; ctx.shadowColor = GOLD; ctx.shadowBlur = 12; slab(ctx, cx2, my, cw2, ch, 4); ctx.fillStyle = GOLD; ctx.fill(); ctx.restore(); }
      }
      slab(ctx, cx2, my, cw2, ch, 4); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    }
    crownGlyph(ctx, left ? mx + mw + 14 : mx + mw + 12, my + 5, 6, t.crown >= 1 ? GOLD : 'rgba(0,0,0,0.45)');
    // score, with a pop when it changes
    const scx = sx + sbw / 2;
    if (t._shown !== t.score) { t._shown = t.score; t._popT = m.time; }
    const age = m.time - (t._popT || -9); const pop = age < 0.45 ? 1 + Math.sin(age / 0.45 * Math.PI) * 0.4 : 1;
    ctx.save(); ctx.translate(scx, y + h / 2 + 2); ctx.scale(pop, pop);
    ctx.font = NUM(42); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (age < 0.6) { ctx.shadowColor = pri; ctx.shadowBlur = 24 * (1 - age / 0.6); }
    ctx.fillStyle = INK; ctx.fillText(String(t.score), 2, 3);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.fillText(String(t.score), 0, 0);
    ctx.restore();
    ctx.restore();
  }
})(window.BK = window.BK || {});
