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
    const wt = this.fx.worldTransform();
    ctx.save();
    ctx.translate(wt.ox, wt.oy); ctx.scale(wt.z, wt.z);
    ctx.drawImage(this.bg, 0, 0, W, H);
    A.drawCrowd(ctx, cam, this.crowd, this.time, this.excite, this.court);
    this.fx.drawGround(ctx);
    this.drawShadows(ctx);
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
    this.fx.drawAir(ctx);
    A.drawGlows(ctx, cam, this.court, this.time);
    ctx.restore();
    this.fx.drawScreen(ctx, this.time);
    if (!this.attract) this.drawHUD(ctx);
    this.fx.drawCalls(ctx);
  };

  M.drawShadows = function (ctx) {
    const cam = this.cam; const night = this.court.time === 'night' || this.court.time === 'indoor';
    ctx.save(); ctx.fillStyle = night ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.28)';
    for (const p of this.players) {
      const g = cam.project(p.x, p.y, 0); const k = 1 / (1 + p.z * 0.12);
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.s * 1.25 * k * (p.state === 'fallen' ? 1.8 : 1), g.s * 0.42 * k, 0, 0, TAU); ctx.fill();
    }
    const b = this.ball; const g = cam.project(b.x, b.y, 0); const k = 1 / (1 + b.z * 0.1);
    ctx.beginPath(); ctx.ellipse(g.x, g.y, g.s * 0.5 * k, g.s * 0.18 * k, 0, 0, TAU); ctx.fill();
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
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(s.x, s.y - p.hgtFt * s.s * 0.5, 0, s.x, s.y - p.hgtFt * s.s * 0.5, p.hgtFt * s.s * 0.8);
      gg.addColorStop(0, p.fire ? 'rgba(255,106,19,0.35)' : 'rgba(255,210,63,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(s.x, s.y - p.hgtFt * s.s * 0.5, p.hgtFt * s.s * 0.8, 0, TAU); ctx.fill(); ctx.restore();
    }
    A.drawBaller(ctx, {
      x: s.x, y: s.y, scale: s.s, hgt: p.data.hgt, build: p.data.build, look: p.data.look, num: p.data.num,
      colors: team.colors, facing: p.facing, spin: p.spin, pose: p.pose, dims: p.dims, time: this.time + p.slot,
      glow: glow && !this.fx.reduced ? glow : null,
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
      const top = cam.project(p.x, p.y, p.z + p.hgtFt + 1.3);
      const label = p.human.label;
      ctx.save(); ctx.font = '400 16px Anton, Impact, sans-serif'; ctx.textAlign = 'center';
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = team.colors.pri; A.roundRect(ctx, top.x - w / 2, top.y - 20, w, 20, 4); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(top.x - 6, top.y); ctx.lineTo(top.x + 6, top.y); ctx.lineTo(top.x, top.y + 7); ctx.closePath(); ctx.fillStyle = team.colors.pri; ctx.fill(); ctx.stroke();
      ctx.fillStyle = A.luminance(team.colors.pri) > 0.6 ? '#111' : '#fff'; ctx.fillText(label, top.x, top.y - 4);
      ctx.restore();
      // turbo meter under the feet
      const g = cam.project(p.x, p.y, 0);
      ctx.save(); const bw = 46;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(g.x - bw / 2, g.y + g.s * 0.6, bw, 6);
      ctx.fillStyle = p.turbo > 0.25 ? (p.turboOn ? '#ffb300' : '#2ec5ff') : '#e8352b'; ctx.fillRect(g.x - bw / 2 + 1, g.y + g.s * 0.6 + 1, (bw - 2) * p.turbo, 4);
      ctx.restore();
      // shot timing meter
      if (p.state === 'shoot' && p.shot && p.shot.human && !p.shot.released) {
        const span = p.shot.apex + 0.24; const k = clamp(p.st / span, 0, 1);
        const mx = s.x + s.s * 2.2, my = s.y - p.hgtFt * s.s * 0.4; const mh = 70;
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(mx - 6, my - mh, 12, mh);
        const gz = (p.shot.apex / span) * mh; const gw = 0.11 / span * mh;
        ctx.fillStyle = '#3fd13f'; ctx.fillRect(mx - 5, my - gz - gw / 2, 10, gw);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 8, my - k * mh - 2, 16, 4);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(mx - 6, my - mh, 12, mh); ctx.restore();
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
  M.drawHUD = function (ctx) {
    const [t0, t1] = this.teams;
    ctx.save();
    // scoreboard
    const cx = W / 2, top = 14, pw = 300, ph = 58;
    panel(ctx, cx - pw - 70, top, pw, ph, t0, 'left', this);
    panel(ctx, cx + 70, top, pw, ph, t1, 'right', this);
    ctx.fillStyle = '#111'; A.roundRect(ctx, cx - 66, top + 4, 132, 50, 8); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = '400 13px Anton, Impact, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('FIRST TO', cx, top + 22);
    ctx.font = '400 26px Anton, Impact, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(this.target), cx, top + 49);
    // rule + court chip
    const rule = BK.data.RULES[this.rule];
    ctx.font = '400 13px Anton, Impact, sans-serif'; ctx.textAlign = 'left';
    const chip = (this.court.name + (this.rule !== 'standard' ? '  ·  ' + rule.name : '')).toUpperCase();
    const cwid = ctx.measureText(chip).width + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; A.roundRect(ctx, 14, H - 34, cwid, 22, 5); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText(chip, 24, H - 18);
    // style pot
    const off = this.teams[this.offense];
    if (off.pot > 0 && (this.phase === 'live')) {
      ctx.textAlign = 'center'; ctx.font = '400 30px Bangers, Impact, sans-serif';
      const txt = `STYLE ${off.pot.toLocaleString()}` + (off.combo > 1 ? `  ×${off.combo}` : '');
      ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.strokeText(txt, cx, H - 26);
      ctx.fillStyle = off.combo > 2 ? '#ffd23f' : '#ffffff'; ctx.fillText(txt, cx, H - 26);
    }
    // crown hint for humans
    this.humans.forEach((h) => {
      const t = this.teams[h.team];
      if (t.crown >= 1 && !t.crownActive) {
        const x = h.team === 0 ? cx - 70 - pw / 2 : cx + 70 + pw / 2;
        const key = h.ctrl.lastSource === 'pad' ? 'LB' : (h.ctrl.layout === null ? 'CROWN' : BK.KEYS[h.keyLayout || 'solo'].crown.split(' ')[0]);
        ctx.textAlign = 'center'; ctx.font = '400 15px Anton, Impact, sans-serif';
        const pulse = 0.6 + Math.sin(this.time * 7) * 0.4;
        ctx.globalAlpha = pulse; ctx.fillStyle = '#ffd23f';
        ctx.fillText(this.offense === h.team ? `CROWN READY · PRESS ${key}` : 'CROWN READY · GET THE BALL', x, top + ph + 34);
        ctx.globalAlpha = 1;
      }
    });
    // intro card
    if (this.phase === 'intro') {
      const k = clamp(this.phaseT / 0.3, 0, 1);
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, H * 0.3, W, H * 0.36);
      ctx.textAlign = 'center';
      ctx.font = '400 64px Bangers, Impact, sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#111';
      const vs = `${t0.name.toUpperCase()}  VS  ${t1.name.toUpperCase()}`;
      ctx.strokeText(vs, W / 2, H * 0.44); ctx.fillStyle = '#ffffff'; ctx.fillText(vs, W / 2, H * 0.44);
      ctx.font = '400 22px Anton, Impact, sans-serif'; ctx.fillStyle = '#ffd23f';
      ctx.fillText(`${this.court.name.toUpperCase()}  ·  FIRST TO ${this.target}  ·  ${rule.name.toUpperCase()}`, W / 2, H * 0.52);
      ctx.font = '400 18px Anton, Impact, sans-serif'; ctx.fillStyle = '#ffffff';
      ctx.fillText(rule.blurb.toUpperCase(), W / 2, H * 0.58);
      ctx.globalAlpha = 1;
    }
    // first-game control hint
    if (this.hint > 0 && this.humans.length === 1 && !(BK.input && BK.input.touchVisible())) {
      const h = this.humans[0]; const K = BK.KEYS[h.keyLayout || 'solo'];
      const pad = h.ctrl.lastSource === 'pad'; const P = BK.KEYS.pad;
      const lines = pad ? [`MOVE ${P.move}`, `SHOOT ${P.shoot}`, `PASS ${P.pass}`, `TRICK ${P.trick}`, `ALLEY-OOP ${P.oop}`, `TURBO ${P.turbo}`]
        : [`MOVE ${K.move}`, `SHOOT / BLOCK  ${K.shoot}`, `PASS / SWITCH  ${K.pass}`, `TRICK / STEAL  ${K.trick}`, `ALLEY-OOP  ${K.oop}`, `TURBO  ${K.turbo}`];
      ctx.globalAlpha = clamp(this.hint, 0, 1) * 0.92;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; A.roundRect(ctx, W - 250, H - 170, 236, 156, 8); ctx.fill();
      ctx.font = '400 14px Anton, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
      lines.forEach((l, i) => ctx.fillText(l.toUpperCase(), W - 236, H - 146 + i * 22));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  function panel(ctx, x, y, w, h, t, side, m) {
    const pri = t.colors.pri, sec = t.colors.sec;
    ctx.save();
    ctx.fillStyle = '#111'; A.roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 10); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, A.shade(pri, 0.15)); g.addColorStop(1, A.shade(pri, -0.25));
    ctx.fillStyle = g; A.roundRect(ctx, x, y, w, h, 8); ctx.fill();
    const light = A.luminance(pri) > 0.6;
    const logoX = side === 'left' ? x + 30 : x + w - 30;
    A.drawLogo(ctx, t.logo, logoX, y + h / 2, 20, sec === pri ? '#ffffff' : sec, A.shade(pri, -0.45));
    ctx.textAlign = side === 'left' ? 'left' : 'right';
    ctx.fillStyle = light ? '#111' : '#fff';
    const nameX = side === 'left' ? x + 58 : x + w - 58;
    const name = t.name.toUpperCase(); const room = w - 58 - 72;
    let fs = 20; ctx.font = `400 ${fs}px Anton, Impact, sans-serif`;
    while (fs > 11 && ctx.measureText(name).width > room) { fs -= 1; ctx.font = `400 ${fs}px Anton, Impact, sans-serif`; }
    ctx.fillText(name, nameX, y + 25);
    // crown meter
    const mw = 150, mx = side === 'left' ? nameX : nameX - mw, my = y + 36;
    for (let i = 0; i < 2; i++) {
      const sx = mx + i * (mw / 2 + 2); const fill = clamp(t.crown - i, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx, my, mw / 2 - 2, 10);
      const ready = fill >= 1;
      ctx.fillStyle = ready ? `hsl(${45 + Math.sin(m.time * 8) * 6},100%,${58 + Math.sin(m.time * 8) * 10}%)` : '#ffd23f';
      ctx.fillRect(sx + 1, my + 1, (mw / 2 - 4) * fill, 8);
    }
    if (t.crownActive) {
      ctx.font = '400 12px Anton, Impact, sans-serif'; ctx.fillStyle = '#ffd23f';
      ctx.fillText(t.crownActive === 2 ? 'DOUBLE CROWN ACTIVE' : 'CROWN ACTIVE', side === 'left' ? mx : mx + mw, my + 22);
    }
    // score
    ctx.font = '400 44px Anton, Impact, sans-serif'; ctx.textAlign = 'center';
    const sx = side === 'left' ? x + w - 34 : x + 34;
    ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.strokeText(String(t.score), sx, y + 47);
    ctx.fillStyle = '#ffffff'; ctx.fillText(String(t.score), sx, y + 47);
    ctx.restore();
  }
})(window.BK = window.BK || {});
