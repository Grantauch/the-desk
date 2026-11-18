// Draws the battlefield and turns simulation events into effects and sound.
(function (root) {
  const BK = root.BK;
  const R = BK.fxr;
  const A = BK.Art;

  const GRADES = {
    dawn: { mul: [[0, "rgba(255,214,170,1)"], [1, "rgba(200,190,215,1)"]], light: "rgba(255,190,120,0.16)", vig: 0.5, lx: 120, ly: 60 },
    noon: { mul: [[0, "rgba(255,250,235,1)"], [1, "rgba(235,235,225,1)"]], light: "rgba(255,250,220,0.08)", vig: 0.38, lx: 640, ly: -100 },
    dusk: { mul: [[0, "rgba(250,170,130,1)"], [1, "rgba(120,110,160,1)"]], light: "rgba(255,140,80,0.2)", vig: 0.62, lx: 1180, ly: 120 },
  };

  // Sun direction per time of day: long shadows at dawn and dusk, short at noon.
  const SUNS = {
    dawn: { x: 1.15, y: 0.55, a: 0.42 },
    noon: { x: 0.35, y: 0.7, a: 0.34 },
    dusk: { x: -1.25, y: 0.5, a: 0.46 },
  };

  class Renderer {
    constructor(canvas, images) {
      this.cv = canvas;
      this.c = canvas.getContext("2d");
      this.img = images;
      this.fx = new BK.FX();
      this.burners = [];
      this.falling = [];
      this.coins = [];
      this.time = 0;
      this.coinTarget = { x: 120, y: 20 };
      this.onCoin = null;
      this.ui = null;
    }

    setGame(g) {
      this.g = g;
      this.fx = new BK.FX();
      this.burners = [];
      this.falling = [];
      this.coins = [];
      this.birds = [];
      this.birdT = 6;
      this.dmgTexts = {};
      this.aims = {};
      const sun = SUNS[g.map.time];
      this.sun = Object.assign({ len: Math.hypot(sun.x, sun.y) }, sun);
      this.fires = BK.Scenery ? BK.Scenery.fires(g.props) : [];
      this.treeShadowCv = null;
      this.bake();
    }

    // ------------------------------------------------------------ static ground
    bake() {
      const g = this.g, map = g.map;
      const cv = (this.ground = document.createElement("canvas"));
      cv.width = BK.W; cv.height = BK.H;
      const c = cv.getContext("2d");
      c.save();
      if (map.flip) { c.translate(BK.W, 0); c.scale(-1, 1); }
      c.drawImage(this.img.terrain, 0, 0, BK.W, BK.H);
      c.restore();

      // Craters and sheaves first, so the roads are laid over them.
      const sc = BK.Scenery;
      for (const pr of g.props) if (pr.kind === "crater" || pr.kind === "stooks") sc.draw(c, pr, this.sun);
      for (const p of g.paths) this.bakeRoad(c, p);
      for (const p of g.paths) this.bakeRuts(c, p);
      const order = ["fence", "tks", "cart", "shrine", "crates", "well", "shed", "barn", "house", "pole"];
      for (const k of order) for (const pr of g.props) if (pr.kind === k) sc.draw(c, pr, this.sun);
      // Hay bales sit on the ground layer; trees are drawn later over the units.
      for (const pr of g.props) if (pr.kind === "hay") { this.drawPropShadow(c, pr); this.drawProp(c, pr); }
      this.bakeMarkers(c);

      const grade = GRADES[map.time];
      const m = (this.gradeMul = document.createElement("canvas"));
      m.width = BK.W; m.height = BK.H;
      const mc = m.getContext("2d");
      const lg = mc.createLinearGradient(grade.lx, grade.ly, BK.W - grade.lx, BK.H);
      for (const [o, col] of grade.mul) lg.addColorStop(o, col);
      mc.fillStyle = lg;
      mc.fillRect(0, 0, BK.W, BK.H);
      // Vignette folds into the same multiply pass, so the grade costs one full screen draw.
      const rg = mc.createRadialGradient(BK.W / 2, BK.H / 2, BK.H * 0.35, BK.W / 2, BK.H / 2, BK.W * 0.72);
      rg.addColorStop(0, "rgba(255,255,255,0)");
      rg.addColorStop(1, `rgba(8,6,4,${grade.vig})`);
      mc.fillStyle = rg;
      mc.fillRect(0, 0, BK.W, BK.H);
      this.vignette = m;
      // Sunlight is static, so it is painted straight into the ground.
      c.globalCompositeOperation = "screen";
      const lr = c.createRadialGradient(grade.lx, grade.ly, 10, grade.lx, grade.ly, 700);
      lr.addColorStop(0, grade.light);
      lr.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = lr;
      c.fillRect(0, 0, BK.W, BK.H);
      c.globalCompositeOperation = "source-over";
      this.clouds = [0, 1].map((i) => ({ x: R.range(0, BK.W), y: R.range(0, BK.H), s: R.range(300, 420), v: R.range(6, 12) }));
    }

    bakeRoad(c, p) {
      const pts = p.pts;
      const stroke = (w, style, alpha) => {
        c.save();
        c.globalAlpha = alpha == null ? 1 : alpha;
        c.strokeStyle = style;
        c.lineWidth = w;
        c.lineJoin = "round";
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
        c.stroke();
        c.restore();
      };
      stroke(74, "rgba(40,34,18,0.32)");
      stroke(64, "#6e5a3c");
      stroke(58, "#86704e");
      stroke(38, "#98805a", 0.6);
      // Speckle the dirt so it isn't a flat ribbon.
      const r = BK.makeRng(pts.length);
      for (let i = 0; i < pts.length; i += 1) {
        const [x, y] = pts[i];
        for (let k = 0; k < 3; k++) {
          c.fillStyle = r() < 0.5 ? "rgba(60,46,28,0.25)" : "rgba(190,170,130,0.18)";
          c.fillRect(x + r.range(-27, 27), y + r.range(-27, 27), r.range(1, 3), r.range(1, 3));
        }
      }
      // Grass tufts along the edges.
      for (let i = 0; i < pts.length; i += 3) {
        const [x, y] = pts[i];
        const a = i < pts.length - 1 ? Math.atan2(pts[i + 1][1] - y, pts[i + 1][0] - x) : 0;
        for (const s of [-1, 1]) {
          const ex = x - Math.sin(a) * 30 * s, ey = y + Math.cos(a) * 30 * s;
          c.strokeStyle = r() < 0.5 ? "rgba(90,110,50,0.7)" : "rgba(150,140,70,0.6)";
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(ex, ey);
          c.lineTo(ex + r.range(-3, 3), ey + r.range(-5, -1));
          c.stroke();
        }
      }
    }
    bakeRuts(c, p) {
      const pts = p.pts;
      for (const off of [-12, 12]) {
        c.strokeStyle = "rgba(70,55,34,0.45)";
        c.lineWidth = 3;
        c.beginPath();
        for (let i = 0; i < pts.length - 1; i++) {
          const a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
          const x = pts[i][0] - Math.sin(a) * off, y = pts[i][1] + Math.cos(a) * off;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      }
    }
    bakeMarkers(c) {
      const g = this.g;
      // Barricade and flag at the exit, the town the column is driving toward.
      const p = g.paths[0];
      let d = p.len;
      let [x, y, a] = p.at(d);
      while (d > 0 && (x > BK.W - 34 || x < 34 || y < 34 || y > BK.H - 34)) { d -= 6; [x, y, a] = p.at(d); }
      c.save();
      c.translate(x, y);
      c.rotate(a);
      for (let i = -3; i <= 3; i++) {
        A.rr(c, -6, i * 9 - 4, 12, 8, 3);
        c.fillStyle = i % 2 ? "#a99266" : "#b9a272";
        c.fill();
        c.strokeStyle = "rgba(60,50,30,0.8)";
        c.lineWidth = 1;
        c.stroke();
      }
      c.restore();
      c.save();
      c.translate(x - Math.sin(a) * 40, y + Math.cos(a) * 40);
      c.fillStyle = "#3a3024";
      c.fillRect(-1.5, -26, 3, 28);
      c.fillStyle = "#f3efe6";
      c.fillRect(1.5, -26, 18, 6);
      c.fillStyle = "#c62f2a";
      c.fillRect(1.5, -20, 18, 6);
      c.restore();
      // Road arrows, faint, so the route reads at a glance.
      for (const path of g.paths) {
        for (let dd = 90; dd < path.len - 60; dd += 150) {
          const [ax, ay, aa] = path.at(dd);
          if (ax < 10 || ax > BK.W - 10 || ay < 10 || ay > BK.H - 10) continue;
          c.save();
          c.translate(ax, ay);
          c.rotate(aa);
          c.fillStyle = "rgba(245,230,190,0.32)";
          c.beginPath();
          c.moveTo(8, 0); c.lineTo(-4, -6); c.lineTo(-1, 0); c.lineTo(-4, 6);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
    }

    drawPropShadow(c, pr) {
      const s = 80 * pr.s;
      const h = pr.kind === "hay" ? 6 : 16;
      c.save();
      c.globalAlpha = this.sun.a * 0.9;
      c.fillStyle = "#000";
      c.filter = "blur(3px)";
      c.beginPath();
      c.ellipse(pr.x + this.sun.x * h, pr.y + this.sun.y * h, s * 0.4, s * 0.34, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    drawProp(c, pr) {
      const im = this.img["prop-" + pr.kind];
      if (!im) return;
      const s = 80 * pr.s;
      c.save();
      c.translate(pr.x, pr.y);
      c.rotate(pr.rot);
      c.drawImage(im, -s / 2, -s / 2, s, s);
      c.restore();
    }
    // Trees are drawn every frame over the units, so their shadows come from a cache.
    treeShadows() {
      if (this.treeShadowCv) return this.treeShadowCv;
      const cv = (this.treeShadowCv = document.createElement("canvas"));
      cv.width = BK.W; cv.height = BK.H;
      const c = cv.getContext("2d");
      for (const pr of this.g.props) if (pr.kind === "tree" || pr.kind === "pine") this.drawPropShadow(c, pr);
      return cv;
    }

    // ------------------------------------------------------------ events
    handle(ev) {
      const fx = this.fx, g = this.g;
      // The battle behind the title screen plays without sound.
      const au = this.quiet ? BK.Audio.silent : BK.Audio;
      switch (ev.type) {
        case "shot": {
          const big = ev.gun === "at37" || ev.gun === "f75" || ev.gun === "atr";
          fx.muzzle(ev.x, ev.y, ev.ang, big || ev.gun === "aa");
          if (ev.gun === "mg") { if (R() < 0.5) fx.casing(ev.x, ev.y, ev.ang); }
          if (ev.gun === "f75") { fx.dust(ev.x - Math.cos(ev.ang) * 10, ev.y - Math.sin(ev.ang) * 10, 6, 14); fx.shake(0.08); }
          if (ev.gun === "mortar") fx.add({ kind: "smoke", x: ev.x, y: ev.y, vy: -20, life: 1, size: 8, grow: 18, a: 0.5 });
          au.shot(ev.gun, ev.manned);
          break;
        }
        case "eshot":
          fx.muzzle(ev.x, ev.y, ev.ang, true);
          au.shot("enemy", false);
          break;
        case "tracer":
          if (ev.kind === "pierce") fx.tracer(ev.x, ev.y, ev.tx, ev.ty, "255,240,200", 2.2);
          else fx.tracer(ev.x, ev.y, ev.tx, ev.ty, "255,200,120", 1.2);
          break;
        case "etracer":
          fx.tracer(ev.x, ev.y, ev.tx, ev.ty, "255,120,90", 1.3);
          if (R() < 0.3) fx.sparks(ev.tx, ev.ty, 2, "255,180,120", 80);
          au.enemyMg();
          break;
        case "hit":
          if (ev.kind === "bullet") fx.sparks(ev.x + R.range(-4, 4), ev.y + R.range(-4, 4), ev.crit ? 6 : 2, ev.crit ? "255,230,120" : "255,200,130", 120);
          else if (ev.kind === "flak") fx.flakBurst(ev.x + R.range(-6, 6), ev.y + R.range(-6, 6));
          else fx.sparks(ev.x, ev.y, ev.crit ? 12 : 5, "255,220,140", 200);
          if (ev.crit) au.crit();
          else if (ev.kind !== "bullet" && ev.kind !== "flak") au.clang();
          break;
        case "miss":
          if (ev.kind === "flak") fx.flakBurst(ev.x, ev.y);
          else fx.dust(ev.x, ev.y, ev.kind === "bullet" ? 1 : 4, 4);
          break;
        case "dmg": {
          if (ev.n < 1 || this.quiet) break;
          if (ev.foot && !ev.explosive && BK.gore) fx.blood(ev.x, ev.y, 3, 0.8);
          // Hits on the same unit add into one number that bumps, instead of a stack of numbers.
          const prev = ev.id != null && this.dmgTexts[ev.id];
          if (prev && prev.age < 0.5 && fx.texts.includes(prev) && (!ev.label || ev.label === prev.label)) {
            prev.total += ev.n;
            prev.str = (prev.label ? prev.label + " " : "") + Math.round(prev.total);
            prev.age = Math.min(prev.age, 0.05);
            prev.size = Math.min(30, prev.base + prev.total / 30);
            if (ev.crit && !prev.crit) { prev.crit = true; prev.color = "#ffd84d"; }
            prev.pop = 1.25;
            break;
          }
          const n = Math.round(ev.n);
          let t;
          if (ev.crit) {
            t = fx.text(ev.x, ev.y - 22, (ev.label ? ev.label + " " : "") + n, "#ffd84d", Math.min(30, 16 + n / 25), { pop: 1.4, life: 1.1 });
          } else {
            t = fx.text(ev.x, ev.y - 18, String(n), "#f4efe2", Math.min(22, 12 + n / 30), { life: 0.8 });
          }
          if (t && ev.id != null) { t.total = ev.n; t.label = ev.label; t.crit = ev.crit; t.base = t.size; this.dmgTexts[ev.id] = t; }
          break;
        }
        case "explosion":
          fx.explosion(ev.x, ev.y, ev.r, ev.size, { bomb: ev.bomb });
          this.scareBirds(ev.x, ev.y);
          fx.shake(Math.min(0.5, 0.06 * ev.size));
          au.boom(ev.size);
          break;
        case "kill":
          this.onKill(ev);
          break;
        case "leak":
          fx.red = 1;
          fx.shake(0.45);
          fx.text(BK.clamp(ev.x, 60, BK.W - 60), BK.clamp(ev.y, 40, BK.H - 40), "-" + ev.n + " GARRISON", "#ff5a4f", 22, { life: 1.4, pop: 1.3 });
          au.leak();
          break;
        case "text":
          fx.text(ev.x, ev.y - 14, ev.str, ev.color, ev.size, { life: 1.3, pop: 1.5, vy: -26 });
          break;
        case "shake":
          fx.shake(ev.n);
          if (ev.n >= 0.6) fx.punch = 1;
          break;
        case "towerHit":
          fx.sparks(ev.x, ev.y, 6, "255,150,90", 120);
          break;
        case "towerKO":
          fx.explosion(ev.x, ev.y, 26, 0.8);
          this.burners.push({ x: ev.x, y: ev.y, t: 4, big: false });
          au.boom(1);
          break;
        case "siren":
          au.siren();
          break;
        case "whistle":
          au.whistle();
          break;
        case "smokePop":
          for (let i = 0; i < 14; i++) fx.add({ kind: "whiteSmoke", x: ev.x + R.range(-20, 20), y: ev.y + R.range(-20, 20), vx: R.range(-40, 40), vy: R.range(-40, 40), life: 1.5, size: 16, grow: 30, a: 0.9, drag: 0.9 });
          au.pop();
          break;
        case "crateDrop":
          au.plane();
          break;
        case "crateOpen":
          au.reel();
          break;
        case "cratePrize":
          fx.text(ev.x, ev.y - 30, ev.label, ev.jackpot ? "#ffd84d" : "#fff1c9", ev.jackpot ? 34 : 22, { pop: 1.8, life: 1.8, vy: -24 });
          fx.sparks(ev.x, ev.y, ev.jackpot ? 60 : 20, "255,215,90", 260);
          if (ev.jackpot) { fx.flash = 1; fx.shake(0.5); au.jackpot(); } else au.prize();
          break;
        case "cash":
          if (ev.x != null) fx.text(ev.x, ev.y - 10, "+" + ev.amount + " zł", "#ffd84d", 18, { life: 1.2 });
          au.coin(4);
          break;
        case "build":
          fx.dust(ev.x, ev.y, 10, 16);
          au.build();
          break;
        case "upgrade":
          fx.sparks(ev.x, ev.y, 24, "255,215,90", 200);
          fx.rings.push({ x: ev.x, y: ev.y, r: 10, max: 46, life: 0.4, age: 0, w: 3 });
          au.upgrade();
          break;
        case "sell":
          fx.dust(ev.x, ev.y, 8, 14);
          au.coin(2);
          break;
        case "man":
          au.ui("man");
          break;
        case "arty":
        case "fighter":
          au.radio();
          if (ev.type === "fighter") setTimeout(() => au.plane(true), 300);
          break;
        case "mines":
          au.build();
          break;
        case "bossDown":
          fx.flash = 0.8;
          fx.punch = 1;
          au.bossDown();
          break;
        case "strafe":
          fx.dust(ev.x, ev.y, 1, 3);
          fx.sparks(ev.x, ev.y, 2, "255,210,120", 90);
          if (R() < 0.4) au.shot("mg", false, 0.4);
          break;
      }
      if (this.ui && !this.quiet) this.ui.onEvent(ev);
    }

    onKill(ev) {
      const fx = this.fx, au = this.quiet ? BK.Audio.silent : BK.Audio, def = BK.ENEMIES[ev.kind];
      if (ev.air) {
        this.falling.push({ kind: ev.kind, x: ev.x, y: ev.y, ang: ev.ang, alt: ev.alt, t: 0, T: 1.3, spin: R.range(-3, 3), vx: Math.cos(ev.ang) * 140, vy: Math.sin(ev.ang) * 140 });
        fx.explosion(ev.x, ev.y, 22, 0.7);
        au.boom(0.8);
      } else if (def.kind === "foot") {
        fx.dust(ev.x, ev.y, 3, 5);
        if (ev.explosive) {
          // Thrown by the blast before he lands.
          fx.blood(ev.x, ev.y, 14, 1.6);
          const a = R() * Math.PI * 2, d = R.range(10, 24);
          setTimeout(() => fx.corpse(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d, a, ev.kind === "officer", true), 120);
        } else {
          fx.blood(ev.x, ev.y, 8, 1.1);
          fx.corpse(ev.x, ev.y, ev.ang + Math.PI, ev.kind === "officer", false);
        }
        au.thud();
      } else {
        const e = { kind: ev.kind, x: ev.x, y: ev.y, ang: ev.ang, seed: 2, dist: 0, turrets: def.turrets && def.turrets.map((t) => Object.assign({}, t, { dead: true })), antennaDown: true };
        fx.wreck(e);
        this.burners.push({ x: ev.x, y: ev.y, t: ev.boss ? 9 : def.L > 50 ? 6 : 4, big: def.L > 40 });
      }
      // Coins burst out and fly to the purse.
      const n = Math.min(9, 1 + Math.floor(ev.coins / 5));
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, s = R.range(60, 150);
        this.coins.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, delay: 0.35 + i * 0.04, v: i === 0 ? ev.coins : 0 });
      }
      if (ev.coins >= 4 || ev.crit) fx.text(ev.x + 14, ev.y - 4, "+" + ev.coins, "#ffd84d", 14, { life: 0.8, vy: -30 });
    }

    // ------------------------------------------------------------ frame
    update(dt) {
      this.time += dt;
      const g = this.g;
      for (const ev of g.events) this.handle(ev);
      g.events.length = 0;
      this.fx.update(dt * (g.timeScale < 0.9 ? 0.6 : 1));
      for (const b of this.burners) {
        b.t -= dt;
        b.acc = (b.acc || 0) + dt * (b.big ? 14 : 8);
        while (b.acc >= 1) { b.acc--; this.fx.burn(b.x + R.range(-6, 6), b.y + R.range(-6, 6), b.big && b.t > 2); }
      }
      this.burners = this.burners.filter((b) => b.t > 0);
      for (const f of this.falling) {
        f.t += dt;
        f.x += f.vx * dt; f.y += f.vy * dt + 30 * dt;
        f.ang += f.spin * dt;
        f.alt = Math.max(0, f.alt - dt * 0.9);
        if (R() < 0.5) this.fx.add({ kind: "smoke", x: f.x, y: f.y, life: 1.2, size: 6, grow: 14, a: 0.55, drag: 0.96 });
        if (R() < 0.6) this.fx.add({ kind: "fire", x: f.x, y: f.y, life: 0.3, size: 7, grow: 4, blend: true });
        if (f.t >= f.T) {
          f.done = true;
          this.fx.explosion(f.x, f.y + 20, 44, 1.4);
          this.fx.shake(0.35);
          if (!this.quiet) BK.Audio.boom(1.4);
          this.burners.push({ x: f.x, y: f.y + 20, t: 5, big: true });
        }
      }
      this.falling = this.falling.filter((f) => !f.done);
      const tgt = this.coinTarget;
      for (const k of this.coins) {
        k.t += dt;
        if (k.t < k.delay) {
          k.vx *= 0.92; k.vy = k.vy * 0.92 + 300 * dt;
          k.x += k.vx * dt; k.y += k.vy * dt;
        } else {
          const dx = tgt.x - k.x, dy = tgt.y - k.y, d = Math.hypot(dx, dy);
          const sp = 900 + (k.t - k.delay) * 1800;
          if (d < sp * dt + 6) {
            k.done = true;
            if (this.onCoin) this.onCoin(k.v);
            continue;
          }
          k.x += (dx / d) * sp * dt;
          k.y += (dy / d) * sp * dt;
        }
      }
      this.coins = this.coins.filter((k) => !k.done);
      for (const cl of this.clouds) { cl.x += cl.v * dt; if (cl.x - cl.s > BK.W) cl.x = -cl.s; }
      this.updateAmbient(dt);
    }

    draw(view) {
      const c = this.c, g = this.g, fx = this.fx;
      const dpr = this.dpr || 1;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = fx.camera();
      c.save();
      c.translate(BK.W / 2 + cam.x, BK.H / 2 + cam.y);
      c.rotate(cam.rot);
      c.scale(cam.zoom, cam.zoom);
      // Behind the title, the camera drifts slowly over the battle.
      if (this.quiet) {
        const t = this.time * 0.03;
        c.scale(1.14, 1.14);
        c.translate(Math.sin(t) * 40, Math.cos(t * 0.7) * 22);
      }
      c.translate(-BK.W / 2, -BK.H / 2);

      c.drawImage(this.ground, 0, 0);
      c.drawImage(fx.decal, 0, 0);
      fx.drawLow(c);

      // Burning fuel and smoke screens.
      for (const z of g.zones) {
        if (z.kind === "fire") {
          const k = z.t / z.max;
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = 0.35 * k;
          c.drawImage(fx.S.glow, z.x - z.r * 1.4, z.y - z.r * 1.4, z.r * 2.8, z.r * 2.8);
          c.globalCompositeOperation = "source-over";
          c.globalAlpha = 1;
          if (R() < 0.35) fx.burn(z.x + R.range(-z.r, z.r) * 0.7, z.y + R.range(-z.r, z.r) * 0.7, false);
        }
      }
      for (const m of g.mines) {
        c.beginPath();
        c.arc(m.x, m.y, 5, 0, Math.PI * 2);
        c.fillStyle = "#3a3a30";
        c.fill();
        c.fillStyle = Math.sin(this.time * 6) > 0 ? "#ffcf4a" : "#6b5a20";
        c.beginPath();
        c.arc(m.x, m.y, 1.8, 0, Math.PI * 2);
        c.fill();
      }

      const crewT = g.crewTower();
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
      const showWeak = !!crewT || (view && view.showWeak);

      // Shadows under everything that stands on the ground, cast away from the sun.
      c.drawImage(this.treeShadows(), 0, 0);
      for (const t of g.towers) A.gunShadow(c, t, this.sun);
      for (const e of g.enemies) if (!e.air && !e.gone) A.shadow(c, e, this.sun);

      // Ground units.
      for (const e of g.enemies) {
        if (e.air || e.gone) continue;
        c.save();
        c.translate(e.x, e.y);
        c.rotate(e.ang);
        const aim = this.turretAim(e);
        const o = { weak: showWeak && e.def.weak, pulse, aim, showTracks: !!crewT };
        A.enemyFast(c, e, o);
        if (e.flash > 0) {
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = Math.min(1, e.flash * 9);
          A.enemyFast(c, e, {});
          c.globalCompositeOperation = "source-over";
          c.globalAlpha = 1;
        }
        c.restore();
        if (e.hp < e.maxHp * 0.5 && e.def.kind !== "foot" && R() < (e.hp < e.maxHp * 0.25 ? 0.25 : 0.1)) fx.burn(e.x + R.range(-6, 6), e.y + R.range(-6, 6), e.hp < e.maxHp * 0.25);
        if (e.burnT > 0 && R() < 0.25) fx.burn(e.x, e.y, false);
        this.drawStatus(c, e);
      }

      // Guns.
      for (const t of g.towers) {
        if (view && view.selected === t.id) this.rangeRing(c, t.x, t.y, g.towerStats(t).range, "rgba(255,230,160,0.9)", g.towerStats(t).minRange);
        if (t.manned) {
          c.save();
          c.beginPath();
          c.arc(t.x, t.y, 32 + pulse * 2, 0, Math.PI * 2);
          c.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * pulse})`;
          c.lineWidth = 2.5;
          c.stroke();
          c.restore();
        }
        A.gun(c, t);
        if (t.flash > 0) {
          c.beginPath();
          c.arc(t.x, t.y, 26, 0, Math.PI * 2);
          c.fillStyle = `rgba(255,80,60,${t.flash * 3})`;
          c.fill();
        }
        this.drawGunBadges(c, t);
        if (t.ko > 0 && R() < 0.3) fx.add({ kind: "smoke", x: t.x + R.range(-6, 6), y: t.y, vy: -25, life: 1.4, size: 6, grow: 14, a: 0.6 });
      }

      // Rounds in flight.
      for (const p of g.projectiles) this.drawProjectile(c, p);

      // Trees over the ground units.
      for (const pr of g.props) if (pr.kind === "tree" || pr.kind === "pine") this.drawProp(c, pr);
      this.drawBirds(c);

      fx.drawHigh(c);

      // Smoke screens sit over everything on the ground.
      for (const z of g.zones) {
        if (z.kind !== "smoke") continue;
        const k = Math.min(1, z.t / 1.5) * Math.min(1, (z.max - z.t) / 0.6 + 0.3);
        const rr = BK.makeRng(Math.round(z.x * 7 + z.y));
        for (let i = 0; i < 12; i++) {
          const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * z.r * 0.8;
          const s = z.r * rr.range(0.45, 0.75) + Math.sin(this.time + i) * 3;
          c.globalAlpha = 0.72 * k;
          c.drawImage(fx.S.whiteSmoke, z.x + Math.cos(a + this.time * 0.05) * d - s, z.y + Math.sin(a + this.time * 0.05) * d - s, s * 2, s * 2);
        }
        c.globalAlpha = 1;
      }

      // Crates.
      for (const cr of g.crates) this.drawCrate(c, cr);

      // Aircraft shadows, then aircraft.
      for (const e of g.enemies) if (e.air && !e.gone) A.airShadow(c, e, this.sun);
      for (const f of this.falling) A.airShadow(c, Object.assign({ alt: f.alt }, f), this.sun);
      for (const e of g.enemies) {
        if (!e.air || e.gone) continue;
        c.save();
        c.translate(e.x, e.y);
        c.rotate(e.ang);
        A.enemy(c, e, { weak: showWeak, pulse });
        if (e.flash > 0) {
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = Math.min(1, e.flash * 9);
          A.enemy(c, e, {});
          c.globalCompositeOperation = "source-over";
          c.globalAlpha = 1;
        }
        c.restore();
        this.drawStatus(c, e);
      }
      for (const f of this.falling) {
        c.save();
        c.translate(f.x, f.y);
        c.rotate(f.ang);
        c.scale(0.6 + f.alt * 0.4, 0.6 + f.alt * 0.4);
        A.enemy(c, { kind: f.kind, t: this.time, alt: f.alt, seed: 1, dist: 0 }, {});
        c.globalCompositeOperation = "source-atop";
        c.restore();
      }
      for (const p of g.projectiles) if (p.type === "bomb") this.drawBomb(c, p);
      for (const f of g.fighters) A.p11(c, f.x, f.y, f.ang, this.time);
      for (const s of g.strikes) this.drawStrike(c, s);

      // Coins in flight.
      for (const k of this.coins) {
        c.save();
        c.translate(k.x, k.y);
        const sx = Math.abs(Math.cos(this.time * 12 + k.delay * 40));
        c.scale(0.4 + sx * 0.6, 1);
        c.beginPath();
        c.arc(0, 0, 5, 0, Math.PI * 2);
        c.fillStyle = "#f2c64a";
        c.fill();
        c.strokeStyle = "#8a6414";
        c.lineWidth = 1.2;
        c.stroke();
        c.restore();
      }

      // Planning overlays from the UI.
      if (view) this.drawOverlay(c, view);

      fx.drawTexts(c);
      c.restore();

      // Light and grade.
      c.globalCompositeOperation = "multiply";
      c.drawImage(this.gradeMul, 0, 0);
      c.globalAlpha = 0.12;
      for (const cl of this.clouds) c.drawImage(fx.S.smoke, cl.x - cl.s, cl.y - cl.s * 0.6, cl.s * 2, cl.s * 1.2);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
      if (fx.red > 0) {
        const rg = c.createRadialGradient(BK.W / 2, BK.H / 2, BK.H * 0.3, BK.W / 2, BK.H / 2, BK.W * 0.7);
        rg.addColorStop(0, "rgba(160,0,0,0)");
        rg.addColorStop(1, `rgba(170,10,10,${0.55 * fx.red})`);
        c.fillStyle = rg;
        c.fillRect(0, 0, BK.W, BK.H);
      }
      if (fx.flash > 0) {
        c.fillStyle = `rgba(255,245,220,${0.35 * fx.flash})`;
        c.fillRect(0, 0, BK.W, BK.H);
      }
      if (g.buffs.frenzy > 0) {
        c.strokeStyle = `rgba(255,170,60,${0.35 + 0.2 * pulse})`;
        c.lineWidth = 10;
        c.strokeRect(5, 5, BK.W - 10, BK.H - 10);
      }
    }

    // Turrets swing toward the nearest gun. Shooters use the sim's aim, the rest just watch.
    turretAim(e) {
      if (e.aimAng != null) return BK.wrapAng(e.aimAng - e.ang);
      if (e.kind !== "ltank" && e.kind !== "smoke" && e.kind !== "armcar") return 0;
      let best = null, bd = 260 * 260;
      for (const t of this.g.towers) {
        const d = (t.x - e.x) * (t.x - e.x) + (t.y - e.y) * (t.y - e.y);
        if (d < bd) { bd = d; best = t; }
      }
      const want = best ? BK.wrapAng(Math.atan2(best.y - e.y, best.x - e.x) - e.ang) : 0;
      const cur = this.aims[e.id] || 0;
      const next = cur + BK.clamp(BK.wrapAng(want - cur), -0.04, 0.04);
      this.aims[e.id] = next;
      return next;
    }

    updateAmbient(dt) {
      const g = this.g, fx = this.fx;
      if (!dt) return;
      // Dust behind anything with wheels or tracks, and treads pressed into the road.
      for (const e of g.enemies) {
        if (e.air || e.gone || e.def.kind === "foot" || e.moving === false) continue;
        const back = (e.def.L || 20) * 0.5;
        const bx = e.x - Math.cos(e.ang) * back, by = e.y - Math.sin(e.ang) * back;
        e.dustAcc = (e.dustAcc || 0) + dt * (e.def.kind === "wheel" ? 5 : 3.5) * (e.speed / 40);
        while (e.dustAcc >= 1) {
          e.dustAcc--;
          fx.add({ kind: "dust", x: bx + R.range(-6, 6), y: by + R.range(-6, 6), vx: -Math.cos(e.ang) * 20 + R.range(-8, 8), vy: -Math.sin(e.ang) * 20 + R.range(-8, 8), life: R.range(0.7, 1.2), size: R.range(7, 11), grow: 18, a: 0.5, drag: 0.94 });
        }
        if (e.def.kind === "track" || e.def.kind === "half") {
          if (e.lastTread == null || Math.abs(e.dist - e.lastTread) > 7) {
            e.lastTread = e.dist;
            fx.treads(e.x, e.y, e.ang, e.def.Wd * 0.82);
          }
        }
      }
      // The burning farmhouse never stops smoking.
      for (const f of this.fires) {
        f.acc = (f.acc || 0) + dt * 6;
        while (f.acc >= 1) {
          f.acc--;
          fx.add({ kind: "smoke", x: f.x + R.range(-8, 8), y: f.y + R.range(-6, 6), vx: R.range(-6, 6), vy: R.range(-24, -10), life: R.range(2.5, 4), size: R.range(8, 14), grow: 22, a: 0.55, drag: 0.98 });
          if (R() < 0.6) fx.add({ kind: "fire", x: f.x + R.range(-9, 9), y: f.y + R.range(-6, 6), vx: R.range(-5, 5), vy: R.range(-20, -8), life: R.range(0.3, 0.6), size: R.range(6, 10), grow: 6, blend: true });
          if (R() < 0.25) fx.add({ kind: "ember", x: f.x, y: f.y, vx: R.range(-20, 20), vy: R.range(-40, -15), life: R.range(1, 2), size: 2, drag: 0.98, flick: R() * 9 });
        }
      }
      // Flocks of crows cross now and then and scatter from blasts.
      this.birdT -= dt;
      if (this.birdT <= 0) {
        this.birdT = R.range(18, 34);
        const fromLeft = R() < 0.5, y0 = R.range(60, 520);
        const ang = (fromLeft ? 0 : Math.PI) + R.range(-0.3, 0.3);
        const n = R.int(5, 9);
        for (let i = 0; i < n; i++) {
          this.birds.push({ x: (fromLeft ? -40 : BK.W + 40) - Math.cos(ang) * i * 14 + R.range(-10, 10), y: y0 + R.range(-26, 26), ang, sp: R.range(70, 90), flap: R() * 6, alt: R.range(0.5, 1) });
        }
      }
      for (const b of this.birds) {
        b.flap += dt * 14;
        b.x += Math.cos(b.ang) * b.sp * dt;
        b.y += Math.sin(b.ang) * b.sp * dt;
        if (b.scare > 0) { b.scare -= dt; b.sp = Math.min(220, b.sp + dt * 300); }
      }
      this.birds = this.birds.filter((b) => b.x > -80 && b.x < BK.W + 80 && b.y > -80 && b.y < BK.H + 80);
    }
    scareBirds(x, y) {
      for (const b of this.birds) {
        if ((b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) < 200 * 200) {
          b.ang = Math.atan2(b.y - y, b.x - x) + R.range(-0.5, 0.5);
          b.scare = 1;
        }
      }
    }
    drawBirds(c) {
      for (const b of this.birds) {
        const w = Math.sin(b.flap) * 4;
        const off = 30 * b.alt;
        c.save();
        c.translate(b.x + this.sun.x * off, b.y + this.sun.y * off);
        c.rotate(b.ang);
        c.globalAlpha = 0.18;
        c.fillStyle = "#000";
        c.fillRect(-2, -5, 3, 10);
        c.restore();
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.ang);
        c.strokeStyle = "#16130f";
        c.lineWidth = 1.6;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(-1, -6 - w * 0.4); c.lineTo(1, -1); c.lineTo(3, 0); c.lineTo(1, 1); c.lineTo(-1, 6 + w * 0.4);
        c.stroke();
        c.restore();
      }
    }

    rangeRing(c, x, y, r, col, minR) {
      c.save();
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = "rgba(255,240,200,0.07)";
      c.fill();
      c.setLineDash([6, 5]);
      c.lineDashOffset = -this.time * 12;
      c.strokeStyle = col;
      c.lineWidth = 1.5;
      c.stroke();
      if (minR) {
        c.beginPath();
        c.arc(x, y, minR, 0, Math.PI * 2);
        c.strokeStyle = "rgba(255,120,90,0.7)";
        c.stroke();
      }
      c.restore();
    }

    drawStatus(c, e) {
      const def = e.def;
      const w = def.kind === "foot" ? 18 : def.air ? 40 : Math.max(26, def.L * 0.6);
      const y = e.y - (def.kind === "foot" ? 17 : def.air ? 38 : def.Wd * 0.72 + 5);
      if (e.hp < e.maxHp && !e.boss) {
        c.fillStyle = "rgba(10,10,8,0.7)";
        c.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 4);
        const k = Math.max(0, e.hp / e.maxHp);
        c.fillStyle = k > 0.5 ? "#b9d77a" : k > 0.25 ? "#f0c24a" : "#e8553f";
        c.fillRect(e.x - w / 2, y, w * k, 2);
        if (e.armor > 0.3) {
          c.fillStyle = "rgba(180,200,220,0.9)";
          c.fillRect(e.x - w / 2, y + 3, w * e.armor, 1);
        }
      }
      if (e.panicT > 0 || e.stunT > 0 || e.trackedT > 0) {
        c.font = "700 12px Oswald, sans-serif";
        c.textAlign = "center";
        c.fillStyle = "#ffd84d";
        c.strokeStyle = "rgba(0,0,0,0.8)";
        c.lineWidth = 3;
        const s = e.panicT > 0 ? "!" : e.trackedT > 0 ? "TRACKED" : "STUNNED";
        c.strokeText(s, e.x, y - 7);
        c.fillText(s, e.x, y - 7);
      }
      if (e.kind === "officer") {
        c.fillStyle = "#ffd84d";
        c.beginPath();
        c.moveTo(e.x - 4, y - 2); c.lineTo(e.x, y - 6); c.lineTo(e.x + 4, y - 2);
        c.lineWidth = 2;
        c.strokeStyle = "#ffd84d";
        c.stroke();
      }
      if (e.ambush) {
        c.fillStyle = "rgba(255,90,79,0.9)";
        c.beginPath();
        c.arc(e.x + w / 2 + 5, y + 1, 3, 0, Math.PI * 2);
        c.fill();
      }
    }

    drawGunBadges(c, t) {
      const y = t.y + 31;
      for (let i = 0; i < t.level; i++) {
        const x = t.x - (t.level - 1) * 5 + i * 10;
        c.beginPath();
        c.moveTo(x - 4, y); c.lineTo(x, y - 3); c.lineTo(x + 4, y);
        c.strokeStyle = "rgba(0,0,0,0.8)";
        c.lineWidth = 4;
        c.stroke();
        c.strokeStyle = "#ffd84d";
        c.lineWidth = 2;
        c.stroke();
      }
      if (t.spec) {
        c.fillStyle = "#ffd84d";
        c.strokeStyle = "rgba(0,0,0,0.8)";
        c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.4 : 5.5;
          c.lineTo(t.x + Math.cos(a) * r, y + 8 + Math.sin(a) * r);
        }
        c.closePath();
        c.stroke();
        c.fill();
      }
      if (t.hp < t.maxHp && t.ko <= 0) {
        c.fillStyle = "rgba(0,0,0,0.6)";
        c.fillRect(t.x - 18, t.y - 34, 36, 5);
        c.fillStyle = t.hp / t.maxHp > 0.4 ? "#9fe870" : "#ff5a4f";
        c.fillRect(t.x - 17, t.y - 33, 34 * (t.hp / t.maxHp), 3);
      }
      if (t.ko > 0 && t.ko < 100) {
        c.save();
        c.beginPath();
        c.arc(t.x, t.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t.ko / 7));
        c.strokeStyle = "#9fe870";
        c.lineWidth = 3;
        c.stroke();
        c.restore();
      }
    }

    drawProjectile(c, p) {
      const k = Math.min(1, p.t / p.T);
      const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      if (p.type === "bullet") {
        c.strokeStyle = "rgba(255,225,140,0.95)";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12);
        c.stroke();
      } else if (p.type === "shell" || p.type === "flak" || p.type === "eshell") {
        const col = p.type === "eshell" ? "255,110,80" : "255,220,150";
        c.strokeStyle = `rgba(${col},0.55)`;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - Math.cos(a) * 22, p.y - Math.sin(a) * 22);
        c.stroke();
        c.fillStyle = `rgba(${col},1)`;
        c.beginPath();
        c.arc(p.x, p.y, p.gun === "f75" ? 3 : 2.2, 0, Math.PI * 2);
        c.fill();
      } else if (p.type === "lob") {
        const h = Math.sin(Math.PI * k) * 90;
        const s = 1 + Math.sin(Math.PI * k) * 0.8;
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.beginPath();
        c.ellipse(p.x, p.y, 3, 2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#2a2a24";
        c.beginPath();
        c.ellipse(p.x, p.y - h, 2.6 * s, 2 * s, a, 0, Math.PI * 2);
        c.fill();
        if (k > 0.6) {
          c.strokeStyle = `rgba(255,90,60,${(k - 0.6) * 1.5})`;
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(p.tx, p.ty, 10 * (1 - k) + 6, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }

    drawBomb(c, p) {
      const k = p.t / p.T;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.atan2(p.vy, p.vx));
      const s = 1.4 - k * 0.6;
      c.scale(s, s);
      c.fillStyle = "#2a2b26";
      A.rr(c, -6, -2.2, 12, 4.4, 2);
      c.fill();
      c.fillRect(-8, -3, 2, 6);
      c.restore();
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath();
      c.arc(p.x + (1 - k) * 25, p.y + (1 - k) * 40, 3, 0, Math.PI * 2);
      c.fill();
    }

    drawStrike(c, s) {
      const k = BK.clamp(s.t / 1.1, 0, 1);
      c.save();
      c.strokeStyle = s.enemy ? `rgba(255,80,60,${0.8 - k * 0.5})` : `rgba(255,214,90,${0.8 - k * 0.5})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(s.x, s.y, 8 + k * 30, 0, Math.PI * 2);
      c.stroke();
      if (s.t < 0.3) {
        const h = s.t * 900;
        c.strokeStyle = "rgba(255,240,200,0.8)";
        c.beginPath();
        c.moveTo(s.x + h * 0.2, s.y - h);
        c.lineTo(s.x + h * 0.2 + 4, s.y - h - 26);
        c.stroke();
      }
      c.restore();
    }

    drawCrate(c, cr) {
      c.save();
      c.translate(cr.x, cr.y);
      c.scale(1.3, 1.3);
      c.translate(-cr.x, -cr.y);
      this.drawCrateInner(c, cr);
      c.restore();
    }
    drawCrateInner(c, cr) {
      const fall = Math.max(0, cr.fall);
      const h = fall * 70;
      const sway = Math.sin(this.time * 2 + cr.id) * 6 * Math.min(1, fall);
      const bob = fall > 0 ? 0 : Math.sin(this.time * 4) * 2;
      c.save();
      // shadow
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath();
      c.ellipse(cr.x + 3, cr.y + 6, 12 - fall * 2, 6, 0, 0, Math.PI * 2);
      c.fill();
      const x = cr.x + sway, y = cr.y - h + bob;
      if (fall > 0) {
        c.strokeStyle = "rgba(230,225,210,0.8)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x - 9, y - 6); c.lineTo(x - 18, y - 40);
        c.moveTo(x + 9, y - 6); c.lineTo(x + 18, y - 40);
        c.stroke();
        c.beginPath();
        c.ellipse(x, y - 42, 24, 12, 0, Math.PI, 0);
        c.fillStyle = "#e5dfc8";
        c.fill();
        c.fillStyle = "#c8312b";
        c.fillRect(x - 6, y - 54, 12, 12);
      } else {
        const blink = cr.life < 3 ? (Math.sin(this.time * 18) > 0 ? 1 : 0.35) : 1;
        c.globalAlpha = blink;
        const glow = 0.5 + 0.5 * Math.sin(this.time * 5);
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.5 * glow * blink;
        c.drawImage(this.fx.S.glow, x - 32, y - 32, 64, 64);
        c.globalCompositeOperation = "source-over";
        c.globalAlpha = blink;
      }
      A.rr(c, x - 11, y - 9, 22, 18, 2);
      c.fillStyle = cr.golden ? "#d2a83a" : "#8a6a3c";
      c.fill();
      c.strokeStyle = "#3a2a14";
      c.lineWidth = 1.5;
      c.stroke();
      c.beginPath();
      c.moveTo(x - 11, y - 9); c.lineTo(x + 11, y + 9);
      c.moveTo(x + 11, y - 9); c.lineTo(x - 11, y + 9);
      c.strokeStyle = "rgba(58,42,20,0.7)";
      c.stroke();
      c.fillStyle = "#f2efe6";
      c.fillRect(x - 4, y - 2, 8, 4);
      c.fillStyle = "#c8312b";
      c.fillRect(x - 4, y, 8, 2);
      if (fall <= 0) {
        c.font = "700 13px Oswald, sans-serif";
        c.textAlign = "center";
        c.lineWidth = 3;
        c.strokeStyle = "rgba(0,0,0,0.8)";
        c.fillStyle = "#ffd84d";
        c.strokeText("SUPPLIES", x, y - 18 + bob);
        c.fillText("SUPPLIES", x, y - 18 + bob);
      }
      c.restore();
    }

    drawOverlay(c, v) {
      const g = this.g;
      if (v.ghost) {
        const { kind, x, y } = v.ghost;
        const bad = g.canPlace(x, y, kind);
        const def = BK.GUNS[kind];
        const r = def.range * (1 + g.mods.range);
        this.rangeRing(c, x, y, r, bad ? "rgba(255,90,79,0.9)" : "rgba(160,240,120,0.95)", def.minRange);
        c.globalAlpha = 0.75;
        A.gun(c, { kind, x, y, ang: -Math.PI / 2, recoil: 0, ko: 0, level: 1 });
        c.globalAlpha = 1;
        if (bad) {
          c.strokeStyle = "rgba(255,90,79,0.95)";
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(x - 10, y - 10); c.lineTo(x + 10, y + 10);
          c.moveTo(x + 10, y - 10); c.lineTo(x - 10, y + 10);
          c.stroke();
        }
      }
      if (v.ability && v.pointer) {
        const { x, y } = v.pointer;
        if (v.ability === "arty") {
          c.strokeStyle = "rgba(255,214,90,0.9)";
          c.setLineDash([5, 4]);
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, 64, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
        } else if (v.ability === "fighter") {
          let ang = 0, best = Infinity;
          for (const p of g.paths) for (let dd = 0; dd < p.len; dd += 12) {
            const [px, py, a] = p.at(dd);
            const d2 = (px - x) * (px - x) + (py - y) * (py - y);
            if (d2 < best) { best = d2; ang = a; }
          }
          c.strokeStyle = "rgba(255,214,90,0.8)";
          c.lineWidth = 28;
          c.globalAlpha = 0.25;
          c.beginPath();
          c.moveTo(x - Math.cos(ang) * 300, y - Math.sin(ang) * 300);
          c.lineTo(x + Math.cos(ang) * 300, y + Math.sin(ang) * 300);
          c.stroke();
          c.globalAlpha = 1;
        } else if (v.ability === "mines") {
          c.strokeStyle = "rgba(255,214,90,0.9)";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, 30, 0, Math.PI * 2);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.moveTo(x, y - 8); c.lineTo(x, y + 8);
        c.stroke();
      }
      const ct = g.crewTower();
      if (ct) {
        const s = g.towerStats(ct);
        this.rangeRing(c, ct.x, ct.y, s.range, "rgba(255,214,90,0.6)", s.minRange);
        const { x, y } = g.aim;
        c.strokeStyle = "rgba(255,214,90,0.25)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(ct.x, ct.y);
        c.lineTo(x, y);
        c.stroke();
        // Crosshair with a reload arc.
        const reload = BK.clamp(1 - ct.cd * s.rate, 0, 1);
        c.save();
        c.translate(x, y);
        c.strokeStyle = "rgba(0,0,0,0.7)";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(0, 0, 13, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = reload >= 1 ? "#ffd84d" : "rgba(255,255,255,0.7)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reload);
        c.stroke();
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          c.beginPath();
          c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          c.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
          c.stroke();
        }
        c.restore();
      }
    }
  }
  BK.Renderer = Renderer;
})(typeof window !== "undefined" ? window : globalThis);
