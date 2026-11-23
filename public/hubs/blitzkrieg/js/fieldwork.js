// Student playtest follow-up: saved support and refits, clearer construction, useful upgrade comparisons.
(function (root) {
  const BK = root.BK;
  const G = BK.Game.prototype;
  BK.SUPPORT_RESERVE = 2;

  // Modest per-step lift for all combat branches, on top of their authored
  // effects. Base guns and economy/repair/dispatch structures keep their stats.
  const towerStats = G.towerStats;
  G.towerStats = function (tower) {
    const stats = towerStats.call(this, tower);
    const tierSteps = Math.min(3, Math.max(0, (tower.path?.length || 1) - 1));
    if (!BK.GUNS[tower.kind].support && tierSteps) {
      stats.dmg *= 1 + 0.06 * tierSteps;
      stats.rate *= 1 + 0.03 * tierSteps;
    }
    return stats;
  };

  const init = G.initExtra;
  G.initExtra = function (opts) {
    init.call(this, opts);
    this.refits = 0;
  };

  const snapshot = G.snapshot, restore = BK.Game.fromSnapshot;
  G.snapshot = function () {
    const data = snapshot.call(this);
    for (const id in data.abil) data.abil[id] = Math.min(data.abil[id], BK.ABILITIES[id].charge * BK.SUPPORT_RESERVE);
    data.refits = this.refits || 0;
    return data;
  };
  BK.Game.fromSnapshot = function (data, unlocks) {
    const game = restore.call(this, data, unlocks);
    game.refits = Number.isSafeInteger(data.refits) && data.refits > 0 ? data.refits : 0;
    return game;
  };

  const cast = G.useAbility;
  G.useAbility = function (id, x, y) {
    const bank = this.abil[id], cost = BK.ABILITIES[id]?.charge;
    const before = bank && cost ? Math.min(bank.charge, cost * BK.SUPPORT_RESERVE) : 0;
    const result = cast.call(this, id, x, y);
    if (result && bank && cost) bank.charge = Math.max(0, before - cost);
    return result;
  };

  const radio = BK.CRATE.find((o) => o.id === "charge");
  radio.label = "Artillery charge +1";
  radio.apply = (g) => {
    const charge = BK.ABILITIES.arty.charge;
    g.abil.arty.charge = Math.min(charge * BK.SUPPORT_RESERVE, g.abil.arty.charge + charge);
  };
  const freeCrate = BK.CRATE.find((o) => o.id === "upg");
  freeCrate.label = "Free refit saved";
  // Credit it at collection instead of relying on a delayed reel callback after a wave.
  const open = G.openCrate;
  G.openCrate = function (crate) {
    if (!this.crates.includes(crate)) return null;
    const prize = open.call(this, crate);
    if (prize === freeCrate) {
      const pending = this.pending[this.pending.length - 1];
      for (let i = 0; i < pending.times; i++) this.freeUpgrade();
      pending.o = { ...prize, apply() {} }; // keep the reveal and its text, not a second credit
    }
    return prize;
  };
  const card = {
    id: "fieldRefit", name: "Free Field Refit", rarity: "common", icon: "wrench", max: 3,
    desc: "Save a free upgrade. Between waves, choose a gun and its next branch. No cash, parts or promotion required.",
    apply: (g) => g.freeUpgrade(),
  };
  BK.CARDS.push(card);
  BK.CARD_BY_ID[card.id] = card;

  // Shared by placement feedback; truth always comes from the actual game validator.
  const whyText = {
    road: "Keep the road clear.", edge: "Too close to the map edge.", water: "Guns need dry ground.",
    gun: "Too close to another gun.", prop: "Scenery is in the way.", fort: "A defense is in the way.",
    money: "Not enough złoty.", rail: "Keep the railway clear.", unavailable: "This gun cannot be placed here.",
    "not mobile": "This gun cannot move.", "only between waves": "Move guns between waves.",
  };
  BK.placementReason = (reason) => whyText[reason] || (reason ? "Can't build here." : "Clear to build");

  const routeStencils = new WeakMap();
  BK.drawPlacementZones = function (c, g, movingId) {
    c.save();
    c.fillStyle = "rgba(150,33,24,0.32)";
    c.fillRect(0, 0, g.WW, 22); c.fillRect(0, g.WH - 22, g.WW, 22);
    c.fillRect(0, 22, 22, g.WH - 44); c.fillRect(g.WW - 22, 22, 22, g.WH - 44);
    let roads = routeStencils.get(g);
    if (!roads) {
      roads = new Path2D();
      for (const path of g.paths) {
        const pts = path.pts;
        if (!pts.length) continue;
        roads.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 2) roads.lineTo(pts[i][0], pts[i][1]);
      }
      routeStencils.set(g, roads);
    }
    c.lineJoin = "round"; c.lineCap = "round";
    c.strokeStyle = "rgba(166,35,26,0.24)"; c.lineWidth = 92; c.stroke(roads);
    c.strokeStyle = "rgba(255,160,118,0.62)"; c.lineWidth = 2; c.setLineDash([7, 7]); c.stroke(roads);
    for (const t of g.towers) {
      if (t.id === movingId) continue;
      c.beginPath(); c.arc(t.x, t.y, 44, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    for (const f of g.forts) {
      if (f.kind === "dig" || f.kind === "wire") continue;
      c.beginPath(); c.arc(f.x, f.y, f.r + 14, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.restore();
  };
  BK.drawPlacementMarker = function (c, x, y, bad) {
    c.save();
    c.lineCap = "round"; c.lineJoin = "round";
    const tint = bad ? "#ff947b" : "#c5fb9b";
    c.strokeStyle = tint; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, 26, 0, Math.PI * 2);
    if (bad) {
      c.fillStyle = "rgba(136,23,21,.55)"; c.fill(); c.setLineDash([4, 5]);
    }
    c.stroke(); c.setLineDash([]);
    c.beginPath();
    if (bad) {
      c.moveTo(x - 10, y - 10); c.lineTo(x + 10, y + 10); c.moveTo(x + 10, y - 10); c.lineTo(x - 10, y + 10);
    } else {
      c.moveTo(x - 10, y); c.lineTo(x - 3, y + 7); c.lineTo(x + 11, y - 8);
    }
    c.strokeStyle = "#231810"; c.lineWidth = 6; c.stroke();
    c.strokeStyle = tint; c.lineWidth = 3; c.stroke();
    c.restore();
  };

  function preview(g, t, path, rank) {
    const sample = { ...t, path, rank, manned: false, rallyT: 0 };
    // The live stats exclude a gun's own aura; a detached sample otherwise looks like its neighbor.
    const aura = g.auraSrc, spot = g.spotters;
    try {
      g.auraSrc = (aura || []).filter((o) => o !== t);
      g.spotters = (spot || []).filter((o) => o !== t);
      return { ...g.towerStats(sample), hp: g.towerMaxHp(sample) };
    } finally {
      g.auraSrc = aura; g.spotters = spot;
    }
  }
  BK.upgradeDeltas = function (g, t, n, refit = false) {
    const before = preview(g, t, t.path, t.rank);
    const rank = refit ? Math.max(t.rank, BK.RANK_FOR_TIER[n.tier]) : t.rank;
    const after = preview(g, t, [...t.path, n.id], rank);
    const out = [];
    const add = (key, label, mul = 1, unit = "", inverse = false) => {
      const delta = (after[key] - before[key]) * mul;
      const rounded = Math.round(delta * 10) / 10;
      if (!rounded || !Number.isFinite(rounded)) return;
      out.push({ label: `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}${unit} ${label}`, good: inverse ? rounded < 0 : rounded > 0 });
    };
    if (!after.support) {
      add("dmg", "damage"); add("rate", "shots/s"); add("shells", "per volley");
      add("crit", "crit", 100, " pp"); add("air", "air damage", 100, " pp");
      add("pen", "armor bypass", 100, " pp"); add("splash", "blast reach");
    }
    add("range", "range"); add("hp", "health"); add("taken", "damage taken", 100, " pp", true);
    if (after.mobile !== before.mobile) out.push({ label: after.mobile ? "Can move" : "Stationary", good: !!after.mobile });
    return out;
  };

  // Field UI: permanent medals are already stored; make both types of bank visible.
  const $ = (id) => document.getElementById(id);
  const UI = BK.UI.prototype, command = UI.showCommand;
  UI.showCommand = function () {
    command.call(this);
    const info = document.querySelector("#command .screen-sub");
    if (info) info.textContent = `${BK.Save.data.medals} medals banked. Unspent medals carry over to future battles. Unlocks are permanent and open one step at a time.`;
  };
  const notes = UI.showNotes;
  UI.showNotes = function () {
    notes.call(this);
    const info = $("notes-body");
    if (info) info.insertAdjacentHTML("beforeend", "<p><b>Save support for later.</b> Each support ability can hold two uses. Calling one spends one charge. Unspent support and free refits carry over to the next wave and are saved in Resume; Command medals are saved separately across battles.</p><p><b>Build support.</b> Supply Farms pay after a completed wave. Repair Stations heal nearby guns. A Dispatch Depot sends a scout; upgrade it to send a road patrol or a short bomber flyover. These support options are fictional game mechanics.</p>");
  };

  const start = UI.startRun;
  UI.startRun = function () {
    start.call(this);
    const hud = $("hud");
    let status = $("build-verdict"), refits = $("refit-count");
    if (!status) {
      status = document.createElement("div");
      status.id = "build-verdict";
      status.hidden = true;
      hud.appendChild(status);
    }
    if (!refits) {
      refits = document.createElement("div");
      refits.id = "refit-count";
      refits.hidden = true;
      refits.setAttribute("role", "status");
      hud.querySelector(".bottombar").prepend(refits);
    }
    for (const button of Object.values(this.abilBtns)) {
      if (button.querySelector(".support-bank")) continue;
      const badge = document.createElement("span");
      badge.className = "support-bank";
      badge.setAttribute("aria-hidden", "true");
      button.appendChild(badge);
    }
  };

  const frame = UI.frame;
  UI.frame = function (dt) {
    frame.call(this, dt);
    const g = this.g, app = this.app;
    if (!g || !app.inRun) return;
    const bank = $("refit-count");
    const count = g.refits || 0;
    bank.hidden = !count;
    const bankText = `${count} free refit${count === 1 ? "" : "s"} saved`;
    if (bank.textContent !== bankText) bank.textContent = bankText;
    bank.title = "Select a gun between waves to spend a saved refit.";

    const status = $("build-verdict");
    status.hidden = !["build", "relocate"].includes(app.mode);
    if (!status.hidden) {
      const moving = app.mode === "relocate";
      const target = moving ? g.towers.find((t) => t.id === app.relocId) : null;
      const p = moving ? app.pointer : app.ghost;
      const reason = p && (target ? g.relocationBlock(target, p.x, p.y) : g.canPlace(p.x, p.y, app.buildKind));
      const suffix = p ? BK.placementReason(reason).replace(/\.$/, "") : "Shaded roads and defenses are blocked";
      const label = `${p ? reason ? "×  " : "✓  " : ""}${suffix}`;
      if (status.textContent !== label) status.textContent = label;
      status.classList.toggle("bad", !!reason);
      status.classList.toggle("ok", !!p && !reason);
    }

    for (const [id, button] of Object.entries(this.abilBtns)) {
      const data = BK.ABILITIES[id], a = g.abil[id];
      if (!a) continue;
      const count = Math.min(BK.SUPPORT_RESERVE, Math.floor(a.charge / data.charge));
      const badge = button.querySelector(".support-bank");
      const onTrack = id === "train" && g.map.railDispatch && g.trains.length > 0;
      button.classList.toggle("ready", !!g.abilityReady(id));
      const label = `${data.name}: ${count} of ${BK.SUPPORT_RESERVE} saved. ${onTrack ? "Patrol already on the tracks. " : ""}${data.desc}`;
      if (button.getAttribute("aria-label") !== label) {
        button.setAttribute("aria-label", label);
        button.title = label;
      }
      if (badge.textContent !== String(count)) badge.textContent = count;
      badge.hidden = count === 0;
      if (count === 1) {
        const next = Math.max(0, Math.min(1, (a.charge - data.charge) / data.charge));
        button.querySelector("circle").setAttribute("stroke-dashoffset", String(116.2 * (1 - next)));
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
