// Particles, ground decals, floating numbers and camera feel.
(function (root) {
  const BK = root.BK;
  const R = BK.fxr;

  function sprite(size, stops) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d");
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return cv;
  }

  class FX {
    constructor(ww, wh, gs) {
      // The decal layer covers the whole world. Big maps keep it at a lower resolution.
      this.ww = ww || BK.W;
      this.wh = wh || BK.H;
      this.gs = gs || 1;
      this.parts = [];
      this.texts = [];
      this.rings = [];
      this.trauma = 0;
      this.punch = 0;
      this.flash = 0;
      this.flashColor = "255,240,210";
      this.red = 0;
      this.time = 0;
      this.wind = { x: 14, y: -6 };
      this.S = {
        fire: sprite(64, [[0, "rgba(255,250,220,1)"], [0.25, "rgba(255,200,90,0.95)"], [0.55, "rgba(240,100,30,0.6)"], [1, "rgba(160,40,10,0)"]]),
        glow: sprite(64, [[0, "rgba(255,230,160,0.9)"], [0.4, "rgba(255,160,60,0.35)"], [1, "rgba(255,120,40,0)"]]),
        smoke: sprite(64, [[0, "rgba(104,100,92,0.5)"], [0.6, "rgba(104,100,92,0.2)"], [1, "rgba(104,100,92,0)"]]),
        whiteSmoke: sprite(64, [[0, "rgba(235,235,228,0.9)"], [0.6, "rgba(225,225,218,0.5)"], [1, "rgba(220,220,214,0)"]]),
        dust: sprite(32, [[0, "rgba(170,145,105,0.6)"], [1, "rgba(170,145,105,0)"]]),
        flak: sprite(64, [[0, "rgba(40,38,36,0.95)"], [0.5, "rgba(50,48,44,0.6)"], [1, "rgba(50,48,44,0)"]]),
        scorch: sprite(64, [[0, "rgba(20,16,12,0.75)"], [0.5, "rgba(30,24,16,0.45)"], [1, "rgba(30,24,16,0)"]]),
        muzzle: sprite(32, [[0, "rgba(255,255,230,1)"], [0.3, "rgba(255,220,120,0.9)"], [1, "rgba(255,150,40,0)"]]),
        blood: sprite(64, [[0, "rgba(92,8,6,0.95)"], [0.55, "rgba(110,12,8,0.8)"], [0.8, "rgba(80,6,4,0.35)"], [1, "rgba(80,6,4,0)"]]),
        core: sprite(64, [[0, "rgba(255,255,245,1)"], [0.2, "rgba(255,236,170,1)"], [0.5, "rgba(255,150,50,0.75)"], [0.8, "rgba(170,50,15,0.25)"], [1, "rgba(120,30,10,0)"]]),
        ember: sprite(16, [[0, "rgba(255,240,180,1)"], [0.4, "rgba(255,150,40,0.8)"], [1, "rgba(255,90,20,0)"]]),
      };
      this.decal = document.createElement("canvas");
      this.decal.width = Math.ceil(this.ww * this.gs);
      this.decal.height = Math.ceil(this.wh * this.gs);
      this.dc = this.decal.getContext("2d");
      this.dc.scale(this.gs, this.gs);
      this.wreckCv = document.createElement("canvas");
      this.wreckCv.width = this.wreckCv.height = 240;
    }

    clearDecals() { this.dc.clearRect(0, 0, this.ww, this.wh); }

    add(p) {
      if (this.parts.length > 720) this.parts.splice(0, 100);
      p.life = p.max = p.life || 1;
      p.vx = p.vx || 0; p.vy = p.vy || 0; p.z = p.z || 0; p.vz = p.vz || 0;
      p.rot = p.rot || 0; p.vr = p.vr || 0; p.grow = p.grow || 0; p.drag = p.drag == null ? 0.9 : p.drag;
      p.a = p.a == null ? 1 : p.a;
      this.parts.push(p);
      return p;
    }

    shake(n) { this.trauma = Math.min(1.2, this.trauma + n); }

    text(x, y, str, color, size, opts) {
      opts = opts || {};
      // Nudge stacked numbers apart so a hail of hits stays readable.
      let yy = y;
      for (const t of this.texts) if (Math.abs(t.x - x) < 26 && Math.abs(t.y - yy) < 12 && t.age < 0.25) yy -= 13;
      const t = { x: x + (opts.jitter ? R.range(-8, 8) : 0), y: yy, str, color: color || "#fff", size: size || 14, age: 0, life: opts.life || 0.9, vy: opts.vy || -38, pop: opts.pop || 1, stroke: opts.stroke || "rgba(0,0,0,0.85)" };
      this.texts.push(t);
      if (this.texts.length > 90) this.texts.shift();
      return t;
    }

    muzzle(x, y, ang, big) {
      this.add({ kind: "muzzle", x, y, rot: ang, life: big ? 0.09 : 0.05, size: big ? 26 : 14, blend: true });
      this.add({ kind: "smoke", x: x + Math.cos(ang) * 6, y: y + Math.sin(ang) * 6, vx: Math.cos(ang) * 30 + R.range(-10, 10), vy: Math.sin(ang) * 30 + R.range(-10, 10), life: big ? 1.2 : 0.5, size: big ? 16 : 7, grow: big ? 22 : 10, a: big ? 0.6 : 0.35 });
    }

    casing(x, y, ang) {
      const a = ang + Math.PI / 2 + R.range(-0.3, 0.3);
      this.add({ kind: "casing", x, y, vx: Math.cos(a) * R.range(40, 70), vy: Math.sin(a) * R.range(40, 70), vz: R.range(40, 80), life: 0.5, size: 1.6, vr: R.range(-20, 20) });
    }

    tracer(x, y, tx, ty, color, w) {
      this.add({ kind: "tracer", x, y, tx, ty, life: 0.07, size: w || 1.6, color: color || "255,225,130" });
    }

    sparks(x, y, n, color, speed) {
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, s = R.range(0.3, 1) * (speed || 160);
        this.add({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: R.range(0.15, 0.35), size: R.range(1, 2), color: color || "255,210,120", drag: 0.86 });
      }
    }

    dust(x, y, n, spread) {
      for (let i = 0; i < n; i++) {
        this.add({ kind: "dust", x: x + R.range(-spread, spread), y: y + R.range(-spread, spread), vx: R.range(-20, 20), vy: R.range(-20, 20), life: R.range(0.4, 0.9), size: R.range(6, 12), grow: 14, a: 0.7 });
      }
    }

    explosion(x, y, r, size, opts) {
      opts = opts || {};
      size = size || r / 40;
      const k = Math.sqrt(size);
      // A short sharp flash, then a fireball that rolls outward and turns to smoke.
      this.add({ kind: "flash", x, y, life: 0.09, size: r * 1.8 + 30, blend: true });
      this.add({ kind: "core", x, y, life: 0.22, size: 10 * k, grow: 90 * k, blend: true });
      this.rings.push({ x, y, r: r * 0.3, max: r * 1.7, life: 0.32, age: 0, w: 2 + size });
      const n = Math.round(10 + size * 10);
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, sp = R.range(30, 130) * k;
        this.add({ kind: "fire", x: x + Math.cos(a) * r * 0.15, y: y + Math.sin(a) * r * 0.15, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R.range(0.22, 0.5), size: R.range(8, 16) * k, grow: 22 * k, blend: true, drag: 0.85 });
      }
      // Flame tongues: stretched streaks thrown straight out.
      for (let i = 0; i < 4 + size * 3; i++) {
        const a = R() * Math.PI * 2, sp = R.range(140, 260) * k;
        this.add({ kind: "tongue", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R.range(0.12, 0.22), size: R.range(4, 7) * k, blend: true, drag: 0.82 });
      }
      // Smoke starts hot and dark and lingers.
      for (let i = 0; i < Math.round(5 + size * 5); i++) {
        const a = R() * Math.PI * 2, sp = R.range(10, 45) * k;
        this.add({ kind: opts.white ? "whiteSmoke" : "smoke", x: x + R.range(-r, r) * 0.3, y: y + R.range(-r, r) * 0.3, vx: Math.cos(a) * sp + this.wind.x, vy: Math.sin(a) * sp + this.wind.y, life: R.range(1.1, 2.2) * Math.min(1.5, 0.7 + size * 0.3), size: R.range(12, 20) * k, grow: 22 * k, a: 0.6, drag: 0.95, delay: 0.08 });
      }
      // A ring of ground dust kicked up by the blast.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + R() * 0.3;
        this.add({ kind: "dust", x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * 90 * k, vy: Math.sin(a) * 90 * k, life: R.range(0.5, 0.9), size: 9 * k, grow: 24, a: 0.75, drag: 0.88 });
      }
      const debris = Math.round(5 + size * 6);
      for (let i = 0; i < debris; i++) {
        const a = R() * Math.PI * 2, sp = R.range(60, 210) * k;
        this.add({ kind: "debris", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.range(80, 280), life: R.range(0.7, 1.2), size: R.range(1.5, 3.5), vr: R.range(-14, 14), drag: 0.97, trail: size > 1 && R() < 0.4, stamp: true });
      }
      for (let i = 0; i < 6 + size * 6; i++) {
        this.add({ kind: "ember", x: x + R.range(-r, r) * 0.4, y: y + R.range(-r, r) * 0.4, vx: R.range(-30, 30) + this.wind.x, vy: R.range(-50, -10) + this.wind.y, life: R.range(0.8, 1.8), size: R.range(1.5, 3), drag: 0.97, flick: R() * 10 });
      }
      this.sparks(x, y, Math.round(6 + size * 8), "255,200,110", 260 * k);
      // A crater and scorch stay on the ground for a while.
      if (r < 26) return;
      const sc = r * R.range(1.05, 1.35);
      this.dc.save();
      this.dc.translate(x, y);
      this.dc.rotate(R() * 6);
      this.dc.globalAlpha = 0.32;
      this.dc.drawImage(this.S.scorch, -sc, -sc * 0.85, sc * 2, sc * 1.7);
      this.dc.globalAlpha = 0.5;
      const cr = Math.min(16, r * 0.28);
      const g = this.dc.createRadialGradient(0, 0, cr * 0.2, 0, 0, cr * 1.4);
      g.addColorStop(0, "rgba(28,22,14,0.9)");
      g.addColorStop(0.6, "rgba(50,38,22,0.6)");
      g.addColorStop(0.8, "rgba(150,125,90,0.4)");
      g.addColorStop(1, "rgba(150,125,90,0)");
      this.dc.fillStyle = g;
      this.dc.beginPath();
      this.dc.arc(0, 0, cr * 1.4, 0, Math.PI * 2);
      this.dc.fill();
      this.dc.restore();
    }

    // ---------------------------------------------------------------- blood
    blood(x, y, n, power, dir) {
      if (!BK.gore) return;
      for (let i = 0; i < n; i++) {
        const a = dir == null ? R() * Math.PI * 2 : dir + R.range(-0.7, 0.7), sp = R.range(30, 110) * (power || 1);
        this.add({ kind: "blood", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.range(30, 90), life: R.range(0.3, 0.6), size: R.range(1, 2.2), drag: 0.9, stamp: true });
      }
    }
    pool(x, y, s) {
      if (!BK.gore) return;
      const dc = this.dc;
      dc.save();
      dc.globalAlpha = 0.85;
      for (let i = 0; i < 3; i++) {
        const ss = s * R.range(0.5, 1);
        dc.drawImage(this.S.blood, x + R.range(-s, s) * 0.4 - ss, y + R.range(-s, s) * 0.4 - ss * 0.8, ss * 2, ss * 1.6);
      }
      dc.restore();
    }
    // A fallen soldier stays where he fell until the field slowly fades.
    corpse(x, y, ang, officer, thrown) {
      const dc = this.dc;
      if (BK.gore) this.pool(x + R.range(-2, 2), y + R.range(-2, 2), thrown ? 20 : 15);
      dc.save();
      dc.translate(x, y);
      dc.rotate(ang + R.range(-0.8, 0.8));
      dc.scale(BK.US, BK.US);
      dc.globalAlpha = 0.95;
      const coat = officer ? "#4f5446" : "#5f6653";
      // legs splayed
      dc.strokeStyle = "#3e4235";
      dc.lineWidth = 2.5;
      dc.lineCap = "round";
      dc.beginPath();
      dc.moveTo(-3, -1.5); dc.lineTo(-10, -4 - R() * 2);
      dc.moveTo(-3, 1.5); dc.lineTo(-10, 3 + R() * 3);
      dc.stroke();
      // arms flung out
      dc.lineWidth = 2;
      dc.strokeStyle = coat;
      dc.beginPath();
      dc.moveTo(2, -3); dc.lineTo(5 + R() * 2, -8);
      dc.moveTo(2, 3); dc.lineTo(6, 6 + R() * 2);
      dc.stroke();
      dc.beginPath();
      dc.ellipse(-0.5, 0, 5.5, 3.6, 0, 0, Math.PI * 2);
      dc.fillStyle = coat;
      dc.fill();
      dc.strokeStyle = "rgba(10,10,8,0.7)";
      dc.lineWidth = 0.8;
      dc.stroke();
      dc.beginPath();
      dc.arc(6.5, 0.5, 2.6, 0, Math.PI * 2);
      dc.fillStyle = "#c4a487";
      dc.fill();
      if (BK.gore) {
        dc.fillStyle = "rgba(120,10,8,0.85)";
        dc.beginPath();
        dc.ellipse(R.range(-2, 2), R.range(-1, 1), 2.4, 1.6, R() * 3, 0, Math.PI * 2);
        dc.fill();
      }
      // helmet knocked off and the rifle dropped beside him
      dc.beginPath();
      dc.arc(11 + R() * 3, -4 + R() * 8, 3, 0, Math.PI * 2);
      dc.fillStyle = officer ? "#3a3c30" : "#555c49";
      dc.fill();
      if (!officer) {
        dc.strokeStyle = "#4a321b";
        dc.lineWidth = 1.4;
        dc.beginPath();
        const ry = R.range(-9, 9);
        dc.moveTo(-6, ry); dc.lineTo(7, ry + R.range(-3, 3));
        dc.stroke();
      }
      dc.restore();
    }
    // Two parallel treads pressed into the dirt.
    treads(x, y, ang, w) {
      const dc = this.dc;
      dc.save();
      dc.translate(x, y);
      dc.rotate(ang);
      dc.fillStyle = "rgba(55,42,26,0.13)";
      dc.fillRect(-2, -w / 2, 4, 3.5);
      dc.fillRect(-2, w / 2 - 3.5, 4, 3.5);
      dc.restore();
    }

    flakBurst(x, y) {
      this.add({ kind: "flash", x, y, life: 0.08, size: 40, blend: true });
      for (let i = 0; i < 5; i++) this.add({ kind: "flak", x: x + R.range(-6, 6), y: y + R.range(-6, 6), vx: R.range(-12, 12), vy: R.range(-12, 12), life: R.range(0.9, 1.5), size: R.range(8, 13), grow: 12, a: 0.85, drag: 0.92 });
      this.sparks(x, y, 4, "255,190,90", 120);
    }

    burn(x, y, big) {
      this.add({ kind: "fire", x: x + R.range(-4, 4), y: y + R.range(-4, 4), vx: R.range(-6, 6), vy: R.range(-24, -8), life: R.range(0.3, 0.6), size: big ? 10 : 6, grow: 6, blend: true });
      if (R() < 0.45) this.add({ kind: "smoke", x, y: y - 3, vx: R.range(-6, 6) + 10, vy: R.range(-30, -14), life: R.range(1.2, 2), size: big ? 8 : 5, grow: 16, a: 0.4, drag: 0.97 });
    }

    // Burned out hull stamped onto the ground so the battlefield remembers every kill.
    wreck(e) {
      const cv = this.wreckCv, c = cv.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, 240, 240);
      c.translate(120, 120);
      c.rotate(e.ang);
      const fake = Object.assign({}, e, { t: 0, empty: true });
      BK.Art.enemy(c, fake, {});
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = "rgba(22,18,14,0.82)";
      c.fillRect(0, 0, 240, 240);
      c.globalCompositeOperation = "source-over";
      this.dc.drawImage(cv, e.x - 120, e.y - 120);
    }

    body(e) {
      // Fallen soldiers fade into the dirt as a dark smudge, nothing graphic.
      this.dc.save();
      this.dc.globalAlpha = 0.35;
      this.dc.fillStyle = "#3b3a2c";
      this.dc.beginPath();
      this.dc.ellipse(e.x, e.y, 5, 3, e.ang, 0, Math.PI * 2);
      this.dc.fill();
      this.dc.restore();
    }

    update(dt) {
      this.time += dt;
      // Old scorch marks and wrecks fade over about a minute so the road never turns into a black smear.
      this.fadeT = (this.fadeT || 0) + dt;
      if (this.fadeT > 0.5) {
        this.fadeT = 0;
        this.dc.save();
        this.dc.globalCompositeOperation = "destination-out";
        this.dc.fillStyle = "rgba(0,0,0,0.009)";
        this.dc.fillRect(0, 0, this.ww, this.wh);
        this.dc.restore();
      }
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
      this.punch = Math.max(0, this.punch - dt * 3);
      this.flash = Math.max(0, this.flash - dt * 3);
      this.red = Math.max(0, this.red - dt * 1.6);
      for (const p of this.parts) {
        p.life -= dt;
        if (p.kind === "smoke" || p.kind === "whiteSmoke") { p.vx += this.wind.x * dt * 0.6; p.vy += this.wind.y * dt * 0.6; }
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.size += p.grow * dt;
        if (p.kind === "debris" || p.kind === "casing" || p.kind === "blood") {
          p.vz -= 520 * dt;
          p.z += p.vz * dt;
          if (p.z < 0) {
            p.z = 0;
            if (p.stamp && !p.landed) {
              p.landed = true;
              this.dc.fillStyle = p.kind === "blood" ? "rgba(105,10,7,0.85)" : "rgba(30,26,20,0.6)";
              this.dc.beginPath();
              this.dc.ellipse(p.x, p.y, p.size * 1.3, p.size, 0, 0, Math.PI * 2);
              this.dc.fill();
              if (p.kind === "blood") p.life = 0;
            }
            p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6;
          }
          if (p.trail && R() < 0.5) this.add({ kind: "smoke", x: p.x, y: p.y - p.z, life: 0.6, size: 4, grow: 10, a: 0.5, drag: 0.95 });
        }
        if (p.kind === "ember") { p.vx += this.wind.x * dt * 0.5; p.vy += this.wind.y * dt * 0.5; }
      }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const r of this.rings) r.age += dt;
      this.rings = this.rings.filter((r) => r.age < r.life);
      for (const t of this.texts) { t.age += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.9, dt * 60); }
      this.texts = this.texts.filter((t) => t.age < t.life);
    }

    drawLow(c) {
      // Ground hugging particles: dust, casings and debris.
      for (const p of this.parts) {
        const k = p.life / p.max;
        if (p.kind === "dust") {
          c.globalAlpha = p.a * k;
          c.drawImage(this.S.dust, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else if (p.kind === "casing") {
          c.globalAlpha = 1;
          c.fillStyle = "#d8b25a";
          c.fillRect(p.x - 1.5, p.y - p.z * 0.3 - 0.8, 3, 1.6);
        }
      }
      c.globalAlpha = 1;
    }

    drawHigh(c) {
      for (const p of this.parts) {
        const k = Math.max(0, p.life / p.max);
        switch (p.kind) {
          case "smoke":
          case "whiteSmoke":
          case "flak":
            c.globalAlpha = p.a * Math.min(1, k * 1.6);
            c.drawImage(this.S[p.kind], p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            break;
          case "blood":
            c.globalAlpha = 1;
            c.fillStyle = "#7a0c08";
            c.beginPath();
            c.arc(p.x, p.y - p.z * 0.4, p.size, 0, Math.PI * 2);
            c.fill();
            break;
          case "debris":
            c.globalAlpha = Math.min(1, k * 2);
            c.save();
            c.translate(p.x, p.y - p.z * 0.4);
            c.rotate(p.rot);
            c.fillStyle = p.color || "#1e1c18";
            c.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
            c.restore();
            break;
        }
      }
      c.globalCompositeOperation = "lighter";
      for (const p of this.parts) {
        const k = Math.max(0, p.life / p.max);
        switch (p.kind) {
          case "fire":
            c.globalAlpha = Math.min(1, k * 1.4);
            c.drawImage(this.S.fire, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            break;
          case "flash":
            c.globalAlpha = k * 0.85;
            c.drawImage(this.S.glow, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            break;
          case "core":
            c.globalAlpha = Math.min(1, k * 1.5);
            c.drawImage(this.S.core, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            break;
          case "tongue": {
            const sp = Math.hypot(p.vx, p.vy) + 1;
            c.globalAlpha = k;
            c.save();
            c.translate(p.x, p.y);
            c.rotate(Math.atan2(p.vy, p.vx));
            c.drawImage(this.S.fire, -sp * 0.09, -p.size, sp * 0.12 + p.size, p.size * 2);
            c.restore();
            break;
          }
          case "ember":
            c.globalAlpha = Math.min(1, k * 2) * (0.6 + 0.4 * Math.sin(this.time * 20 + p.flick));
            c.drawImage(this.S.ember, p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
            break;
          case "muzzle":
            c.globalAlpha = k;
            c.save();
            c.translate(p.x, p.y);
            c.rotate(p.rot);
            c.drawImage(this.S.muzzle, -p.size * 0.2, -p.size * 0.35, p.size * 1.4, p.size * 0.7);
            c.drawImage(this.S.muzzle, -p.size * 0.45, -p.size * 0.45, p.size * 0.9, p.size * 0.9);
            c.restore();
            break;
          case "spark":
            c.globalAlpha = k;
            c.strokeStyle = `rgba(${p.color},1)`;
            c.lineWidth = p.size;
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            c.stroke();
            break;
          case "tracer": {
            c.globalAlpha = Math.min(1, k * 2);
            c.strokeStyle = `rgba(${p.color},1)`;
            c.lineWidth = p.size;
            c.lineCap = "round";
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.tx, p.ty);
            c.stroke();
            break;
          }
        }
      }
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      for (const r of this.rings) {
        const k = r.age / r.life;
        c.strokeStyle = `rgba(255,235,200,${0.5 * (1 - k)})`;
        c.lineWidth = r.w * (1 - k);
        c.beginPath();
        c.arc(r.x, r.y, BK.lerp(r.r, r.max, BK.easeOut(k)), 0, Math.PI * 2);
        c.stroke();
      }
    }

    drawTexts(c) {
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const t of this.texts) {
        const k = t.age / t.life;
        const s = t.age < 0.12 ? BK.lerp(t.pop * 1.6, 1, t.age / 0.12) : 1;
        c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        c.font = `700 ${Math.round(t.size * s)}px Oswald, Impact, sans-serif`;
        c.lineWidth = Math.max(3, t.size / 5);
        c.strokeStyle = t.stroke;
        c.lineJoin = "round";
        c.strokeText(t.str, t.x, t.y);
        c.fillStyle = t.color;
        c.fillText(t.str, t.x, t.y);
      }
      c.globalAlpha = 1;
    }

    camera() {
      const t = this.trauma * this.trauma;
      const s = 14 * t;
      return {
        x: (Math.sin(this.time * 47.3) + Math.sin(this.time * 31.1) * 0.5) * s,
        y: (Math.cos(this.time * 43.7) + Math.sin(this.time * 27.9) * 0.5) * s,
        rot: Math.sin(this.time * 37) * 0.01 * t,
        zoom: 1 + this.punch * 0.025,
      };
    }
  }
  BK.FX = FX;
})(typeof window !== "undefined" ? window : globalThis);
