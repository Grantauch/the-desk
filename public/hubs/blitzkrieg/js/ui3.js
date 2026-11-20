// Interface for difficulty, stars, the commander, resuming a battle, the range preview, undo and
// the damage summary. Loaded after main.js so it can extend the running app.
(function (root) {
  const BK = root.BK;
  const $ = (id) => document.getElementById(id);
  const UP = BK.UI.prototype;
  const app = BK.app;
  const Save = BK.Save;
  const RUN_KEY = "bk39-run-v1";

  // ------------------------------------------------------------------ the saved battle
  BK.RunSave = {
    read() {
      try { const s = JSON.parse(localStorage.getItem(RUN_KEY) || "null"); return s && s.v === 1 && BK.MAPS[s.map] && BK.MAPS[s.map].id === s.mapId ? s : null; } catch (e) { return null; }
    },
    write(g) {
      try { localStorage.setItem(RUN_KEY, JSON.stringify(g.snapshot())); return true; } catch (e) { return false; }
    },
    clear() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* nothing saved */ } },
  };
  const stars = (n, of) => "★".repeat(n) + "☆".repeat((of || 3) - n);
  const diffName = (id) => (BK.DIFFS[id] || BK.DIFFS.regular).name;

  // ------------------------------------------------------------------ menus: resume, difficulty, stars
  const baseScreen = UP.screen;
  UP.screen = function (name) {
    baseScreen.call(this, name);
    if (name === "title") this.refreshResume();
  };
  UP.refreshResume = function () {
    const menu = document.querySelector("#title .menu");
    if (!menu) return;
    let b = menu.querySelector("#b-title-resume");
    const s = BK.RunSave.read();
    if (!s) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("button");
      b.id = "b-title-resume";
      b.className = "big resume";
      menu.insertBefore(b, menu.firstChild);
    }
    const m = BK.MAPS[s.map];
    b.innerHTML = `Resume <small>${m.name} · wave ${s.wave + 1} · ${diffName(s.diff)}</small>`;
    b.onclick = () => { BK.Audio.unlock(); this.resumeRun(); };
  };
  UP.resumeRun = function () {
    const s = BK.RunSave.read();
    if (!s) return;
    app.startRun(s.map, s.endless, { snapshot: s, daily: s.daily });
    this.savedWave = s.wave;
    this.toast("Battle resumed", `${BK.MAPS[s.map].name}, ready for wave ${s.wave + 1}.`, null, 0.3, 4);
  };

  const baseMaps = UP.showMaps;
  UP.showMaps = function () {
    baseMaps.call(this);
    const S = Save.data;
    S.bestD = S.bestD || {};
    const cur = S.settings.diff || "regular";
    // Difficulty picker above the cards.
    let bar = $("diffbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "diffbar";
      $("map-grid").before(bar);
    }
    bar.innerHTML = BK.DIFF_ORDER.map((id) => {
      const D = BK.DIFFS[id];
      return `<button data-d="${id}" class="${id === cur ? "on" : ""}" title="${D.desc}"><b>${D.name}</b><small>${D.medals === 1 ? "Medals x1" : "Medals x" + D.medals}</small></button>`;
    }).join("") + `<span class="diffdesc">${BK.DIFFS[cur].desc}</span>`;
    bar.querySelectorAll("button").forEach((b) => {
      b.onclick = () => { S.settings.diff = b.dataset.d; Save.write(); BK.Audio.ui(); this.showMaps(); };
    });
    // Stars and best result for the chosen difficulty on every card.
    const cards = document.querySelectorAll("#map-grid .mapc");
    let total = 0;
    BK.MAPS.forEach((m, i) => {
      const el = cards[i];
      const rec = S.bestD[m.id] || {};
      for (const id of BK.DIFF_ORDER) total += (rec[id] && rec[id].stars) || 0;
      if (!el) return;
      const r = rec[cur];
      const body = el.querySelector(".body");
      if (!body) return;
      body.insertAdjacentHTML("beforeend", `<div class="stars${r && r.stars ? "" : " none"}" title="${diffName(cur)}">${stars((r && r.stars) || 0)}<small>${r ? (r.won ? "Held" : "Best wave " + r.wave) + " on " + diffName(cur) : "Not fought on " + diffName(cur)}</small></div>`);
    });
    const head = document.querySelector("#maps .screen-head h2");
    if (head) head.innerHTML = `Choose a battlefield <span class="startotal">${total} / ${BK.MAPS.length * 12} ★</span>`;
    // Today's daily challenge.
    const dly = BK.dailyFor();
    let db = $("daily");
    if (!db) { db = document.createElement("button"); db.id = "daily"; bar.after(db); }
    const best = (S.dailyBest || {})[dly.date];
    db.innerHTML = `<span class="dk">Daily challenge · ${dly.date}</span><b>${BK.MAPS[dly.map].name}</b><span class="dm">${dly.mods.map((m) => `<span title="${BK.DAILY_MODS[m].desc}">${BK.DAILY_MODS[m].name}</span>`).join("")}<span>${BK.WEATHER[dly.weather].name}</span></span><span class="db">${best ? "Your best today: " + BK.fmt(best.score) + (best.won ? " · held" : " · wave " + best.wave) : "Not tried today"}</span>`;
    db.title = dly.mods.map((m) => BK.DAILY_MODS[m].name + ": " + BK.DAILY_MODS[m].desc).join(" ");
    db.onclick = () => { BK.Audio.unlock(); app.startRun(dly.map, false, { daily: dly, seed: dly.seed, weather: dly.weather, diff: "regular" }); };
    // A saved battle can be picked up from here too.
    const s = BK.RunSave.read();
    let rb = $("maps-resume");
    if (s) {
      if (!rb) { rb = document.createElement("button"); rb.id = "maps-resume"; rb.className = "resume"; bar.after(rb); }
      rb.innerHTML = `Resume ${BK.MAPS[s.map].name} at wave ${s.wave + 1} <small>${diffName(s.diff)}</small>`;
      rb.onclick = () => this.resumeRun();
    } else if (rb) rb.remove();
  };

  // ------------------------------------------------------------------ the result screen
  const baseResult = UP.showResult;
  UP.showResult = function () {
    baseResult.call(this);
    const g = this.g, r = g.result;
    if (!r) return;
    BK.RunSave.clear();
    const S = Save.data;
    S.bestD = S.bestD || {};
    const rec = S.bestD[g.map.id] || (S.bestD[g.map.id] = {});
    if (g.daily) {
      S.dailyBest = S.dailyBest || {};
      const b = S.dailyBest[g.daily.date] || { score: 0, wave: 0, won: false };
      S.dailyBest[g.daily.date] = { score: Math.max(b.score, r.score), wave: Math.max(b.wave, r.cleared), won: b.won || r.won };
      // Only the last two weeks of dailies are kept.
      const keys = Object.keys(S.dailyBest).sort();
      while (keys.length > 14) delete S.dailyBest[keys.shift()];
    }
    if (!g.endless && !g.daily) {
      const b = rec[g.diff] || { stars: 0, wave: 0, score: 0, won: false };
      rec[g.diff] = { stars: Math.max(b.stars, r.stars || 0), wave: Math.max(b.wave, r.cleared), score: Math.max(b.score, r.score), won: b.won || r.won };
    }
    Save.write();
    const kick = $("res-kicker");
    kick.textContent += g.daily ? " · daily " + g.daily.date : " · " + diffName(g.diff);
    let h = "";
    if (r.won && !g.endless) h += `<div class="res-stars">${stars(r.stars)}<small>${r.stars === 3 ? "Full garrison held" : r.stars === 2 ? "Garrison above half" : "The road held, at a cost"}</small></div>`;
    // Damage by gun type, largest first.
    const rows = g.damageSummary().slice(0, 8);
    if (rows.length) {
      h += `<div class="res-dmg"><div class="res-dmg-h">Damage by gun</div>`;
      for (const x of rows) {
        const d = BK.GUNS[x.kind];
        h += `<div class="row"><img alt="" src="${BK.Art.gunIcon(x.kind, 32)}"><span class="nm">${d.short}${x.n > 1 ? " ×" + x.n : ""}</span><span class="bar"><i style="width:${Math.max(2, x.share * 100).toFixed(1)}%"></i></span><span class="v">${BK.fmt(Math.round(x.dmg))}</span><span class="k">${x.kills} kills</span></div>`;
      }
      if (g.hero) h += `<div class="row hero"><img alt="" src="${BK.Art.heroIcon(32)}"><span class="nm">${BK.HERO.name}</span><span class="bar"></span><span class="v">Level ${g.hero.lvl}</span><span class="k">${g.hero.kills} kills</span></div>`;
      h += `</div>`;
    }
    const old = $("res-more");
    if (old) old.remove();
    $("res-next").insertAdjacentHTML("beforebegin", `<div id="res-more">${h}</div>`);
  };

  // ------------------------------------------------------------------ in battle
  const baseStart = UP.startRun;
  UP.startRun = function () {
    baseStart.call(this);
    const g = this.g;
    this.savedWave = g.resumed ? g.wave : -1;
    // One saved battle at a time: the newest one.
    if (!g.resumed) BK.RunSave.clear();
    this.buildHeroBar();
    // Hotkeys on hover.
    for (const k of BK.GUN_ORDER) {
      const d = BK.GUNS[k], b = this.gunBtns[k];
      if (b) b.title = `${d.name}. ${d.role}. Key ${d.key.toUpperCase()}`;
    }
    for (const id in this.abilBtns) {
      const a = BK.ABILITIES[id];
      this.abilBtns[id].title = `${a.name}: ${a.desc} Key ${a.key}`;
    }
    // The range preview toggle sits with the build tabs.
    if (!$("tab-range")) {
      const tabs = document.querySelector(".buildtabs");
      if (tabs) {
        const b = document.createElement("button");
        b.id = "tab-range";
        b.title = "Show every gun's reach. Key L";
        b.innerHTML = `Ranges <small>L</small>`;
        b.onclick = () => this.toggleRanges();
        tabs.appendChild(b);
      }
    }
    app.rangeAll = false;
    const tr = $("tab-range");
    if (tr) tr.classList.remove("on");
    if (g.hero && !g.resumed) this.tipOnce("hero", `${BK.HERO.name} commands the line. Click him, or press H, then click where he should go. Q rallies the guns near him. N throws grenades.`, BK.Art.heroIcon(40), 4);
    if (g.daily) this.banner("Daily challenge", g.daily.label, "streak");
  };
  UP.toggleRanges = function () {
    app.rangeAll = !app.rangeAll;
    const tr = $("tab-range");
    if (tr) tr.classList.toggle("on", app.rangeAll);
    BK.Audio.ui();
  };

  UP.buildHeroBar = function () {
    let bar = $("herobar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "herobar";
      $("abils").after(bar);
    }
    const g = this.g;
    bar.classList.toggle("hidden", !g.hero);
    if (!g.hero) return;
    const ring = `<svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18.5" fill="none" stroke="rgba(255,207,74,0.9)" stroke-width="3" stroke-dasharray="116.2" stroke-dashoffset="116.2"/></svg>`;
    bar.innerHTML = `<button id="hero-face" class="heroface" title="${BK.HERO.name}. Click to select, then click the field to move him. Key H"><img alt="" src="${BK.Art.heroIcon(44)}"><span class="lv" id="hero-lv">1</span><i class="hp"><b id="hero-hp"></b></i><span class="nm">${BK.HERO.name}</span></button>`
      + `<button class="abil" id="hero-rally" title="Rally: guns near the captain fire 40% faster for 8 seconds. Key Q">${ring}<span class="k">Q</span><span class="ic"><i data-ic="bolt"></i></span><span class="lb">Rally</span></button>`
      + `<button class="abil" id="hero-gren" title="Grenades: the captain's runners throw three grenades at the nearest knot of enemies. Key N">${ring}<span class="k">N</span><span class="ic"><i data-ic="burst"></i></span><span class="lb">Grenades</span></button>`;
    if (BK.paintIcons) BK.paintIcons(bar);
    $("hero-face").onclick = () => this.selectHero();
    $("hero-rally").onclick = () => { if (!g.heroRally()) BK.Audio.ui("deny"); };
    $("hero-gren").onclick = () => { if (!g.heroGrenade()) BK.Audio.ui("deny"); };
  };
  UP.selectHero = function () {
    const g = this.g, h = g.hero;
    if (!h) return;
    if (h.dead) { BK.Audio.ui("deny"); this.toast("Commander down", `Back in ${Math.ceil(h.respawn)} seconds.`, null, 0, 2); return; }
    if (app.mode === "hero") { app.clearMode(); return; }
    if (g.crew) { g.unman(); app.refreshCrew(); }
    app.clearMode();
    this.closePanel();
    app.selected = null;
    app.mode = "hero";
    app.cv.classList.add("aim");
    BK.Audio.ui();
    if (app.R.bigMap()) {
      const [sx, sy] = app.R.toScreen(h.x, h.y);
      if (sx < 0 || sy < 0 || sx > BK.W || sy > BK.H) app.R.centerOn(h.x, h.y);
    }
  };

  const baseFrame = UP.frame;
  UP.frame = function (dt) {
    baseFrame.call(this, dt);
    const g = this.g;
    if (!g || !app.inRun) return;
    // Save at the start of every build phase after the first wave.
    if (g.phase === "deploy" && g.wave >= 1 && !g.result && this.savedWave !== g.wave && !g.demo) {
      this.savedWave = g.wave;
      if (BK.RunSave.write(g)) this.tipOnce("autosave", "The battle saves itself between waves. Close the tab and Resume from the title screen.", null, 0.5);
    }
    const h = g.hero;
    if (!h || !$("herobar")) return;
    $("hero-lv").textContent = h.lvl;
    $("hero-hp").style.width = (h.dead ? 0 : (100 * h.hp) / h.maxHp) + "%";
    const face = $("hero-face");
    face.classList.toggle("on", app.mode === "hero");
    face.classList.toggle("dead", h.dead);
    const ring = (id, cd, max, ready) => {
      const b = $(id);
      b.querySelector("circle").setAttribute("stroke-dashoffset", String(116.2 * Math.min(1, cd / max)));
      b.classList.toggle("ready", ready);
    };
    ring("hero-rally", h.rallyCd, BK.HERO.rally.cd, g.heroReady("rally"));
    ring("hero-gren", h.grenCd, BK.HERO.grenade.cd, g.heroReady("grenade"));
  };

  // ------------------------------------------------------------------ Chromebooks
  // The animated film grain is blended over the whole moving canvas. Chromebook GPUs can tear or
  // flicker on that, so it goes on ChromeOS and on any machine that has had to lower its resolution.
  try { if (/CrOS/.test(navigator.userAgent)) document.documentElement.classList.add("lowfx"); } catch (e) { /* no user agent */ }
  setInterval(() => { if ((app.quality || 1) < 1) document.documentElement.classList.add("lowfx"); }, 2000);

  // ------------------------------------------------------------------ input
  app.fieldClick = function (p, e) {
    const g = this.g, h = g && g.hero;
    if (!h || g.crew) return false;
    if (this.mode === "hero") {
      if (!h.dead && Math.hypot(p.x - h.x, p.y - h.y) < 24) { this.clearMode(); return true; }
      if (g.moveHero(p.x, p.y)) { BK.Audio.ui(); this.clearMode(); }
      else { BK.Audio.ui("deny"); this.R.fx.text(p.x, p.y - 20, "He can't go there.", "#ff8a70", 15, { life: 1 }); }
      return true;
    }
    if (this.mode === "idle" && !h.dead && Math.hypot(p.x - h.x, p.y - h.y) < 24) { this.ui.selectHero(); return true; }
    return false;
  };
  app.onKey = function (k, e) {
    const g = this.g;
    if (k === "l") { this.ui.toggleRanges(); return true; }
    if (k === "backspace" || (k === "z" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      const t = g.undoLast();
      if (t) { BK.Audio.ui(); if (this.selected === t.id) { this.selected = null; this.ui.closePanel(); } this.ui.toast("Undone", `${BK.GUNS[t.kind].short} picked up. ${BK.GUNS[t.kind].cost} zł back.`, null, 0, 2); }
      else BK.Audio.ui("deny");
      return true;
    }
    if (!g.hero) return false;
    if (k === "h") { this.ui.selectHero(); return true; }
    if (k === "q") { if (!g.heroRally()) BK.Audio.ui("deny"); return true; }
    if (k === "n") { if (!g.heroGrenade()) BK.Audio.ui("deny"); return true; }
    return false;
  };

  // Restart keeps the same kind of battle, a daily stays the daily, but a resumed one starts fresh.
  const baseStartRun = app.startRun;
  app.startRun = function (mapIndex, endless, opts) {
    if (!opts && this.lastOpts) opts = this.lastOpts;
    this.lastOpts = opts && opts.daily ? { daily: opts.daily, seed: opts.seed, weather: opts.weather } : null;
    return baseStartRun.call(this, mapIndex, endless, opts);
  };

  // A tip the first time a gun is placed: the undo.
  const baseTip = UP.tipOnce;
  UP.tipOnce = function (key, text, img, delay) {
    if (key === "send") baseTip.call(this, "undo", "Placed a gun in the wrong spot? Sell it before the wave for a full refund, or press Backspace.", null, 3);
    return baseTip.call(this, key, text, img, delay);
  };
})(typeof window !== "undefined" ? window : globalThis);
