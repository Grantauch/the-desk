/* Blacktop Kings — special effects. Particles live in the world (feet) and are projected by the
   game camera. Screen effects (shake, flash, slow motion, zoom, letterbox, speed lines) and the big
   comic callouts live in screen space. BK.FX(cam) makes one effects layer per game. */
(function (BK) {
  'use strict';
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function rgbDist(a, b) {
    const pa = parseInt(String(a).slice(1), 16), pb = parseInt(String(b).slice(1), 16);
    if (!Number.isFinite(pa) || !Number.isFinite(pb)) return 999;
    return Math.hypot(((pa >> 16) & 255) - ((pb >> 16) & 255), ((pa >> 8) & 255) - ((pb >> 8) & 255), (pa & 255) - (pb & 255));
  }

  function FX(cam) {
    this.cam = cam;
    this.parts = [];
    this.rings = [];
    this.decals = [];
    this.calls = [];
    this.floats = [];
    this.bolts = [];
    this.shakeAmp = 0; this.shakeT = 0;
    this.flashCol = null; this.flashT = 0; this.flashDur = 0;
    this.slowScale = 1; this.slowT = 0;
    this.stopT = 0;
    this.zoomAmt = 0; this.zoomTarget = 0; this.zoomFocus = { x: cam.W / 2, y: cam.H / 2 }; this.zoomT = 0;
    this.boxT = 0; this.box = 0;
    this.linesT = 0; this.linesCol = '#fff';
    this.tint = null; this.tintT = 0;
    this.reduced = false;
  }
  const P = FX.prototype;

  // ---------- spawning ----------
  P.add = function (o) { if (this.parts.length < 900) this.parts.push(o); };
  P.burst = function (x, y, z, n, opts) {
    opts = opts || {};
    if (this.reduced) n = Math.ceil(n * 0.35);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), up = rand(opts.upMin == null ? 0.2 : opts.upMin, opts.upMax == null ? 1 : opts.upMax);
      const sp = rand(opts.speed ? opts.speed * 0.4 : 4, opts.speed || 14);
      this.add({
        kind: opts.kind || 'spark', x, y, z, vx: Math.cos(a) * sp * (1 - up * 0.5), vy: Math.sin(a) * sp * (1 - up * 0.5), vz: up * sp,
        life: rand(opts.lifeMin || 0.4, opts.life || 0.9), age: 0, size: rand(opts.sizeMin || 0.12, opts.size || 0.3),
        color: Array.isArray(opts.color) ? pick(opts.color) : (opts.color || '#ffd23f'), g: opts.g == null ? 18 : opts.g, rot: rand(0, TAU), vr: rand(-12, 12), drag: opts.drag || 0.4,
      });
    }
  };
  P.ring = function (x, y, z, opts) {
    opts = opts || {};
    this.rings.push({ x, y, z, r: opts.r0 || 0.5, vr: opts.speed || 22, life: opts.life || 0.55, age: 0, color: opts.color || '#ffffff', width: opts.width || 0.5, vertical: !!opts.vertical });
  };
  P.decal = function (x, y, kind, color) { this.decals.push({ x, y, kind, color, age: 0, life: 9 }); };
  P.call = function (text, opts) {
    if (this.quiet) return;
    opts = opts || {};
    const W = this.cam.W, H = this.cam.H;
    const color = opts.color || '#ffd23f';
    let color2 = opts.color2 || '#e8352b';
    // the burst and outline must stand apart from the letters
    if (rgbDist(color, color2) < 140) color2 = rgbDist(color, '#e8352b') > 160 ? '#e8352b' : '#1f6feb';
    this.calls.push({ text, x: opts.x == null ? W / 2 : opts.x, y: opts.y == null ? H * 0.36 : opts.y, size: opts.size || 72, color, color2, life: opts.life || 1.5, age: 0, rot: opts.rot == null ? rand(-0.12, 0.12) : opts.rot, style: opts.style || 'pop', sub: opts.sub || null });
    if (this.calls.length > 4) this.calls.shift();
  };
  P.float = function (text, x, y, z, color) { if (this.quiet) return; this.floats.push({ text, x, y, z, color: color || '#ffffff', age: 0, life: 1.3 }); };
  P.bolt = function (x0, y0, x1, y1, color) {
    const pts = [[x0, y0]]; const n = 9;
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([x0 + (x1 - x0) * k + rand(-26, 26), y0 + (y1 - y0) * k + rand(-8, 8)]); }
    pts.push([x1, y1]);
    this.bolts.push({ pts, color: color || '#bfe8ff', age: 0, life: 0.35 });
  };

  // ---------- screen effects ----------
  P.shake = function (amp, dur) { if (this.reduced) amp *= 0.25; this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, dur || 0.4); };
  P.flash = function (color, dur) { if (this.reduced) return; this.flashCol = color || '#ffffff'; this.flashT = dur || 0.25; this.flashDur = this.flashT; };
  P.slowmo = function (scale, dur) { if (this.reduced) return; this.slowScale = scale; this.slowT = dur; };
  P.hitstop = function (dur) { if (this.reduced) return; this.stopT = Math.max(this.stopT, dur); };
  P.zoom = function (sx, sy, amt, dur) { if (this.reduced) return; this.zoomFocus = { x: sx, y: sy }; this.zoomTarget = amt; this.zoomT = dur; };
  P.letterbox = function (dur) { if (this.reduced) return; this.boxT = dur; };
  P.lines = function (dur, color) { if (this.reduced) return; this.linesT = dur; this.linesCol = color || '#ffffff'; };
  P.tintScreen = function (color, dur) { this.tint = color; this.tintT = dur; };
  // How fast game time should run right now.
  P.timeScale = function () { if (this.stopT > 0) return 0; return this.slowT > 0 ? this.slowScale : 1; };

  // ---------- presets for big moments ----------
  P.preset = function (name, x, y, z, o) {
    o = o || {};
    const cam = this.cam; const s = cam.project(x, y, z);
    if (!this.reduced && !this.quiet && ['dunk', 'block'].includes(name) && BK.assets && BK.assets.get('impact')) {
      this.add({ kind: 'impactArt', x, y, z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0,
        age: 0, life: 0.32, size: 4.5, rot: 0, vr: 0, color: '#ffc629' });
    }
    switch (name) {
      case 'green':
        this.ring(x, y, z, { color: '#5ee38a', speed: 5, life: 0.3, width: 0.18, vertical: true });
        break;
      case 'swish':
        this.ring(x, y, z, { color: '#ffffff', speed: 8, life: 0.4, width: 0.2, vertical: true });
        this.burst(x, y, z - 1, 14, { color: ['#ffffff', '#bfe8ff'], speed: 6, size: 0.12, life: 0.6, g: 10 });
        break;
      case 'deep':
        this.ring(x, y, z, { color: o.color || '#2ec5ff', speed: 12, life: 0.5, width: 0.3, vertical: true });
        this.burst(x, y, z, 40, { color: [o.color || '#2ec5ff', '#ffffff', '#ffd23f'], speed: 16, life: 1.1, kind: 'confetti', size: 0.28, g: 12 });
        this.shake(5, 0.25);
        break;
      case 'dunk':
        this.ring(x, y, 0, { color: o.color || '#ffd23f', speed: 30, life: 0.6, width: 0.7 });
        this.ring(x, y, 0, { color: '#ffffff', speed: 18, life: 0.45, width: 0.35 });
        this.burst(x, y, z, 50, { color: [o.color || '#ffd23f', '#ff6a13', '#ffffff'], speed: 20, life: 0.9, size: 0.3 });
        this.burst(x, y, 0.2, 18, { kind: 'dust', color: ['#c9c2b5', '#a39b8e'], speed: 9, upMax: 0.4, life: 1.1, size: 0.7, g: 2 });
        this.shake(8, 0.24); this.hitstop(0.035); this.flash('#ffffff', 0.07);
        this.zoom(s.x, s.y, 0.075, 0.28);
        break;
      case 'bigdunk':
        this.preset('dunk', x, y, z, o);
        this.ring(x, y, 0, { color: '#ff3ea5', speed: 45, life: 0.8, width: 1.0 });
        this.burst(x, y, z, 60, { kind: 'fire', color: ['#ffb300', '#ff6a13', '#e8352b'], speed: 14, life: 1.0, size: 0.6, g: -6 });
        this.hitstop(0.055); this.slowmo(0.72, 0.22); this.lines(0.3, o.color || '#ffd23f'); this.shake(12, 0.28);
        this.zoom(s.x, s.y, 0.11, 0.34);
        break;
      case 'block':
        this.ring(x, y, z, { color: '#2ec5ff', speed: 26, life: 0.5, width: 0.6, vertical: true });
        this.burst(x, y, z, 45, { color: ['#2ec5ff', '#ffffff', '#7b2ff7'], speed: 22, life: 0.8, size: 0.3 });
        this.burst(x, y, z, 8, { kind: 'star', color: '#ffffff', speed: 10, life: 0.9, size: 0.5, g: 6 });
        this.shake(9, 0.22); this.hitstop(0.05); this.flash('#bfe8ff', 0.07); this.slowmo(0.75, 0.2);
        this.zoom(s.x, s.y, 0.085, 0.3);
        break;
      case 'steal':
        this.burst(x, y, z, 22, { color: ['#3fd13f', '#ffffff', '#ffe14d'], speed: 12, life: 0.6, size: 0.22 });
        this.ring(x, y, z, { color: '#3fd13f', speed: 14, life: 0.35, width: 0.3, vertical: true });
        this.shake(5, 0.2);
        break;
      case 'ankles':
        this.burst(x, y, 0.3, 26, { kind: 'dust', color: ['#d8d0c0', '#b8b0a0'], speed: 8, upMax: 0.5, life: 1.2, size: 0.9, g: 1 });
        this.burst(x, y, 5, 10, { kind: 'star', color: ['#ffe14d', '#ffffff'], speed: 6, life: 1.4, size: 0.45, g: 2 });
        this.ring(x, y, 0, { color: '#ffe14d', speed: 20, life: 0.5, width: 0.4 });
        this.shake(6, 0.2); this.hitstop(0.04); this.slowmo(0.8, 0.2); this.zoom(s.x, s.y, 0.065, 0.3);
        break;
      case 'crownReady':
        this.burst(x, y, z, 30, { color: ['#ffd23f', '#fff1a8'], speed: 10, life: 1.0, size: 0.25, g: -4 });
        break;
      case 'crownOn': {
        this.hitstop(0.045); this.flash(o.color || '#ffd23f', 0.16); this.slowmo(0.7, 0.28); this.letterbox(0.65); this.shake(7, 0.28);
        this.zoom(s.x, s.y, 0.08, 0.3);
        const top = cam.project(x, y, 30), bot = cam.project(x, y, 6);
        for (let i = 0; i < 3; i++) this.bolt(top.x + rand(-80, 80), 0, bot.x + rand(-10, 10), bot.y, i ? '#fff1a8' : '#bfe8ff');
        this.burst(x, y, 4, 70, { color: ['#ffd23f', '#ffffff', o.color || '#ffd23f'], speed: 18, life: 1.2, size: 0.3, g: -2 });
        this.ring(x, y, 0, { color: '#ffd23f', speed: 35, life: 0.8, width: 0.8 });
        break;
      }
      case 'crownMade':
        this.flash('#ffd23f', 0.4); this.slowmo(0.2, 1.1); this.shake(24, 0.8); this.letterbox(1.6); this.lines(1.2, '#ffd23f');
        this.burst(x, y, z, 120, { kind: 'confetti', color: ['#ffd23f', '#ffffff', '#ff3ea5', '#2ec5ff', '#3fd13f'], speed: 24, life: 2.2, size: 0.35, g: 8 });
        this.burst(x, y, z, 50, { kind: 'fire', color: ['#ffd23f', '#ffb300', '#ff6a13'], speed: 16, life: 1.2, size: 0.7, g: -8 });
        this.ring(x, y, 0, { color: '#ffd23f', speed: 50, life: 1.0, width: 1.2 });
        this.ring(x, y, z, { color: '#ffffff', speed: 30, life: 0.7, width: 0.6, vertical: true });
        this.decal(x, y, 'crack', '#ffd23f');
        this.zoom(s.x, s.y, 0.22, 1.2);
        break;
      case 'shatter':
        this.burst(x, y, z + 1.5, 110, { kind: 'glass', color: ['#e6f6ff', '#bfe8ff', '#ffffff'], speed: 16, life: 2.0, size: 0.45, g: 26, upMin: -0.2 });
        this.burst(x, y, z + 1.5, 40, { color: ['#ffffff', '#bfe8ff'], speed: 26, life: 0.7, size: 0.18 });
        this.flash('#ffffff', 0.3); this.shake(26, 0.8);
        break;
      case 'fire':
        this.burst(x, y, z, 30, { kind: 'fire', color: ['#ffb300', '#ff6a13', '#e8352b'], speed: 8, life: 0.9, size: 0.6, g: -10 });
        break;
      case 'fireworks':
        for (let i = 0; i < 4; i++) {
          const fx2 = x + rand(-30, 30), fz = 30 + rand(0, 25), fy = -60;
          this.burst(fx2, fy, fz, 50, { color: [pick(['#ffd23f', '#ff3ea5', '#2ec5ff', '#3fd13f', '#ff6a13']), '#ffffff'], speed: 18, life: 1.6, size: 0.6, g: 6, upMin: -1, upMax: 1 });
        }
        break;
      default: break;
    }
  };

  // ---------- update ----------
  P.update = function (dt, realDt) {
    // particles run on game time; screen effects on real time
    for (const p of this.parts) {
      p.age += dt;
      p.vz -= p.g * dt;
      const drag = Math.pow(1 - p.drag * 0.5, dt * 6);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      if (p.z < 0 && p.kind !== 'fire') { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; if (p.kind === 'glass') p.vr *= 0.5; }
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    this.rings.forEach((r) => { r.age += dt; r.r += r.vr * dt; });
    this.rings = this.rings.filter((r) => r.age < r.life);
    this.decals.forEach((d) => { d.age += dt; });
    this.decals = this.decals.filter((d) => d.age < d.life);
    this.floats.forEach((f) => { f.age += realDt; f.z += realDt * 3; });
    this.floats = this.floats.filter((f) => f.age < f.life);
    this.calls.forEach((c) => { c.age += realDt; });
    this.calls = this.calls.filter((c) => c.age < c.life);
    this.bolts.forEach((b) => { b.age += realDt; });
    this.bolts = this.bolts.filter((b) => b.age < b.life);
    if (this.shakeT > 0) { this.shakeT -= realDt; this.shakeAmp *= Math.pow(0.02, realDt); } else this.shakeAmp = 0;
    if (this.flashT > 0) this.flashT -= realDt;
    if (this.slowT > 0) this.slowT -= realDt;
    if (this.stopT > 0) this.stopT -= realDt;
    if (this.zoomT > 0) { this.zoomT -= realDt; this.zoomAmt += (this.zoomTarget - this.zoomAmt) * Math.min(1, realDt * 8); }
    else this.zoomAmt += (0 - this.zoomAmt) * Math.min(1, realDt * 4);
    this.box += ((this.boxT > 0 ? 1 : 0) - this.box) * Math.min(1, realDt * 6);
    if (this.boxT > 0) this.boxT -= realDt;
    if (this.linesT > 0) this.linesT -= realDt;
    if (this.tintT > 0) this.tintT -= realDt;
  };

  // Camera transform for the world layer. `base` is the broadcast camera (zoom + pan that follows
  // the ball); effect zooms (dunks, blocks) and shake stack on top of it.
  P.worldTransform = function (base) {
    base = base || { z: 1, ox: 0, oy: 0 };
    const W = this.cam.W, H = this.cam.H;
    const sx = this.shakeAmp ? rand(-1, 1) * this.shakeAmp : 0, sy = this.shakeAmp ? rand(-1, 1) * this.shakeAmp : 0;
    const fz = 1 + this.zoomAmt; const f = this.zoomFocus;
    const fsx = f.x * base.z + base.ox, fsy = f.y * base.z + base.oy;
    // drift the effect focus toward the middle so the moment stays framed
    const tx = (W / 2 - fsx) * this.zoomAmt * 0.6, ty = (H / 2 - fsy) * this.zoomAmt * 0.6;
    const z = base.z * fz;
    let ox = (base.ox - fsx) * fz + fsx + tx, oy = (base.oy - fsy) * fz + fsy + ty;
    ox = Math.min(0, Math.max(W - W * z, ox)); oy = Math.min(0, Math.max(H - H * z, oy));
    return { z, ox: ox + sx, oy: oy + sy };
  };

  // ---------- drawing ----------
  P.drawGround = function (ctx) {
    const cam = this.cam;
    for (const d of this.decals) {
      const a = Math.min(1, (d.life - d.age) / 2);
      ctx.save(); ctx.globalAlpha = a * 0.85; ctx.strokeStyle = d.color; ctx.lineWidth = 2.5;
      const c = cam.project(d.x, d.y, 0);
      for (let i = 0; i < 9; i++) {
        const ang = i / 9 * TAU + 0.3; let px = d.x, py = d.y; ctx.beginPath(); ctx.moveTo(c.x, c.y);
        for (let k = 0; k < 4; k++) { px += Math.cos(ang + Math.sin(i * 7 + k) * 0.5) * 1.5; py += Math.sin(ang + Math.cos(i * 3 + k) * 0.5) * 1.5; const q = cam.project(px, py, 0); ctx.lineTo(q.x, q.y); }
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const r of this.rings) {
      if (r.vertical) continue;
      const k = r.age / r.life; const a = 1 - k;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = r.color; ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) { const ang = i / 36 * TAU; const q = cam.project(r.x + Math.cos(ang) * r.r, r.y + Math.sin(ang) * r.r, r.z); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      const s = cam.project(r.x, r.y, r.z).s; ctx.lineWidth = Math.max(1.5, r.width * s * (1 - k * 0.6)); ctx.stroke(); ctx.restore();
    }
  };

  P.drawAir = function (ctx) {
    const cam = this.cam;
    ctx.save();
    for (const p of this.parts) {
      const q = cam.project(p.x, p.y, p.z); const k = p.age / p.life; const a = 1 - k;
      const sz = Math.max(1, p.size * q.s);
      switch (p.kind) {
        case 'impactArt': {
          const sprite = BK.assets && BK.assets.get('impact');
          if (sprite) {
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.75;
            const r = sz * (0.65 + k * 0.5);
            ctx.drawImage(sprite, q.x - r, q.y - r, r * 2, r * 2);
          }
          break;
        }
        case 'fire': case 'ember': {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8;
          const r = sz * (1 + k * 1.2);
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,80,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); break;
        }
        case 'dust': case 'smoke': {
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.45; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(q.x, q.y, sz * (1 + k * 2), 0, TAU); ctx.fill(); break;
        }
        case 'confetti': {
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.rot); ctx.fillRect(-sz, -sz * 0.4 * Math.abs(Math.sin(p.rot * 2)), sz * 2, sz * 0.8 * Math.abs(Math.sin(p.rot * 2)) + 1); ctx.restore(); break;
        }
        case 'glass': {
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 2) * 0.85; ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.5); ctx.lineTo(sz, -sz * 0.2); ctx.lineTo(sz * 0.2, sz); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); break;
        }
        case 'star': {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.rot); ctx.beginPath();
          for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5; const rr = i % 2 ? sz * 0.4 : sz; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
          ctx.closePath(); ctx.fill(); ctx.restore(); break;
        }
        case 'frost': {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
          ctx.beginPath(); for (let i = 0; i < 3; i++) { const ang = i * Math.PI / 3 + p.rot; ctx.moveTo(q.x - Math.cos(ang) * sz, q.y - Math.sin(ang) * sz); ctx.lineTo(q.x + Math.cos(ang) * sz, q.y + Math.sin(ang) * sz); } ctx.stroke(); break;
        }
        default: {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.color;
          const vx = p.vx * 0.02 * q.s, vy = -p.vz * 0.02 * q.s;
          ctx.strokeStyle = p.color; ctx.lineWidth = sz; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - vx, q.y - vy); ctx.stroke();
        }
      }
    }
    ctx.restore();
    // vertical rings (around the rim, around a blocked ball)
    for (const r of this.rings) {
      if (!r.vertical) continue;
      const q = cam.project(r.x, r.y, r.z); const k = r.age / r.life; const e = 1 - Math.pow(1 - k, 3);
      const rx = r.r * q.s, ry = r.r * q.s * 0.85;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.35; ctx.fillStyle = r.color; ctx.beginPath(); ctx.ellipse(q.x, q.y, rx * 0.92, ry * 0.92, 0, 0, TAU); ctx.ellipse(q.x, q.y, rx * 0.55, ry * 0.55, 0, 0, TAU); ctx.fill('evenodd');
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(2, r.width * q.s * (1 - e) * 1.4);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r.width * q.s * (1 - e) * 0.5); ctx.stroke();
      ctx.restore();
    }
    // lightning
    for (const b of this.bolts) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - b.age / b.life;
      ctx.shadowColor = b.color; ctx.shadowBlur = 20; ctx.strokeStyle = b.color; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    }
  };

  // Screen-space overlays drawn after the world (no zoom/shake).
  P.drawScreen = function (ctx, time) {
    const W = this.cam.W, H = this.cam.H;
    if (this.linesT > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.linesT * 2) * 0.55; ctx.strokeStyle = this.linesCol; ctx.lineWidth = 2;
      const cx = this.zoomFocus.x, cy = this.zoomFocus.y;
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * TAU + time * 0.7; const r0 = 260 + Math.sin(i * 9.1 + time * 20) * 60;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * 1400, cy + Math.sin(a) * 1400); ctx.stroke();
      }
      ctx.restore();
    }
    if (this.box > 0.01) {
      ctx.fillStyle = '#000'; const h = this.box * H * 0.09;
      ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
    }
    if (this.tintT > 0 && this.tint) {
      ctx.save(); ctx.globalAlpha = Math.min(0.25, this.tintT * 0.3);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, this.tint);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (this.flashT > 0 && this.flashCol) {
      ctx.save(); ctx.globalAlpha = Math.max(0, this.flashT / this.flashDur) * 0.6; ctx.fillStyle = this.flashCol; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  };

  // Callouts are broadcast stamps, not comic bursts: slanted Anton lettering with a hard two-tone fill,
  // an ink outline and offset shadow. 'slam' calls ride a crew-color slab that wipes in with speed streaks.
  const INK = '#07080c';
  const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  function slabPath(ctx, x, y, w, h, sl) { ctx.beginPath(); ctx.moveTo(x + sl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - sl, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
  function letters(ctx, text, size, color, x, y) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = INK; ctx.fillStyle = INK;
    ctx.strokeText(text, x + size * 0.06, y + size * 0.07); ctx.fillText(text, x + size * 0.06, y + size * 0.07);
    ctx.lineWidth = size * 0.13; ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(0, y - size * 0.4, 0, y + size * 0.4);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.47, '#ffffff'); g.addColorStop(0.47, color); g.addColorStop(1, A_shade(color, -0.18));
    ctx.fillStyle = g; ctx.fillText(text, x, y);
  }
  P.drawCalls = function (ctx) {
    const cam = this.cam; const W = cam.W;
    for (const f of this.floats) {
      const q = cam.project(f.x, f.y, f.z); const a = 1 - f.age / f.life;
      const size = Math.round(Math.max(20, q.s * 2.3));
      ctx.save(); ctx.globalAlpha = Math.min(1, a * 2); ctx.translate(q.x, q.y); ctx.transform(1, 0, -0.18, 1, 0, 0);
      ctx.font = `400 ${size}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = INK; ctx.strokeText(f.text, 2, 3);
      ctx.lineWidth = size * 0.16; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    for (const c of this.calls) {
      const k = c.age / c.life; const slam = c.style === 'slam';
      const size = c.size; const tin = ease(c.age / (slam ? 0.16 : 0.2));
      const out = k > 0.82 ? (k - 0.82) / 0.18 : 0;
      let dx = 0, sc = 1, a = 1 - out;
      if (slam) { dx = (1 - tin) * -W * 0.55 + ease(out) * W * 0.35; sc = 1 + (1 - tin) * 0.18; }
      else { sc = c.age < 0.12 ? 0.4 + c.age / 0.12 * 0.72 : c.age < 0.22 ? 1.12 - (c.age - 0.12) / 0.1 * 0.12 : 1; dx = ease(out) * 40; }
      ctx.save(); ctx.translate(c.x + dx, c.y - out * 20); ctx.rotate(c.rot * 0.35); ctx.scale(sc, sc); ctx.globalAlpha = a;
      ctx.transform(1, 0, -0.2, 1, 0, 0);
      ctx.font = `400 ${size}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(c.text).width;
      if (slam) {
        const pw = tw + size * 0.9, ph = size * 1.12, px = -pw / 2, py = -ph / 2 + size * 0.02;
        // speed streaks trailing off the left
        ctx.save(); ctx.globalAlpha = a * (0.4 + (1 - tin) * 0.6);
        for (let i = 0; i < 5; i++) {
          const ly = py + ph * (0.12 + i * 0.19); const len = size * (1.4 + ((i * 7) % 5) * 0.5) * (1.4 - tin * 0.6);
          ctx.fillStyle = i % 2 ? c.color : '#ffffff'; ctx.fillRect(px - len - size * 0.12, ly, len, Math.max(2, size * 0.045));
        }
        ctx.restore();
        // accent plate, shadow, main plate in the crew color, ink edge
        ctx.fillStyle = c.color; slabPath(ctx, px - size * 0.14, py - size * 0.12, pw + size * 0.12, ph, size * 0.18); ctx.fill();
        ctx.lineWidth = Math.max(2, size * 0.04); ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = INK; slabPath(ctx, px + size * 0.1, py + size * 0.12, pw, ph, size * 0.18); ctx.fill();
        slabPath(ctx, px, py, pw, ph, size * 0.18); ctx.fillStyle = c.color2; ctx.fill();
        ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px - size, py, pw + size * 2, ph * 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px - size, py + ph * 0.8, pw + size * 2, ph * 0.2); ctx.restore();
        slabPath(ctx, px, py, pw, ph, size * 0.18); ctx.lineWidth = Math.max(3, size * 0.06); ctx.strokeStyle = INK; ctx.stroke();
      } else {
        // a crew-color bar under the word
        const bw = tw * 0.92, bh = Math.max(6, size * 0.15), by = size * 0.44;
        ctx.fillStyle = INK; slabPath(ctx, -bw / 2 + 5, by + 5, bw, bh, bh * 0.8); ctx.fill();
        slabPath(ctx, -bw / 2, by, bw, bh, bh * 0.8); ctx.fillStyle = c.color2; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      }
      letters(ctx, c.text, size, c.color, 0, 0);
      if (c.sub) {
        const ss = Math.round(size * 0.3); ctx.font = `italic 900 ${ss}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        const sw = ctx.measureText(c.sub).width + ss * 1.4, sy = size * (slam ? 0.66 : 0.72);
        ctx.fillStyle = INK; slabPath(ctx, -sw / 2, sy, sw, ss * 1.35, ss * 0.35); ctx.fill();
        ctx.fillStyle = c.color; ctx.fillRect(-sw / 2 + ss * 0.1, sy + ss * 0.1, ss * 0.22, ss * 1.15);
        ctx.fillStyle = '#ffffff'; ctx.fillText(c.sub, ss * 0.1, sy + ss * 0.72);
      }
      ctx.restore();
    }
  };
  function A_shade(c, amt) { return BK.art && BK.art.shade ? BK.art.shade(c, amt == null ? -0.35 : amt) : c; }

  BK.FX = FX;
})(window.BK = window.BK || {});
