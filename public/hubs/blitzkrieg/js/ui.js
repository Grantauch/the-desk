// DOM side of the game: HUD, gun panel, cards, crate reels, banners, menus and the save file.
(function (root) {
  const BK = root.BK;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ icons
  const P = {
    heart: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.5.9-1.4 2.3-2.5 4.4-2.5 3.6 0 5.7 3.8 4.2 7.3C19.5 16.4 12 21 12 21z"/>',
    coin: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#5a3f08" stroke-width="1.4"/><path d="M12 8.2l1.2 2.5 2.7.3-2 1.8.6 2.7L12 14.1l-2.5 1.4.6-2.7-2-1.8 2.7-.3z" fill="#5a3f08"/>',
    star: '<path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5c1.2 1 1.8 2.2 1.8 3.5s-.6 2.5-1.8 3.5M18.5 6c2 1.6 3 3.6 3 6s-1 4.4-3 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    music: '<path d="M9 17.5V6l11-2.5v11.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15" r="2.8"/>',
    book: '<path d="M4 4.5h6c1.2 0 2 .8 2 2V20c0-1-.8-1.6-2-1.6H4zM20 4.5h-6c-1.2 0-2 .8-2 2V20c0-1 .8-1.6 2-1.6h6z"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    flame: '<path d="M12 2.5c1 3.4 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.9 1.6-4.6 2.8-6 .2 2 1 3.2 2.2 3.8C11 8.6 11 5.4 12 2.5z"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.5 8.6-8 10-4.5-1.4-8-5-8-10v-6z"/>',
    target: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.6"/>',
    bullets: '<path d="M5 9c0-3 1-5 2-6 1 1 2 3 2 6v11H5zM10 9c0-3 1-5 2-6 1 1 2 3 2 6v11h-4zM15 9c0-3 1-5 2-6 1 1 2 3 2 6v11h-4z"/>',
    shell: '<path d="M9 9c0-4 1.5-6.5 3-7.5 1.5 1 3 3.5 3 7.5v9H9z"/><rect x="8" y="18.5" width="8" height="3" rx="1"/>',
    plane: '<path d="M21 12.5l-7.5-1.6V4.8c0-1-.7-2.3-1.5-2.3s-1.5 1.3-1.5 2.3v6.1L3 12.5v2l7.5-.9v4.6l-2.5 1.6v1.4l4-1 4 1v-1.4l-2.5-1.6v-4.6l7.5.9z"/>',
    radio: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M7 9l9-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="14.5" r="2.5" fill="#1a1a14"/>',
    skull: '<path d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.6 1.2 4.4 3 5.5V20h11v-4c1.8-1.1 3-2.9 3-5.5 0-4.6-3.5-8-8.5-8z"/><circle cx="8.7" cy="11.5" r="2" fill="#1a1a14"/><circle cx="15.3" cy="11.5" r="2" fill="#1a1a14"/>',
    wrench: '<path d="M20.5 6.5l-3.5 3.5-3-3 3.5-3.5c-2.5-1-5.3 0-6.5 2.2-.8 1.4-.8 3-.3 4.3L3.5 17.2a2.1 2.1 0 0 0 3 3l7.2-7.2c1.3.5 2.9.5 4.3-.3 2.2-1.2 3.2-4 2.5-6.2z"/>',
    crate: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 5l17 15M20.5 5l-17 15" stroke="#1a1a14" stroke-width="1.6"/>',
    crosshair: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2"/>',
    burst: '<path d="M12 1.5l2.2 6 6-2.4-3.2 5.6 5.5 3.3-6.4.8.9 6.3-5-4.1-5 4.1.9-6.3-6.4-.8 5.5-3.3L3.8 5.1l6 2.4z"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.6" fill="#1a1a14"/><circle cx="15.5" cy="15.5" r="1.6" fill="#1a1a14"/><circle cx="12" cy="12" r="1.6" fill="#1a1a14"/>',
    bolt: '<path d="M13.5 1.5L4 13.5h6.5l-1.5 9 10-12.5h-6.5z"/>',
    crown: '<path d="M3 8l4.5 4L12 4.5 16.5 12 21 8l-2 11H5z"/>',
    arty: '<path d="M4 20l4-9 3 3 5-10 4 16z"/>',
    mine: '<circle cx="12" cy="13" r="7"/><rect x="10.5" y="3" width="3" height="4" rx="1"/>',
    drop: '<path d="M12 2.5c3.5 5 6.5 8.6 6.5 12a6.5 6.5 0 0 1-13 0c0-3.4 3-7 6.5-12z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" fill="currentColor">${P[name] || P.star}</svg>`;
  BK.icon = svg;
  function paintIcons(rootEl) {
    (rootEl || document).querySelectorAll("i[data-ic]").forEach((el) => { if (!el.firstChild) el.innerHTML = svg(el.dataset.ic); });
  }

  // ------------------------------------------------------------------ save
  const KEY = "bk39-save-v1";
  const Save = {
    data: null,
    load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { d = null; }
      this.data = Object.assign({ medals: 0, unlocks: {}, best: {}, seen: {}, settings: { muted: false, music: true, gore: true }, runs: 0, wins: 0, tips: {} }, d || {});
      if (this.data.settings.gore == null) this.data.settings.gore = true;
      BK.gore = !!this.data.settings.gore;
      return this.data;
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode: progress lasts the session */ }
    },
  };
  BK.Save = Save;

  // ------------------------------------------------------------------ UI
  class UI {
    constructor(app) {
      this.app = app;
      this.toastQ = [];
      this.shownMoney = 0;
      this.lastCombo = 0;
      paintIcons();
      this.buildGuns();
      this.buildAbils();
      this.bind();
    }

    get g() { return this.app.g; }

    bind() {
      $("b-pause").onclick = () => this.app.togglePause();
      $("b-speed").onclick = () => this.app.toggleSpeed();
      $("b-send").onclick = () => this.app.sendWave();
      $("b-leave").onclick = () => { this.g.unman(); this.app.refreshCrew(); };
      $("b-resume").onclick = () => this.app.togglePause(false);
      $("b-restart").onclick = () => this.app.startRun(this.app.lastMap, this.app.lastEndless);
      $("b-quit").onclick = () => this.app.toTitle();
      $("b-reroll").onclick = () => { if (this.g.reroll()) { BK.Audio.ui(); this.showCards(true); } };
      $("b-play").onclick = () => { BK.Audio.unlock(); this.showMaps(); };
      $("b-command").onclick = () => { BK.Audio.unlock(); this.showCommand(); };
      $("b-notes").onclick = () => { BK.Audio.unlock(); this.showNotes(); };
      $("b-again").onclick = () => this.app.startRun(this.app.lastMap, this.app.lastEndless);
      $("b-res-command").onclick = () => { this.app.toTitle(); this.showCommand(); };
      $("b-res-menu").onclick = () => this.app.toTitle();
      for (const id of ["b-sound", "b-sound2"]) $(id).onclick = () => this.toggleSound();
      for (const id of ["b-music", "b-music2"]) $(id).onclick = () => this.toggleMusic();
      for (const id of ["b-gore", "b-gore2"]) $(id).onclick = () => this.toggleGore();
      document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { BK.Audio.ui(); this.screen(b.dataset.go); }));
      this.syncSound();
    }

    toggleSound() {
      const s = Save.data.settings;
      s.muted = !s.muted;
      BK.Audio.setMuted(s.muted);
      Save.write();
      this.syncSound();
    }
    toggleMusic() {
      const s = Save.data.settings;
      s.music = !s.music;
      BK.Audio.setMusic(s.music);
      Save.write();
      this.syncSound();
    }
    toggleGore() {
      const s = Save.data.settings;
      s.gore = !s.gore;
      BK.gore = s.gore;
      Save.write();
      this.syncSound();
    }
    syncSound() {
      const s = Save.data.settings;
      for (const id of ["b-gore", "b-gore2"]) {
        $(id).classList.toggle("off", !s.gore);
        $(id).querySelector("span").textContent = s.gore ? "Blood on" : "Blood off";
      }
      for (const id of ["b-sound", "b-sound2"]) $(id).classList.toggle("off", s.muted);
      for (const id of ["b-music", "b-music2"]) $(id).classList.toggle("off", !s.music);
    }

    screen(name) {
      for (const id of ["title", "maps", "command", "notes"]) $(id).classList.toggle("hidden", id !== name);
      document.querySelectorAll(".v-medals").forEach((el) => (el.textContent = Save.data.medals));
      $("v-medals").textContent = Save.data.medals;
    }

    // ---------------------------------------------------------------- build bar
    buildGuns() {
      const box = $("guns");
      box.innerHTML = "";
      this.gunBtns = {};
      for (const k of BK.GUN_ORDER) {
        const d = BK.GUNS[k];
        const b = document.createElement("button");
        b.className = "gunb";
        b.innerHTML = `<span class="k">${d.key}</span><img alt="" src="${BK.Art.gunIcon(k, 48)}"><span class="n">${d.short}</span><span class="c">${d.cost}</span>`;
        b.title = `${d.name}. ${d.role}.`;
        b.onclick = () => this.app.armBuild(k);
        box.appendChild(b);
        this.gunBtns[k] = b;
      }
    }
    buildAbils() {
      const box = $("abils");
      box.innerHTML = "";
      this.abilBtns = {};
      const ic = { arty: "arty", fighter: "plane", mines: "mine" };
      for (const a of Object.values(BK.ABILITIES)) {
        const b = document.createElement("button");
        b.className = "abil";
        b.title = `${a.name}: ${a.desc}`;
        b.innerHTML = `<svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18.5" fill="none" stroke="rgba(255,207,74,0.9)" stroke-width="3" stroke-dasharray="116.2" stroke-dashoffset="116.2"/></svg><span class="k">${a.key}</span><span class="ic">${svg(ic[a.id])}</span><span class="lb">${a.name}</span>`;
        b.onclick = () => this.app.armAbility(a.id);
        box.appendChild(b);
        this.abilBtns[a.id] = b;
      }
    }

    startRun() {
      const g = this.g;
      for (const k of BK.GUN_ORDER) this.gunBtns[k].classList.toggle("locked", !g.gunAvailable(k));
      for (const id in this.abilBtns) this.abilBtns[id].classList.toggle("hidden", !g.abil[id]);
      $("hud").classList.remove("hidden");
      $("v-wavemax").textContent = g.endless ? "" : "/" + BK.WAVE_COUNT;
      this.shownMoney = g.money;
      this.closePanel();
      $("bossbar").classList.add("hidden");
      $("toasts").innerHTML = "";
      $("banner").innerHTML = "";
      $("reels").innerHTML = "";
      for (const id of ["cards", "pause", "result"]) $(id).classList.add("hidden");
      this.updatePreview();
      this.banner(g.map.name, g.map.sub, "");
      this.tipOnce("place", "Pick a gun below, then click open ground beside the road.", null, 1.5);
    }

    // ---------------------------------------------------------------- per frame
    frame(dt) {
      const g = this.g;
      if (!g) return;
      // Money counts up toward the true value so coin arrivals feel like income.
      const diff = g.money - this.shownMoney;
      if (Math.abs(diff) < 1) this.shownMoney = g.money;
      else this.shownMoney += diff * Math.min(1, dt * (diff < 0 ? 20 : 6));
      $("v-money").textContent = Math.round(this.shownMoney);
      $("v-gar").textContent = g.garrison;
      $("v-wave").textContent = Math.max(1, g.wave + (g.phase === "deploy" ? 1 : 0));
      $("v-score").textContent = BK.fmt(g.score);
      for (const k of BK.GUN_ORDER) {
        const b = this.gunBtns[k];
        b.classList.toggle("poor", g.money < BK.GUNS[k].cost);
        b.classList.toggle("on", this.app.mode === "build" && this.app.buildKind === k);
      }
      for (const id in this.abilBtns) {
        const a = g.abil[id];
        if (!a) continue;
        const max = BK.ABILITIES[id].charge;
        const k = Math.min(1, a.charge / max);
        const b = this.abilBtns[id];
        b.querySelector("circle").setAttribute("stroke-dashoffset", String(116.2 * (1 - k)));
        b.classList.toggle("ready", k >= 1 && g.phase === "combat");
        b.classList.toggle("on", this.app.mode === "ability" && this.app.abilityId === id);
      }
      // Combo meter.
      const cb = $("combo");
      cb.classList.toggle("on", g.combo >= 3);
      cb.classList.toggle("hot", g.combo >= 15);
      cb.classList.toggle("fire", g.combo >= 40);
      if (g.combo !== this.lastCombo) {
        const n = $("v-combo");
        n.textContent = g.combo;
        if (g.combo > this.lastCombo) { n.classList.remove("pop"); void n.offsetWidth; n.classList.add("pop"); }
        $("v-mult").textContent = "pay x" + g.comboMult().toFixed(1);
        this.lastCombo = g.combo;
        BK.Audio.combo = g.combo;
      }
      $("combo-fill").style.width = (g.combo ? Math.max(0, g.comboT / g.mods.comboWin) * 100 : 0) + "%";
      BK.Audio.intensity = g.phase === "combat" ? Math.min(1, 0.3 + g.enemies.length / 30) : 0.1;

      // Boss bar.
      const boss = g.enemies.find((e) => e.boss && !e.gone);
      $("bossbar").classList.toggle("hidden", !boss);
      if (boss) {
        $("boss-name").textContent = boss.def.name;
        $("boss-fill").style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + "%";
      }

      // Buffs.
      const bf = [];
      if (g.buffs.frenzy > 0) bf.push(`Overdrive ${Math.ceil(g.buffs.frenzy)}s`);
      if (g.buffs.rush > 0) bf.push(`Gold rush ${Math.ceil(g.buffs.rush)}s`);
      if (g.mods.lastStand && g.garrison <= 6) bf.push("Last stand");
      if (g.mods.adrenaline && g.combo >= 25) bf.push("Adrenaline");
      const bfs = bf.join("|");
      if (bfs !== this.lastBuffs) {
        $("buffs").innerHTML = bf.map((s) => `<span class="buff">${s}</span>`).join("");
        this.lastBuffs = bfs;
      }

      // Send button.
      const send = $("b-send");
      const canSend = g.phase === "deploy" && (g.endless || g.wave < BK.WAVE_COUNT);
      send.disabled = !canSend;
      send.classList.toggle("pulse", canSend && g.towers.length > 0);
      $("v-sendwave").textContent = g.wave + 1;
      let sub;
      if (g.phase === "combat") sub = `${g.enemies.length + g.queue.length} enemies left`;
      else if (!g.towers.length) sub = "Place a gun first";
      else if (isFinite(g.earlyT)) sub = `+${Math.max(0, Math.ceil(g.earlyT * 0.8))} zł for going now · auto in ${Math.max(0, Math.ceil(g.earlyT))}s`;
      else sub = "Space to send";
      if (sub !== this.lastSub) { $("v-sendsub").textContent = sub; this.lastSub = sub; }
      $("send-timer").style.width = isFinite(g.earlyT) && g.phase === "deploy" ? (g.earlyT / 30) * 100 + "%" : "0";
      if (g.phase === "deploy" && this.previewWave !== g.wave) this.updatePreview();

      if (this.panelFor) this.refreshPanel(false);
      this.drainToasts(dt);
    }

    updatePreview() {
      const g = this.g;
      this.previewWave = g.wave;
      const next = g.wave + 1;
      if (!g.endless && next > BK.WAVE_COUNT) { $("v-preview").innerHTML = ""; return; }
      const def = next <= BK.WAVE_COUNT ? BK.WAVES[next - 1] : null;
      if (!def) { $("v-preview").innerHTML = "<span>Unknown column</span>"; return; }
      const counts = {};
      for (const gr of def.groups) {
        if (gr.squad) { counts.inf = (counts.inf || 0) + gr.squad; if (gr.officer) counts.officer = (counts.officer || 0) + 1; }
        else counts[gr.kind] = (counts[gr.kind] || 0) + gr.n;
      }
      this.iconCache = this.iconCache || {};
      $("v-preview").innerHTML = Object.entries(counts).map(([k, n]) => {
        if (!this.iconCache[k]) this.iconCache[k] = BK.Art.enemyIcon(k, 32);
        return `<span title="${BK.ENEMIES[k].name}"><img alt="" src="${this.iconCache[k]}">${n}</span>`;
      }).join("") + `<span style="padding:0 .4em">${def.name}</span>`;
    }

    // ---------------------------------------------------------------- events
    onEvent(ev) {
      const g = this.g;
      switch (ev.type) {
        case "waveStart":
          this.banner(`Wave ${ev.wave}`, ev.name, ev.boss ? "boss" : "");
          BK.Audio.bugle();
          this.closePanelIfBuild();
          this.waveTips();
          break;
        case "waveClear":
          if (!g.result) this.showCards(false, ev);
          break;
        case "bossIn":
          this.bossIntro(ev);
          break;
        case "bossDown":
          this.banner(ev.name + " destroyed", "", "streak");
          break;
        case "streak": {
          const names = { 10: "Holding", 25: "Unbreakable", 50: "Iron wall", 75: "Legend of the road", 100: "Not one step back", 150: "Immortal", 200: "The road is yours" };
          this.banner(names[ev.combo] || "Streak", ev.combo + " in a row", "streak");
          BK.Audio.streak(ev.combo);
          break;
        }
        case "banner":
          this.banner(ev.str, ev.sub, "");
          break;
        case "leak":
          $("st-gar").classList.remove("hurt"); void $("st-gar").offsetWidth; $("st-gar").classList.add("hurt");
          break;
        case "crateOpen":
          this.reel(ev);
          break;
        case "crateDrop":
          this.tipOnce("crate", "Supplies dropped. Click the crate before it is gone.", null, 0);
          break;
        case "towerKO":
          this.tipOnce("ko", "A gun was knocked out. It comes back at the end of the wave.", null, 0);
          if (this.panelFor && this.g.towers.find((t) => t.id === this.panelFor && t.ko > 0)) this.refreshPanel(true);
          break;
        case "victory":
        case "defeat":
          setTimeout(() => this.showResult(), ev.type === "victory" ? 1600 : 1200);
          if (ev.type === "victory") BK.Audio.victory(); else BK.Audio.defeat();
          break;
        case "kill":
          if (ev.manned && ev.crit) this.tipOnce("crewcrit", "Weak spot kill. Crewed guns hit far harder there.", null, 0);
          break;
      }
    }

    waveTips() {
      const g = this.g;
      const def = g.waveDef;
      if (!def) return;
      const kinds = new Set();
      for (const gr of def.groups) { if (gr.squad) { kinds.add("inf"); if (gr.officer) kinds.add("officer"); } else kinds.add(gr.kind); }
      let delay = 1.4;
      for (const k of kinds) {
        const d = BK.ENEMIES[k];
        if (!d.tip || Save.data.seen[k]) continue;
        Save.data.seen[k] = 1;
        this.toast("New: " + d.name, d.tip, BK.Art.enemyIcon(k, 40), delay, 7);
        delay += 1.2;
      }
      Save.write();
      if (g.wave === 3) this.tipOnce("crew", "Double click a gun to crew it yourself. Aim at the glowing weak spots.", null, 3);
      if (g.wave === 2) this.tipOnce("ability", "Kills charge Artillery. Press Q, then click the road.", null, 4);
    }

    tipOnce(key, text, img, delay) {
      if (Save.data.tips[key]) return;
      Save.data.tips[key] = 1;
      Save.write();
      this.toast("Tip", text, img, delay || 0, 7);
    }

    toast(head, text, img, delay, life) {
      this.toastQ.push({ head, text, img, t: delay || 0, life: life || 5 });
    }
    drainToasts(dt) {
      for (const q of this.toastQ) {
        q.t -= dt;
        if (q.t <= 0 && !q.el) {
          const el = document.createElement("div");
          el.className = "toast";
          el.innerHTML = (q.img ? `<img alt="" src="${q.img}">` : "") + `<div><b>${q.head}</b>${q.text}</div>`;
          $("toasts").appendChild(el);
          q.el = el;
          q.left = q.life;
          while ($("toasts").children.length > 3) $("toasts").firstChild.remove();
        }
        if (q.el) {
          q.left -= dt;
          if (q.left <= 0 && !q.out) { q.out = true; q.el.classList.add("out"); setTimeout(() => q.el.remove(), 400); }
        }
      }
      this.toastQ = this.toastQ.filter((q) => !q.out);
    }

    // Letterbox bars slide in and a nameplate with the unit's portrait introduces each boss.
    bossIntro(ev) {
      const cine = $("cine");
      this.iconCache = this.iconCache || {};
      const key = ev.kind + "-big";
      if (!this.iconCache[key]) this.iconCache[key] = BK.Art.enemyIcon(ev.kind, 96);
      $("plate").innerHTML = `<img alt="" src="${this.iconCache[key]}"><div><div class="k">Enemy commander</div><div class="n">${ev.name}</div><div class="t">${ev.tip}</div></div>`;
      cine.classList.remove("on");
      void cine.offsetWidth;
      cine.classList.add("on");
      BK.Audio.siren && BK.Audio.radio();
      clearTimeout(this.cineT);
      this.cineT = setTimeout(() => cine.classList.remove("on"), 3600);
    }

    banner(big, sub, cls) {
      const el = document.createElement("div");
      el.className = "bn " + (cls || "");
      el.innerHTML = `<div class="big">${big}</div>` + (sub ? `<div class="sub">${sub}</div>` : "");
      const box = $("banner");
      box.innerHTML = "";
      box.appendChild(el);
      setTimeout(() => el.remove(), 2300);
    }

    reel(ev) {
      const box = $("reels");
      const el = document.createElement("div");
      el.className = "reel" + (ev.jackpot ? " jack" : "");
      const pct = this.app.worldToStage(ev.x, ev.y - 26);
      el.style.left = BK.clamp(pct.x, 12, 88) + "%";
      el.style.top = BK.clamp(pct.y, 30, 95) + "%";
      const pool = BK.CRATE.map((c) => c.icon);
      const strips = [];
      for (let r = 0; r < 3; r++) {
        const items = [];
        for (let i = 0; i < 12 + r * 4; i++) items.push(pool[Math.floor(Math.random() * pool.length)]);
        items.push(ev.icon);
        strips.push(items);
      }
      el.innerHTML = `<div class="wins">${strips.map((items, r) => `<div class="win"><div class="strip" style="transition-duration:${0.75 + r * 0.3}s">${items.map((ic) => `<div>${svg(ic)}</div>`).join("")}</div></div>`).join("")}</div><div class="rlab">${ev.label}</div>`;
      box.appendChild(el);
      const els = el.querySelectorAll(".strip");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        els.forEach((st, r) => { st.style.transform = `translateY(-${(strips[r].length - 1) * 3.2}em)`; });
      }));
      [0, 1, 2].forEach((r) => setTimeout(() => BK.Audio.ui(), (0.75 + r * 0.3) * 1000));
      setTimeout(() => el.classList.add("land"), 1400);
      setTimeout(() => el.classList.add("done"), 1500);
      setTimeout(() => el.remove(), 2900);
    }

    // ---------------------------------------------------------------- gun panel
    openPanel(t) {
      this.panelFor = t.id;
      this.refreshPanel(true);
      this.tipOnce("crewbtn", "Crew This Gun puts you behind it. You aim, it hits harder, and weak spots light up.", null, 0.3);
    }
    closePanel() {
      this.panelFor = null;
      $("panel").classList.add("hidden");
    }
    closePanelIfBuild() {}

    refreshPanel(force) {
      const g = this.g;
      const t = g.towers.find((x) => x.id === this.panelFor);
      if (!t) { this.closePanel(); return; }
      const key = [t.level, t.spec, t.priority, g.money >= (g.upgradeCost(t) || 1e9), t.ko > 0, t.manned, g.phase].join(",");
      if (!force && key === this.panelKey) return;
      this.panelKey = key;
      const d = BK.GUNS[t.kind];
      const s = g.towerStats(Object.assign({}, t, { manned: false }));
      const c = g.upgradeCost(t);
      let next = null;
      if (c != null && t.level < 3) next = g.towerStats(Object.assign({}, t, { manned: false, level: t.level + 1 }));
      const fmt = (v) => (v >= 10 ? Math.round(v) : v.toFixed(1));
      const up = (a, b) => (b && b > a + 0.01 ? `<em>+${fmt(b - a)}</em>` : "");
      let h = `<h3>${d.short} <small>${t.spec ? d.specs.find((x) => x.id === t.spec).name : "Level " + t.level}</small></h3>`;
      h += `<div class="role">${d.role}${t.kills ? ` · ${t.kills} kills` : ""}</div>`;
      h += `<div class="stats"><div><span>Damage</span><b>${fmt(s.dmg)}</b>${up(s.dmg, next && next.dmg)}</div><div><span>Shots/s</span><b>${s.rate.toFixed(1)}</b>${up(s.rate, next && next.rate)}</div><div><span>Range</span><b>${Math.round(s.range)}</b>${up(s.range, next && next.range)}</div></div>`;
      h += `<button class="pbtn crew" data-a="crew" ${t.ko > 0 ? "disabled" : ""}>${svg("crosshair").replace("<svg", '<svg width="18" height="18"')} ${t.manned ? "Leave gun" : "Crew this gun"} <small style="opacity:.7">C</small></button>`;
      if (c != null && t.level < 3) {
        h += `<button class="pbtn" data-a="up" ${g.money < c ? "disabled" : ""}><b>Upgrade to level ${t.level + 1}</b><span class="cost">${c} zł</span></button>`;
      } else if (c != null) {
        for (const sp of d.specs) h += `<button class="pbtn spec" data-a="spec" data-s="${sp.id}" ${g.money < c ? "disabled" : ""}><span style="display:flex;justify-content:space-between"><b>${sp.name}</b><span class="cost">${c} zł</span></span><small>${sp.desc}</small></button>`;
      }
      if (!t.manned && t.kind !== "mortar" || t.kind === "mortar") {
        const pr = ["first", "last", "strong", "near"];
        h += `<div class="prio">${pr.map((p) => `<button data-a="prio" data-p="${p}" class="${t.priority === p ? "on" : ""}">${p}</button>`).join("")}</div>`;
      }
      h += `<div class="prow"><button class="pbtn sell" data-a="sell"><b>Sell</b><span class="cost">${g.sellValue(t)} zł</span></button><button class="pbtn" data-a="close"><b>Close</b></button></div>`;
      const el = $("panel");
      el.innerHTML = h;
      el.classList.remove("hidden");
      el.querySelectorAll("button[data-a]").forEach((b) => {
        b.onclick = (ev) => {
          ev.stopPropagation();
          const a = b.dataset.a;
          if (a === "crew") { if (t.manned) g.unman(); else g.man(t); this.app.refreshCrew(); if (t.manned) this.closePanel(); }
          else if (a === "up") { if (!g.upgrade(t)) BK.Audio.ui("deny"); }
          else if (a === "spec") { if (!g.upgrade(t, b.dataset.s)) BK.Audio.ui("deny"); }
          else if (a === "prio") { t.priority = b.dataset.p; BK.Audio.ui(); }
          else if (a === "sell") { g.sell(t); this.closePanel(); return; }
          else if (a === "close") { this.closePanel(); return; }
          this.refreshPanel(true);
        };
      });
      // Float beside the gun, flipping sides so it never covers it.
      const p = this.app.worldToStage(t.x, t.y);
      const left = t.x < BK.W * 0.55;
      el.style.left = left ? `calc(${p.x}% + 2.4em)` : "";
      el.style.right = left ? "" : `calc(${100 - p.x}% + 2.4em)`;
      el.style.top = `clamp(3.5em, calc(${p.y}% - 8em), calc(100% - 7em - ${el.offsetHeight}px))`;
    }

    // ---------------------------------------------------------------- cards
    showCards(reroll, ev) {
      const g = this.g;
      if (!g.offer) return;
      $("cards").classList.remove("hidden");
      if (ev) {
        $("cards-kicker").textContent = `Wave ${ev.wave} held`;
        $("cards-pay").innerHTML = `Wave pay <b>+${ev.clear} zł</b> · Interest <b>+${ev.interest} zł</b>`;
      }
      const row = $("card-row");
      row.innerHTML = "";
      g.offer.forEach((card, i) => {
        const el = document.createElement("button");
        el.className = "card " + card.rarity;
        el.style.animationDelay = i * 0.12 + "s";
        const have = g.cardsTaken[card.id] || 0;
        el.innerHTML = `<div class="rar">${BK.RARITY[card.rarity].label}</div><div class="ic">${svg(card.icon)}</div><h4>${card.name}</h4><p>${card.desc}</p><div class="stack">${[have ? `Owned ${have}` : "", card.max > 1 ? `Stacks up to ${card.max}` : ""].filter(Boolean).join(" · ")}</div>`;
        el.onclick = () => this.pickCard(card, el);
        row.appendChild(el);
        setTimeout(() => BK.Audio.card(card.rarity), i * 120 + 100);
      });
      $("v-rerolls").textContent = g.rerolls;
      $("b-reroll").disabled = g.rerolls <= 0;
    }
    pickCard(card, el) {
      if (this.picking) return;
      this.picking = true;
      document.querySelectorAll("#card-row .card").forEach((c) => c.classList.add(c === el ? "chosen" : "gone"));
      BK.Audio.upgrade();
      setTimeout(() => {
        this.picking = false;
        this.g.takeCard(card);
        $("cards").classList.add("hidden");
        this.updatePreview();
        this.banner(card.name, BK.RARITY[card.rarity].label + " card", card.rarity === "legendary" || card.rarity === "epic" ? "streak" : "");
      }, 450);
    }

    // ---------------------------------------------------------------- result
    showResult() {
      const g = this.g, r = g.result;
      if (!r) return;
      const S = Save.data;
      S.medals += r.medals;
      S.runs++;
      if (r.won) S.wins++;
      const best = S.best[g.map.id] || { wave: 0, score: 0, won: false };
      const newBest = r.score > best.score;
      S.best[g.map.id] = { wave: Math.max(best.wave, r.cleared), score: Math.max(best.score, r.score), won: best.won || r.won };
      Save.write();
      const el = $("result");
      el.classList.remove("hidden", "win", "lose");
      el.classList.add(r.won ? "win" : "lose");
      $("res-kicker").textContent = g.map.name + (g.endless ? " · endless" : "");
      $("res-title").textContent = r.won ? "The road held" : g.endless ? `Overrun at wave ${r.wave}` : "The line broke";
      const stat = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
      $("res-stats").innerHTML = stat("Waves", r.cleared) + stat("Kills", r.kills) + stat("Best combo", r.bestCombo) + stat("Weak spot hits", g.stats.crits) + stat("Score", BK.fmt(r.score) + (newBest ? " ★" : ""));
      const m = $("res-medals");
      let n = 0;
      const step = () => { n = Math.min(r.medals, n + Math.max(1, Math.ceil(r.medals / 20))); m.textContent = n; BK.Audio.coin(); if (n < r.medals) setTimeout(step, 50); };
      m.textContent = "0";
      setTimeout(step, 400);
      const afford = BK.UNLOCKS.filter((u) => !S.unlocks[u.id] && u.cost <= S.medals && (!u.requires || S.unlocks[u.requires]));
      $("res-next").textContent = afford.length ? `You can unlock ${afford[0].name} in Command.` : "";
      $("hud").classList.add("hidden");
    }

    // ---------------------------------------------------------------- menus
    showMaps() {
      this.screen("maps");
      const S = Save.data;
      const grid = $("map-grid");
      grid.innerHTML = "";
      BK.MAPS.forEach((m, i) => {
        const locked = m.unlock && !S.unlocks[m.unlock];
        const best = S.best[m.id];
        const el = document.createElement("button");
        el.className = "mapc" + (locked ? " locked" : "");
        const cv = this.app.mapThumb(i);
        el.innerHTML = `<div class="body"><div class="sub">${m.sub}</div><h3>${m.name}</h3><p>${m.blurb}</p><div class="best">${best ? `Best: wave <b>${best.wave}</b> · ${BK.fmt(best.score)}${best.won ? " · <b>held</b>" : ""}` : "Not fought yet"}</div></div>` + (locked ? `<div class="lock">${svg("lock").replace("<svg", '<svg width="34" height="34"')}<span>Unlock in Command</span><span>${BK.UNLOCK_BY_ID[m.unlock].cost} medals</span></div>` : "");
        el.prepend(cv);
        el.onclick = () => {
          if (locked) { BK.Audio.ui("deny"); this.showCommand(); return; }
          this.app.startRun(i, $("endless").checked && S.wins > 0);
        };
        grid.appendChild(el);
      });
      $("endless-wrap").classList.toggle("hidden", !(S.wins > 0));
    }

    showCommand() {
      this.screen("command");
      const S = Save.data;
      const grid = $("unlock-grid");
      grid.innerHTML = "";
      for (const u of BK.UNLOCKS) {
        const owned = !!S.unlocks[u.id];
        const blocked = u.requires && !S.unlocks[u.requires];
        const el = document.createElement("div");
        el.className = "unl" + (owned ? " owned" : "");
        el.innerHTML = `<div class="ty">${u.type}</div><h4>${u.name}</h4><p>${u.desc}${blocked ? " Needs " + BK.UNLOCK_BY_ID[u.requires].name + "." : ""}</p><button class="buy" ${owned || blocked || S.medals < u.cost ? "disabled" : ""}>${owned ? "Owned" : `${u.cost} medals`}</button>`;
        el.querySelector(".buy").onclick = () => {
          if (owned || S.medals < u.cost) return;
          S.medals -= u.cost;
          S.unlocks[u.id] = true;
          Save.write();
          BK.Audio.upgrade();
          this.showCommand();
        };
        grid.appendChild(el);
      }
    }

    showNotes() {
      this.screen("notes");
      const b = $("notes-body");
      let h = `<p class="typed">On 1 September 1939 Germany invaded Poland from the west, north and south. Polish units fought for five weeks against a larger, more mechanized army. The Soviet Union invaded from the east on 17 September. Warsaw surrendered on 28 September, and the last large Polish formation laid down its arms near Kock on 6 October.</p>`;
      h += `<p>The battlefields here are fictional, but the guns and the vehicles are drawn from that campaign.</p>`;
      h += `<h3>How to play</h3>`;
      h += `<p>Build guns beside the road. Every unit that reaches the far end costs garrison, and the battle ends at zero. Kills pay złoty and charge your abilities. Chaining kills builds a combo that raises your pay.</p>`;
      h += `<p>Double click any gun, or press C, to crew it yourself. A crewed gun follows your aim and hits harder. Weak spots glow gold while you crew: engine decks, fuel drums, tracks, tires and the command tank's radio frame.</p>`;
      h += `<p>After each wave you pick one of three cards. Supply crates parachute in during a wave. Click them before they vanish. Medals from every battle buy permanent unlocks in Command.</p>`;
      h += `<h3>The guns</h3>`;
      for (const k of BK.GUN_ORDER) {
        const d = BK.GUNS[k];
        h += `<div class="gunrow"><img alt="" src="${BK.Art.gunIcon(k, 48)}"><div><b>${d.name}</b>. ${d.role}.<br><span style="color:var(--mute)">${d.history}</span></div></div>`;
      }
      b.innerHTML = h;
    }
  }
  BK.UI = UI;
  BK.paintIcons = paintIcons;
})(typeof window !== "undefined" ? window : globalThis);
