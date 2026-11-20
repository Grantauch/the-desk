// A simple automatic player. Used for the title screen battle in the background and for balance tests.
(function (root) {
  const BK = root.BK;

  // Score open ground by how much road a gun there would cover.
  BK.spotScores = function (g, range) {
    const spots = [];
    for (let x = 40; x < (g.WW || BK.W) - 40; x += 28) {
      for (let y = 40; y < (g.WH ? g.WH - 40 : 610); y += 28) {
        if (g.canPlace(x, y)) continue;
        let cover = 0;
        for (const p of g.paths) {
          for (let d = 0; d < p.len; d += 12) {
            const [px, py] = p.at(d);
            if ((px - x) * (px - x) + (py - y) * (py - y) < range * range && px > 0 && px < (g.WW || BK.W)) cover++;
          }
        }
        spots.push({ x, y, cover });
      }
    }
    spots.sort((a, b) => b.cover - a.cover);
    return spots;
  };

  BK.Bot = class {
    constructor(g, opts) {
      this.g = g;
      this.opts = Object.assign({ crew: false, skill: 1 }, opts || {});
      this.cache = {};
      this.thinkT = 0;
    }
    plan(kind) {
      const r = BK.GUNS[kind].range * 0.9;
      const key = kind;
      if (!this.cache[key]) this.cache[key] = BK.spotScores(this.g, r);
      return this.cache[key];
    }
    want() {
      const g = this.g;
      const counts = {};
      for (const t of g.towers) counts[t.kind] = (counts[t.kind] || 0) + 1;
      const c = (k) => counts[k] || 0;
      const has = (k) => g.gunAvailable(k);
      const w = g.wave + (g.phase === "deploy" ? 1 : 0);
      if (c("mg") < 2) return "mg";
      if (has("rkm") && c("rkm") < 1) return "rkm";
      if (w >= 2 && has("gran") && c("gran") < 1) return "gran";
      if (w >= 3 && c("at37") < 1) return "at37";
      if (w >= 4 && has("obs") && c("obs") < 1 && g.towers.length >= 5) return "obs";
      if (w >= 5 && c("mortar") < 1) return "mortar";
      if (w >= 5 && has("tks") && c("tks") < 1) return "tks";
      if (w >= 6 && c("aa") < 1) return "aa";
      if (w >= 5 && c("at37") < 2) return "at37";
      if (g.gunAvailable("atr") && c("atr") < Math.floor(w / 4)) return "atr";
      if (w >= 7 && has("how100") && c("how100") < 1) return "how100";
      if (w >= 8 && c("aa") < 2) return "aa";
      if (g.gunAvailable("f75") && w >= 9 && c("f75") < 2) return "f75";
      if (w >= 9 && has("obs") && c("obs") < 2 && g.towers.length >= 14) return "obs";
      if (w >= 10 && has("how100") && c("how100") < 2) return "how100";
      if (c("at37") < Math.floor(w / 3)) return "at37";
      if (has("gran") && c("gran") < Math.floor(w / 4)) return "gran";
      if (c("mg") < 3 + Math.floor(w / 5)) return "mg";
      if (has("rkm") && c("rkm") < 1 + Math.floor(w / 5)) return "rkm";
      if (has("tks") && w >= 10 && c("tks") < 2) return "tks";
      return g.rng() < 0.5 ? "mortar" : "at37";
    }
    tryBuild(kind) {
      const g = this.g;
      if (g.money < BK.GUNS[kind].cost) return false;
      if (BK.GUNS[kind].support) {
        // An observer goes where its circle covers the most guns.
        const r = BK.GUNS[kind].range * 0.85;
        let best = null;
        for (const t of g.towers) {
          for (let a = 0; a < 6.28; a += 0.7) {
            const x = t.x + Math.cos(a) * 60, y = t.y + Math.sin(a) * 60;
            if (g.canPlace(x, y, kind)) continue;
            let n = 0;
            for (const o of g.towers) if (!BK.GUNS[o.kind].support && Math.hypot(o.x - x, o.y - y) < r) n++;
            if (!best || n > best.n) best = { x, y, n };
          }
        }
        if (best) return !!g.build(kind, best.x, best.y);
      }
      for (const s of this.plan(kind)) {
        if (!g.canPlace(s.x, s.y, kind)) return !!g.build(kind, s.x, s.y);
      }
      return false;
    }
    spend() {
      const g = this.g;
      for (let i = 0; i < 6; i++) {
        // A good commander grows the guns he has before adding more: take any earned tier 2 or 3 form first.
        if (g.wave >= 3) {
          let up = null;
          for (const t of g.towers) {
            for (const n of g.upgradeOptions(t)) if (n.tier >= 2 && !g.upgradeBlock(t, n) && (!up || n.tier > up.n.tier)) up = { t, n };
          }
          if (up && g.upgrade(up.t, up.n.id)) continue;
        }
        const k = this.want();
        if (g.money >= BK.GUNS[k].cost) { if (!this.tryBuild(k)) break; continue; }
        // Otherwise take the cheapest upgrade the gun has earned, picking a random branch.
        let done = false;
        const ts = g.towers.slice().sort((a, b) => (g.upgradeCost(a) || 1e9) - (g.upgradeCost(b) || 1e9));
        for (const t of ts) {
          const opts = g.upgradeOptions(t).filter((n) => !g.upgradeBlock(t, n));
          if (!opts.length) continue;
          done = g.upgrade(t, opts[Math.floor(g.rng() * opts.length)].id);
          if (done) break;
        }
        if (done) continue;
        // Sandbag the guns that are taking fire.
        if (g.phase === "deploy" && g.money > 60 && g.buildFort) {
          const t = g.towers.find((t) => t.hp < t.maxHp * 0.9 && !g.forts.some((f) => Math.hypot(f.x - t.x, f.y - t.y) < 50));
          if (t) {
            for (let a = 0; a < 6.28; a += 0.8) {
              const x = t.x + Math.cos(a) * 34, y = t.y + Math.sin(a) * 34;
              if (g.canFort("sandbag", x, y) === true || g.canFort("sandbag", x, y) == null) { if (g.buildFort("sandbag", x, y)) break; }
            }
          }
        }
        break;
      }
    }
    update(dt) {
      const g = this.g;
      this.thinkT -= dt;
      if (g.phase === "cards" && g.offer) {
        const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
        const best = g.offer.slice().sort((a, b) => order[a.rarity] - order[b.rarity])[0];
        g.takeCard(best);
        return;
      }
      for (const c of g.crates.slice()) if (c.fall <= 0) g.openCrate(c);
      if (this.thinkT > 0) return;
      this.thinkT = 0.5;
      this.spend();
      for (const id in g.abil) {
        if (g.abilityReady(id)) {
          const f = g.frontEnemy();
          if (f) g.useAbility(id, f.x, f.y);
        }
      }
      // The commander goes where the fighting is and uses his orders when they are ready.
      if (g.hero && !g.hero.dead && g.phase === "combat") {
        const f = g.frontEnemy();
        if (f) {
          let near = null, bd = 1e12;
          for (const t of g.towers) { const d = (t.x - f.x) * (t.x - f.x) + (t.y - f.y) * (t.y - f.y); if (d < bd) { bd = d; near = t; } }
          if (near) g.moveHero(near.x + (f.x - near.x) * 0.25, near.y + (f.y - near.y) * 0.25);
        }
        g.heroGrenade();
        if (g.towers.filter((t) => Math.hypot(t.x - g.hero.x, t.y - g.hero.y) < BK.HERO.rally.r).length >= 3 && g.enemies.length > 4) g.heroRally();
      }
      if (g.phase === "deploy" && !g.demo) g.startWave();
      if (g.phase === "deploy" && g.demo) g.startWave();
      if (this.opts.crew) {
        // Crew the best gun near the front and aim for weak spots on the toughest target.
        // Every couple of seconds pick the gun and target pair that matters most: the toughest unit in range of a hard hitting gun.
        this.crewT = (this.crewT || 0) - 0.5;
        let target = this.crewTarget && g.enemies.find((e) => e.id === this.crewTarget && !e.gone);
        let t = g.crewTower();
        if (!target || !t || this.crewT <= 0 || Math.hypot(target.x - t.x, target.y - t.y) > g.towerStats(t).range) {
          this.crewT = 2;
          let best = null;
          for (const tw of g.towers) {
            if (tw.ko > 0 || BK.GUNS[tw.kind].shot === "lob" || BK.GUNS[tw.kind].support) continue;
            const r = g.towerStats(Object.assign({}, tw, { manned: true })).range;
            for (const e of g.enemies) {
              if (e.gone || e.x < 0 || (e.air && tw.kind !== "aa" && tw.kind !== "mg" && tw.kind !== "rkm")) continue;
              const d = Math.hypot(e.x - tw.x, e.y - tw.y);
              if (d > r * 0.95) continue;
              const sc = e.maxHp * (BK.GUNS[tw.kind].dmg / 10) * (e.def.weak ? 2 : 1) + e.dist * 0.1;
              if (!best || sc > best.sc) best = { sc, tw, e };
            }
          }
          if (best) {
            if (!t || t.id !== best.tw.id) g.man(best.tw);
            t = g.crewTower();
            target = best.e;
            this.crewTarget = target.id;
          }
        }
        if (target) {
          if (t) {
            const w = target.def.weak && target.def.weak[0];
            let lx = 0, ly = 0;
            if (w && this.opts.skill > 0.5) { lx = (w.x0 + w.x1) / 2; ly = (w.y0 + w.y1) / 2; }
            // Crewed rounds lock onto whatever is under the crosshair, so aim at where it is now.
            const px = target.x, py = target.y;
            const c = Math.cos(target.ang), s = Math.sin(target.ang);
            g.aim.x = px + lx * c - ly * s;
            g.aim.y = py + lx * s + ly * c;
            g.fireHeld = Math.hypot(target.x - t.x, target.y - t.y) < g.towerStats(t).range;
          }
        } else if (g.crew) g.fireHeld = false;
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
