// Campaign expansion for the simulation: larger worlds, cover and craters, destructible scenery,
// enemies that use the ground, specialist units, fortifications, crew XP and upgrade trees,
// field items, salvage, prisoners, weather and battle honors.
(function (root) {
  const BK = root.BK;
  const { clamp, dist, dist2, angTo, wrapAng, turnTo } = BK;
  const G = BK.Game.prototype;
  let XID = 500000;

  const VEHICLE = { wheel: 1, track: 1, half: 1 };
  const FOOT_SPECIAL = { pioneer: 1, sniper: 1, mortarteam: 1, engineer: 1 };

  // ------------------------------------------------------------------ setup
  G.initExtra = function (opts) {
    const map = this.map;
    this.WW = map.ww || BK.W;
    this.WH = map.wh || BK.H;
    this.layout = map.procedural && BK.Terrain ? BK.Terrain.layout(map, this.paths) : null;
    this.bridges = this.layout && BK.Terrain ? BK.Terrain.bridges(this.layout, this.paths) : [];
    // Scenery comes after the layout so it can avoid the river.
    this.props = BK.makeProps ? BK.makeProps(map, this.paths, this.layout) : [];
    for (const p of this.props) {
      const hp = { house: 700, barn: 520, shed: 260, church: 1400, windmill: 520, tree: 140, pine: 140, hay: 60, cart: 90, crates: 70 }[p.kind];
      if (hp) { p.hp = p.maxHp = hp; p.state = "ok"; p.ver = 0; }
    }
    this.craters = this.props.filter((p) => p.kind === "crater").map((p) => ({ x: p.x, y: p.y, r: 12 * p.s + 4, old: true }));
    this.wrecks = [];
    this.forts = [];
    this.drops = [];
    this.inv = {};
    this.waveLoot = {};
    this.prisoners = [];
    this.trains = [];
    this.uhlans = [];
    this.honors = {};
    this.coverVer = 0;
    this.usedNames = {};
    this.aim = { x: this.WW / 2, y: this.WH / 2 };
    const wk = opts.weather || (this.demo ? "clear" : this.rng.pick(["clear", "clear", "fog", "rain", "smoke"]));
    this.weatherId = wk;
    this.weather = BK.WEATHER[wk];
    Object.assign(this.stats, { prisoners: 0, salvaged: 0, forts: 0, items: 0 });
    // Abilities that need a railway only exist on maps with one.
    if (this.abil.train && !(this.layout && this.layout.rail)) delete this.abil.train;
  };

  G.inWorld = function (x, y, m) {
    m = m || 0;
    return x >= m && y >= m && x <= this.WW - m && y <= this.WH - m;
  };
  G.isWater = function (x, y) {
    if (!this.map.procedural) return y > 618;
    return BK.Terrain.isWater(this.layout, x, y) && !this.bridges.some((b) => dist2(x, y, b.x, b.y) < 46 * 46);
  };
  G.nearRoad = function (x, y) {
    let d = 1e9;
    for (const p of this.paths) d = Math.min(d, p.near(x, y));
    return d;
  };

  // ------------------------------------------------------------------ craters and scenery
  G.addCrater = function (x, y, r) {
    if (!this.inWorld(x, y)) return;
    for (const c of this.craters) {
      if (dist2(x, y, c.x, c.y) < (c.r + r) * (c.r + r) * 0.36) {
        c.r = Math.min(34, c.r + r * 0.25);
        this.coverVer++;
        return c;
      }
    }
    const c = { x, y, r, fresh: 1 };
    this.craters.push(c);
    if (this.craters.length > 260) this.craters.splice(0, 20);
    this.coverVer++;
    this.emit("crater", { x, y, r });
    return c;
  };
  G.craterAt = function (x, y, shrink) {
    for (const c of this.craters) if (dist2(x, y, c.x, c.y) < c.r * c.r * (shrink || 0.8) * (shrink || 0.8)) return c;
    return null;
  };
  G.ruinAt = function (x, y) {
    for (const p of this.props) if (p.state === "ruin" && dist2(x, y, p.x, p.y) < (p.r + 6) * (p.r + 6)) return p;
    return null;
  };
  G.wreckAt = function (x, y, pad) {
    for (const w of this.wrecks) if (dist2(x, y, w.x, w.y) < (w.r + (pad || 0)) * (w.r + (pad || 0))) return w;
    return null;
  };
  G.damageProps = function (x, y, dmg, r) {
    for (const p of this.props) {
      if (!p.maxHp || p.state === "ruin" || p.state === "felled" || p.state === "burnt") continue;
      const rr = r + p.r;
      if (dist2(x, y, p.x, p.y) > rr * rr) continue;
      p.hp -= dmg;
      p.ver++;
      if (p.hp <= 0) {
        if (p.kind === "tree" || p.kind === "pine") { p.state = "felled"; p.fallAng = angTo(x, y, p.x, p.y); p.block = false; }
        else if (p.kind === "hay" || p.kind === "cart" || p.kind === "crates") { p.state = "burnt"; p.block = false; }
        else { p.state = "ruin"; p.block = false; p.burning = 0; }
        this.coverVer++;
        this.emit("propDown", { x: p.x, y: p.y, kind: p.kind, r: p.r });
      } else if (p.hp < p.maxHp * 0.55 && p.state === "ok") {
        p.state = "damaged";
        this.emit("propHit", { x: p.x, y: p.y, kind: p.kind });
      }
    }
  };

  // ------------------------------------------------------------------ cover
  G.coverOf = function (t) {
    if (t.coverVer === this.coverVer && t.coverForts === this.forts.length) return t.cover;
    const c = { crater: !!this.craterAt(t.x, t.y, 0.9), ruin: !!this.ruinAt(t.x, t.y), sandbags: 0 };
    for (const f of this.forts) if (f.kind === "sandbag" && f.hp > 0 && dist2(f.x, f.y, t.x, t.y) < 52 * 52) c.sandbags++;
    c.sandbags = Math.min(2, c.sandbags);
    t.cover = c;
    t.coverVer = this.coverVer;
    t.coverForts = this.forts.length;
    return c;
  };

  // ------------------------------------------------------------------ crews, XP and ranks
  G.newCrewName = function () {
    const pool = BK.SURNAMES.filter((n) => !this.usedNames[n]);
    const n = pool.length ? this.rng.pick(pool) : this.rng.pick(BK.SURNAMES);
    this.usedNames[n] = 1;
    return n;
  };
  G.gainXp = function (t, xp) {
    if (!t || t.ko > 0) return;
    t.xp += xp;
    while (t.rank < BK.RANKS.length - 1 && t.xp >= BK.RANKS[t.rank + 1].xp) {
      t.rank++;
      const old = t.maxHp;
      t.maxHp = this.towerMaxHp(t);
      t.hp += t.maxHp - old;
      this.emit("promote", { id: t.id, x: t.x, y: t.y, rank: t.rank, name: t.crewName, kind: t.kind });
      if (t.rank === 4) this.honorEvent("rank4");
    }
  };
  G.node = function (t) { return BK.TREES[t.kind][t.path[t.path.length - 1]]; };
  G.form = function (t) { return this.node(t); };

  G.towerMaxHp = function (t) {
    let hp = BK.GUNS[t.kind].hp * (1 + this.mods.hp) * (1 + 0.08 * (t.rank || 0));
    for (const id of t.path || []) { const m = BK.TREES[t.kind][id].mods; if (m.hp) hp *= m.hp; }
    return Math.round(hp);
  };

  const MULT = { dmg: 1, rate: 1, range: 1, taken: 1, weakMult: 1 };
  G.towerStats = function (t) {
    const d = BK.GUNS[t.kind], m = this.mods, rank = t.rank || 0;
    const s = {
      dmg: d.dmg * (1 + 0.06 * rank) * (1 + m.dmg + (m.gun[t.kind] || 0)),
      rate: d.rate * (1 + 0.05 * rank) * (1 + m.rate),
      range: d.range * (1 + m.range),
      minRange: d.minRange || 0,
      splash: d.splash * (1 + m.splash),
      pen: d.pen, crit: d.crit + m.crit, air: d.air * (1 + m.air), ground: d.ground == null ? 1 : d.ground,
      pierce: d.pierce || 0, weakMult: 1, shells: 1, stun: 0, burn: false, airSplash: 0, oneshotFoot: false,
      vsShooters: 1, shot: d.shot, speed: d.speed, taken: 1, priority: null, airDmg: 1,
    };
    for (const id of (t.path || []).slice(1)) {
      const mods = BK.TREES[t.kind][id].mods;
      for (const k in mods) {
        const v = mods[k];
        if (MULT[k]) s[k] *= v;
        else if (k === "splash") s.splash = s.splash ? s.splash * v : v;
        else if (k === "crit") s.crit += v;
        else if (k === "air") s.air = v * (1 + m.air);
        else if (k === "footKill") s.oneshotFoot = v;
        else if (k === "hp") continue;
        else s[k] = v;
      }
    }
    // Cover: a crater hides a direct fire gun but costs sight lines, while a mortar loves it.
    const cv = this.coverOf(t);
    const C = BK.COVER;
    if (cv.crater) {
      s.taken *= C.crater.taken;
      if (s.shot === "lob") { s.rate *= C.crater.mortarRate; s.splash *= C.crater.mortarSplash; }
      else s.range *= C.crater.directRange;
    }
    if (cv.ruin) { s.taken *= C.ruin.taken; if (s.shot !== "lob") s.range *= C.ruin.directRange; }
    for (let i = 0; i < cv.sandbags; i++) s.taken *= C.sandbag.taken;
    s.range *= this.weather.sight;
    // A spotter nearby calls targets.
    for (const o of this.spotters || []) if (o !== t && dist2(o.x, o.y, t.x, t.y) < o.spotR * o.spotR) { s.dmg *= 1.25; break; }
    if (this.buffs.frenzy > 0) s.rate *= 2;
    if (m.adrenaline && this.combo >= 25) s.rate *= 1.5;
    if (m.lastStand && this.garrison <= 6) { s.dmg *= 1.7; s.rate *= 1.4; }
    if (t.manned) {
      s.dmg *= 1.5 + m.manned;
      s.rate *= 1.25;
      s.range *= 1.15;
      if (s.air <= 0 && s.shot !== "lob" && s.shot !== "flame") s.air = 0.6;
    }
    return s;
  };
  G.refreshAuras = function () {
    this.spotters = this.towers.filter((t) => this.node(t).mods.spot && t.ko <= 0).map((t) => Object.assign(t, { spotR: this.node(t).mods.spot }));
    this.suppressors = this.towers.filter((t) => this.towerStats(t).suppress && t.ko <= 0);
    this.lights = this.towers.filter((t) => this.towerStats(t).airSlow && t.ko <= 0);
  };

  // ------------------------------------------------------------------ building guns
  G.canPlace = function (x, y, kind, ignore) {
    if (!this.inWorld(x, y, 22)) return "edge";
    if (this.isWater(x, y)) return "water";
    if (this.nearRoad(x, y) < 46) return "road";
    for (const t of this.towers) if (t !== ignore && dist2(x, y, t.x, t.y) < 44 * 44) return "gun";
    for (const pr of this.props) if (pr.block && dist2(x, y, pr.x, pr.y) < (pr.r + 18) * (pr.r + 18)) return "prop";
    for (const f of this.forts) if (f.kind !== "dig" && f.kind !== "wire" && dist2(x, y, f.x, f.y) < (f.r + 14) * (f.r + 14)) return "fort";
    if (kind && this.money < BK.GUNS[kind].cost) return "money";
    return null;
  };
  G.build = function (kind, x, y) {
    if (!this.gunAvailable(kind)) return null;
    if (this.canPlace(x, y, kind)) return null;
    const d = BK.GUNS[kind];
    this.money -= d.cost;
    const t = {
      id: XID++, kind, x, y, ang: -Math.PI / 2 + (this.rng() - 0.5), cd: 0.3, path: [kind], rank: this.mods.vets ? 1 : 0, xp: this.mods.vets ? BK.RANKS[1].xp : 0,
      hp: 1, maxHp: 1, ko: 0, priority: kind === "f75" ? "strong" : "first", manned: false, recoil: 0, crewName: this.newCrewName(),
      kills: 0, waveKills: 0, waveDmg: 0, dmgDone: 0, invest: d.cost, builtWave: this.wave, phaseBuilt: this.phase, target: null, flash: 0, supT: 0,
    };
    t.level = 1;
    t.maxHp = this.towerMaxHp(t);
    t.hp = t.maxHp;
    this.towers.push(t);
    this.stats.built++;
    // The countdown to the first wave starts with the first gun.
    if (this.wave === 0 && !isFinite(this.earlyT) && !this.demo) this.earlyT = 45;
    this.refreshAuras();
    this.emit("build", { x, y, kind });
    return t;
  };

  // ------------------------------------------------------------------ upgrade trees
  G.upgradeOptions = function (t) {
    return this.node(t).next.map((id) => BK.TREES[t.kind][id]);
  };
  G.upgradeBlock = function (t, n, refit = false) {
    if (this.phase === "won" || this.phase === "lost") return "battle over";
    if (t.ko > 0) return "crew knocked out";
    if (refit) {
      if (this.phase !== "deploy") return "use between waves";
      return this.refits > 0 ? null : "no saved refit";
    }
    if ((t.rank || 0) < BK.RANK_FOR_TIER[n.tier]) return "needs " + BK.RANKS[BK.RANK_FOR_TIER[n.tier]].name;
    if (this.money < n.cost) return "needs " + n.cost + " zł";
    for (const [k, v] of Object.entries(n.items)) if ((this.inv[k] || 0) < v) return "needs " + BK.ITEMS[k].name;
    return null;
  };
  G.upgradeCost = function (t) {
    const o = this.upgradeOptions(t);
    return o.length ? Math.min(...o.map((n) => n.cost)) : null;
  };
  G.upgrade = function (t, nodeId, refit = false) {
    if (!this.towers.includes(t)) return false;
    const opts = this.upgradeOptions(t);
    const n = nodeId ? opts.find((o) => o.id === nodeId) : opts.length === 1 ? opts[0] : null;
    if (!n || this.upgradeBlock(t, n, refit)) return false;
    if (refit) {
      this.refits--;
      // The voucher covers field training too: a new crew can use a genuine free upgrade.
      const rank = BK.RANK_FOR_TIER[n.tier];
      if (t.rank < rank) this.gainXp(t, BK.RANKS[rank].xp - t.xp);
    } else {
      this.money -= n.cost;
      for (const [k, v] of Object.entries(n.items)) this.inv[k] -= v;
      t.invest += n.cost;
    }
    t.path.push(n.id);
    t.level = t.path.length;
    t.spec = n.tier === 3 ? n.id : null;
    const old = t.maxHp;
    t.maxHp = this.towerMaxHp(t);
    t.hp = Math.min(t.maxHp, t.hp + Math.max(0, t.maxHp - old));
    this.refreshAuras();
    this.emit("upgrade", { x: t.x, y: t.y, spec: n.tier === 3, name: n.name, morph: true, refit });
    if (n.tier === 3) this.honorEvent("tier3");
    return true;
  };
  // Free refits belong to the player; they never get wasted on the wrong crew.
  G.freeUpgrade = function () {
    this.refits = (this.refits || 0) + 1;
    this.emit("refitBanked", { count: this.refits });
    return this.refits;
  };
  G.relocationBlock = function (t, x, y) {
    if (!this.towerStats(t).mobile) return "not mobile";
    if (this.phase !== "deploy") return "only between waves";
    return this.canPlace(x, y, null, t);
  };
  G.relocate = function (t, x, y) {
    const why = this.relocationBlock(t, x, y);
    if (why) return why;
    t.x = x; t.y = y;
    t.coverVer = -1;
    this.emit("build", { x, y, kind: t.kind });
    return null;
  };

  // ------------------------------------------------------------------ fortifications
  G.canFort = function (kind, x, y) {
    const F = BK.FORTS[kind];
    if (this.phase !== "deploy") return "between waves only";
    if (!this.inWorld(x, y, 16)) return "edge";
    if (this.isWater(x, y)) return "water";
    const dRoad = this.nearRoad(x, y);
    if (F.where === "road" && dRoad > 26) return "on the road only";
    if (F.where === "off" && dRoad < 40) return "off the road only";
    for (const t of this.towers) if (kind !== "sandbag" && dist2(x, y, t.x, t.y) < 36 * 36) return "gun";
    for (const f of this.forts) if (dist2(x, y, f.x, f.y) < (F.r + f.r) * (F.r + f.r) * 0.5) return "too close";
    for (const pr of this.props) if (pr.block && dist2(x, y, pr.x, pr.y) < (pr.r + 10) * (pr.r + 10)) return "prop";
    if (this.money < F.cost) return "money";
    return null;
  };
  G.buildFort = function (kind, x, y) {
    if (this.canFort(kind, x, y)) return null;
    const F = BK.FORTS[kind];
    this.money -= F.cost;
    if (kind === "dig") {
      this.addCrater(x, y, 20);
      this.emit("dig", { x, y });
      this.stats.forts++;
      return { kind };
    }
    // Face road obstacles across the road, and walls toward it.
    let best = null;
    for (let pi = 0; pi < this.paths.length; pi++) {
      const p = this.paths[pi];
      for (let d = 0; d < p.len; d += 6) {
        const [px, py, a] = p.at(d);
        const d2 = dist2(x, y, px, py);
        if (!best || d2 < best.d2) best = { d2, a, px, py };
      }
    }
    const f = { id: XID++, kind, x, y, hp: F.hp, maxHp: F.hp, r: F.r, ang: best ? (F.where === "road" || kind === "wire" ? best.a + Math.PI / 2 : angTo(x, y, best.px, best.py)) : 0, work: 0 };
    // Record where each road passes it, so units on that road know when they reach it.
    f.onPath = {};
    for (let pi = 0; pi < this.paths.length; pi++) {
      const p = this.paths[pi];
      let bd = 1e9, bdist = 0;
      for (let d = 0; d < p.len; d += 4) { const [px, py] = p.at(d); const d2 = dist2(x, y, px, py); if (d2 < bd) { bd = d2; bdist = d; } }
      if (Math.sqrt(bd) < f.r + 12) f.onPath[pi] = bdist;
    }
    this.forts.push(f);
    this.stats.forts++;
    this.coverVer++;
    this.emit("fort", { x, y, kind });
    return f;
  };
  G.fortAt = function (x, y) {
    for (const f of this.forts) if (dist2(x, y, f.x, f.y) < (f.r + 6) * (f.r + 6)) return f;
    return null;
  };
  G.sellFort = function (f) {
    if (this.phase !== "deploy") return;
    this.money += Math.round(BK.FORTS[f.kind].cost * 0.6);
    this.forts = this.forts.filter((x) => x !== f);
    this.coverVer++;
  };
  G.damageFort = function (f, dmg) {
    if (f.hp <= 0) return;
    f.hp -= dmg;
    if (f.hp <= 0) {
      this.forts = this.forts.filter((x) => x !== f);
      this.coverVer++;
      this.emit("fortDown", { x: f.x, y: f.y, kind: f.kind });
    }
  };

  // ------------------------------------------------------------------ drops, inventory, salvage
  G.rollDrops = function (e) {
    const table = BK.DROPS[e.kind];
    if (!table) return;
    const mult = e.boss ? 1 : 0.85 + this.mods.luck * 0.15;
    for (const [item, p] of Object.entries(table)) {
      if (this.rng() < p * mult) {
        const a = this.rng() * 6.28, r = this.rng.range(8, 26);
        this.drops.push({ id: XID++, item, x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, t: 0, life: 45 });
        this.emit("drop", { x: e.x, y: e.y, item });
      }
    }
  };
  G.dropAt = function (x, y) {
    let best = null, bd = 34 * 34;
    for (const d of this.drops) { const d2 = dist2(x, y, d.x, d.y); if (d2 < bd) { bd = d2; best = d; } }
    return best;
  };
  G.collectDrop = function (d, quiet) {
    this.drops = this.drops.filter((x) => x !== d);
    this.inv[d.item] = (this.inv[d.item] || 0) + 1;
    this.waveLoot[d.item] = (this.waveLoot[d.item] || 0) + 1;
    this.stats.items++;
    if (!quiet) this.emit("pickup", { x: d.x, y: d.y, item: d.item });
  };
  G.salvage = function (w) {
    if (this.phase !== "deploy" || !w || w.salvaged) return null;
    w.salvaged = true;
    this.wrecks = this.wrecks.filter((x) => x !== w);
    const table = { track: ["steel", "parts", "steel", "optics"], half: ["parts", "mg34", "ammo"], wheel: ["parts", "fuel", "ammo", "radio"] }[w.vk] || ["parts"];
    const got = [];
    const n = w.boss ? 3 : w.big ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const it = this.rng.pick(table);
      this.inv[it] = (this.inv[it] || 0) + 1;
      this.waveLoot[it] = (this.waveLoot[it] || 0) + 1;
      got.push(it);
    }
    this.stats.salvaged++;
    this.coverVer++;
    this.emit("salvage", { x: w.x, y: w.y, items: got });
    return got;
  };

  // ------------------------------------------------------------------ honors
  G.honorEvent = function (id) {
    const h = BK.HONORS.find((x) => x.ev === id);
    if (h) this.earnHonor(h);
  };
  G.earnHonor = function (h) {
    if (this.honors[h.id] || this.demo) return;
    this.honors[h.id] = true;
    this.emit("honor", { id: h.id, name: h.name, medals: h.medals });
  };
  G.checkHonors = function () {
    for (const h of BK.HONORS) if (h.test && h.test(this)) this.earnHonor(h);
  };

  // ------------------------------------------------------------------ the enemy brain
  G.onSpawn = function (e) {
    e.latT = e.lat;
    e.mode = "road";
    e.thinkT = this.rng() * 0.3;
    e.grenT = this.rng.range(2, 6);
    if (e.def.snipe) e.hidden = true;
    if (e.kind === "inf" && this.rng() < 0.3) e.grenades = true;
  };

  // Free movement off the road toward a point, used by specialists.
  function moveTo(e, x, y, sp, dt) {
    const d = dist(e.x, e.y, x, y);
    if (d < 2) return true;
    const a = angTo(e.x, e.y, x, y);
    e.ang = turnTo(e.ang, a, dt * 6);
    const step = Math.min(d, sp * dt);
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
    return d <= sp * dt + 1;
  }

  G.nearestTower = function (x, y, range, filter) {
    let best = null, bd = range * range;
    for (const t of this.towers) {
      if (t.ko > 0 || (filter && !filter(t))) continue;
      const d = dist2(x, y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  };
  G.visibleTo = function (t) { return !this.towerStats(t).camo; };

  // Pick a way back onto the road after a detour.
  G.rejoinRoad = function (e) {
    e.jobs = (e.jobs || 0) + 1;
    e.offT = 0;
    e.coolT = this.time + 6;
    const p = this.paths[e.path];
    let best = e.dist, bd = 1e9;
    for (let d = Math.max(0, e.dist - 120); d < Math.min(p.len, e.dist + 200); d += 6) {
      const [x, y] = p.at(d);
      const d2 = dist2(e.x, e.y, x, y);
      if (d2 < bd) { bd = d2; best = d; }
    }
    e.dist = best;
    const [x, y, a] = p.at(best);
    e.lat = clamp(-(e.x - x) * Math.sin(a) + (e.y - y) * Math.cos(a), -40, 40);
    e.latT = e.lat * 0.4;
    e.mode = "return";
  };

  G.updateSpecialist = function (e, dt) {
    const def = e.def;
    if (e.mode === "return") {
      const p = this.paths[e.path];
      const [x, y, a] = p.at(e.dist);
      const tx = x - Math.sin(a) * e.lat, ty = y + Math.cos(a) * e.lat;
      if (moveTo(e, tx, ty, e.speed, dt)) e.mode = "road";
      return true;
    }
    if (e.mode === "road") {
      e.thinkT -= dt;
      if (e.thinkT > 0 || e.panicT > 0 || e.surrender) return false;
      e.thinkT = 0.5;
      // Each specialist leaves the road a few times at most, with a breather between.
      if ((e.jobs || 0) >= 3 || (e.coolT || 0) > this.time) return false;
      if (def.assault) {
        const t = this.nearestTower(e.x, e.y, 200, (t) => this.visibleTo(t));
        if (t) { e.mode = "assault"; e.tgt = t.id; }
      } else if (def.mortar) {
        const t = this.nearestTower(e.x, e.y, 320, (t) => this.visibleTo(t));
        if (t && dist(e.x, e.y, t.x, t.y) > 150) {
          // Set up a little off the road, on the far side from the gun.
          const p = this.paths[e.path];
          const [x, y, a] = p.at(e.dist);
          const side = Math.sign(-(t.x - x) * Math.sin(a) + (t.y - y) * Math.cos(a)) || 1;
          e.mode = "setup"; e.tgt = t.id; e.setupT = 2; e.fireT = 1;
          e.hx = x + Math.sin(a) * 48 * side; e.hy = y - Math.cos(a) * 48 * side;
          e.stayT = 26;
        }
      } else if (def.snipe) {
        const t = this.nearestTower(e.x, e.y, 340, (t) => this.visibleTo(t));
        if (t) {
          // Look for a crater, ruin, wreck or tree to shoot from.
          let spot = null, bd = 150 * 150;
          const consider = (x, y) => { const d = dist2(e.x, e.y, x, y); if (d < bd && this.nearRoad(x, y) > 20) { bd = d; spot = { x, y }; } };
          for (const c of this.craters) consider(c.x, c.y);
          for (const w of this.wrecks) consider(w.x + 14, w.y + 14);
          for (const p of this.props) if (p.kind === "tree" || p.kind === "pine" || p.state === "ruin") consider(p.x + 18, p.y + 10);
          if (!spot) { const [x, y, a] = this.paths[e.path].at(e.dist); spot = { x: x + Math.sin(a) * 50, y: y - Math.cos(a) * 50 }; }
          e.mode = "snipe"; e.hx = spot.x; e.hy = spot.y; e.fireT = 2.5; e.stayT = 30;
        }
      } else if (def.engineer) {
        let target = null, bd = 160 * 160;
        for (const f of this.forts) {
          if (f.kind === "sandbag" || f.kind === "dig") continue;
          const d = dist2(e.x, e.y, f.x, f.y);
          if (d < bd && f.onPath[e.path] != null && f.onPath[e.path] > e.dist - 20) { bd = d; target = { f }; }
        }
        for (const m of this.mines) { const d = dist2(e.x, e.y, m.x, m.y); if (d < bd) { bd = d; target = { m }; } }
        if (target) { e.mode = "clear"; e.job = target; e.work = 0; }
        else {
          // No obstacles: patch up the most damaged vehicle nearby.
          const v = this.enemies.find((o) => !o.gone && VEHICLE[o.def.kind] && o.hp < o.maxHp * 0.8 && dist2(o.x, o.y, e.x, e.y) < 90 * 90);
          if (v) { v.hp = Math.min(v.maxHp, v.hp + 8); e.repairing = v.id; if (this.rng() < 0.2) this.emit("repair", { x: v.x, y: v.y }); }
        }
      }
      return false;
    }
    // Off road states. No unit stays off the road forever, so a wave always ends.
    if (e.panicT > 0 || e.surrender) { this.rejoinRoad(e); return true; }
    e.offT = (e.offT || 0) + dt;
    if (e.offT > 40) { e.offT = 0; e.jobs = 9; this.rejoinRoad(e); return true; }
    if (e.mode === "assault") {
      const t = this.towers.find((x) => x.id === e.tgt && x.ko <= 0);
      if (!t) { this.rejoinRoad(e); return true; }
      const d = dist(e.x, e.y, t.x, t.y);
      if (d > 54) moveTo(e, t.x, t.y, e.speed * 1.1, dt);
      else {
        e.ang = turnTo(e.ang, angTo(e.x, e.y, t.x, t.y), dt * 6);
        e.flameT = (e.flameT || 0) - dt;
        if (e.flameT <= 0) {
          e.flameT = 0.12;
          const cv = this.coverOf(t);
          this.damageTower(t, 4.2 * (cv.crater || cv.sandbags ? 0.8 : 1), "flame");
          this.emit("eflame", { x: e.x, y: e.y, tx: t.x, ty: t.y });
        }
      }
      return true;
    }
    if (e.mode === "setup") {
      e.stayT -= dt * 0.5;
      if (!moveTo(e, e.hx, e.hy, e.speed, dt)) return true;
      e.stayT -= dt * 0.5;
      const t = this.towers.find((x) => x.id === e.tgt && x.ko <= 0) || this.nearestTower(e.x, e.y, 340, (t) => this.visibleTo(t));
      if (!t || e.stayT <= 0) { this.rejoinRoad(e); return true; }
      e.tgt = t.id;
      e.ang = turnTo(e.ang, angTo(e.x, e.y, t.x, t.y), dt * 3);
      if (e.setupT > 0) { e.setupT -= dt; return true; }
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 4.5;
        const tx = t.x + this.rng.range(-18, 18), ty = t.y + this.rng.range(-18, 18);
        this.projectiles.push({ type: "elob", x: e.x, y: e.y, sx: e.x, sy: e.y, tx, ty, t: 0, T: 1.6, dmg: 30, splash: 34 });
        this.emit("eshot", { x: e.x, y: e.y, ang: e.ang, mortar: true });
        this.emit("whistle", { x: tx, y: ty });
      }
      return true;
    }
    if (e.mode === "snipe") {
      e.stayT -= dt * 0.5;
      if (!moveTo(e, e.hx, e.hy, e.speed, dt)) return true;
      e.stayT -= dt * 0.5;
      e.revealT = Math.max(0, (e.revealT || 0) - dt);
      const t = this.nearestTower(e.x, e.y, 380, (t) => this.visibleTo(t));
      if (!t || e.stayT <= 0) { this.rejoinRoad(e); return true; }
      e.ang = turnTo(e.ang, angTo(e.x, e.y, t.x, t.y), dt * 4);
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 3.2;
        e.revealT = 1.2;
        const cv = this.coverOf(t);
        const pin = cv.crater || cv.sandbags || cv.ruin ? 0.9 : 1.6;
        t.supT = Math.max(t.supT || 0, pin);
        this.damageTower(t, 3, "mg");
        this.emit("etracer", { x: e.x, y: e.y, tx: t.x, ty: t.y, sniper: true });
        this.emit("text", { x: t.x, y: t.y - 30, str: "PINNED", color: "#ff8a70", size: 16 });
      }
      return true;
    }
    if (e.mode === "clear") {
      const j = e.job;
      const tx = j.f ? j.f.x : j.m.x, ty = j.f ? j.f.y : j.m.y;
      const alive = j.f ? this.forts.includes(j.f) : this.mines.includes(j.m);
      if (!alive) { this.rejoinRoad(e); return true; }
      if (!moveTo(e, tx + 10, ty + 10, e.speed, dt)) return true;
      e.work += dt;
      if (this.rng() < dt * 3) this.emit("sparks", { x: tx, y: ty });
      if (e.work > 2.6) {
        if (j.f) { this.forts = this.forts.filter((x) => x !== j.f); this.coverVer++; this.emit("fortDown", { x: tx, y: ty, kind: j.f.kind, cleared: true }); }
        else this.mines = this.mines.filter((x) => x !== j.m);
        this.emit("text", { x: tx, y: ty - 20, str: "CLEARED", color: "#ff8a70", size: 16 });
        this.rejoinRoad(e);
      }
      return true;
    }
    return false;
  };

  // Vehicles look ahead for craters, wrecks and obstacles and pick the clearest line.
  G.steer = function (e) {
    const p = this.paths[e.path];
    const tracked = e.def.kind === "track" || e.def.kind === "half";
    const limit = tracked ? 46 : 36;
    const half = (e.def.Wd || 20) * 0.45;
    let best = e.latT, bestCost = 1e9;
    for (let L = -limit; L <= limit; L += 9) {
      let cost = Math.abs(L) * 0.02 + Math.abs(L - e.lat) * 0.015;
      for (let ahead = 18; ahead <= 100; ahead += 20) {
        const [x, y, a] = p.at(e.dist + ahead);
        const px = x - Math.sin(a) * L, py = y + Math.cos(a) * L;
        for (const c of this.craters) {
          if (c.r < 11) continue;
          const d = dist(px, py, c.x, c.y);
          if (d < c.r + half) cost += (c.r + half - d) * (tracked ? 0.6 : 1.4);
        }
        for (const w of this.wrecks) {
          const d = dist(px, py, w.x, w.y);
          if (d < w.r + half) cost += (w.r + half - d) * 3;
        }
        for (const o of this.enemies) {
          if (o === e || o.gone || o.air || !VEHICLE[o.def.kind] || o.moving !== false) continue;
          const d = dist(px, py, o.x, o.y);
          if (d < (o.def.L || 30) * 0.5 + half) cost += 4;
        }
      }
      if (cost < bestCost) { bestCost = cost; best = L; }
    }
    e.latT = best;
  };

  G.obstacleSpeed = function (e) {
    let mult = 1;
    const tracked = e.def.kind === "track" || e.def.kind === "half";
    if (VEHICLE[e.def.kind]) {
      const c = this.craterAt(e.x, e.y, 0.85);
      if (c && c.r >= 10) mult *= tracked ? 0.6 : 0.35;
      if (this.wreckAt(e.x, e.y, 4)) mult *= 0.5;
      if (!tracked && this.weather.wheelSlow) mult *= this.weather.wheelSlow;
    }
    for (const f of this.forts) {
      const at = f.onPath[e.path];
      if (at == null) continue;
      const gap = at - e.dist;
      if (f.kind === "roadblock") {
        if (VEHICLE[e.def.kind] && gap > -4 && gap < 34) {
          // Stopped dead. Vehicles shoot or ram it apart.
          e.blocked = f;
          return 0;
        }
        if (e.def.kind === "foot" && Math.abs(gap) < 18) mult *= 0.5;
      } else if (f.kind === "traps") {
        if (VEHICLE[e.def.kind] && Math.abs(gap) < 30) mult *= 0.35;
      } else if (f.kind === "wire") {
        if (Math.abs(gap) < 14) {
          if (e.def.kind === "foot") { mult *= 0.3; e.inWire = true; }
          else if (tracked) { this.damageFort(f, 999); }
          else { mult *= 0.7; this.damageFort(f, 2); }
        }
      }
    }
    return mult;
  };

  // Infantry bound from cover to cover once they are under fire.
  G.footCover = function (e, dt) {
    e.inCover = !!(this.craterAt(e.x, e.y, 0.95) || this.ruinAt(e.x, e.y) || this.wreckAt(e.x, e.y, 10));
    if (e.holdT > 0) { e.holdT -= dt; return 0; }
    if (e.underFire <= 0 || e.coverCd > 0) { e.coverCd = Math.max(0, (e.coverCd || 0) - dt); return 1; }
    e.coverCd = 0.6;
    const p = this.paths[e.path];
    const [x0, y0, a0] = p.at(e.dist);
    const nx = -Math.sin(a0), ny = Math.cos(a0), tx = Math.cos(a0), ty = Math.sin(a0);
    let best = null, bd = 1e9;
    const consider = (cx, cy, r) => {
      const along = (cx - x0) * tx + (cy - y0) * ty, lat = (cx - x0) * nx + (cy - y0) * ny;
      if (along < 4 || along > 85 || Math.abs(lat) > 62) return;
      if (e.lastCover && Math.abs(e.lastCover.x - cx) < 3 && Math.abs(e.lastCover.y - cy) < 3) return;
      const cost = along + Math.abs(lat - e.lat) * 0.6;
      if (cost < bd) { bd = cost; best = { x: cx, y: cy, lat, along, r }; }
    };
    for (const c of this.craters) consider(c.x, c.y, c.r);
    for (const w of this.wrecks) consider(w.x, w.y, w.r);
    for (const pr of this.props) if (pr.state === "ruin") consider(pr.x, pr.y, pr.r);
    if (best) { e.latT = clamp(best.lat, -60, 60); e.coverGoal = best; }
    if (e.coverGoal && dist(e.x, e.y, e.coverGoal.x, e.coverGoal.y) < Math.max(8, e.coverGoal.r * 0.6)) {
      e.holdT = this.rng.range(1.2, 2.4);
      e.lastCover = e.coverGoal;
      e.coverGoal = null;
      return 0;
    }
    return 1;
  };

  G.updateEnemies = function (dt) {
    const officers = {};
    let commander = null;
    for (const e of this.enemies) {
      if (e.kind === "officer") officers[e.squad] = e;
      if (e.kind === "command" && !e.antennaDown) commander = e;
    }
    const sup = this.suppressors || [];
    for (const e of this.enemies) {
      if (e.gone) continue;
      e.t += dt;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.underFire > 0) e.underFire -= dt;
      if (e.air) { this.updateAir(e, dt); continue; }
      if (e.surrender) { this.updatePrisoner(e, dt); continue; }
      let mult = 1;
      if (e.squad && officers[e.squad] && officers[e.squad] !== e) mult *= 1.25;
      let armorBonus = 0;
      if (commander && commander !== e && dist2(e.x, e.y, commander.x, commander.y) < 130 * 130) { mult *= 1.2; armorBonus = 0.08; }
      e.armorNow = Math.min(0.95, e.armor + armorBonus);
      if (e.slowT > 0) { e.slowT -= dt; mult *= 0.5; }
      if (e.panicT > 0) { e.panicT -= dt; mult *= 0.45; }
      if (e.trackedT > 0) { e.trackedT -= dt; mult = 0; }
      if (e.stunT > 0) { e.stunT -= dt; mult = 0; }
      e.pinned = false;
      if (e.def.kind === "foot") for (const t of sup) if (dist2(t.x, t.y, e.x, e.y) < 170 * 170) { mult *= 0.5; e.pinned = true; break; }
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.25;
          this.damage(e, 4, { pen: 1, src: "burn", quiet: true });
          if (e.def.kind === "foot") for (const o of this.enemies) if (o !== e && !o.air && o.burnT <= 0 && o.def.kind === "foot" && dist2(o.x, o.y, e.x, e.y) < 22 * 22 && this.rng() < 0.12) o.burnT = 3;
        }
      }
      if (e.gone) continue;

      // Specialists leave the road to do their jobs.
      if (FOOT_SPECIAL[e.kind] && this.updateSpecialist(e, dt)) { e.moving = true; continue; }

      e.blocked = null;
      e.inWire = false;
      if (VEHICLE[e.def.kind]) {
        e.thinkT -= dt;
        if (e.thinkT <= 0) { e.thinkT = 0.25; this.steer(e); }
      }
      mult *= this.obstacleSpeed(e);
      if (e.def.kind === "foot") mult *= this.footCover(e, dt);
      if (e.inWire && this.rng() < dt * 4) this.damage(e, 3, { pen: 1, quiet: true, src: "wire" });
      if (e.blocked) {
        // Batter the roadblock: guns if they have them, engines if they don't.
        const f = e.blocked;
        e.ramT = (e.ramT || 0) - dt;
        if (e.ramT <= 0) {
          e.ramT = 0.5;
          const dps = e.def.kind === "track" ? (e.def.L > 70 ? 40 : 22) : e.kind === "armcar" ? 12 : 5;
          this.damageFort(f, dps * 0.5);
          if (e.def.kind === "track" && this.rng() < 0.4) { this.emit("eshot", { x: e.x, y: e.y, ang: e.ang, big: true }); this.emit("explosion", { x: f.x + this.rng.range(-10, 10), y: f.y + this.rng.range(-10, 10), r: 18, size: 0.5 }); }
        }
      }
      e.moving = mult > 0;
      e.dist += e.speed * mult * dt;
      const p = this.paths[e.path];
      if (e.dist >= p.len) { this.leak(e); continue; }
      // Ease toward the chosen line across the road.
      if (e.latT == null) e.latT = e.lat;
      e.lat += clamp(e.latT - e.lat, -dt * (e.def.kind === "foot" ? 40 : 22), dt * (e.def.kind === "foot" ? 40 : 22));
      let lat = e.lat;
      if (e.kind === "moto") lat += Math.sin(e.t * 2.6 + e.seed) * 9;
      const [x, y, a] = p.at(e.dist);
      e.x = x - Math.sin(a) * lat;
      e.y = y + Math.cos(a) * lat;
      e.ang = turnTo(e.ang, a, dt * (e.def.kind === "foot" ? 8 : 3.2));

      if (e.def.smoke && !e.smokePopped && e.hp < e.maxHp * 0.65) {
        e.smokePopped = true;
        this.zones.push({ kind: "smoke", x: e.x, y: e.y, r: 90, t: 7, max: 7 });
        this.emit("smokePop", { x: e.x, y: e.y });
      }
      const onScreen = this.inWorld(e.x, e.y);
      if (e.def.shoots && onScreen && !this.inFriendlySmoke(e.x, e.y)) this.enemyShoot(e, e.def.shoots, e.x, e.y, dt, e);
      if (e.turrets) {
        const c = Math.cos(e.ang), s = Math.sin(e.ang);
        for (const tt of e.turrets) {
          if (tt.dead) continue;
          const wx = e.x + tt.x * c - tt.y * s, wy = e.y + tt.x * s + tt.y * c;
          tt.wx = wx; tt.wy = wy;
          this.enemyShoot(tt, tt, wx, wy, dt, e);
        }
      }
      // Riflemen close to a gun throw grenades into the pit.
      if (e.def.kind === "foot" && (e.grenades || e.kind === "officer")) {
        e.grenT -= dt;
        if (e.grenT <= 0) {
          const t = this.nearestTower(e.x, e.y, 70, (t) => this.visibleTo(t));
          e.grenT = t ? 7 : 1;
          if (t) {
            this.projectiles.push({ type: "grenade", x: e.x, y: e.y, sx: e.x, sy: e.y, tx: t.x + this.rng.range(-12, 12), ty: t.y + this.rng.range(-12, 12), t: 0, T: 0.8, dmg: 18, splash: 26 });
          }
        }
      }
    }
  };

  // ------------------------------------------------------------------ prisoners
  G.trySurrender = function (squad) {
    for (const x of this.enemies) {
      if (x.squad !== squad || x.gone || x.def.kind !== "foot" || x.surrender) continue;
      if (this.rng() < 0.4) {
        x.surrender = true;
        x.surT = 0;
        this.emit("surrender", { x: x.x, y: x.y });
      }
    }
  };
  G.updatePrisoner = function (e, dt) {
    e.surT += dt;
    if (e.surT < 1.2) return;
    // Walk with hands up toward the nearest gun, where the crew takes them in.
    const t = this.nearestTower(e.x, e.y, 1e5);
    const tx = t ? t.x : this.paths[e.path].at(this.paths[e.path].len)[0];
    const ty = t ? t.y : this.paths[e.path].at(this.paths[e.path].len)[1];
    moveTo(e, tx, ty, 26, dt);
    if (dist(e.x, e.y, tx, ty) < 36 || e.surT > 9) {
      e.gone = true;
      this.stats.prisoners++;
      this.addMoney(18, false);
      this.score += 30;
      const intel = this.rng() < 0.3;
      if (intel) { this.inv.maps = (this.inv.maps || 0) + 1; this.waveLoot.maps = (this.waveLoot.maps || 0) + 1; }
      this.emit("prisoner", { x: e.x, y: e.y, intel });
    }
  };

  // ------------------------------------------------------------------ damage to guns
  G.damageTower = function (t, dmg, kind) {
    if (t.ko > 0) return;
    dmg *= this.towerStats(t).taken;
    t.hp -= dmg;
    t.flash = 0.12;
    // A crew that keeps working under fire learns from it.
    if (t.hp > 0) this.gainXp(t, dmg * 0.12);
    if (this.mods.fort && kind === "mg" && t.hp < 1) t.hp = 1;
    if (t.hp <= 0) {
      t.hp = 0;
      t.ko = this.mods.quickRepair ? 7 : 999;
      if (t.manned) this.unman();
      this.refreshAuras();
      this.emit("towerKO", { x: t.x, y: t.y });
      this.emit("text", { x: t.x, y: t.y - 26, str: "KNOCKED OUT", color: "#ff5a4f", size: 18 });
    } else if (kind !== "mg" && kind !== "flame") this.emit("towerHit", { x: t.x, y: t.y });
  };

  G.enemyShoot = function (holder, spec, x, y, dt, owner) {
    holder.cd -= dt;
    let best = null, bd = spec.range * spec.range;
    for (const t of this.towers) {
      if (t.ko > 0 || !this.visibleTo(t)) continue;
      const d = dist2(x, y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) holder.aimAng = turnTo(holder.aimAng == null ? owner.ang : holder.aimAng, angTo(x, y, best.x, best.y), dt * 3);
    if (!best || holder.cd > 0 || owner.stunT > 0) return;
    holder.cd = (1 / spec.rate) * (spec.kind === "mg" ? this.rng.range(0.8, 1.3) : 1);
    if (spec.kind === "mg") {
      this.emit("etracer", { x, y, tx: best.x + this.rng.range(-8, 8), ty: best.y + this.rng.range(-8, 8) });
      this.damageTower(best, spec.dmg, "mg");
    } else {
      const T = Math.sqrt(bd) / 520;
      this.projectiles.push({ type: "eshell", x, y, sx: x, sy: y, tx: best.x, ty: best.y, t: 0, T, dmg: spec.dmg, splash: spec.splash || 20 });
      this.emit("eshot", { x, y, ang: angTo(x, y, best.x, best.y), big: true });
    }
  };

  G.inFriendlySmoke = function (x, y) {
    for (const z of this.zones) if (z.kind === "smoke" && z.side === "pl" && dist2(x, y, z.x, z.y) < z.r * z.r) return true;
    return false;
  };
  G.inSmoke = function (x, y) {
    for (const z of this.zones) if (z.kind === "smoke" && z.side !== "pl" && dist2(x, y, z.x, z.y) < z.r * z.r) return true;
    return false;
  };

  // ------------------------------------------------------------------ targeting for the new forms
  const HUNT = { officer: 1, sniper: 1, pioneer: 1, mortarteam: 1, engineer: 1 };
  G.findTarget = function (t, s) {
    const r2 = s.range * s.range, m2 = s.minRange * s.minRange;
    const canAir = s.air > 0, canGround = s.ground > 0;
    let best = null, bestScore = -Infinity;
    const pri = s.priority || t.priority;
    const airFirst = BK.GUNS[t.kind].airFirst;
    for (const e of this.enemies) {
      if (e.gone || e.surrender) continue;
      if (e.air ? !canAir : !canGround) continue;
      if (!this.inWorld(e.x, e.y, -10)) continue;
      const d2 = dist2(t.x, t.y, e.x, e.y);
      if (d2 > r2 || d2 < m2) continue;
      if (!e.air && this.inSmoke(e.x, e.y)) continue;
      // Hidden snipers only show up close in, when they fire, or to a spotter.
      if (e.hidden && e.mode === "snipe" && !(e.revealT > 0) && d2 > 150 * 150 && !this.spotted(e)) continue;
      let sc;
      if (pri === "first") sc = e.air ? e.age * 40 : e.dist;
      else if (pri === "last") sc = e.air ? -e.age * 40 : -e.dist;
      else if (pri === "strong") sc = e.hp + (e.boss ? 1e5 : 0);
      else sc = -d2;
      if (e.inCover) sc -= 60;
      if (s.hunt && HUNT[e.kind]) sc += 1e6;
      if (airFirst && e.air) sc += 1e7;
      if (sc > bestScore) { bestScore = sc; best = e; }
    }
    return best;
  };
  G.spotted = function (e) {
    for (const o of this.spotters || []) if (dist2(o.x, o.y, e.x, e.y) < o.spotR * o.spotR) return true;
    return false;
  };

  // ------------------------------------------------------------------ extra per frame work
  G.updateExtra = function (dt) {
    for (const d of this.drops) { d.t += dt; d.life -= dt; }
    this.drops = this.drops.filter((d) => d.life > 0);
    for (const c of this.craters) if (c.fresh > 0) c.fresh = Math.max(0, c.fresh - dt * 0.5);
    if (this.phase !== "combat") return;
    for (const t of this.towers) {
      if (t.supT > 0) t.supT -= dt;
      if (t.ko > 0) continue;
      const s = this.towerStats(t);
      if (s.minelayer) {
        t.mineT = (t.mineT == null ? 4 : t.mineT) - dt;
        if (t.mineT <= 0 && this.mines.length < 10) {
          t.mineT = s.minelayer;
          // Plant on the stretch of road closest to the gun.
          let best = null;
          for (const p of this.paths) for (let d = 0; d < p.len; d += 10) {
            const [x, y] = p.at(d);
            const d2 = dist2(x, y, t.x, t.y);
            if (d2 < s.range * s.range && !this.mines.some((m) => dist2(m.x, m.y, x, y) < 30 * 30) && (!best || d2 < best.d2)) best = { x, y, d2 };
          }
          if (best) { this.mines.push({ x: best.x, y: best.y }); this.emit("text", { x: best.x, y: best.y - 16, str: "MINE LAID", color: "#cfe08a", size: 14 }); }
        }
      }
      if (s.hullMg) {
        t.cd2 = (t.cd2 || 0) - dt;
        if (t.cd2 <= 0) {
          const e = this.enemies.find((o) => !o.gone && !o.air && !o.surrender && o.def.kind === "foot" && dist2(o.x, o.y, t.x, t.y) < 170 * 170);
          if (e) {
            t.cd2 = 0.18;
            this.emit("tracer", { x: t.x, y: t.y, tx: e.x, ty: e.y });
            this.damage(e, 7, { pen: 0.1, tower: t, gun: "mg" });
          } else t.cd2 = 0.4;
        }
      }
    }
    // Trains and cavalry.
    for (const tr of this.trains) {
      tr.d += tr.speed * dt;
      tr.fireT -= dt;
      const rail = this.layout.rail;
      if (tr.fireT <= 0 && tr.d > 60 && tr.d < rail.len) {
        tr.fireT = 0.35;
        const [x, y] = rail.at(tr.d);
        const tgt = this.enemies.filter((e) => !e.gone && !e.air && dist2(e.x, e.y, x, y) < 260 * 260);
        const e = tgt.length ? this.rng.pick(tgt) : null;
        const tx = e ? e.x : x + this.rng.range(-200, 200), ty = e ? e.y : y + this.rng.range(-200, 200);
        this.strikes.push({ x: tx + this.rng.range(-12, 12), y: ty + this.rng.range(-12, 12), t: 0.7 });
        this.emit("eshot", { x, y, ang: angTo(x, y, tx, ty), big: true, polish: true });
      }
    }
    this.trains = this.trains.filter((tr) => tr.d < this.layout.rail.len + 400);
    for (const u of this.uhlans) {
      u.d -= u.speed * dt;
      const p = this.paths[u.path];
      const [x, y] = p.at(u.d);
      u.x = x; u.y = y;
      for (const e of this.enemies) {
        if (e.gone || e.air || e.surrender || e.def.kind !== "foot" || u.hit.has(e.id)) continue;
        if (dist2(e.x, e.y, x, y) < 44 * 44) { u.hit.add(e.id); this.damage(e, 160, { pen: 1, src: "uhlan" }); }
      }
    }
    this.uhlans = this.uhlans.filter((u) => u.d > -100);
  };

  // ------------------------------------------------------------------ abilities, with the new two
  const baseUse = G.useAbility;
  G.useAbility = function (id, x, y) {
    if (id === "train") {
      if (!this.abilityReady(id) || !this.layout || !this.layout.rail) return false;
      this.trains.push({ d: -300, speed: 160, fireT: 0.5 });
      this.abil[id].charge = 0;
      this.emit("train", {});
      return true;
    }
    if (id === "uhlans") {
      if (!this.abilityReady(id)) return false;
      let best = null;
      for (let pi = 0; pi < this.paths.length; pi++) {
        const p = this.paths[pi];
        for (let d = 0; d < p.len; d += 10) { const [px, py] = p.at(d); const d2 = dist2(x, y, px, py); if (!best || d2 < best.d2) best = { d2, pi, d }; }
      }
      if (!best || best.d2 > 120 * 120) return false;
      // The squadron rides up the road from the town, past the point picked.
      const p = this.paths[best.pi];
      this.uhlans.push({ path: best.pi, d: Math.min(p.len, best.d + 420), speed: 210, hit: new Set(), x, y });
      this.abil[id].charge = 0;
      this.emit("uhlans", { x, y });
      return true;
    }
    return baseUse.call(this, id, x, y);
  };


  // ------------------------------------------------------------------ hooks from the core sim
  G.onKillExtra = function (e, o) {
    const t = o && o.tower;
    if (t) {
      t.waveKills = (t.waveKills || 0) + 1;
      this.gainXp(t, e.def.score * 0.08 + 2);
    }
    this.rollDrops(e);
    if ((e.kind === "stuka" || e.kind === "leader") && o && o.gun === "mg") this.honorEvent("stukaMg");
    if (e.kind === "officer") this.trySurrender(e.squad);
    if (e.flameBlown) {
      this.zones.push({ kind: "fire", x: e.x, y: e.y, r: 36, t: 4, max: 4, dps: 26 });
      this.explode(e.x, e.y, 60, 46, { pen: 0.8, src: "flametank", tower: t, chainDepth: 2 });
    }
    if (!e.air && VEHICLE[e.def.kind]) {
      this.wrecks.push({ id: XID++, x: e.x, y: e.y, ang: e.ang, r: (e.def.L || 30) * 0.42, kind: e.kind, vk: e.def.kind, big: (e.def.L || 0) > 70, boss: e.boss, wave: this.wave });
      this.coverVer++;
    }
  };

  G.onExplode = function (x, y, dmg, r, o) {
    if (r >= 26 && !o.noCrater) this.addCrater(x, y, clamp(r * 0.32, 8, 26));
    this.damageProps(x, y, dmg, r * 0.8);
    for (const f of this.forts.slice()) {
      if (f.kind === "roadblock" || f.kind === "traps") { if (o.enemy) continue; }
      if (dist2(x, y, f.x, f.y) < (r + f.r) * (r + f.r)) this.damageFort(f, dmg * 0.5);
    }
  };

  G.onLobImpact = function (p) {
    const s = p.o && p.o.tower ? this.towerStats(p.o.tower) : {};
    if (s.burnGround) this.zones.push({ kind: "fire", x: p.tx, y: p.ty, r: 36, t: 4, max: 4, dps: 22 });
    if (s.smokeShells) this.zones.push({ kind: "smoke", side: "pl", x: p.tx, y: p.ty, r: 60, t: 5, max: 5 });
    if (s.craterShells) { this.addCrater(p.tx, p.ty, 26); this.shake(0.3); }
  };

  // A flamethrower burns everything in a short cone in front of it.
  G.fireFlame = function (t, s, ang, base) {
    t.ang = ang;
    this.emit("flame", { x: t.x + Math.cos(ang) * 14, y: t.y + Math.sin(ang) * 14, ang, range: s.range });
    for (const e of this.enemies) {
      if (e.gone || e.air || e.surrender) continue;
      const d = dist(t.x, t.y, e.x, e.y);
      if (d > s.range) continue;
      if (Math.abs(wrapAng(angTo(t.x, t.y, e.x, e.y) - ang)) > 0.38) continue;
      this.damage(e, s.dmg, Object.assign({}, base, { pen: 0.7, burn: true, quiet: true }));
    }
    if (s.burnGround && this.rng() < 0.15) {
      const d = s.range * this.rng.range(0.5, 0.9);
      this.zones.push({ kind: "fire", x: t.x + Math.cos(ang) * d, y: t.y + Math.sin(ang) * d, r: 26, t: 3, max: 3, dps: 18 });
    }
  };

  // ------------------------------------------------------------------ wave end

  // Which roads the next wave will use and how heavy each will be, for the attack arrows.
  G.nextWavePlan = function () {
    const def = BK.WAVES[Math.min(this.wave, BK.WAVES.length - 1)];
    if (!def || this.wave >= BK.WAVE_COUNT && !this.endless) return null;
    const n = this.paths.length;
    const roads = Array.from({ length: n }, () => ({ foot: 0, armor: 0, air: 0 }));
    let air = 0, flip = 0;
    for (const g of def.groups) {
      if (g.squad) { roads[(g.path != null ? g.path : flip++) % n].foot += g.squad; continue; }
      const d = BK.ENEMIES[g.kind];
      if (g.path === "air" || (d && d.air)) { air += g.n; continue; }
      for (let i = 0; i < g.n; i++) {
        const r = roads[(g.path != null ? g.path : flip + i) % n];
        if (d.kind === "foot") r.foot++; else r.armor += d.kind === "track" ? 2 : 1;
      }
      flip++;
    }
    return { roads, air, name: def.name };
  };
  G.waveCleared = function () {
    if (this.phase !== "combat") return;
    this.breakCombo();
    // The crews sweep the field for anything left lying around.
    for (const d of this.drops.slice()) this.collectDrop(d, true);
    const clear = Math.round(BK.TUNE.clear + this.wave * 4);
    const interest = Math.min(this.mods.interestCap, Math.floor(this.money * this.mods.interest));
    this.money += clear + interest;
    for (const t of this.towers) { if (t.ko > 0) t.ko = 0; t.hp = t.maxHp; t.supT = 0; }
    this.refreshAuras();
    this.zones = this.zones.filter((z) => z.kind !== "smoke");
    // Wrecks older than three waves are hauled off the road.
    this.wrecks = this.wrecks.filter((w) => this.wave - w.wave < 3);
    let mvp = null;
    for (const t of this.towers) if (!mvp || t.waveDmg > mvp.waveDmg) mvp = t;
    this.mvp = mvp && mvp.waveDmg > 0 ? { id: mvp.id, name: mvp.crewName, rank: BK.RANKS[mvp.rank].short, kind: mvp.kind, form: this.node(mvp).name, kills: mvp.waveKills, dmg: Math.round(mvp.waveDmg) } : null;
    if (mvp) this.gainXp(mvp, 25);
    this.loot = this.waveLoot;
    this.waveLoot = {};
    this.checkHonors();
    this.emit("waveClear", { wave: this.wave, clear, interest, mvp: this.mvp, loot: this.loot });
    if (!this.endless && this.wave >= BK.WAVE_COUNT) { this.endRun(true); return; }
    this.phase = "cards";
    this.offer = this.drawCards(this.waveDef && this.waveDef.boss ? "rare" : this.firstCard && this.mods.luck > 0 ? "rare" : null);
    this.firstCard = false;
  };
})(typeof window !== "undefined" ? window : globalThis);
