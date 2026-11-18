// Renderer for the expansion: a camera over battlefields bigger than the screen, destructible
// scenery drawn live, craters, fortifications, drops, wrecks, prisoners, cavalry, the armored
// train, weather, ambient life, attack arrows, the minimap and the big wave countdown.
(function (root) {
  const BK = root.BK;
  const R = BK.fxr;
  const A = BK.Art;
  const S = () => BK.Scenery;
  const RP = BK.Renderer.prototype;
  const W = () => BK.W, H = () => BK.H;

  const ITEM_COL = { ammo: "#e0b04a", steel: "#a9b3bd", optics: "#8fd0ff", parts: "#c99a6b", mg34: "#b6c98a", explosives: "#ff7a50", radio: "#9fe870", fuel: "#e8d06a", maps: "#f0e0b0" };

  // ------------------------------------------------------------------ setup
  const baseSetGame = RP.setGame;
  RP.setGame = function (g) {
    this.gs = Math.min(1, 3000 / (g.WW || BK.W));
    baseSetGame.call(this, g);
    this.fx = new BK.FX(g.WW, g.WH, this.gs);
    this.zMin = Math.max(BK.W / g.WW, BK.H / g.WH);
    this.zMax = 1.7;
    // Start over the town the roads run to, a little zoomed out on the bigger maps.
    let ex = 0, ey = 0;
    for (const p of g.paths) { const [x, y] = p.at(p.len - 60); ex += x; ey += y; }
    ex /= g.paths.length; ey /= g.paths.length;
    const z0 = g.WW > BK.W ? Math.max(this.zMin, 0.72) : 1;
    this.cam = { x: ex, y: ey, z: z0, tx: ex, ty: ey, tz: z0 };
    this.clampCam(true);
    this.life = BK.Life ? new BK.Life(g, this.sun) : null;
    if (this.life) this.life.onPlane = (polish) => { if (!this.quiet && BK.Audio.plane) BK.Audio.plane(polish); };
    this.rain = [];
    this.fogT = 0;
    this.spriteVer = {};
    this.arrowsFor = -1;
  };

  // ------------------------------------------------------------------ camera
  RP.clampCam = function (snap) {
    const cm = this.cam, g = this.g;
    cm.tz = BK.clamp(cm.tz, this.zMin, this.zMax);
    const hw = BK.W / (2 * cm.tz), hh = BK.H / (2 * cm.tz);
    cm.tx = g.WW <= hw * 2 ? g.WW / 2 : BK.clamp(cm.tx, hw, g.WW - hw);
    cm.ty = g.WH <= hh * 2 ? g.WH / 2 : BK.clamp(cm.ty, hh, g.WH - hh);
    if (snap) { cm.x = cm.tx; cm.y = cm.ty; cm.z = cm.tz; }
  };
  RP.panBy = function (dx, dy) {
    this.cam.tx += dx / this.cam.z;
    this.cam.ty += dy / this.cam.z;
    this.clampCam();
    this.cam.x = this.cam.tx; this.cam.y = this.cam.ty;
  };
  RP.zoomAt = function (sx, sy, f) {
    const cm = this.cam;
    const [wx, wy] = this.toWorld(sx, sy);
    cm.tz = BK.clamp(cm.tz * f, this.zMin, this.zMax);
    // Keep the point under the pointer still.
    cm.tx = wx - (sx - BK.W / 2) / cm.tz;
    cm.ty = wy - (sy - BK.H / 2) / cm.tz;
    this.clampCam();
  };
  RP.centerOn = function (x, y, snap) {
    this.cam.tx = x; this.cam.ty = y;
    this.clampCam(snap);
  };
  RP.toWorld = function (sx, sy) {
    const cm = this.cam;
    if (!cm) return [sx, sy];
    return [(sx - BK.W / 2) / cm.z + cm.x, (sy - BK.H / 2) / cm.z + cm.y];
  };
  RP.toScreen = function (wx, wy) {
    const cm = this.cam;
    if (!cm) return [wx, wy];
    return [(wx - cm.x) * cm.z + BK.W / 2, (wy - cm.y) * cm.z + BK.H / 2];
  };
  RP.viewRect = function (pad) {
    const cm = this.cam, p = pad || 0;
    const hw = BK.W / (2 * cm.z), hh = BK.H / (2 * cm.z);
    return { x0: cm.x - hw - p, y0: cm.y - hh - p, x1: cm.x + hw + p, y1: cm.y + hh + p };
  };
  RP.bigMap = function () { return this.g && (this.g.WW > BK.W + 4 || this.g.WH > BK.H + 4); };

  // ------------------------------------------------------------------ static ground
  RP.bake = function () {
    const g = this.g, map = g.map;
    const gs = this.gs || 1;
    const WW = g.WW || BK.W, WH = g.WH || BK.H;
    const cv = (this.ground = document.createElement("canvas"));
    cv.width = Math.ceil(WW * gs); cv.height = Math.ceil(WH * gs);
    const c = cv.getContext("2d");
    c.scale(gs, gs);
    if (map.procedural && g.layout) BK.Terrain.paint(c, map, g.layout, g.paths);
    else {
      c.save();
      if (map.flip) { c.translate(WW, 0); c.scale(-1, 1); }
      c.drawImage(this.img.terrain, 0, 0, WW, WH);
      c.restore();
    }
    const sc = S();
    for (const pr of g.props) if (pr.kind === "crater" || pr.kind === "stooks") sc.draw(c, pr, this.sun);
    for (const p of g.paths) this.bakeRoad(c, p);
    for (const p of g.paths) this.bakeRuts(c, p);
    for (const b of g.bridges || []) BK.Terrain.paintBridge(c, b);
    // Only the scenery nothing can knock down is baked. Buildings and trees are drawn live.
    const order = ["fence", "tks", "shrine", "well", "sweep", "bunker", "pole"];
    for (const k of order) for (const pr of g.props) if (pr.kind === k) sc.draw(c, pr, this.sun);
    this.bakeMarkers(c);

    const grade = { dawn: { mul: [[0, "rgba(255,214,170,1)"], [1, "rgba(200,190,215,1)"]], light: "rgba(255,190,120,0.16)", vig: 0.5, lx: 120, ly: 60 }, noon: { mul: [[0, "rgba(255,250,235,1)"], [1, "rgba(235,235,225,1)"]], light: "rgba(255,250,220,0.08)", vig: 0.38, lx: 640, ly: -100 }, dusk: { mul: [[0, "rgba(250,170,130,1)"], [1, "rgba(120,110,160,1)"]], light: "rgba(255,140,80,0.2)", vig: 0.62, lx: 1180, ly: 120 } }[map.time];
    const m = (this.gradeMul = document.createElement("canvas"));
    m.width = BK.W; m.height = BK.H;
    const mc = m.getContext("2d");
    const lg = mc.createLinearGradient(grade.lx, grade.ly, BK.W - grade.lx, BK.H);
    for (const [o, col] of grade.mul) lg.addColorStop(o, col);
    mc.fillStyle = lg;
    mc.fillRect(0, 0, BK.W, BK.H);
    const rg = mc.createRadialGradient(BK.W / 2, BK.H / 2, BK.H * 0.35, BK.W / 2, BK.H / 2, BK.W * 0.72);
    rg.addColorStop(0, "rgba(255,255,255,0)");
    rg.addColorStop(1, `rgba(8,6,4,${grade.vig})`);
    mc.fillStyle = rg;
    mc.fillRect(0, 0, BK.W, BK.H);
    this.vignette = m;
    this.clouds = [0, 1, 2].map(() => ({ x: R.range(0, BK.W), y: R.range(0, BK.H), s: R.range(300, 420), v: R.range(6, 12) }));
    this.bakeMini();
  };

  // Entry markers sit where each road enters the world.
  RP.bakeMarkers = function (c) {
    const g = this.g;
    for (const p of g.paths) {
      let d = 30, [x, y, a] = p.at(d);
      while (d < p.len && (x < 30 || y < 30 || x > g.WW - 30 || y > g.WH - 30)) { d += 6; [x, y, a] = p.at(d); }
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.fillStyle = "rgba(160,30,24,0.75)";
      c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -11); c.lineTo(-2, 0); c.lineTo(-6, 11); c.closePath(); c.fill();
      c.restore();
    }
  };

  // A little map of the whole field for the corner.
  RP.bakeMini = function () {
    const g = this.g;
    const mw = 220, mh = Math.round((220 * g.WH) / g.WW);
    const cv = document.createElement("canvas");
    cv.width = mw * 2; cv.height = mh * 2;
    const c = cv.getContext("2d");
    c.scale((mw * 2) / (g.WW * this.gs), (mh * 2) / (g.WH * this.gs));
    c.drawImage(this.ground, 0, 0);
    this.minimap = { cv, mw, mh, k: mw / g.WW };
  };

  // ------------------------------------------------------------------ events
  const baseHandle = RP.handle;
  RP.handle = function (ev) {
    const fx = this.fx, g = this.g;
    const au = this.quiet ? BK.Audio.silent : BK.Audio;
    const say = (str, col, size, x, y) => fx.text(x == null ? ev.x : x, (y == null ? ev.y : y) - 24, str, col, size || 18, { life: 1.6, pop: 1.5, vy: -24 });
    switch (ev.type) {
      case "leak":
        fx.red = 1;
        fx.shake(0.45);
        fx.text(ev.x, ev.y, "-" + ev.n + " GARRISON", "#ff5a4f", 22, { life: 1.4, pop: 1.3 });
        au.leak();
        if (this.ui && !this.quiet) this.ui.onEvent(ev);
        return;
      case "explosion":
        if (this.life) this.life.scare(ev.x, ev.y, ev.r);
        break;
      case "dig":
        fx.dust(ev.x, ev.y, 14, 18);
        au.build();
        break;
      case "fort":
        fx.dust(ev.x, ev.y, 10, 22);
        au.build();
        break;
      case "fortDown":
        fx.dust(ev.x, ev.y, 12, 24);
        fx.sparks(ev.x, ev.y, 6, "220,190,140", 120);
        break;
      case "drop":
        fx.sparks(ev.x, ev.y, 6, "255,230,140", 80);
        break;
      case "pickup": {
        const it = BK.ITEMS[ev.item];
        say("+ " + (it ? it.name : ev.item), ITEM_COL[ev.item] || "#fff1c9", 16);
        fx.sparks(ev.x, ev.y, 10, "255,230,140", 140);
        au.coin(3);
        break;
      }
      case "salvage": {
        const names = (ev.items || []).map((k) => (BK.ITEMS[k] ? BK.ITEMS[k].name : k));
        say("SALVAGED " + names.join(", "), "#cfe08a", 16);
        fx.sparks(ev.x, ev.y, 18, "255,200,120", 160);
        au.clang();
        break;
      }
      case "flame":
      case "eflame": {
        const ang = ev.ang != null ? ev.ang : Math.atan2(ev.ty - ev.y, ev.tx - ev.x);
        const len = ev.range || Math.hypot(ev.tx - ev.x, ev.ty - ev.y);
        for (let i = 0; i < 5; i++) {
          const a = ang + R.range(-0.2, 0.2), sp = len * R.range(1.6, 2.2);
          fx.add({ kind: "fire", x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.42, size: 5, grow: 26, blend: true, drag: 0.9 });
        }
        if (R() < 0.4) fx.add({ kind: "smoke", x: ev.x + Math.cos(ang) * len * 0.7, y: ev.y + Math.sin(ang) * len * 0.7, vy: -20, life: 1.2, size: 8, grow: 18, a: 0.5 });
        if (R() < 0.3) au.shot("flame", false, 0.5);
        break;
      }
      case "promote": {
        const rk = BK.RANKS[ev.rank];
        say((rk ? rk.name.toUpperCase() : "PROMOTED") + "!", "#ffd84d", 20);
        fx.rings.push({ x: ev.x, y: ev.y, r: 14, max: 56, life: 0.6, age: 0, w: 3 });
        fx.sparks(ev.x, ev.y, 30, "255,215,90", 220);
        au.upgrade();
        break;
      }
      case "surrender":
        say("SURRENDER!", "#f4efe2", 15);
        break;
      case "prisoner":
        say(ev.intel ? "PRISONER: INTEL" : "PRISONER +18 zł", ev.intel ? "#f0e0b0" : "#ffd84d", 15);
        au.coin(2);
        break;
      case "propDown": {
        const big = ev.kind === "house" || ev.kind === "barn" || ev.kind === "church" || ev.kind === "windmill";
        fx.explosion(ev.x, ev.y, big ? 44 : 18, big ? 1.3 : 0.5, {});
        for (let i = 0; i < (big ? 30 : 10); i++) fx.add({ kind: "debris", x: ev.x + R.range(-20, 20), y: ev.y + R.range(-20, 20), vx: R.range(-150, 150), vy: R.range(-150, 150), vz: R.range(80, 260), z: 4, life: 2, size: R.range(2, 4), grow: 0, drag: 0.97, color: big ? "#8a7a68" : "#5a4a30", stamp: true });
        for (let i = 0; i < (big ? 14 : 4); i++) fx.add({ kind: "smoke", x: ev.x + R.range(-30, 30), y: ev.y + R.range(-20, 20), vx: R.range(-20, 20), vy: R.range(-30, -8), life: R.range(2, 4), size: 14, grow: 30, a: 0.65, drag: 0.97 });
        if (big) { this.burners.push({ x: ev.x, y: ev.y, t: 14, big: true }); this.fires.push({ x: ev.x, y: ev.y, t: 40 }); fx.shake(0.4); }
        if (this.life) this.life.scare(ev.x, ev.y, 80);
        au.boom(big ? 1.4 : 0.6);
        break;
      }
      case "propHit":
        for (let i = 0; i < 8; i++) fx.add({ kind: "debris", x: ev.x + R.range(-10, 10), y: ev.y + R.range(-10, 10), vx: R.range(-90, 90), vy: R.range(-90, 90), vz: R.range(60, 160), z: 4, life: 1.6, size: 2, grow: 0, drag: 0.97, color: "#7a6a58", stamp: true });
        break;
      case "repair":
      case "sparks":
        fx.sparks(ev.x, ev.y, 4, "255,210,140", 90);
        break;
      case "train":
        say("ŚMIAŁY IS COMING", "#ffd84d", 22, this.cam.x, this.cam.y);
        au.radio();
        break;
      case "uhlans":
        au.radio();
        if (BK.Audio.charge) BK.Audio.charge();
        break;
      case "upgrade":
        if (ev.name) say(ev.name.toUpperCase(), ev.spec ? "#ffd84d" : "#fff1c9", ev.spec ? 22 : 18);
        if (ev.morph) { for (let i = 0; i < 10; i++) fx.add({ kind: "whiteSmoke", x: ev.x + R.range(-18, 18), y: ev.y + R.range(-18, 18), vx: R.range(-40, 40), vy: R.range(-40, 40), life: 0.9, size: 10, grow: 26, a: 0.6, drag: 0.9 }); }
        break;
      case "waveStart":
        this.arrowsFor = -1;
        break;
    }
    baseHandle.call(this, ev);
  };

  // Coins live in screen space so they can fly to the purse wherever the camera is.
  const baseOnKill = RP.onKill;
  RP.onKill = function (ev) {
    const n0 = this.coins.length;
    baseOnKill.call(this, ev);
    for (let i = n0; i < this.coins.length; i++) {
      const k = this.coins[i];
      [k.x, k.y] = this.toScreen(k.x, k.y);
    }
  };

  // ------------------------------------------------------------------ frame update
  const baseUpdate = RP.update;
  RP.update = function (dt) {
    const cm = this.cam;
    if (cm) {
      if (this.quiet && this.bigMap()) {
        // Over the title screen the camera tours the battlefield.
        const t = this.time * 0.04;
        cm.tx = this.g.WW * (0.5 + 0.32 * Math.sin(t));
        cm.ty = this.g.WH * (0.5 + 0.3 * Math.sin(t * 0.7 + 1));
        this.clampCam();
      }
      const k = Math.min(1, dt * 9);
      cm.x += (cm.tx - cm.x) * k;
      cm.y += (cm.ty - cm.y) * k;
      cm.z += (cm.tz - cm.z) * k;
    }
    baseUpdate.call(this, dt);
    for (const f of this.fires) if (f.t != null) f.t -= dt;
    this.fires = this.fires.filter((f) => f.t == null || f.t > 0);
    if (this.life) this.life.update(dt);
    // Weather.
    const w = this.g.weatherId;
    if (w === "rain") {
      const v = this.viewRect(40);
      for (let i = 0; i < 26; i++) this.rain.push({ x: R.range(v.x0, v.x1), y: R.range(v.y0, v.y1), t: 0, T: R.range(0.25, 0.4) });
      for (const d of this.rain) d.t += dt;
      this.rain = this.rain.filter((d) => d.t < d.T).slice(-700);
    }
    this.fogT += dt;
  };

  RP.updateAmbient = function (dt) {
    const g = this.g, fx = this.fx;
    if (!dt) return;
    const v = this.viewRect(80);
    for (const e of g.enemies) {
      if (e.air || e.gone || e.def.kind === "foot" || e.moving === false) continue;
      if (e.x < v.x0 || e.x > v.x1 || e.y < v.y0 || e.y > v.y1) continue;
      const back = (e.def.L || 20) * 0.5;
      const bx = e.x - Math.cos(e.ang) * back, by = e.y - Math.sin(e.ang) * back;
      e.dustAcc = (e.dustAcc || 0) + dt * (e.def.kind === "wheel" ? 5 : 3.5) * (e.speed / 40) * (g.weatherId === "rain" ? 0.3 : 1);
      while (e.dustAcc >= 1) {
        e.dustAcc--;
        fx.add({ kind: "dust", x: bx + R.range(-6, 6), y: by + R.range(-6, 6), vx: -Math.cos(e.ang) * 20 + R.range(-8, 8), vy: -Math.sin(e.ang) * 20 + R.range(-8, 8), life: R.range(0.7, 1.2), size: R.range(7, 11), grow: 18, a: 0.5, drag: 0.94 });
      }
      if (e.def.kind === "track" || e.def.kind === "half") {
        if (e.lastTread == null || Math.abs(e.dist - e.lastTread) > 7) { e.lastTread = e.dist; fx.treads(e.x, e.y, e.ang, e.def.Wd * 0.82); }
      }
    }
    for (const f of this.fires) {
      if (f.x < v.x0 || f.x > v.x1 || f.y < v.y0 - 100 || f.y > v.y1) continue;
      f.acc = (f.acc || 0) + dt * 6;
      while (f.acc >= 1) {
        f.acc--;
        fx.add({ kind: "smoke", x: f.x + R.range(-8, 8), y: f.y + R.range(-6, 6), vx: R.range(-6, 6), vy: R.range(-24, -10), life: R.range(2.5, 4), size: R.range(8, 14), grow: 22, a: 0.55, drag: 0.98 });
        if (R() < 0.6) fx.add({ kind: "fire", x: f.x + R.range(-9, 9), y: f.y + R.range(-6, 6), vx: R.range(-5, 5), vy: R.range(-20, -8), life: R.range(0.3, 0.6), size: R.range(6, 10), grow: 6, blend: true });
        if (R() < 0.25) fx.add({ kind: "ember", x: f.x, y: f.y, vx: R.range(-20, 20), vy: R.range(-40, -15), life: R.range(1, 2), size: 2, drag: 0.98, flick: R() * 9 });
      }
    }
    // Crows cross the part of the field the camera is on.
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = R.range(14, 28);
      const fromLeft = R() < 0.5, y0 = R.range(v.y0 + 60, v.y1 - 60);
      const ang = (fromLeft ? 0 : Math.PI) + R.range(-0.3, 0.3);
      const n = R.int(5, 9);
      for (let i = 0; i < n; i++) this.birds.push({ x: (fromLeft ? v.x0 : v.x1) - Math.cos(ang) * i * 14 + R.range(-10, 10), y: y0 + R.range(-26, 26), ang, sp: R.range(70, 90), flap: R() * 6, alt: R.range(0.5, 1) });
    }
    for (const b of this.birds) {
      b.flap += dt * 14;
      b.x += Math.cos(b.ang) * b.sp * dt;
      b.y += Math.sin(b.ang) * b.sp * dt;
      if (b.scare > 0) { b.scare -= dt; b.sp = Math.min(220, b.sp + dt * 300); }
    }
    this.birds = this.birds.filter((b) => b.x > -200 && b.x < g.WW + 200 && b.y > -200 && b.y < g.WH + 200);
  };

  // ------------------------------------------------------------------ live scenery
  const treeShadow = (() => {
    let cv = null;
    return () => {
      if (cv) return cv;
      cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const c = cv.getContext("2d");
      c.filter = "blur(5px)";
      c.fillStyle = "#000";
      c.beginPath(); c.ellipse(64, 64, 46, 40, 0, 0, 6.28); c.fill();
      return cv;
    };
  })();
  RP.drawLiveProps = function (c, v, layer) {
    const sc = S(), sun = this.sun;
    for (const pr of this.g.props) {
      if (!sc.LIVE[pr.kind]) continue;
      const tree = pr.kind === "tree" || pr.kind === "pine";
      if (layer === "low" && tree && pr.state !== "felled" && pr.state !== "burnt") continue;
      if (layer === "high" && !(tree && pr.state !== "felled" && pr.state !== "burnt")) continue;
      const rr = (pr.kind === "church" ? 90 : pr.r || 30) + 50;
      if (pr.x + rr < v.x0 || pr.x - rr > v.x1 || pr.y + rr < v.y0 || pr.y - rr > v.y1) continue;
      const sp = sc.sprite(pr, sun, this.img);
      c.drawImage(sp.cv, sp.x, sp.y, sp.size, sp.size);
      if (pr.kind === "windmill") sc.drawSails(c, pr, this.time);
    }
  };
  RP.drawTreeShadows = function (c, v) {
    const sh = treeShadow(), sun = this.sun;
    c.globalAlpha = sun.a * 0.9;
    for (const pr of this.g.props) {
      if ((pr.kind !== "tree" && pr.kind !== "pine") || pr.state === "felled" || pr.state === "burnt") continue;
      if (pr.x < v.x0 - 60 || pr.x > v.x1 + 60 || pr.y < v.y0 - 60 || pr.y > v.y1 + 60) continue;
      const s = 80 * (pr.s || 1) * 0.9;
      c.drawImage(sh, pr.x + sun.x * 16 - s / 2, pr.y + sun.y * 16 - s / 2, s, s);
    }
    c.globalAlpha = 1;
  };

  // ------------------------------------------------------------------ the frame
  RP.draw = function (view) {
    const c = this.c, g = this.g, fx = this.fx, cm = this.cam;
    const dpr = this.dpr || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#1a1712";
    c.fillRect(0, 0, BK.W, BK.H);
    const shake = fx.camera();
    c.save();
    c.translate(BK.W / 2 + shake.x, BK.H / 2 + shake.y);
    c.rotate(shake.rot);
    const z = cm.z * shake.zoom * (this.quiet && !this.bigMap() ? 1.14 : 1);
    c.scale(z, z);
    let cx = cm.x, cy = cm.y;
    if (this.quiet && !this.bigMap()) { const t = this.time * 0.03; cx -= Math.sin(t) * 40; cy -= Math.cos(t * 0.7) * 22; }
    c.translate(-cx, -cy);
    const v = this.viewRect(40);
    const gs = this.gs;

    // Ground and scorch, cropped to what the camera sees.
    const sx = Math.max(0, v.x0), sy = Math.max(0, v.y0), sw = Math.min(g.WW, v.x1) - sx, sh = Math.min(g.WH, v.y1) - sy;
    if (sw > 0 && sh > 0) {
      c.drawImage(this.ground, sx * gs, sy * gs, sw * gs, sh * gs, sx, sy, sw, sh);
      c.drawImage(fx.decal, sx * gs, sy * gs, sw * gs, sh * gs, sx, sy, sw, sh);
    }
    // Craters the battle has dug.
    for (const cr of g.craters) {
      if (cr.old || cr.x < v.x0 - 40 || cr.x > v.x1 + 40 || cr.y < v.y0 - 40 || cr.y > v.y1 + 40) continue;
      A.crater(c, cr);
    }
    fx.drawLow(c);
    // Wrecks you can strip for parts glint between waves.
    if (g.phase === "deploy") {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      for (const w of g.wrecks) {
        if (w.x < v.x0 || w.x > v.x1 || w.y < v.y0 || w.y > v.y1) continue;
        c.beginPath();
        c.arc(w.x, w.y, w.r + 6 + pulse * 3, 0, 6.28);
        c.strokeStyle = `rgba(207,224,138,${0.35 + 0.35 * pulse})`;
        c.lineWidth = 2;
        c.setLineDash([4, 4]);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "rgba(20,18,12,0.7)";
        c.fillRect(w.x - 24, w.y - w.r - 22, 48, 14);
        c.fillStyle = "#cfe08a";
        c.font = "bold 10px system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText("SALVAGE", w.x, w.y - w.r - 12);
        c.textAlign = "left";
      }
    }

    // Burning fuel.
    for (const zn of g.zones) {
      if (zn.kind !== "fire") continue;
      const k = zn.t / zn.max;
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.35 * k;
      c.drawImage(fx.S.glow, zn.x - zn.r * 1.4, zn.y - zn.r * 1.4, zn.r * 2.8, zn.r * 2.8);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      if (R() < 0.35) fx.burn(zn.x + R.range(-zn.r, zn.r) * 0.7, zn.y + R.range(-zn.r, zn.r) * 0.7, false);
    }
    for (const m of g.mines) {
      c.beginPath(); c.arc(m.x, m.y, 5, 0, 6.28); c.fillStyle = "#3a3a30"; c.fill();
      c.fillStyle = Math.sin(this.time * 6) > 0 ? "#ffcf4a" : "#6b5a20";
      c.beginPath(); c.arc(m.x, m.y, 1.8, 0, 6.28); c.fill();
    }
    // Fortifications.
    for (const f of g.forts) if (f.x > v.x0 - 50 && f.x < v.x1 + 50 && f.y > v.y0 - 50 && f.y < v.y1 + 50) A.fort(c, f, this.sun);

    // Buildings, carts and fallen trees.
    this.drawLiveProps(c, v, "low");

    const crewT = g.crewTower();
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
    const showWeak = !!crewT || (view && view.showWeak);

    // Shadows.
    this.drawTreeShadows(c, v);
    const inV = (o, p) => o.x > v.x0 - p && o.x < v.x1 + p && o.y > v.y0 - p && o.y < v.y1 + p;
    for (const t of g.towers) if (inV(t, 60)) A.gunShadow(c, t, this.sun);
    for (const e of g.enemies) if (!e.air && !e.gone && inV(e, 80)) A.shadow(c, e, this.sun);

    // People and animals going about their day.
    if (this.life) this.life.drawGround(c, v);

    // Field drops glow until someone picks them up.
    for (const d of g.drops) {
      if (!inV(d, 30)) continue;
      const fade = d.life < 8 ? (Math.sin(this.time * 12) > 0 ? 1 : 0.4) : 1;
      const bob = Math.sin(this.time * 4 + d.id) * 2;
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.5 * fade;
      c.drawImage(fx.S.glow, d.x - 18, d.y - 18, 36, 36);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = fade;
      this.drawItem(c, d.item, d.x, d.y + bob, 9);
      c.globalAlpha = 1;
    }

    // Ground units.
    for (const e of g.enemies) {
      if (e.air || e.gone || !inV(e, 80)) continue;
      c.save();
      c.translate(e.x, e.y);
      c.rotate(e.ang);
      if (e.surrender) A.prisoner(c, e, this.time);
      else {
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
      }
      c.restore();
      if (e.hp < e.maxHp * 0.5 && e.def.kind !== "foot" && R() < (e.hp < e.maxHp * 0.25 ? 0.25 : 0.1)) fx.burn(e.x + R.range(-6, 6), e.y + R.range(-6, 6), e.hp < e.maxHp * 0.25);
      if (e.burnT > 0 && R() < 0.25) fx.burn(e.x, e.y, false);
      if (!e.surrender) this.drawStatus(c, e);
    }

    // Uhlans at the charge.
    for (const u of g.uhlans) {
      const p = g.paths[u.path];
      for (let i = 0; i < 8; i++) {
        const d = u.d + (i >> 1) * 22;
        if (d < 0 || d > p.len) continue;
        const [x, y, a] = p.at(d);
        const lat = (i % 2 ? 1 : -1) * 11;
        c.save();
        c.translate(x - Math.sin(a) * lat, y + Math.cos(a) * lat);
        c.rotate(a + Math.PI);
        A.horse(c, this.time + i * 0.13, ["#6a4428", "#3a2618", "#8a6a48", "#2a1a10"][i % 4], "uhlan");
        c.restore();
        if (R() < 0.3) fx.add({ kind: "dust", x, y, vx: R.range(-10, 10), vy: R.range(-10, 10), life: 0.8, size: 8, grow: 16, a: 0.45, drag: 0.94 });
      }
    }

    // Guns.
    for (const t of g.towers) {
      if (!inV(t, 80)) continue;
      if (view && view.selected === t.id) this.rangeRing(c, t.x, t.y, g.towerStats(t).range, "rgba(255,230,160,0.9)", g.towerStats(t).minRange);
      if (t.manned) {
        c.beginPath();
        c.arc(t.x, t.y, A.formRadius(t) + 2 + pulse * 2, 0, 6.28);
        c.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * pulse})`;
        c.lineWidth = 2.5;
        c.stroke();
      }
      A.gun(c, t);
      if (t.flash > 0) {
        c.beginPath(); c.arc(t.x, t.y, 26, 0, 6.28);
        c.fillStyle = `rgba(255,80,60,${t.flash * 3})`;
        c.fill();
      }
      this.drawGunBadges(c, t);
      if (t.ko > 0 && R() < 0.3) fx.add({ kind: "smoke", x: t.x + R.range(-6, 6), y: t.y, vy: -25, life: 1.4, size: 6, grow: 14, a: 0.6 });
    }

    // Armored train on the line.
    if (g.layout && g.layout.rail) {
      const rail = g.layout.rail;
      for (const tr of g.trains) {
        for (let i = 0; i < 4; i++) {
          const d = tr.d - i * 66;
          if (d < -60 || d > rail.len + 60) continue;
          const [x, y, a] = rail.at(BK.clamp(d, 0, rail.len));
          c.save(); c.translate(x, y); c.rotate(a);
          A.trainCar(c, i === 0 ? "loco" : "gun", this.time);
          c.restore();
          if (i === 0 && R() < 0.5) fx.add({ kind: "smoke", x, y, vx: R.range(-10, 10), vy: -30, life: 2, size: 9, grow: 20, a: 0.6, drag: 0.97 });
        }
      }
    }

    // Rounds in flight.
    for (const p of g.projectiles) this.drawProjectile(c, p);

    // Trees over the ground units, windmill sails, storks.
    this.drawLiveProps(c, v, "high");
    this.drawBirds(c);
    fx.drawHigh(c);

    // Smoke screens.
    for (const zn of g.zones) {
      if (zn.kind !== "smoke") continue;
      const k = Math.min(1, zn.t / 1.5) * Math.min(1, (zn.max - zn.t) / 0.6 + 0.3);
      const rr = BK.makeRng(Math.round(zn.x * 7 + zn.y));
      for (let i = 0; i < 12; i++) {
        const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * zn.r * 0.8;
        const s = zn.r * rr.range(0.45, 0.75) + Math.sin(this.time + i) * 3;
        c.globalAlpha = 0.72 * k;
        c.drawImage(fx.S.whiteSmoke, zn.x + Math.cos(a + this.time * 0.05) * d - s, zn.y + Math.sin(a + this.time * 0.05) * d - s, s * 2, s * 2);
      }
      c.globalAlpha = 1;
    }

    for (const cr of g.crates) this.drawCrate(c, cr);

    // Aircraft.
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
      c.restore();
    }
    for (const p of g.projectiles) if (p.type === "bomb") this.drawBomb(c, p);
    for (const f of g.fighters) A.p11(c, f.x, f.y, f.ang, this.time);
    for (const s of g.strikes) this.drawStrike(c, s);
    if (this.life) this.life.drawAir(c, v);

    // Weather over the field.
    this.drawWeather(c, v);

    // Planning overlays.
    if (view) this.drawOverlay(c, view);
    if (g.phase === "deploy" && !this.quiet) this.drawAttackArrows(c);

    fx.drawTexts(c);
    c.restore();

    // Screen space: light, grade, coins, minimap and the big countdown.
    c.globalCompositeOperation = "multiply";
    c.drawImage(this.gradeMul, 0, 0);
    c.globalAlpha = g.weatherId === "fog" ? 0.22 : 0.12;
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
    for (const k of this.coins) {
      c.save();
      c.translate(k.x, k.y);
      const sxx = Math.abs(Math.cos(this.time * 12 + k.delay * 40));
      c.scale(0.4 + sxx * 0.6, 1);
      c.beginPath(); c.arc(0, 0, 5, 0, 6.28);
      c.fillStyle = "#f2c64a"; c.fill();
      c.strokeStyle = "#8a6414"; c.lineWidth = 1.2; c.stroke();
      c.restore();
    }
    if (!this.quiet) {
      this.drawCountdown(c);
      if (this.bigMap()) this.drawMinimap(c);
    }
  };

  // ------------------------------------------------------------------ pieces
  RP.drawItem = function (c, item, x, y, r) {
    c.save();
    c.translate(x, y);
    c.beginPath(); c.arc(0, 0, r + 2, 0, 6.28);
    c.fillStyle = "rgba(14,12,9,0.85)"; c.fill();
    c.strokeStyle = ITEM_COL[item] || "#fff"; c.lineWidth = 2; c.stroke();
    c.fillStyle = ITEM_COL[item] || "#fff";
    const s = r * 0.6;
    switch (item) {
      case "ammo": for (const dx of [-s * 0.6, 0, s * 0.6]) { c.fillRect(dx - 1.2, -s, 2.4, s * 1.6); c.beginPath(); c.arc(dx, -s, 1.2, Math.PI, 0); c.fill(); } break;
      case "steel": c.fillRect(-s, -s * 0.5, s * 2, s); break;
      case "optics": c.beginPath(); c.arc(-s * 0.5, 0, s * 0.55, 0, 6.28); c.arc(s * 0.5, 0, s * 0.55, 0, 6.28); c.fill(); break;
      case "parts": c.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28, rr = i % 2 ? s * 0.6 : s; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); c.fillStyle = "#111"; c.beginPath(); c.arc(0, 0, s * 0.3, 0, 6.28); c.fill(); break;
      case "mg34": c.fillRect(-s, -1.5, s * 2, 3); c.fillRect(-s, -1.5, s * 0.6, 4); break;
      case "explosives": for (const dx of [-s * 0.5, 0, s * 0.5]) c.fillRect(dx - 1.5, -s, 3, s * 2); break;
      case "radio": c.fillRect(-s * 0.8, -s * 0.4, s * 1.6, s * 1.2); c.fillRect(s * 0.4, -s * 1.2, 1.2, s); break;
      case "fuel": c.fillRect(-s * 0.7, -s, s * 1.4, s * 2); c.fillStyle = "#111"; c.fillRect(-s * 0.2, -s * 1.2, s * 0.4, s * 0.4); break;
      case "maps": c.fillRect(-s, -s * 0.7, s * 2, s * 1.4); c.strokeStyle = "#111"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-s * 0.3, -s * 0.7); c.lineTo(-s * 0.3, s * 0.7); c.moveTo(s * 0.3, -s * 0.7); c.lineTo(s * 0.3, s * 0.7); c.stroke(); break;
      default: c.beginPath(); c.arc(0, 0, s, 0, 6.28); c.fill();
    }
    c.restore();
  };

  RP.drawWeather = function (c, v) {
    const w = this.g.weatherId;
    if (w === "rain") {
      c.strokeStyle = "rgba(200,210,225,0.35)";
      c.lineWidth = 1;
      c.beginPath();
      for (const d of this.rain) { const k = d.t / d.T; c.moveTo(d.x - 6 + k * 6, d.y - 16 + k * 16); c.lineTo(d.x + k * 6, d.y + k * 16); }
      c.stroke();
      // Splashes where drops land.
      c.strokeStyle = "rgba(220,228,240,0.25)";
      for (const d of this.rain) if (d.t > d.T * 0.8) { c.beginPath(); c.arc(d.x + 6, d.y + 16, 2 + (d.t / d.T) * 2, 0, 6.28); c.stroke(); }
    } else if (w === "fog" || w === "smoke") {
      // Banks drifting across, thinner near the guns so the player can still see the fight.
      const S2 = this.fx.S[w === "fog" ? "whiteSmoke" : "smoke"];
      const rr = BK.makeRng(11);
      const n = Math.ceil(((v.x1 - v.x0) * (v.y1 - v.y0)) / 60000) + 6;
      for (let i = 0; i < n; i++) {
        const bx = rr() * this.g.WW, by = rr() * this.g.WH;
        const x = ((bx + this.fogT * (w === "fog" ? 8 : 14)) % (this.g.WW + 600)) - 300;
        if (x < v.x0 - 400 || x > v.x1 + 400 || by < v.y0 - 400 || by > v.y1 + 400) continue;
        const s = 220 + rr() * 200;
        c.globalAlpha = w === "fog" ? 0.22 : 0.3;
        c.drawImage(S2, x - s, by - s * 0.6, s * 2, s * 1.2);
      }
      c.globalAlpha = 1;
    }
  };

  // Before each wave, arrows down every road the enemy will use, sized by what is coming.
  RP.drawAttackArrows = function (c) {
    const g = this.g;
    if (this.arrowsFor !== g.wave) { this.plan = g.nextWavePlan ? g.nextWavePlan() : null; this.arrowsFor = g.wave; }
    const plan = this.plan;
    if (!plan) return;
    const t = this.time;
    plan.roads.forEach((r, pi) => {
      const total = r.foot + r.armor * 2;
      if (!total) return;
      const p = g.paths[pi];
      const w = BK.clamp(6 + total * 0.5, 7, 22);
      const col = r.armor > r.foot / 3 ? "255,110,80" : "255,214,90";
      // Chevrons march down the first stretch of road.
      for (let i = 0; i < 6; i++) {
        const d = 40 + ((i * 60 + t * 70) % 360);
        const [x, y, a] = p.at(Math.min(p.len, d));
        const k = 1 - d / 400;
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.globalAlpha = 0.75 * k;
        c.fillStyle = `rgba(${col},1)`;
        c.strokeStyle = "rgba(0,0,0,0.6)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(w, 0); c.lineTo(-w * 0.6, -w); c.lineTo(-w * 0.2, 0); c.lineTo(-w * 0.6, w); c.closePath();
        c.stroke(); c.fill();
        c.restore();
      }
      const [x, y] = p.at(Math.min(p.len, 130));
      const label = (r.armor ? r.armor + " armor " : "") + (r.foot ? r.foot + " foot" : "");
      c.globalAlpha = 0.9;
      c.font = "bold 13px system-ui, sans-serif";
      const tw = c.measureText(label).width;
      c.fillStyle = "rgba(14,12,9,0.75)";
      c.fillRect(x - tw / 2 - 6, y - 30, tw + 12, 18);
      c.fillStyle = `rgba(${col},1)`;
      c.textAlign = "center";
      c.fillText(label, x, y - 17);
      c.textAlign = "left";
      c.globalAlpha = 1;
    });
  };

  // The big translucent countdown in the middle of the screen while the player builds.
  RP.drawCountdown = function (c) {
    const g = this.g;
    if (g.phase !== "deploy" || !isFinite(g.earlyT) || g.demo) return;
    const s = Math.max(0, Math.ceil(g.earlyT));
    const urgent = g.earlyT < 6;
    const beat = urgent ? 1 + 0.08 * Math.max(0, Math.sin(this.time * 12)) : 1;
    c.save();
    c.translate(BK.W / 2, BK.H * 0.42);
    c.scale(beat, beat);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "800 15px system-ui, sans-serif";
    c.fillStyle = "rgba(255,240,210,0.55)";
    c.fillText("WAVE " + (g.wave + 1) + " IN", 0, -64);
    c.font = "900 120px system-ui, sans-serif";
    c.lineWidth = 6;
    c.strokeStyle = "rgba(0,0,0,0.22)";
    c.strokeText(String(s), 0, 4);
    c.fillStyle = urgent ? "rgba(255,110,80,0.42)" : "rgba(255,240,210,0.28)";
    c.fillText(String(s), 0, 4);
    // A ring that drains as the time runs out.
    const max = g.wave === 0 ? 45 : 30;
    c.beginPath();
    c.arc(0, 0, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * BK.clamp(g.earlyT / max, 0, 1));
    c.strokeStyle = urgent ? "rgba(255,110,80,0.45)" : "rgba(255,240,210,0.25)";
    c.lineWidth = 5;
    c.stroke();
    c.restore();
  };

  RP.minimapRect = function () {
    const m = this.minimap;
    if (!m) return null;
    return { x: BK.W - m.mw - 14, y: 66, w: m.mw, h: m.mh };
  };
  RP.drawMinimap = function (c) {
    const m = this.minimap, g = this.g;
    const r = this.minimapRect();
    c.save();
    c.globalAlpha = 0.92;
    c.fillStyle = "rgba(14,12,9,0.85)";
    c.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    c.drawImage(m.cv, r.x, r.y, r.w, r.h);
    const k = m.k;
    // Guns, enemies, drops.
    for (const t of g.towers) { c.fillStyle = t.ko > 0 ? "#777" : "#9fe870"; c.fillRect(r.x + t.x * k - 2, r.y + t.y * k - 2, 4, 4); }
    for (const e of g.enemies) {
      if (e.gone) continue;
      c.fillStyle = e.surrender ? "#f4efe2" : e.air ? "#ffb070" : e.def.kind === "foot" ? "#ff8a70" : "#ff4a3a";
      const s = e.def.kind === "foot" ? 2 : 3;
      c.fillRect(r.x + e.x * k - s / 2, r.y + e.y * k - s / 2, s, s);
    }
    for (const d of g.drops) { c.fillStyle = "#ffd84d"; c.fillRect(r.x + d.x * k - 1, r.y + d.y * k - 1, 2, 2); }
    // The camera's view.
    const v = this.viewRect(0);
    c.strokeStyle = "rgba(255,240,210,0.9)";
    c.lineWidth = 1.5;
    c.strokeRect(r.x + Math.max(0, v.x0) * k, r.y + Math.max(0, v.y0) * k, (Math.min(g.WW, v.x1) - Math.max(0, v.x0)) * k, (Math.min(g.WH, v.y1) - Math.max(0, v.y0)) * k);
    c.restore();
  };
  RP.minimapHit = function (sx, sy) {
    const r = this.bigMap() && this.minimapRect();
    if (!r || sx < r.x - 4 || sy < r.y - 4 || sx > r.x + r.w + 4 || sy > r.y + r.h + 4) return null;
    return [(sx - r.x) / this.minimap.k, (sy - r.y) / this.minimap.k];
  };

  // Badges under each gun: rank chevrons, health, and the crew's name when selected.
  RP.drawGunBadges = function (c, t) {
    const rad = A.formRadius(t);
    const y = t.y + rad + 4;
    const rank = t.rank || 0;
    for (let i = 0; i < rank; i++) {
      const x = t.x - (rank - 1) * 5 + i * 10;
      c.beginPath();
      c.moveTo(x - 4, y); c.lineTo(x, y - 3); c.lineTo(x + 4, y);
      c.strokeStyle = "rgba(0,0,0,0.8)"; c.lineWidth = 4; c.stroke();
      c.strokeStyle = "#ffd84d"; c.lineWidth = 2; c.stroke();
    }
    if (t.spec) {
      c.fillStyle = "#ffd84d";
      c.strokeStyle = "rgba(0,0,0,0.8)";
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.4 : 5.5; c.lineTo(t.x + Math.cos(a) * r, y + 8 + Math.sin(a) * r); }
      c.closePath(); c.stroke(); c.fill();
    }
    // A thin XP bar toward the next rank.
    if (rank < BK.RANKS.length - 1) {
      const lo = BK.RANKS[rank].xp, hi = BK.RANKS[rank + 1].xp;
      const k = BK.clamp((t.xp - lo) / (hi - lo), 0, 1);
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(t.x - 14, y + 3, 28, 3);
      c.fillStyle = "#8fd0ff";
      c.fillRect(t.x - 14, y + 3, 28 * k, 3);
    }
    if (t.hp < t.maxHp && t.ko <= 0) {
      c.fillStyle = "rgba(0,0,0,0.6)";
      c.fillRect(t.x - 18, t.y - rad - 6, 36, 5);
      c.fillStyle = t.hp / t.maxHp > 0.4 ? "#9fe870" : "#ff5a4f";
      c.fillRect(t.x - 17, t.y - rad - 5, 34 * (t.hp / t.maxHp), 3);
    }
    if (t.supT > 0) {
      c.font = "bold 10px system-ui, sans-serif";
      c.fillStyle = "#ff8a70";
      c.textAlign = "center";
      c.fillText("PINNED", t.x, t.y - rad - 10);
      c.textAlign = "left";
    }
    if (t.ko > 0 && t.ko < 100) {
      c.beginPath();
      c.arc(t.x, t.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t.ko / 7));
      c.strokeStyle = "#9fe870"; c.lineWidth = 3; c.stroke();
    }
  };

  // Mortar bombs from the enemy arc high; draw them with a shadow on the ground.
  const baseProj = RP.drawProjectile;
  RP.drawProjectile = function (c, p) {
    if (p.type === "elob") {
      const k = BK.clamp(p.t / p.T, 0, 1);
      const x = p.sx + (p.tx - p.sx) * k, y = p.sy + (p.ty - p.sy) * k;
      const h = Math.sin(k * Math.PI) * 120;
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath(); c.ellipse(x + this.sun.x * h * 0.2, y + this.sun.y * h * 0.2, 3, 2, 0, 0, 6.28); c.fill();
      c.fillStyle = "#2a2a24";
      c.beginPath(); c.arc(x, y - h, 2.6 + (h / 120) * 1.4, 0, 6.28); c.fill();
      return;
    }
    if (p.type === "grenade") {
      const k = BK.clamp(p.t / (p.T || 1), 0, 1);
      const x = p.sx + (p.tx - p.sx) * k, y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 30;
      c.fillStyle = "#3a3c30";
      c.beginPath(); c.arc(x, y, 2.2, 0, 6.28); c.fill();
      return;
    }
    baseProj.call(this, c, p);
  };

  // Placing forts and moving guns: show a ghost of what will go where.
  const baseOverlay = RP.drawOverlay;
  RP.drawOverlay = function (c, v) {
    if (v.ghost && v.ghost.kind) {
      const { kind, x, y } = v.ghost;
      const bad = this.g.canPlace(x, y, kind);
      const def = BK.GUNS[kind];
      const r = def.range * (1 + this.g.mods.range);
      this.rangeRing(c, x, y, r, bad ? "rgba(255,90,79,0.9)" : "rgba(160,240,120,0.95)", def.minRange);
      c.globalAlpha = 0.75;
      A.gun(c, { kind, x, y, ang: -Math.PI / 2, recoil: 0, ko: 0, level: 1, path: [kind] });
      c.globalAlpha = 1;
      if (bad) {
        c.strokeStyle = "rgba(255,90,79,0.95)";
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x + 10, y + 10); c.moveTo(x + 10, y - 10); c.lineTo(x - 10, y + 10); c.stroke();
      }
      v = Object.assign({}, v, { ghost: null });
    }
    if (v.fortGhost) {
      const { kind, x, y } = v.fortGhost;
      const bad = this.g.canFort(kind, x, y);
      let ang = 0, best = Infinity;
      for (const p of this.g.paths) for (let d = 0; d < p.len; d += 8) { const [px, py, a] = p.at(d); const d2 = (px - x) ** 2 + (py - y) ** 2; if (d2 < best) { best = d2; ang = BK.FORTS[kind].where === "road" || kind === "wire" ? a + Math.PI / 2 : Math.atan2(py - y, px - x); } }
      c.globalAlpha = bad ? 0.4 : 0.8;
      if (kind === "dig") A.crater(c, { x, y, r: 20 });
      else A.fort(c, { kind, x, y, ang, hp: 1, maxHp: 1 }, this.sun);
      c.globalAlpha = 1;
      if (kind === "sandbag" || kind === "dig") {
        c.beginPath(); c.arc(x, y, kind === "dig" ? 20 : 52, 0, 6.28);
        c.strokeStyle = bad ? "rgba(255,90,79,0.8)" : "rgba(160,240,120,0.6)";
        c.setLineDash([4, 4]); c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
      }
      if (bad && bad !== "money") {
        c.font = "bold 12px system-ui, sans-serif";
        c.fillStyle = "#ff8a70";
        c.textAlign = "center";
        c.fillText(bad, x, y - 30);
        c.textAlign = "left";
      }
    }
    if (v.relocate) {
      const t = this.g.towers.find((x) => x.id === v.relocate.id);
      if (t && v.pointer) {
        const bad = this.g.canPlace(v.pointer.x, v.pointer.y, t.kind, t);
        c.globalAlpha = 0.6;
        A.gun(c, Object.assign({}, t, { x: v.pointer.x, y: v.pointer.y }));
        c.globalAlpha = 1;
        c.strokeStyle = bad ? "rgba(255,90,79,0.9)" : "rgba(160,240,120,0.9)";
        c.setLineDash([6, 5]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(v.pointer.x, v.pointer.y); c.stroke();
        c.setLineDash([]);
      }
    }
    if (v.ability === "uhlans" && v.pointer) {
      c.strokeStyle = "rgba(255,214,90,0.9)";
      c.lineWidth = 2;
      c.beginPath(); c.arc(v.pointer.x, v.pointer.y, 40, 0, 6.28); c.stroke();
    }
    baseOverlay.call(this, c, v);
  };
})(typeof window !== "undefined" ? window : globalThis);
