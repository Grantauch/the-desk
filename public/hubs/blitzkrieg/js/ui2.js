// UI for the expansion: the Guns and Defenses tabs, the upgrade tree panel with crews and cover,
// the inventory that opens after every wave, Supplies Inbound, battle briefings and honors.
(function (root) {
  const BK = root.BK;
  const $ = (id) => document.getElementById(id);
  const UP = BK.UI.prototype;
  const svg = BK.icon;

  // Small canvas icons for items, drawn with the renderer's item art.
  const itemIcons = {};
  function itemIcon(item) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 52;
    const c = cv.getContext("2d");
    c.scale(2, 2);
    BK.Renderer.prototype.drawItem.call(null, c, item, 13, 13, 10);
    return cv;
  }
  function fortIcon(kind) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 96;
    const c = cv.getContext("2d");
    c.scale(1.2, 1.2);
    const f = { kind, x: 40, y: 40, ang: kind === "sandbag" ? 0 : kind === "wire" ? 0.3 : 0, hp: 1, maxHp: 1 };
    if (kind === "dig") BK.Art.crater(c, { x: 40, y: 40, r: 18 });
    else BK.Art.fort(c, f, { x: 0.5, y: 0.6, a: 0.35 });
    return cv.toDataURL();
  }

  // ------------------------------------------------------------------ build bar tabs
  const baseBind = UP.bind;
  UP.bind = function () {
    baseBind.call(this);
    this.buildTab = "guns";
    $("tab-guns").onclick = () => this.setBuildTab("guns");
    $("tab-forts").onclick = () => this.setBuildTab("forts");
    $("b-inv").onclick = () => this.toggleInventory();
    $("b-inv-expand").onclick = () => this.expandInventory();
    $("b-inv-go").onclick = () => this.closeInventory();
    $("b-brief-go").onclick = () => this.closeBriefing();
    this.buildForts();
    // Name each track as it starts, during a battle.
    BK.Audio.onTrack = (t) => { if (this.app.inRun && BK.Audio.musicOn && !BK.Audio.muted) this.toast("Now playing", t.name, null, 0, 3); };
  };
  UP.setBuildTab = function (tab) {
    this.buildTab = tab;
    $("tab-guns").classList.toggle("on", tab === "guns");
    $("tab-forts").classList.toggle("on", tab === "forts");
    $("guns").classList.toggle("hidden", tab !== "guns");
    $("forts").classList.toggle("hidden", tab !== "forts");
    if (this.app.mode === "fort" || this.app.mode === "build") this.app.clearMode();
    BK.Audio.ui();
  };
  UP.toggleBuildTab = function () { this.setBuildTab(this.buildTab === "guns" ? "forts" : "guns"); };
  UP.buildForts = function () {
    const box = $("forts");
    box.innerHTML = "";
    this.fortBtns = {};
    for (const k of BK.FORT_ORDER) {
      const d = BK.FORTS[k];
      const b = document.createElement("button");
      b.className = "gunb";
      b.innerHTML = `<span class="k">${d.key}</span><img alt="" src="${fortIcon(k)}"><span class="n">${d.short}</span><span class="c">${d.cost}</span>`;
      b.title = `${d.name}. ${d.desc}`;
      b.onclick = () => this.app.armFort(k);
      box.appendChild(b);
      this.fortBtns[k] = b;
    }
  };
  const baseAbils = UP.buildAbils;
  UP.buildAbils = function () {
    baseAbils.call(this);
    // Icons for the two new abilities.
    const extra = { train: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="7" width="15" height="9" rx="1.5"/><rect x="17" y="10" width="4" height="6" rx="1"/><circle cx="7" cy="18" r="2"/><circle cx="14" cy="18" r="2"/><rect x="8" y="4" width="3" height="3"/></svg>', uhlans: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20l2-6c-1-1-1.5-3-.5-5L9 5l3 1 2-2 1 3 3 2-1 2-3-1-1 3 3 6h-2.5l-2.5-5-3 2-1 4z"/><path d="M14 2l8 18" stroke="currentColor" stroke-width="1.2"/></svg>' };
    for (const id in extra) if (this.abilBtns[id]) this.abilBtns[id].querySelector(".ic").innerHTML = extra[id];
  };

  // ------------------------------------------------------------------ run start
  const baseStart = UP.startRun;
  UP.startRun = function () {
    baseStart.call(this);
    this.setBuildTab("guns");
    $("inv").classList.add("hidden");
    document.getElementById("stage").classList.toggle("bigmap", this.app.R.bigMap());
    this.invSeen = 0;
    const g = this.g;
    if (g.map.briefing || g.weatherId !== "clear") this.showBriefing();
  };

  UP.showBriefing = function () {
    const g = this.g, m = g.map;
    $("brief-kicker").textContent = m.sub;
    $("brief-title").textContent = m.name;
    const w = BK.WEATHER[g.weatherId];
    $("brief-meta").innerHTML = [`${m.size} battlefield`, `${g.paths.length} road${g.paths.length > 1 ? "s" : ""} in`, g.layout && g.layout.river ? "River crossing" : "", g.layout && g.layout.rail ? "Railway" : "", w.name].filter(Boolean).map((s) => `<span>${s}</span>`).join("");
    $("brief-text").textContent = m.briefing || m.blurb;
    const tips = [];
    if (g.weatherId !== "clear") tips.push(w.desc);
    if (this.app.R.bigMap()) tips.push("Drag or use WASD to move around the field, scroll to zoom, and click the map in the corner to jump.");
    $("brief-tip").textContent = tips.join(" ");
    $("brief").classList.remove("hidden");
    this.app.paused = true;
  };
  UP.closeBriefing = function () {
    $("brief").classList.add("hidden");
    this.app.paused = false;
    BK.Audio.ui();
  };

  // ------------------------------------------------------------------ per frame
  const baseFrame = UP.frame;
  UP.frame = function (dt) {
    baseFrame.call(this, dt);
    const g = this.g;
    if (!g) return;
    if (this.fortBtns) {
      for (const k of BK.FORT_ORDER) {
        const b = this.fortBtns[k];
        b.classList.toggle("poor", g.money < BK.FORTS[k].cost || g.phase !== "deploy");
        b.classList.toggle("on", this.app.mode === "fort" && this.app.fortKind === k);
      }
    }
    let n = 0;
    for (const k in g.inv) n += g.inv[k];
    if (n !== this.invCount) {
      $("v-inv").textContent = n;
      $("b-inv").classList.toggle("new", n > (this.invSeen || 0));
      this.invCount = n;
    }
  };

  // ------------------------------------------------------------------ events
  const baseEvent = UP.onEvent;
  UP.onEvent = function (ev) {
    const g = this.g;
    switch (ev.type) {
      case "waveClear":
        if (!g.result) this.showInventory(ev);
        return;
      case "honor":
        this.toast("Battle honor", `${ev.name}. +${ev.medals} medals at the end of the battle.`, null, 0, 4);
        BK.Audio.streak && BK.Audio.streak(25);
        return;
      case "promote":
        if (ev.rank >= 2) this.toast("Promotion", `${BK.RANKS[ev.rank].short} ${ev.name}'s crew, ${BK.GUNS[ev.kind].short}, is now ${BK.RANKS[ev.rank].name}. New upgrades open up.`, null, 0, 3.5);
        if (this.panelFor === ev.id) this.refreshPanel(true);
        return;
      case "surrender":
        this.tipOnce("surrender", "Kill an officer and his squad may give up. Prisoners walk to your guns and pay, and some carry maps.", null, 0);
        return;
      case "drop":
        this.tipOnce("drop", "Supplies on the ground. Click or mouse over them to pick them up. They upgrade your guns.", null, 0);
        return;
      case "waveStart":
        if (g.wave === 1) this.tipOnce("dig", "Between waves, open the Defenses tab to lay sandbags, wire and roadblocks.", null, 8);
        break;
    }
    baseEvent.call(this, ev);
  };

  // ------------------------------------------------------------------ inventory
  UP.showInventory = function (ev) {
    const g = this.g;
    this.invFromWave = !!ev;
    $("inv").classList.remove("hidden");
    $("inv-grid").classList.add("hidden");
    $("b-inv-expand").textContent = "Show full inventory";
    $("b-inv-expand").classList.remove("hidden");
    const loot = (ev && ev.loot) || {};
    if (ev) {
      $("inv-kicker").textContent = `Wave ${ev.wave} held · +${ev.clear} zł pay · +${ev.interest} zł interest`;
      $("inv-title").textContent = "The haul";
      const m = ev.mvp;
      $("inv-mvp").innerHTML = m ? `Wave MVP: <b>${m.rank} ${m.name}</b> on the ${m.form}, ${m.kills || 0} kills and ${m.dmg} damage. +25 XP.` : "";
      $("b-inv-go").textContent = "Supplies inbound";
    } else {
      $("inv-kicker").textContent = g.map.name;
      $("inv-title").textContent = "Inventory";
      $("inv-mvp").innerHTML = "Items from the field. Spend them on gun upgrades.";
      $("b-inv-go").textContent = "Close";
    }
    const box = $("inv-loot");
    box.innerHTML = "";
    const src = ev ? loot : g.inv;
    const keys = Object.keys(BK.ITEMS).filter((k) => (src[k] || 0) > 0);
    if (!keys.length) box.innerHTML = `<span class="none">${ev ? "Nothing picked up this wave. Knocked out vehicles and officers drop supplies." : "Empty. Pick up what the enemy drops, and strip wrecks between waves."}</span>`;
    keys.forEach((k, i) => {
      const el = document.createElement("div");
      el.className = "item" + (ev ? " fresh" : "");
      el.style.animationDelay = i * 0.07 + "s";
      el.appendChild(itemIcon(k));
      el.insertAdjacentHTML("beforeend", `<b>${BK.ITEMS[k].name}</b><span class="n">${ev ? "+" : "×"}${src[k]}</span>`);
      box.appendChild(el);
      if (ev) setTimeout(() => BK.Audio.coin(2), 120 + i * 80);
    });
    if (!ev) this.expandInventory();
    let n = 0;
    for (const k in g.inv) n += g.inv[k];
    this.invSeen = n;
    $("b-inv").classList.remove("new");
  };
  UP.expandInventory = function () {
    const g = this.g;
    const grid = $("inv-grid");
    if (!grid.classList.contains("hidden") && this.invFromWave) { grid.classList.add("hidden"); $("b-inv-expand").textContent = "Show full inventory"; return; }
    grid.classList.remove("hidden");
    $("b-inv-expand").textContent = this.invFromWave ? "Hide full inventory" : "";
    if (!this.invFromWave) $("b-inv-expand").classList.add("hidden");
    grid.innerHTML = "";
    // What each item is good for, from the upgrade trees.
    const uses = {};
    for (const kind in BK.TREES) for (const id in BK.TREES[kind]) {
      const n = BK.TREES[kind][id];
      for (const it in n.items || {}) (uses[it] = uses[it] || []).push(n.name);
    }
    for (const k of Object.keys(BK.ITEMS)) {
      const row = document.createElement("div");
      row.className = "row";
      row.appendChild(itemIcon(k));
      const u = (uses[k] || []).slice(0, 4).join(", ");
      row.insertAdjacentHTML("beforeend", `<div><b>${BK.ITEMS[k].name} <span>×${g.inv[k] || 0}</span></b><small>${BK.ITEMS[k].desc}${u ? " Used for " + u + "." : ""}</small></div>`);
      grid.appendChild(row);
    }
  };
  UP.toggleInventory = function () {
    if (!$("inv").classList.contains("hidden")) { this.closeInventory(); return; }
    if (this.g.phase === "cards") return;
    this.showInventory(null);
    this.app.paused = true;
  };
  UP.closeInventory = function () {
    $("inv").classList.add("hidden");
    BK.Audio.ui();
    if (this.invFromWave) { this.invFromWave = false; this.showCards(false, this.lastClear); }
    else this.app.paused = false;
  };
  const baseCards = UP.showCards;
  UP.showCards = function (reroll, ev) {
    if (ev) this.lastClear = ev;
    baseCards.call(this, reroll, ev || this.lastClear);
    if (this.lastClear) $("cards-kicker").textContent = `Wave ${this.lastClear.wave} held`;
  };
  // Capture the wave clear payload before the inventory opens.
  const baseShowInv = UP.showInventory;
  UP.showInventory = function (ev) { if (ev) this.lastClear = ev; baseShowInv.call(this, ev); };

  // ------------------------------------------------------------------ the gun panel
  UP.refreshPanel = function (force) {
    const g = this.g;
    const t = g.towers.find((x) => x.id === this.panelFor);
    if (!t) { this.closePanel(); return; }
    const invKey = Object.keys(g.inv).map((k) => k + g.inv[k]).join("");
    const key = [t.path.join(">"), t.rank, Math.floor(t.xp / 10), t.priority, Math.floor(g.money / 5), invKey, t.ko > 0, t.manned, g.phase, t.coverVer, g.forts.length].join(",");
    if (!force && key === this.panelKey) return;
    this.panelKey = key;
    const d = BK.GUNS[t.kind];
    const node = g.node(t);
    const s = g.towerStats(Object.assign({}, t, { manned: false }));
    const fmt = (v) => (v >= 10 ? Math.round(v) : v.toFixed(1));
    const rk = BK.RANKS[t.rank || 0], nxt = BK.RANKS[(t.rank || 0) + 1];
    const xpK = nxt ? Math.min(1, (t.xp - rk.xp) / (nxt.xp - rk.xp)) : 1;
    let h = `<h3>${node.name} <small>${d.short}</small></h3>`;
    h += `<div class="crewline"><span><b>${rk.short} ${t.crewName}</b> and crew</span><span>${t.kills || 0} kills</span></div>`;
    h += `<div class="xp" title="${nxt ? Math.round(t.xp) + " / " + nxt.xp + " XP to " + nxt.name : "Highest rank"}"><i style="width:${xpK * 100}%"></i></div>`;
    // Where this gun came from.
    const trail = t.path.map((id) => BK.TREES[t.kind][id].name);
    if (trail.length > 1) h += `<div class="trail">${trail.map((n, i) => (i === trail.length - 1 ? `<b>${n}</b>` : n)).join(" › ")}</div>`;
    else h += `<div class="role">${d.role}</div>`;
    // Cover.
    const cv = g.coverOf(t);
    const tags = [];
    const mortar = t.kind === "mortar";
    if (cv.crater) tags.push(mortar ? `<span>Crater: −35% damage, +15% fire rate, +10% blast</span>` : `<span>Crater: −35% damage taken</span><span class="bad">Crater: −15% range</span>`);
    if (cv.ruin) tags.push(`<span>Ruins: −40% damage taken</span>`);
    if (cv.sandbags) tags.push(`<span>Sandbags ×${cv.sandbags}: −${cv.sandbags === 2 ? 36 : 20}% damage</span>`);
    if (s.camo) tags.push(`<span>Camouflaged</span>`);
    if (t.supT > 0) tags.push(`<span class="bad">Pinned down</span>`);
    if (tags.length) h += `<div class="cover">${tags.join("")}</div>`;
    h += `<div class="stats"><div><span>Damage</span><b>${fmt(s.dmg)}</b></div><div><span>Shots/s</span><b>${s.rate.toFixed(1)}</b></div><div><span>Range</span><b>${Math.round(s.range)}</b></div></div>`;
    h += `<button class="pbtn crew" data-a="crew" ${t.ko > 0 ? "disabled" : ""}>${svg("crosshair").replace("<svg", '<svg width="18" height="18"')} ${t.manned ? "Leave gun" : "Crew this gun"} <small style="opacity:.7">E</small></button>`;
    // The next forms this gun can take.
    const opts = g.upgradeOptions(t);
    for (const n of opts) {
      const why = g.upgradeBlock(t, n);
      const needs = [];
      const rankNeed = BK.RANK_FOR_TIER[n.tier];
      if (rankNeed) needs.push(`<span class="${(t.rank || 0) >= rankNeed ? "ok" : "no"}">${BK.RANKS[rankNeed].name}</span>`);
      for (const [k, v] of Object.entries(n.items || {})) needs.push(`<span class="${(g.inv[k] || 0) >= v ? "ok" : "no"}">${v}× ${BK.ITEMS[k].name} (${g.inv[k] || 0})</span>`);
      h += `<button class="upopt${n.tier === 3 ? " tier3" : ""}" data-a="up" data-n="${n.id}" ${why ? "disabled" : ""} title="${why || "Upgrade"}"><img alt="" src="${BK.Art.formIcon(t.kind, n.id, 48)}"><div><div class="top"><b>${n.name}</b><span class="cost">${n.cost} zł</span></div><small>${n.desc}</small><div class="needs">${needs.join("")}</div></div></button>`;
    }
    if (!opts.length) h += `<div class="role" style="margin-top:.4em">Final form. This crew has nothing left to learn but the enemy.</div>`;
    const pr = ["first", "last", "strong", "near"];
    h += `<div class="prio">${pr.map((p) => `<button data-a="prio" data-p="${p}" class="${t.priority === p ? "on" : ""}">${p}</button>`).join("")}</div>`;
    h += `<div class="prow">${g.phase === "deploy" ? `<button class="pbtn small" data-a="move"><b>Move</b><small>R</small></button>` : ""}<button class="pbtn sell small" data-a="sell"><b>Sell</b><span class="cost">${g.sellValue(t)} zł</span></button><button class="pbtn small" data-a="close"><b>Close</b></button></div>`;
    const el = $("panel");
    el.innerHTML = h;
    el.classList.remove("hidden");
    el.querySelectorAll("button[data-a]").forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        const a = b.dataset.a;
        if (a === "crew") { if (t.manned) g.unman(); else g.man(t); this.app.refreshCrew(); if (t.manned) this.closePanel(); }
        else if (a === "up") { if (!g.upgrade(t, b.dataset.n)) BK.Audio.ui("deny"); }
        else if (a === "prio") { t.priority = b.dataset.p; BK.Audio.ui(); }
        else if (a === "move") { this.app.armRelocate(t); return; }
        else if (a === "sell") { g.sell(t); this.closePanel(); return; }
        else if (a === "close") { this.closePanel(); return; }
        this.refreshPanel(true);
      };
    });
    this.placePanel(t);
  };
  // Float beside the gun on whichever side has room, wherever the camera is.
  UP.placePanel = function (t) {
    const el = $("panel");
    const p = this.app.worldToStage(t.x, t.y);
    const left = p.x < 55;
    el.style.left = left ? `calc(${BK.clamp(p.x, 0, 70)}% + 2.6em)` : "";
    el.style.right = left ? "" : `calc(${BK.clamp(100 - p.x, 0, 70)}% + 2.6em)`;
    el.style.top = `clamp(3.5em, calc(${p.y}% - 9em), calc(100% - 7em - ${el.offsetHeight}px))`;
  };
  const baseFrame2 = UP.frame;
  UP.frame = function (dt) {
    baseFrame2.call(this, dt);
    if (this.panelFor) { const t = this.g.towers.find((x) => x.id === this.panelFor); if (t) this.placePanel(t); }
  };

  // ------------------------------------------------------------------ result: list the honors won
  const baseResult = UP.showResult;
  UP.showResult = function () {
    baseResult.call(this);
    const g = this.g, r = g.result;
    if (!r) return;
    const won = (BK.HONORS || []).filter((h) => g.honors && g.honors[h.id]);
    const extra = [`Prisoners ${g.stats.prisoners || 0}`, `Wrecks salvaged ${g.stats.salvaged || 0}`, `Defenses built ${g.stats.forts || 0}`, `Supplies found ${g.stats.items || 0}`];
    const vets = g.towers.filter((t) => t.rank >= 3).map((t) => `${BK.RANKS[t.rank].short} ${t.crewName}`);
    let h = `<div class="res-honors">${extra.map((s) => `<span>${s}</span>`).join("")}</div>`;
    if (won.length) h += `<div class="res-honors gold">${won.map((x) => `<span title="${x.desc}">${x.name} +${x.medals}</span>`).join("")}</div>`;
    if (vets.length) h += `<div class="res-vets">Veteran crews: ${vets.slice(0, 6).join(", ")}</div>`;
    $("res-next").insertAdjacentHTML("beforebegin", `<div id="res-extra">${h}</div>`);
    const old = document.querySelectorAll("#res-extra");
    if (old.length > 1) old[0].remove();
  };

  // ------------------------------------------------------------------ menus
  const baseMaps = UP.showMaps;
  UP.showMaps = function () {
    baseMaps.call(this);
    const cards = document.querySelectorAll("#map-grid .mapc");
    BK.MAPS.forEach((m, i) => {
      const el = cards[i];
      if (!el) return;
      el.insertAdjacentHTML("afterbegin", `<span class="size">${m.size}</span><span class="roads">${m.paths.length} road${m.paths.length > 1 ? "s" : ""}${m.river ? " · river" : ""}${m.rail ? " · rail" : ""}</span>`);
    });
  };

  const baseNotes = UP.showNotes;
  UP.showNotes = function () {
    baseNotes.call(this);
    const b = $("notes-body");
    let h = `<h3>New orders</h3>`;
    h += `<p><b>Battlefields.</b> Seven fields from Smaller to Gigantic. The bigger ones are real battles of September 1939, with more roads in, rivers, bridges and railways. Drag the field, use WASD, or click the corner map to move. Scroll or pinch to zoom.</p>`;
    h += `<p><b>Guns grow.</b> Every gun earns experience from kills and from time under fire. Each promotion opens a new tier, and each upgrade turns the gun into something new: an MG nest can become a quad flak mount, a concrete pillbox, a 20mm casemate or a flamethrower bunker. Higher tiers also need supplies from the field.</p>`;
    h += `<p><b>Supplies.</b> Trucks, tanks, officers and specialists drop ammunition, plate, optics, parts, radios and more. Click or mouse over them. Between waves, click a wreck to strip it. After each wave the inventory shows the haul, then Supplies Inbound brings your card.</p>`;
    h += `<p><b>Ground and cover.</b> Blasts leave craters and knock buildings down. A machine gun in a crater is safer but sees less. A mortar in a crater fires faster with a bigger blast. Ruins and sandbags shelter guns too. Enemy vehicles steer around craters and wrecks, and infantry dive into them.</p>`;
    h += `<p><b>Defenses.</b> Between waves, the Defenses tab lays sandbag walls, barbed wire, roadblocks, tank traps and gun pits. Engineers will try to clear them.</p>`;
    h += `<p><b>The enemy fights back.</b> Flamethrower pioneers leave the road to burn out your guns. Snipers pin crews down. Mortar teams set up and shell you. Kill an officer and his squad may surrender, and prisoners sometimes carry maps.</p>`;
    h += `<p><b>Help from your own side.</b> On rail maps, armored train Śmiały shells the column. A squadron of Uhlans can ride down a road, as the 18th Pomeranian Uhlans did at Krojanty on 1 September.</p>`;
    h += `<p><b>Soundtrack.</b> Iron Line Advance, March of the Iron Engines and The Long Advance, made for this game by Grant Auch. The music button on the title and pause screens turns it off.</p>`;
    b.insertAdjacentHTML("afterbegin", h);
    b.innerHTML = b.innerHTML.replace("Double click any gun, or press C, to crew it yourself.", "Double click any gun, or press E, to crew it yourself.");
  };
})(typeof window !== "undefined" ? window : globalThis);
