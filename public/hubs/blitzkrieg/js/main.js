// Boot, the frame loop, and mouse, touch and keyboard input.
(function (root) {
  const BK = root.BK;
  const $ = (id) => document.getElementById(id);
  const STEP = 1 / 60;

  class App {
    constructor() {
      this.cv = $("game");
      this.stage = $("stage");
      this.paused = false;
      this.speed = 1;
      this.mode = "idle";
      this.buildKind = null;
      this.abilityId = null;
      this.pointer = null;
      this.ghost = null;
      this.selected = null;
      this.acc = 0;
      this.thumbs = {};
      this.inRun = false;
    }

    async boot() {
      const names = ["terrain", "prop-hay", "prop-pine", "prop-tree"];
      const imgs = {};
      await Promise.all(names.map((n) => new Promise((res) => {
        const im = new Image();
        im.onload = () => res();
        im.onerror = () => res();
        im.src = `assets/${n}.${n === "terrain" ? "jpg" : "png"}`;
        imgs[n] = im;
      })));
      try { await document.fonts.ready; } catch (e) { /* fonts load late; text still draws */ }
      this.images = imgs;
      BK.Save.load();
      BK.Audio.muted = BK.Save.data.settings.muted;
      BK.Audio.musicOn = BK.Save.data.settings.music;
      this.R = new BK.Renderer(this.cv, imgs);
      this.ui = new BK.UI(this);
      this.R.ui = this.ui;
      this.R.onCoin = (v) => {
        BK.Audio.coin();
        const el = $("st-money");
        el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
      };
      this.makeGrain();
      this.resize();
      addEventListener("resize", () => this.resize());
      this.bindInput();
      this.toTitle();
      $("loading").classList.add("hidden");
      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.tick(dt);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      document.addEventListener("visibilitychange", () => { if (document.hidden && this.inRun) this.togglePause(true); });
      // Audio may only start after a user gesture.
      const unlock = () => { BK.Audio.unlock(); BK.Audio.startMusic(); BK.Audio.setMuted(BK.Audio.muted); BK.Audio.setMusic(BK.Audio.musicOn); };
      addEventListener("pointerdown", unlock, { once: false, passive: true });
      addEventListener("keydown", unlock, { once: true });
    }

    // A fine film grain over everything, from one small noise tile.
    makeGrain() {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 160;
      const c = cv.getContext("2d");
      const im = c.createImageData(160, 160);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = Math.random() * 255;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
      c.putImageData(im, 0, 0);
      $("grain").style.backgroundImage = `url(${cv.toDataURL()})`;
    }

    resize() {
      const vw = innerWidth, vh = innerHeight;
      const w = Math.min(vw, (vh * 16) / 9), h = (w * 9) / 16;
      this.stage.style.width = w + "px";
      this.stage.style.height = h + "px";
      this.stage.style.fontSize = (w / 1280) * 16 + "px";
      // Render scale drops on slow machines, so a Chromebook keeps a steady frame rate.
      const dpr = Math.min(2, devicePixelRatio || 1) * (this.quality || 1);
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(h * dpr);
      this.R.dpr = this.cv.width / BK.W;
      $("rotate").classList.toggle("hidden", !(vh > vw * 1.15 && vw < 900));
      this.updateCoinTarget();
    }
    updateCoinTarget() {
      const el = $("st-money"), r = el.getBoundingClientRect(), s = this.stage.getBoundingClientRect();
      if (!r.width) { this.R.coinTarget = { x: 150, y: 22 }; return; }
      this.R.coinTarget = { x: ((r.left + r.width * 0.3 - s.left) / s.width) * BK.W, y: ((r.top + r.height / 2 - s.top) / s.height) * BK.H };
    }
    worldToStage(x, y) {
      const [sx, sy] = this.R.toScreen(x, y);
      return { x: (sx / BK.W) * 100, y: (sy / BK.H) * 100 };
    }
    toScreen(ev) {
      const r = this.cv.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * BK.W, y: ((ev.clientY - r.top) / r.height) * BK.H };
    }
    toWorld(ev) {
      const s = this.toScreen(ev);
      const [x, y] = this.R.toWorld(s.x, s.y);
      return { x, y, sx: s.x, sy: s.y };
    }

    // ---------------------------------------------------------------- runs
    toTitle() {
      this.inRun = false;
      this.paused = false;
      this.speed = 1;
      $("v-speed").textContent = "1x";
      this.clearMode();
      for (const id of ["hud", "cards", "pause", "result"]) $(id).classList.add("hidden");
      this.ui.closePanel();
      $("crewbar").classList.add("hidden");
      this.cv.className = "";
      $("banner").innerHTML = "";
      this.startDemo();
      this.ui.screen("title");
    }
    startDemo() {
      const S = BK.Save.data;
      const avail = BK.MAPS.map((m, i) => (!m.unlock || S.unlocks[m.unlock] ? i : -1)).filter((i) => i >= 0);
      const mi = avail[Math.floor(Math.random() * avail.length)];
      this.g = new BK.Game({ map: mi, demo: true, endless: true, seed: (Math.random() * 1e6) | 0, save: { unlocks: S.unlocks } });
      this.g.money += 900;
      this.bot = new BK.Bot(this.g, { crew: false });
      this.R.setGame(this.g);
      this.R.quiet = true;
      // Let the battle develop before anyone sees it.
      for (let i = 0; i < 60 * 14; i++) { this.bot.update(STEP); this.g.update(STEP); }
      this.g.events.length = 0;
    }
    startRun(mapIndex, endless) {
      BK.Audio.unlock();
      BK.Audio.startMusic();
      this.lastMap = mapIndex;
      this.lastEndless = !!endless;
      for (const id of ["title", "maps", "command", "notes", "cards", "pause", "result"]) $(id).classList.add("hidden");
      this.bot = null;
      this.g = new BK.Game({ map: mapIndex, endless, seed: (Math.random() * 1e9) | 0, save: { unlocks: BK.Save.data.unlocks } });
      this.R.setGame(this.g);
      this.R.quiet = false;
      this.inRun = true;
      this.paused = false;
      this.speed = 1;
      $("v-speed").textContent = "1x";
      this.clearMode();
      this.ui.startRun();
      this.refreshCrew();
      setTimeout(() => this.updateCoinTarget(), 50);
    }

    togglePause(force) {
      if (!this.inRun || this.g.result) return;
      this.paused = force == null ? !this.paused : force;
      if (this.paused) this.g.fireHeld = false;
      $("pause").classList.toggle("hidden", !this.paused);
      BK.Audio.ui();
    }
    toggleSpeed() {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
      $("v-speed").textContent = this.speed + "x";
      BK.Audio.ui();
    }
    sendWave() {
      if (!this.inRun) return;
      if (!this.g.towers.length && this.g.wave === 0) { BK.Audio.ui("deny"); this.ui.toast("Tip", "Place at least one gun before the column arrives.", null, 0, 4); return; }
      if (this.g.startWave()) BK.Audio.unlock();
    }

    clearMode() {
      this.mode = "idle";
      this.buildKind = null;
      this.abilityId = null;
      this.ghost = null;
      this.fortKind = null;
      this.relocId = null;
      this.cv.classList.remove("build", "aim");
    }
    armBuild(kind) {
      if (!this.inRun || !this.g.gunAvailable(kind)) return;
      BK.Audio.ui();
      if (this.mode === "build" && this.buildKind === kind) { this.clearMode(); return; }
      if (this.g.money < BK.GUNS[kind].cost) { BK.Audio.ui("deny"); this.ui.toast("Short of złoty", `${BK.GUNS[kind].short} costs ${BK.GUNS[kind].cost} zł.`, null, 0, 2.5); return; }
      if (this.g.crew) { this.g.unman(); this.refreshCrew(); }
      this.ui.closePanel();
      this.selected = null;
      this.mode = "build";
      this.buildKind = kind;
      this.cv.classList.add("build");
      if (this.pointer) this.ghost = { kind, x: this.pointer.x, y: this.pointer.y };
    }
    armAbility(id) {
      if (!this.inRun) return;
      if (!this.g.abilityReady(id)) { BK.Audio.ui("deny"); return; }
      BK.Audio.ui();
      if (this.mode === "ability" && this.abilityId === id) { this.clearMode(); return; }
      this.clearMode();
      this.mode = "ability";
      this.abilityId = id;
      this.cv.classList.add("aim");
    }
    refreshCrew() {
      const t = this.g.crewTower();
      $("crewbar").classList.toggle("hidden", !t);
      this.cv.classList.toggle("crew", !!t);
      if (t) {
        $("crew-name").textContent = BK.GUNS[t.kind].short;
        this.ui.closePanel();
        this.selected = null;
        if (this.mode === "build") this.clearMode();
      }
    }

    towerAt(x, y) {
      let best = null, bd = 1e9;
      for (const t of this.g.towers) {
        const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
        const r = Math.max(30, BK.Art.formRadius ? BK.Art.formRadius(t) * 0.8 : 30);
        if (d < r * r && d < bd) { bd = d; best = t; }
      }
      return best;
    }
    armFort(kind) {
      if (!this.inRun) return;
      if (this.g.phase !== "deploy") { BK.Audio.ui("deny"); this.ui.toast("Between waves", "Defenses go up while the guns are quiet.", null, 0, 2.5); return; }
      BK.Audio.ui();
      if (this.mode === "fort" && this.fortKind === kind) { this.clearMode(); return; }
      this.clearMode();
      if (this.g.crew) { this.g.unman(); this.refreshCrew(); }
      this.ui.closePanel();
      this.selected = null;
      this.mode = "fort";
      this.fortKind = kind;
      this.cv.classList.add("build");
    }
    armRelocate(t) {
      if (!this.inRun || !t) return;
      this.clearMode();
      this.mode = "relocate";
      this.relocId = t.id;
      this.ui.closePanel();
      this.cv.classList.add("build");
    }

    // ---------------------------------------------------------------- input
    bindInput() {
      const cv = this.cv;
      let lastTap = { t: 0, id: null };
      cv.addEventListener("contextmenu", (e) => e.preventDefault());
      // Several fingers down means a pinch; a drag on open ground pans the camera.
      const touches = new Map();
      this.drag = null;
      cv.addEventListener("wheel", (e) => {
        if (!this.inRun) return;
        e.preventDefault();
        const s = this.toScreen(e);
        this.R.zoomAt(s.x, s.y, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
      cv.addEventListener("pointerdown", (e) => {
        if (!this.inRun || this.paused) return;
        e.preventDefault();
        cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        const p = this.toWorld(e);
        this.pointer = p;
        const g = this.g;
        touches.set(e.pointerId, { x: p.sx, y: p.sy });
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
          this.drag = null;
          g.fireHeld = false;
          return;
        }
        // The minimap jumps the camera.
        const mm = this.R.minimapHit(p.sx, p.sy);
        if (mm) { this.R.centerOn(mm[0], mm[1]); this.drag = { mini: true }; return; }
        if (e.button === 1 || (e.button === 2 && this.R.bigMap())) { this.drag = { sx: p.sx, sy: p.sy, moved: 0, pan: true, right: e.button === 2 }; return; }
        if (e.button === 2) { this.cancel(); return; }
        // Supplies on the ground are picked up with a tap.
        const dr = g.dropAt(p.x, p.y);
        if (dr) { g.collectDrop(dr); return; }
        // Crates win over everything else.
        const cr = g.crateAt(p.x, p.y);
        if (cr) { g.openCrate(cr); return; }
        if (g.crew) {
          g.aim.x = p.x; g.aim.y = p.y;
          const t = this.towerAt(p.x, p.y);
          const now = performance.now();
          if (t && t.id !== g.crew && now - lastTap.t < 320 && lastTap.id === t.id) { g.man(t); this.refreshCrew(); return; }
          lastTap = { t: now, id: t ? t.id : null };
          g.fireHeld = true;
          return;
        }
        if (this.mode === "build") {
          const why = g.canPlace(p.x, p.y, this.buildKind);
          if (!why) {
            g.build(this.buildKind, p.x, p.y);
            this.ui.tipOnce("send", "Add more guns, or hit Send Wave when you are ready. Going early pays a bonus.", null, 0.6);
            if (!e.shiftKey || g.money < BK.GUNS[this.buildKind].cost) this.clearMode();
          } else {
            BK.Audio.ui("deny");
            const msg = { road: "Too close to the road.", gun: "Too close to another gun.", prop: "Trees and hay are in the way.", edge: "Too close to the edge.", money: "Not enough złoty." }[why];
            this.R.fx.text(p.x, p.y - 20, msg, "#ff8a70", 15, { life: 1 });
          }
          return;
        }
        if (this.mode === "fort") {
          const why = g.canFort(this.fortKind, p.x, p.y);
          if (!why) {
            g.buildFort(this.fortKind, p.x, p.y);
            if (!e.shiftKey && !(e.pointerType === "mouse" && this.fortKind === "sandbag") || g.money < BK.FORTS[this.fortKind].cost) this.clearMode();
          } else {
            BK.Audio.ui("deny");
            this.R.fx.text(p.x, p.y - 20, why === "money" ? "Not enough złoty." : why.charAt(0).toUpperCase() + why.slice(1) + ".", "#ff8a70", 15, { life: 1 });
          }
          return;
        }
        if (this.mode === "relocate") {
          const t = g.towers.find((x) => x.id === this.relocId);
          if (t && g.relocate(t, p.x, p.y)) { this.clearMode(); this.selected = t.id; this.ui.openPanel(t); }
          else { BK.Audio.ui("deny"); this.R.fx.text(p.x, p.y - 20, g.phase !== "deploy" ? "Between waves only." : "Can't set up there.", "#ff8a70", 15); }
          return;
        }
        if (this.mode === "ability") {
          if (g.useAbility(this.abilityId, p.x, p.y)) this.clearMode();
          else { BK.Audio.ui("deny"); this.R.fx.text(p.x, p.y - 20, this.abilityId === "mines" ? "Mines go on the road." : "Not ready.", "#ff8a70", 15); }
          return;
        }
        // Strip a wreck for parts between waves.
        if (g.phase === "deploy") {
          const w = g.wreckAt(p.x, p.y, 10);
          if (w && !this.towerAt(p.x, p.y)) { g.salvage(w); return; }
        }
        const t = this.towerAt(p.x, p.y);
        const now = performance.now();
        if (!t) {
          // Maybe a pan; decide on release.
          this.drag = { sx: p.sx, sy: p.sy, moved: 0, pan: this.R.bigMap(), tap: true };
          lastTap = { t: now, id: null };
          return;
        }
        if (t) {
          if (now - lastTap.t < 320 && lastTap.id === t.id && t.ko <= 0) {
            g.man(t);
            this.refreshCrew();
            lastTap = { t: 0, id: null };
            return;
          }
          lastTap = { t: now, id: t.id };
          this.selected = t.id;
          this.ui.openPanel(t);
          BK.Audio.ui();
        } else {
          lastTap = { t: now, id: null };
          this.selected = null;
          this.ui.closePanel();
        }
      });
      cv.addEventListener("pointermove", (e) => {
        if (!this.inRun) return;
        const s = this.toScreen(e);
        if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: s.x, y: s.y });
        if (this.pinch && touches.size >= 2) {
          const [a, b] = [...touches.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          this.R.zoomAt(mx, my, d / this.pinch.d);
          this.R.panBy(this.pinch.mx - mx, this.pinch.my - my);
          this.pinch = { d, mx, my };
          return;
        }
        if (this.drag) {
          if (this.drag.mini) { const mm = this.R.minimapHit(s.x, s.y); if (mm) this.R.centerOn(mm[0], mm[1]); return; }
          const dx = s.x - this.drag.sx, dy = s.y - this.drag.sy;
          this.drag.moved += Math.abs(dx) + Math.abs(dy);
          if (this.drag.pan && (this.drag.moved > 8 || !this.drag.tap)) { this.R.panBy(-dx, -dy); this.drag.sx = s.x; this.drag.sy = s.y; }
        }
        const p = this.toWorld(e);
        this.pointer = p;
        // Mousing over supplies picks them up.
        if (e.pointerType === "mouse" && this.g.drops.length) { const dr = this.g.dropAt(p.x, p.y); if (dr) this.g.collectDrop(dr); }
        if (this.g.crew) { this.g.aim.x = p.x; this.g.aim.y = p.y; }
        if (this.mode === "build" && e.pointerType === "mouse") this.ghost = { kind: this.buildKind, x: p.x, y: p.y };
      });
      const up = (e) => {
        if (this.g) this.g.fireHeld = false;
        if (e && e.pointerId != null) touches.delete(e.pointerId);
        if (touches.size < 2) this.pinch = null;
        const d = this.drag;
        this.drag = null;
        // A tap on open ground that did not turn into a pan closes the panel.
        if (d && d.tap && d.moved <= 8 && this.mode === "idle") { this.selected = null; this.ui.closePanel(); }
        if (d && d.right && d.moved <= 8) this.cancel();
      };
      cv.addEventListener("pointerup", up);
      cv.addEventListener("pointercancel", up);
      cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") this.ghost = null; up(); });

      this.keys = {};
      addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });
      addEventListener("blur", () => { this.keys = {}; });
      addEventListener("keydown", (e) => {
        this.keys[e.key.toLowerCase()] = true;
        if (!this.inRun) {
          if (e.key === "Escape" && $("title").classList.contains("hidden")) this.toTitle();
          return;
        }
        if (e.repeat && e.key !== " ") return;
        const k = e.key.toLowerCase();
        if (k === "p" || (k === "escape" && this.paused)) { this.togglePause(); return; }
        if (this.paused || this.g.result) return;
        if (k === "escape") { this.cancel(); return; }
        if (k === " ") { e.preventDefault(); this.sendWave(); return; }
        if (k === "f") { this.toggleSpeed(); return; }
        if (this.ui.buildTab === "forts") {
          const fk = BK.FORT_ORDER.find((f) => BK.FORTS[f].key === k);
          if (fk) { this.armFort(fk); return; }
        }
        const gun = BK.GUN_ORDER.find((g) => BK.GUNS[g].key === k);
        if (gun) { this.armBuild(gun); return; }
        const ab = Object.values(BK.ABILITIES).find((a) => a.key.toLowerCase() === k);
        if (ab && this.g.abil[ab.id]) { this.armAbility(ab.id); return; }
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); return; }
        if (k === "+" || k === "=") { this.R.zoomAt(BK.W / 2, BK.H / 2, 1.2); return; }
        if (k === "-" || k === "_") { this.R.zoomAt(BK.W / 2, BK.H / 2, 1 / 1.2); return; }
        if (k === "i") { this.ui.toggleInventory(); return; }
        if (k === "g") { this.ui.toggleBuildTab(); return; }
        if (k === "r" && this.selected) { const t = this.g.towers.find((x) => x.id === this.selected); if (t && this.g.phase === "deploy") this.armRelocate(t); return; }
        if (k === "e") {
          if (this.g.crew) { this.g.unman(); this.refreshCrew(); return; }
          const t = this.selected ? this.g.towers.find((x) => x.id === this.selected) : this.pointer && this.towerAt(this.pointer.x, this.pointer.y);
          if (t && this.g.man(t)) this.refreshCrew();
          return;
        }
        if (k === "u" && this.selected) {
          const t = this.g.towers.find((x) => x.id === this.selected);
          if (t && this.g.upgradeOptions(t).length === 1) this.g.upgrade(t);
        }
      });
    }

    cancel() {
      if (this.g.crew) { this.g.unman(); this.refreshCrew(); return; }
      if (this.mode !== "idle") { this.clearMode(); return; }
      this.selected = null;
      this.ui.closePanel();
    }

    // ---------------------------------------------------------------- frame
    tick(dt) {
      const g = this.g;
      if (!g) return;
      // Watch the frame time and step the resolution down if the machine is struggling.
      if (this.inRun && !this.paused && dt > 0 && dt < 0.25) {
        this.perf = this.perf || { t: 0, n: 0, sum: 0 };
        const pf = this.perf;
        pf.t += dt; pf.n++; pf.sum += dt;
        if (pf.t > 3) {
          const avg = pf.sum / pf.n;
          const q = this.quality || 1;
          if (avg > 1 / 40 && q > 0.55) { this.quality = Math.max(0.55, q - 0.15); this.resize(); }
          else if (avg < 1 / 58 && q < 1 && pf.good > 3) { this.quality = Math.min(1, q + 0.15); this.resize(); pf.good = 0; }
          pf.good = avg < 1 / 58 ? (pf.good || 0) + 1 : 0;
          pf.t = 0; pf.n = 0; pf.sum = 0;
        }
      }
      const running = !this.paused && !(this.inRun && g.phase === "cards");
      if (running) {
        this.acc += dt * (this.inRun ? this.speed : 1);
        let n = 0;
        while (this.acc >= STEP && n < 8) {
          if (this.bot) this.bot.update(STEP);
        if (!this.inRun && g.phase === "cards" && g.offer) g.takeCard(g.offer[0]);
          g.update(STEP);
          this.acc -= STEP;
          n++;
        }
        if (n >= 8) this.acc = 0;
        if (!this.inRun && (g.phase === "won" || g.phase === "lost")) this.startDemo();
        this.R.update(dt);
      } else {
        this.R.update(0);
      }
      if (this.inRun && this.keys && !this.paused) {
        const K = this.keys, sp = 900 * dt;
        const dx = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0), dy = (K.s || K.arrowdown ? 1 : 0) - (K.w || K.arrowup ? 1 : 0);
        if (dx || dy) this.R.panBy(dx * sp, dy * sp);
      }
      if (this.inRun && g.crew && !g.crewTower()) this.refreshCrew();
      if (this.inRun && $("crewbar").classList.contains("hidden") === !!g.crew) this.refreshCrew();
      this.R.draw(this.inRun ? {
        ghost: this.ghost, ability: this.mode === "ability" ? this.abilityId : null, pointer: this.pointer, selected: this.selected,
        fortGhost: this.mode === "fort" && this.pointer ? { kind: this.fortKind, x: this.pointer.x, y: this.pointer.y } : null,
        relocate: this.mode === "relocate" ? { id: this.relocId } : null,
      } : null);
      if (this.inRun) this.ui.frame(dt);
    }

    mapThumb(i) {
      if (!this.thumbs[i]) {
        const g = new BK.Game({ map: i, save: { unlocks: {} } });
        const r = new BK.Renderer(document.createElement("canvas"), this.images);
        r.setGame(g);
        const cv = document.createElement("canvas");
        cv.width = 480; cv.height = 270;
        const c = cv.getContext("2d");
        c.drawImage(r.ground, 0, 0, 480, 270);
        // Buildings and trees are live scenery now, so draw them into the thumbnail too.
        c.save();
        c.scale(480 / g.WW, 270 / g.WH);
        for (const pr of g.props) {
          if (!BK.Scenery.LIVE[pr.kind]) continue;
          const sp = BK.Scenery.sprite(pr, r.sun, this.images);
          c.drawImage(sp.cv, sp.x, sp.y, sp.size, sp.size);
        }
        c.restore();
        c.globalCompositeOperation = "multiply";
        c.drawImage(r.gradeMul, 0, 0, 480, 270);
        c.globalCompositeOperation = "source-over";
        this.thumbs[i] = cv;
      }
      const out = document.createElement("canvas");
      out.width = 480; out.height = 270;
      out.getContext("2d").drawImage(this.thumbs[i], 0, 0);
      return out;
    }
  }

  BK.app = new App();
  BK.app.boot();
})(window);
