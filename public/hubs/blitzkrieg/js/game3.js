// Rules for the newer guns: support auras, income, grenades, cavalry screens and called fire.
// Loaded after game2.js. Each piece wraps the method it extends and leaves the old guns alone.
(function (root) {
  const BK = root.BK;
  const { dist2, angTo, turnTo } = BK;
  const G = BK.Game.prototype;

  // ------------------------------------------------------------------ difficulty
  // Enemy health climbs a little faster each wave, so a strong economy still meets a real fight late on.
  G.hpScale = function () {
    const extra = this.wave > BK.WAVE_COUNT ? Math.pow(1.13, this.wave - BK.WAVE_COUNT) : 1;
    const w = Math.min(this.wave, BK.WAVE_COUNT) - 1;
    return this.map.hp * BK.TUNE.hp * (1 + BK.TUNE.ramp * w + (BK.TUNE.ramp2 || 0) * w * w) * extra * (this.diffHp || 1);
  };

  // ------------------------------------------------------------------ stats
  // Root forms can carry flags (mobile, aura), and support guns get help from the posts around them.
  const baseStats = G.towerStats;
  G.towerStats = function (t) {
    const s = baseStats.call(this, t);
    const d = BK.GUNS[t.kind];
    const tree = BK.TREES[t.kind];
    const rootMods = (tree && tree[t.kind] && tree[t.kind].mods) || {};
    let mobileSet = false, auraSet = false;
    for (const id of (t.path || []).slice(1)) {
      const m = tree[id].mods;
      if ("mobile" in m) mobileSet = true;
      if ("aura" in m) auraSet = true;
    }
    if (d.mobile && !mobileSet) s.mobile = true;
    if (!auraSet && rootMods.aura) s.aura = rootMods.aura;
    if (d.support) { s.support = true; if (s.aura) s.range = s.aura.r; return s; }
    // Auras from observation posts and supply tankettes.
    for (const o of this.auraSrc || []) {
      if (o === t || o.ko > 0) continue;
      const a = o.auraNow;
      if (dist2(o.x, o.y, t.x, t.y) > a.r * a.r) continue;
      if (a.range) s.range *= a.range;
      if (a.rate) s.rate *= a.rate;
      if (a.dmg) s.dmg *= a.dmg;
    }
    return s;
  };

  // Which guns project an aura, a damage mark, called fire or repairs. Recomputed when guns change.
  const baseAuras = G.refreshAuras;
  G.refreshAuras = function () {
    baseAuras.call(this);
    this.auraSrc = [];
    this.marks = [];
    this.fdcBoost = 0;
    for (const t of this.towers) {
      if (t.ko > 0) continue;
      const s = this.towerStats(t);
      if (s.aura) { t.auraNow = s.aura; this.auraSrc.push(t); }
      else t.auraNow = null;
      if (s.mark) { t.markR = (s.aura && s.aura.r) || s.range; t.markNow = s.mark; this.marks.push(t); }
      if (s.chargeBoost) this.fdcBoost = Math.max(this.fdcBoost, s.chargeBoost);
    }
  };
  const baseSell = G.sell;
  G.sell = function (t) { baseSell.call(this, t); this.refreshAuras(); };

  // The strongest aura of one kind that covers a gun.
  G.auraAt = function (t, key) {
    let best = 0;
    for (const o of this.auraSrc || []) {
      if (o === t || o.ko > 0 || !o.auraNow[key]) continue;
      const a = o.auraNow;
      if (dist2(o.x, o.y, t.x, t.y) <= a.r * a.r) best = Math.max(best, a[key]);
    }
    return best;
  };

  // ------------------------------------------------------------------ damage marks
  const baseDamage = G.damage;
  G.damage = function (e, base, o) {
    if (this.marks && this.marks.length && !e.gone) {
      let m = 1;
      for (const t of this.marks) if (t.ko <= 0 && dist2(t.x, t.y, e.x, e.y) < t.markR * t.markR) m = Math.max(m, t.markNow);
      base *= m;
    }
    return baseDamage.call(this, e, base, o);
  };

  // ------------------------------------------------------------------ experience
  // Support posts learn from the guns they serve, and a liaison officer speeds every crew nearby.
  const baseXp = G.gainXp;
  G.gainXp = function (t, xp) {
    if (!t) return;
    if (!BK.GUNS[t.kind].support) {
      const boost = this.auraAt(t, "xp");
      if (boost) xp *= boost;
      for (const o of this.auraSrc || []) {
        if (o === t || o.ko > 0 || !BK.GUNS[o.kind].support) continue;
        if (dist2(o.x, o.y, t.x, t.y) <= o.auraNow.r * o.auraNow.r) baseXp.call(this, o, xp * 0.3);
      }
    }
    baseXp.call(this, t, xp);
  };

  // Called fire, grenades and repairs need the post or gun alive and the wave on.
  const baseTower = G.updateTower;
  G.updateTower = function (t, dt) {
    if (!t) return;
    if (BK.GUNS[t.kind].support) {
      if (t.ko > 0) { baseTower.call(this, t, dt); return; }
      // The observer swings his glasses along the road.
      const e = this.phase === "combat" ? this.frontEnemy() : null;
      if (e && dist2(t.x, t.y, e.x, e.y) < 400 * 400) t.ang = turnTo(t.ang, angTo(t.x, t.y, e.x, e.y), dt * 1.5);
      else t.ang += dt * 0.15;
      return;
    }
    baseTower.call(this, t, dt);
  };

  // A crewed support post has nothing to aim.
  const baseMan = G.man;
  G.man = function (t) {
    if (t && BK.GUNS[t.kind].support) return false;
    return baseMan.call(this, t);
  };

  // ------------------------------------------------------------------ per frame
  const baseExtra = G.updateExtra;
  G.updateExtra = function (dt) {
    baseExtra.call(this, dt);
    if (this.phase !== "combat") return;
    this.auraT = (this.auraT || 0) - dt;
    if (this.auraT <= 0) { this.auraT = 0.5; this.refreshAuras(); }
    for (const t of this.towers) {
      if (t.ko > 0) continue;
      const s = this.towerStats(t);
      if (s.grenade) this.tickGrenade(t, s, dt);
      if (s.slowAura) this.tickScreen(t, s, dt);
      if (s.callFire) this.tickCallFire(t, s, dt);
      if (s.aura && s.aura.repair) this.tickRepair(t, s.aura, dt);
    }
  };

  // Grenadiers throw a bundle into the thickest knot of infantry in reach.
  G.tickGrenade = function (t, s, dt) {
    t.grenT = (t.grenT == null ? 2 : t.grenT) - dt;
    if (t.grenT > 0) return;
    let best = null, bn = 0;
    const r2 = s.range * s.range;
    for (const e of this.enemies) {
      if (e.gone || e.air || e.surrender || e.def.kind !== "foot") continue;
      if (dist2(t.x, t.y, e.x, e.y) > r2) continue;
      let n = 0;
      for (const o of this.enemies) if (!o.gone && !o.air && o.def.kind === "foot" && dist2(o.x, o.y, e.x, e.y) < 44 * 44) n++;
      if (n > bn) { bn = n; best = e; }
    }
    if (!best) { t.grenT = 0.5; return; }
    t.grenT = s.grenade;
    const [tx, ty] = this.predict(best, 0.8);
    this.projectiles.push({
      type: "lob", gun: "gran", x: t.x, y: t.y, sx: t.x, sy: t.y, tx, ty, t: 0, T: 0.8, target: null,
      dmg: 70 * (1 + this.mods.dmg), splash: 46, airSplash: 0, crit: 0, manned: false,
      o: { tower: t, gun: t.kind, pen: 0.5, groundMult: 1, airMult: 0, explosive: true },
    });
    this.emit("text", { x: t.x, y: t.y - 26, str: "GRENADES", color: "#f2e3b0", size: 13 });
  };

  // Riders harass the column: ground units in reach move at half speed. Bosses push through.
  G.tickScreen = function (t, s, dt) {
    const r2 = s.range * s.range;
    for (const e of this.enemies) {
      if (e.gone || e.air || e.boss || e.surrender) continue;
      if (dist2(t.x, t.y, e.x, e.y) < r2) e.slowT = Math.max(e.slowT, 0.12);
    }
  };

  // A radio post calls a heavy shell onto the toughest enemy near it.
  G.tickCallFire = function (t, s, dt) {
    t.callT = (t.callT == null ? 3 : t.callT) - dt;
    if (t.callT > 0) return;
    const r = (s.aura && s.aura.r) || s.range;
    let best = null;
    for (const e of this.enemies) {
      if (e.gone || e.air || e.surrender || !this.inWorld(e.x, e.y)) continue;
      if (dist2(t.x, t.y, e.x, e.y) > r * r) continue;
      if (!best || e.hp > best.hp) best = e;
    }
    if (!best) { t.callT = 1; return; }
    t.callT = s.callFire;
    const n = s.callShells || 1;
    for (let i = 0; i < n; i++) {
      const [x, y] = this.predict(best, 0.9 + i * 0.25);
      this.strikes.push({ x: x + this.rng.range(-10, 10), y: y + this.rng.range(-10, 10), t: 0.9 + i * 0.25, called: true, tower: t.id });
    }
    this.emit("text", { x: t.x, y: t.y - 26, str: "FIRE MISSION", color: "#ffd84d", size: 13 });
  };

  // Called shells hit a little lighter than the artillery ability and credit the post.
  const baseStrikes = G.updateStrikes;
  G.updateStrikes = function (dt) {
    const called = [];
    for (const s of this.strikes) {
      if (!s.called) continue;
      s.t -= dt;
      if (s.t > 0) { called.push(s); continue; }
      const t = this.towers.find((x) => x.id === s.tower);
      this.explode(s.x, s.y, 110 * (1 + this.mods.dmg) * (1 + 0.08 * this.wave), 44, { pen: 0.8, src: "arty", tower: t, explosive: true });
      this.shake(0.15);
    }
    // The core loop only sees the ability's own shells.
    this.strikes = this.strikes.filter((s) => !s.called);
    baseStrikes.call(this, dt);
    this.strikes.push(...called);
  };

  // Mechanics patch up the guns around the tankette and get knocked out guns firing again.
  G.tickRepair = function (t, a, dt) {
    for (const o of this.towers) {
      if (o === t || dist2(o.x, o.y, t.x, t.y) > a.r * a.r) continue;
      if (o.ko > 0) { if (o.ko > 6) o.ko = 6; continue; }
      if (o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + a.repair * dt);
    }
  };

  // Tag each shot with its round so the tankette's 20mm sounds like a cannon, not its old MG.
  const baseFire = G.fire;
  G.fire = function (t, s, target, ax, ay) {
    const n = this.events.length;
    baseFire.call(this, t, s, target, ax, ay);
    for (let i = n; i < this.events.length; i++) if (this.events[i].type === "shot") this.events[i].round = s.shot;
  };

  // ------------------------------------------------------------------ abilities and pay
  const baseKill = G.kill;
  G.kill = function (e, o) {
    const was = e.gone;
    baseKill.call(this, e, o);
    if (!was && this.fdcBoost) for (const a in this.abil) this.abil[a].charge += e.def.reward * 0.9 * this.fdcBoost;
  };

  const baseClear = G.waveCleared;
  G.waveCleared = function () {
    if (this.phase === "combat") {
      let pay = 0;
      for (const t of this.towers) {
        const s = this.towerStats(t);
        if (s.income) {
          pay += s.income;
          this.emit("text", { x: t.x, y: t.y - 28, str: "+" + s.income + " zł", color: "#ffd84d", size: 15 });
        }
      }
      if (pay) { this.addMoney(pay, false); this.stats.supply = (this.stats.supply || 0) + pay; }
    }
    baseClear.call(this);
  };
})(typeof window !== "undefined" ? window : globalThis);
