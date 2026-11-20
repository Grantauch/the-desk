// Difficulty levels, star ratings, the commander, saving a battle between waves, a full refund
// for a gun placed by mistake, and damage totals per gun. Loaded after game3.js.
(function (root) {
  const BK = root.BK;
  const { dist, dist2, angTo, turnTo } = BK;
  const G = BK.Game.prototype;

  // ------------------------------------------------------------------ difficulty
  // hp and count scale the columns, pay scales kill money, medals scale the reward at the end.
  BK.DIFFS = {
    recruit: { id: "recruit", name: "Recruit", hp: 0.7, count: 0.85, pay: 1.15, medals: 0.6, garrison: 5, desc: "Thinner columns and better pay. Fewer medals." },
    regular: { id: "regular", name: "Regular", hp: 1, count: 1, pay: 1, medals: 1, garrison: 0, desc: "The battle as it was planned." },
    veteran: { id: "veteran", name: "Veteran", hp: 1.3, count: 1.1, pay: 0.95, medals: 1.4, garrison: 0, desc: "Tougher units and more of them. 40% more medals." },
    iron: { id: "iron", name: "Iron Wall", hp: 1.6, count: 1.2, pay: 0.9, medals: 1.9, garrison: -5, desc: "Everything they have, and less garrison to lose. Nearly double medals." },
  };
  BK.DIFF_ORDER = ["recruit", "regular", "veteran", "iron"];

  // Stars on a win: keep your whole garrison for three, at least half for two.
  BK.starsFor = function (won, garrison, start) {
    if (!won) return 0;
    if (garrison >= start) return 3;
    if (garrison >= start * 0.5) return 2;
    return 1;
  };

  const baseInit = G.initExtra;
  G.initExtra = function (opts) {
    baseInit.call(this, opts);
    const D = BK.DIFFS[opts.diff] || BK.DIFFS.regular;
    this.diff = D.id;
    this.diffHp = D.hp;
    this.diffCount = D.count;
    this.mods.reward += D.pay - 1;
    this.garrison = Math.max(5, this.garrison + D.garrison);
    this.startGarrison = this.garrison;
    this.daily = opts.daily || null;
    if (!this.demo && opts.hero !== false) this.initHero();
  };

  const baseExpand = G.expandWave;
  G.expandWave = function (def) {
    const m = this.map, c = m.count;
    m.count = c * (this.diffCount || 1);
    try { return baseExpand.call(this, def); } finally { m.count = c; }
  };

  const baseEnd = G.endRun;
  G.endRun = function (won) {
    if (this.result) return;
    baseEnd.call(this, won);
    const D = BK.DIFFS[this.diff] || BK.DIFFS.regular;
    const r = this.result;
    r.medals = Math.round(r.medals * D.medals);
    r.diff = this.diff;
    r.stars = this.endless ? 0 : BK.starsFor(won, this.garrison, this.startGarrison);
    r.garrison = this.garrison;
  };

  // ------------------------------------------------------------------ a gun placed by mistake
  // Sold in the same build phase it went down, before any upgrade, a gun refunds in full.
  G.isFresh = function (t) {
    return this.phase === "deploy" && t.builtWave === this.wave && t.phaseBuilt === "deploy" && t.path.length === 1 && !t.kills;
  };
  const baseSellValue = G.sellValue;
  G.sellValue = function (t) {
    return this.isFresh(t) ? BK.GUNS[t.kind].cost : baseSellValue.call(this, t);
  };
  G.undoLast = function () {
    const fresh = this.towers.filter((t) => this.isFresh(t));
    if (!fresh.length) return null;
    const t = fresh.reduce((a, b) => (b.id > a.id ? b : a));
    this.sell(t);
    return t;
  };

  // ------------------------------------------------------------------ the commander
  const LV = [0, 110, 300, 620, 1050];
  BK.HERO = {
    name: "Kpt. Zawada", rank: "Captain",
    hp: 260, dmg: 15, rate: 2.4, range: 115, speed: 78, respawn: 18,
    rally: { cd: 34, dur: 8, r: 170, rate: 1.4 },
    grenade: { cd: 22, r: 165, dmg: 85, splash: 50 },
    levels: LV,
  };
  G.initHero = function () {
    const p = this.paths[0];
    // He starts near the town the roads run to, off to one side.
    let x = this.WW / 2, y = this.WH / 2;
    for (const d of [140, 220, 300, 380]) {
      const [px, py, a] = p.at(Math.max(0, p.len - d));
      for (const side of [1, -1]) {
        const hx = px - Math.sin(a) * 70 * side, hy = py + Math.cos(a) * 70 * side;
        if (this.inWorld(hx, hy, 30) && !this.isWater(hx, hy) && this.nearRoad(hx, hy) > 40) { x = hx; y = hy; break; }
      }
      if (x !== this.WW / 2) break;
    }
    const H = BK.HERO;
    this.hero = { x, y, tx: x, ty: y, home: { x, y }, ang: -Math.PI / 2, lvl: 1, xp: 0, hp: H.hp, maxHp: H.hp, cd: 0, dead: false, respawn: 0, rallyCd: 6, grenCd: 4, walk: 0, flash: 0, kills: 0 };
  };
  G.heroStats = function () {
    const h = this.hero, H = BK.HERO, l = (h && h.lvl) || 1;
    return { maxHp: Math.round(H.hp * (1 + 0.2 * (l - 1))), dmg: H.dmg * (1 + 0.28 * (l - 1)) * (1 + this.mods.dmg * 0.5), rate: H.rate * (1 + 0.06 * (l - 1)), range: H.range, gren: H.grenade.dmg * (1 + 0.25 * (l - 1)) };
  };
  G.heroGainXp = function (xp) {
    const h = this.hero;
    if (!h || h.dead) return;
    h.xp += xp;
    while (h.lvl < LV.length && h.xp >= LV[h.lvl]) {
      h.lvl++;
      const s = this.heroStats();
      h.maxHp = s.maxHp;
      h.hp = s.maxHp;
      this.emit("text", { x: h.x, y: h.y - 30, str: "COMMANDER LEVEL " + h.lvl, color: "#ffd84d", size: 18 });
      this.emit("heroLevel", { lvl: h.lvl });
    }
  };
  G.moveHero = function (x, y) {
    const h = this.hero;
    if (!h || h.dead) return false;
    x = BK.clamp(x, 20, this.WW - 20);
    y = BK.clamp(y, 20, this.WH - 20);
    if (this.isWater(x, y)) return false;
    h.tx = x; h.ty = y;
    return true;
  };
  G.heroDamage = function (dmg) {
    const h = this.hero;
    if (!h || h.dead || this.phase !== "combat") return;
    h.hp -= dmg;
    h.flash = 0.12;
    if (h.hp <= 0) {
      h.hp = 0;
      h.dead = true;
      h.respawn = BK.HERO.respawn;
      this.emit("text", { x: h.x, y: h.y - 26, str: "COMMANDER DOWN", color: "#ff5a4f", size: 18 });
      this.emit("heroDown", {});
    }
  };
  G.heroReady = function (which) {
    const h = this.hero;
    return !!h && !h.dead && this.phase === "combat" && (which === "rally" ? h.rallyCd <= 0 : h.grenCd <= 0);
  };
  G.heroRally = function () {
    if (!this.heroReady("rally")) return false;
    const h = this.hero, R = BK.HERO.rally;
    h.rallyCd = R.cd;
    let n = 0;
    for (const t of this.towers) if (t.ko <= 0 && dist2(t.x, t.y, h.x, h.y) < R.r * R.r) { t.rallyT = R.dur; n++; }
    this.emit("rally", { x: h.x, y: h.y, r: R.r });
    this.emit("text", { x: h.x, y: h.y - 30, str: n ? "RALLY! " + n + " GUNS" : "RALLY!", color: "#ffd84d", size: 18 });
    return true;
  };
  G.heroGrenade = function () {
    if (!this.heroReady("grenade")) return false;
    const h = this.hero, R = BK.HERO.grenade;
    let best = null, bn = 0;
    for (const e of this.enemies) {
      if (e.gone || e.air || e.surrender || !this.inWorld(e.x, e.y)) continue;
      if (dist2(e.x, e.y, h.x, h.y) > R.r * R.r) continue;
      let n = 0;
      for (const o of this.enemies) if (!o.gone && !o.air && dist2(o.x, o.y, e.x, e.y) < 50 * 50) n += o.def.kind === "foot" ? 1 : 2;
      if (n > bn) { bn = n; best = e; }
    }
    if (!best) return false;
    h.grenCd = R.cd;
    const s = this.heroStats();
    for (let i = 0; i < 3; i++) {
      const [tx, ty] = this.predict(best, 0.7 + i * 0.12);
      this.projectiles.push({
        type: "lob", gun: "gran", x: h.x, y: h.y, sx: h.x, sy: h.y, tx: tx + this.rng.range(-14, 14), ty: ty + this.rng.range(-14, 14), t: 0, T: 0.7 + i * 0.12,
        target: null, dmg: s.gren, splash: R.splash, airSplash: 0, crit: 0, manned: false,
        o: { pen: 0.6, groundMult: 1, airMult: 0, explosive: true, hero: true },
      });
    }
    this.emit("text", { x: h.x, y: h.y - 30, str: "GRENADES!", color: "#f2e3b0", size: 16 });
    return true;
  };

  G.updateHero = function (dt) {
    const h = this.hero;
    if (!h) return;
    h.flash = Math.max(0, h.flash - dt);
    if (h.dead) {
      h.respawn -= dt;
      if (h.respawn <= 0 || this.phase !== "combat") {
        h.dead = false;
        h.x = h.tx = h.home.x; h.y = h.ty = h.home.y;
        h.maxHp = this.heroStats().maxHp;
        h.hp = h.maxHp;
        this.emit("text", { x: h.x, y: h.y - 26, str: "COMMANDER BACK", color: "#9fe870", size: 16 });
      }
      return;
    }
    // Walk.
    const d = dist(h.x, h.y, h.tx, h.ty);
    if (d > 2) {
      const a = angTo(h.x, h.y, h.tx, h.ty);
      const step = Math.min(d, BK.HERO.speed * dt);
      const nx = h.x + Math.cos(a) * step, ny = h.y + Math.sin(a) * step;
      if (this.isWater(nx, ny)) { h.tx = h.x; h.ty = h.y; }
      else { h.x = nx; h.y = ny; h.ang = turnTo(h.ang, a, dt * 8); h.walk += dt; }
    }
    h.rallyCd = Math.max(0, h.rallyCd - dt);
    h.grenCd = Math.max(0, h.grenCd - dt);
    if (this.phase !== "combat") { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2 * dt); return; }
    const s = this.heroStats();
    // Fight whatever is close: his pistol and the runner's carbine.
    h.cd -= dt;
    let tgt = null, bd = s.range * s.range;
    let threat = 0, near = false;
    const wv = Math.min(this.wave, BK.WAVE_COUNT);
    for (const e of this.enemies) {
      if (e.gone || e.air || e.surrender || !this.inWorld(e.x, e.y)) continue;
      const d2 = dist2(e.x, e.y, h.x, h.y);
      if (d2 < 160 * 160) near = true;
      if (d2 < bd) { bd = d2; tgt = e; }
      if (e.def.kind === "foot" && d2 < 70 * 70) threat += 2.2;
      else if (e.def.shoots && d2 < 130 * 130) threat += 6;
    }
    if (threat) this.heroDamage(threat * (1 + 0.07 * wv) * dt);
    else if (!near) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.04 * dt);
    if (h.dead || !tgt) return;
    if (d <= 2) h.ang = turnTo(h.ang, angTo(h.x, h.y, tgt.x, tgt.y), dt * 8);
    if (h.cd <= 0) {
      h.cd = 1 / s.rate;
      const before = tgt.hp;
      this.damage(tgt, s.dmg, { pen: 0.3, hero: true });
      this.heroGainXp(Math.min(before, s.dmg) * 0.12);
      this.emit("tracer", { x: h.x, y: h.y, tx: tgt.x, ty: tgt.y });
      this.emit("shot", { x: h.x + Math.cos(h.ang) * 8, y: h.y + Math.sin(h.ang) * 8, ang: h.ang, gun: "rkm", hero: true });
    }
  };

  // Explosions on the guns also find the commander, and a rally makes guns fire faster.
  const baseArea = G.damageTowersArea;
  G.damageTowersArea = function (x, y, dmg, r) {
    baseArea.call(this, x, y, dmg, r);
    const h = this.hero;
    if (h && !h.dead && dist2(x, y, h.x, h.y) < r * r) this.heroDamage(dmg * 0.6);
  };
  const baseStats = G.towerStats;
  G.towerStats = function (t) {
    const s = baseStats.call(this, t);
    if (t.rallyT > 0 && !s.support) s.rate *= BK.HERO.rally.rate;
    return s;
  };
  const baseExtra = G.updateExtra;
  G.updateExtra = function (dt) {
    baseExtra.call(this, dt);
    for (const t of this.towers) if (t.rallyT > 0) t.rallyT -= dt;
    this.updateHero(dt);
  };
  // Grenades from the commander teach him too.
  const baseKill = G.kill;
  G.kill = function (e, o) {
    const was = e.gone;
    baseKill.call(this, e, o);
    if (!was && o && o.hero && this.hero) { this.heroGainXp(e.def.score * 0.15 + 3); this.hero.kills++; }
  };

  // ------------------------------------------------------------------ damage totals per gun
  // Guns that were sold still count toward the summary at the end.
  const baseSell = G.sell;
  G.sell = function (t) {
    this.soldStats = this.soldStats || {};
    const k = this.soldStats[t.kind] || (this.soldStats[t.kind] = { dmg: 0, kills: 0 });
    k.dmg += t.dmgDone || 0;
    k.kills += t.kills || 0;
    baseSell.call(this, t);
  };
  G.damageSummary = function () {
    const by = {};
    const add = (kind, dmg, kills, n) => {
      const r = by[kind] || (by[kind] = { kind, dmg: 0, kills: 0, n: 0 });
      r.dmg += dmg; r.kills += kills; r.n += n;
    };
    for (const t of this.towers) add(t.kind, t.dmgDone || 0, t.kills || 0, 1);
    for (const [k, v] of Object.entries(this.soldStats || {})) add(k, v.dmg, v.kills, 0);
    const rows = Object.values(by).filter((r) => r.dmg > 0 || r.n > 0).sort((a, b) => b.dmg - a.dmg);
    const total = rows.reduce((a, r) => a + r.dmg, 0) || 1;
    for (const r of rows) r.share = r.dmg / total;
    return rows;
  };

  // ------------------------------------------------------------------ save and resume
  // A battle is saved at the start of each build phase, so a closed tab picks up from the last cleared wave.
  G.snapshot = function () {
    const T = (t) => ({ kind: t.kind, x: Math.round(t.x), y: Math.round(t.y), ang: +t.ang.toFixed(2), path: t.path.slice(), rank: t.rank, xp: Math.round(t.xp), priority: t.priority, crewName: t.crewName, kills: t.kills || 0, dmgDone: Math.round(t.dmgDone || 0), invest: t.invest, builtWave: t.builtWave });
    const h = this.hero;
    return {
      v: 1, map: this.mapIndex, mapId: this.map.id, diff: this.diff, endless: this.endless, daily: this.daily, weather: this.weatherId,
      wave: this.wave, money: Math.round(this.money), garrison: this.garrison, startGarrison: this.startGarrison, score: this.score,
      kills: this.kills, bossKills: this.bossKills, bestCombo: this.bestCombo, rerolls: this.rerolls, firstCard: this.firstCard,
      cardsTaken: Object.assign({}, this.cardsTaken), mods: JSON.parse(JSON.stringify(this.mods)), inv: Object.assign({}, this.inv),
      honors: Object.assign({}, this.honors), stats: Object.assign({}, this.stats), usedNames: Object.assign({}, this.usedNames),
      abil: Object.fromEntries(Object.entries(this.abil).map(([k, a]) => [k, Math.round(a.charge)])),
      towers: this.towers.map(T), soldStats: this.soldStats || {},
      forts: this.forts.map((f) => ({ kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), hp: Math.round(f.hp) })),
      craters: this.craters.filter((c) => !c.old).slice(-120).map((c) => [Math.round(c.x), Math.round(c.y), Math.round(c.r)]),
      hero: h ? { lvl: h.lvl, xp: Math.round(h.xp), kills: h.kills } : null,
      when: Date.now(),
    };
  };
  BK.Game.fromSnapshot = function (s, unlocks) {
    const g = new BK.Game({ map: s.map, seed: (Math.random() * 1e9) | 0, diff: s.diff, endless: s.endless, daily: s.daily, weather: s.weather, save: { unlocks: unlocks || {} } });
    const keep = ["wave", "garrison", "startGarrison", "score", "kills", "bossKills", "bestCombo", "rerolls", "firstCard"];
    for (const k of keep) if (s[k] != null) g[k] = s[k];
    g.cardsTaken = s.cardsTaken || {};
    g.mods = Object.assign(g.mods, s.mods || {});
    g.inv = s.inv || {};
    g.honors = s.honors || {};
    Object.assign(g.stats, s.stats || {});
    g.usedNames = s.usedNames || {};
    g.soldStats = s.soldStats || {};
    for (const [k, c] of Object.entries(s.abil || {})) if (g.abil[k]) g.abil[k].charge = c;
    for (const [x, y, r] of s.craters || []) g.craters.push({ x, y, r, fresh: 0 });
    g.coverVer++;
    // Rebuild every gun where it stood, then give it back its history.
    g.phase = "deploy";
    for (const o of s.towers || []) {
      if (!BK.GUNS[o.kind] || !BK.TREES[o.kind]) continue;
      g.money = 1e9;
      const t = g.build(o.kind, o.x, o.y);
      if (!t) continue;
      const path = (o.path || [o.kind]).filter((id) => BK.TREES[o.kind][id]);
      Object.assign(t, { ang: o.ang, path: path.length ? path : [o.kind], rank: o.rank || 0, xp: o.xp || 0, priority: o.priority || t.priority, crewName: o.crewName || t.crewName, kills: o.kills || 0, dmgDone: o.dmgDone || 0, invest: o.invest || t.invest, builtWave: o.builtWave || 0, phaseBuilt: "loaded" });
      t.level = t.path.length;
      t.spec = BK.TREES[t.kind][t.path[t.path.length - 1]].tier === 3 ? t.path[t.path.length - 1] : null;
      t.maxHp = g.towerMaxHp(t);
      t.hp = t.maxHp;
    }
    for (const f of s.forts || []) {
      if (!BK.FORTS[f.kind]) continue;
      g.money = 1e9;
      const made = g.buildFort(f.kind, f.x, f.y);
      if (made && made.hp != null) made.hp = Math.min(made.maxHp, f.hp);
    }
    g.money = s.money;
    g.stats.forts = (s.stats && s.stats.forts) || 0;
    g.stats.built = (s.stats && s.stats.built) || g.towers.length;
    if (g.hero && s.hero) {
      g.hero.lvl = 1; g.hero.xp = 0;
      g.heroGainXp(s.hero.xp);
      g.hero.kills = s.hero.kills || 0;
    }
    g.refreshAuras();
    g.events.length = 0;
    g.earlyT = 30;
    g.resumed = true;
    return g;
  };

  // ------------------------------------------------------------------ the daily challenge
  // One battle a day: the same field, weather and orders for everyone on that date.
  BK.DAILY_MODS = {
    armor: { name: "Armored push", desc: "Every vehicle has 25% more health." },
    thin: { name: "Thin supply", desc: "Kills pay 20% less." },
    air: { name: "Air raids", desc: "Two extra Stukas from wave 3 on." },
    rich: { name: "War chest", desc: "Start with 150 more złoty." },
    vets: { name: "Old hands", desc: "Every new gun arrives at level 2." },
    fast: { name: "Forced march", desc: "Ground units move 15% faster." },
    nocrates: { name: "No drops", desc: "No supply crates fall." },
    short: { name: "Short garrison", desc: "Start with 6 less garrison." },
  };
  BK.dailyFor = function (date) {
    const d = date || new Date();
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    let h = 0;
    for (const ch of "bk39" + key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = BK.makeRng(h || 1);
    const map = Math.floor(r() * BK.MAPS.length);
    const weather = r.pick(["clear", "fog", "rain", "smoke"]);
    const ids = Object.keys(BK.DAILY_MODS);
    const mods = [];
    while (mods.length < 3) { const m = r.pick(ids); if (!mods.includes(m) && !(m === "rich" && mods.includes("thin"))) mods.push(m); }
    return { date: key, map, weather, seed: h, mods, label: BK.MAPS[map].name + " · " + mods.map((m) => BK.DAILY_MODS[m].name).join(" · ") };
  };
  G.applyDaily = function (d) {
    if (!d) return;
    this.daily = d;
    const has = (m) => d.mods.includes(m);
    if (has("thin")) this.mods.reward -= 0.2;
    if (has("rich")) this.money += 150;
    if (has("vets")) this.takeCard(BK.CARD_BY_ID.vets, true);
    if (has("nocrates")) this.mods.crateRate = -1;
    if (has("short")) { this.garrison = Math.max(5, this.garrison - 6); this.startGarrison = this.garrison; }
  };
  const baseSpawn = G.spawn;
  G.spawn = function (q) {
    const e = baseSpawn.call(this, q);
    const d = this.daily;
    if (d && e) {
      if (d.mods.includes("armor") && !e.air && e.def.kind !== "foot") { e.hp *= 1.25; e.maxHp *= 1.25; }
      if (d.mods.includes("fast") && !e.air) e.speed *= 1.15;
    }
    return e;
  };
  const baseExpand2 = G.expandWave;
  G.expandWave = function (def) {
    if (this.daily && this.daily.mods.includes("air") && this.wave >= 3) def = Object.assign({}, def, { groups: def.groups.concat([{ kind: "stuka", n: 2, gap: 4, path: "air", at: 7 }]) });
    return baseExpand2.call(this, def);
  };
})(typeof window !== "undefined" ? window : globalThis);
