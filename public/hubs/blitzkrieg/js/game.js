// The simulation. No drawing here: it emits events that the renderer, audio and HUD read each frame.
(function (root) {
  const BK = root.BK;
  const { clamp, dist, dist2, angTo, wrapAng, turnTo } = BK;

  let NEXT_ID = 1;

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.mapIndex = opts.map || 0;
      this.map = BK.MAPS[this.mapIndex];
      this.demo = !!opts.demo;
      this.endless = !!opts.endless;
      this.save = opts.save || { unlocks: {} };
      this.rng = BK.makeRng(opts.seed || (Date.now() & 0xffffff));
      this.paths = this.map.paths.map((c) => BK.buildPath(c));
      this.props = [];

      const U = this.save.unlocks || {};
      this.unlocked = (id) => !!U[id];

      this.time = 0;
      this.phase = "deploy";
      this.wave = 0; // waves started so far
      this.waveDef = null;
      this.waveT = 0;
      this.queue = [];
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.zones = [];
      this.mines = [];
      this.crates = [];
      this.events = [];
      this.strikes = [];
      this.fighters = [];

      this.money = this.map.money + (U.cash1 ? 60 : 0) + (U.cash2 ? 90 : 0);
      this.garrison = 20 + (U.garrison1 ? 4 : 0);
      this.score = 0;
      this.kills = 0;
      this.bossKills = 0;
      this.combo = 0;
      this.comboT = 0;
      this.bestCombo = 0;
      this.rerolls = 1 + (U.reroll1 ? 1 : 0);
      this.cardsTaken = {};
      this.offer = null;
      this.earlyT = Infinity;
      this.crateT = 26;
      this.airCoverT = 22;
      this.timeScale = 1;
      this.slowT = 0;
      this.crew = null;
      this.aim = { x: BK.W / 2, y: BK.H / 2 };
      this.fireHeld = false;
      this.firstCard = true;
      this.result = null;
      this.stats = { built: 0, crits: 0, crewKills: 0, crates: 0, leaks: 0 };

      this.mods = {
        dmg: 0, rate: 0, range: 0, hp: 0, reward: 0, splash: 0, air: 0, charge: 0, crit: 0,
        rico: 0, interest: 0.05, interestCap: 20, comboWin: 1.6, crateRate: 0, manned: 0,
        blast: 0, luck: U.luck1 ? 1 : 0, gun: {}, penAll: 0,
        fuelFire: false, quickRepair: false, ambush: 0, vets: false, airCover: false,
        chain: false, fort: false, bounty: false, bigArty: false, adrenaline: false,
        lastStand: false, ace: false,
      };
      if (U.vet) this.takeCard(BK.CARD_BY_ID.vets, true);
      this.buffs = { rush: 0, frenzy: 0 };
      this.abil = {};
      for (const a of Object.values(BK.ABILITIES)) {
        if (!a.unlock || U[a.unlock]) this.abil[a.id] = { charge: a.id === "arty" ? a.charge * 0.5 : 0 };
      }
      this.ambushLeft = 0;
      if (this.initExtra) this.initExtra(opts);
    }

    // ------------------------------------------------------------ helpers
    emit(type, data) {
      if (this.events.length < 600) this.events.push(Object.assign({ type }, data));
    }
    gunAvailable(kind) {
      const d = BK.GUNS[kind];
      return !d.unlock || this.unlocked(d.unlock);
    }
    addMoney(n, show, x, y) {
      n = Math.round(n);
      this.money += n;
      if (show) this.emit("cash", { amount: n, x, y });
    }
    comboMult() {
      return 1 + Math.min(2, Math.floor(this.combo / 5) * 0.1);
    }
    towerMaxHp(t) {
      return Math.round(BK.GUNS[t.kind].hp * (1 + this.mods.hp) * (1 + 0.15 * (t.level - 1)));
    }

    towerStats(t) {
      const d = BK.GUNS[t.kind], m = this.mods, L = t.level;
      const s = {
        dmg: d.dmg * (1 + 0.32 * (L - 1)) * (1 + m.dmg + (m.gun[t.kind] || 0)),
        rate: d.rate * (1 + 0.12 * (L - 1)) * (1 + m.rate),
        range: d.range * (1 + 0.06 * (L - 1)) * (1 + m.range),
        minRange: d.minRange || 0,
        splash: d.splash * (1 + m.splash),
        pen: d.pen,
        crit: d.crit + m.crit,
        air: d.air * (1 + m.air),
        ground: d.ground == null ? 1 : d.ground,
        pierce: d.pierce || 0,
        weakMult: 1,
        shells: 1,
        stun: 0,
        burn: false,
        airSplash: 0,
        oneshotFoot: false,
        vsShooters: 1,
      };
      switch (t.spec) {
        case "twin": s.rate *= 2; break;
        case "fire": s.burn = true; break;
        case "mark": s.range *= 1.3; s.crit += 0.4; break;
        case "over": s.pierce = 7; break;
        case "tung": s.crit += 0.3; s.weakMult = 4 / 3; break;
        case "load": s.rate *= 1.8; break;
        case "barr": s.shells = 3; break;
        case "heavy": s.splash *= 1.6; s.stun = 0.5; break;
        case "burst": s.airSplash = 55; break;
        case "sweep": s.ground = 1; s.range *= 1.25; break;
        case "cb": s.vsShooters = 2; break;
        case "shrap": s.splash *= 2.2; s.oneshotFoot = true; break;
      }
      if (this.buffs.frenzy > 0) s.rate *= 2;
      if (m.adrenaline && this.combo >= 25) s.rate *= 1.5;
      if (m.lastStand && this.garrison <= 6) { s.dmg *= 1.7; s.rate *= 1.4; }
      if (t.manned) {
        s.dmg *= 1.5 + m.manned;
        s.rate *= 1.25;
        s.range *= 1.15;
        if (s.air <= 0 && t.kind !== "mortar") s.air = 0.6;
      }
      return s;
    }

    // ------------------------------------------------------------ building
    canPlace(x, y, kind) {
      if (x < 22 || x > BK.W - 22 || y < 22 || y > 618) return "edge";
      for (const p of this.paths) if (p.near(x, y) < 46) return "road";
      for (const t of this.towers) if (dist2(x, y, t.x, t.y) < 44 * 44) return "gun";
      for (const pr of this.props) if (pr.block && dist2(x, y, pr.x, pr.y) < (pr.r + 18) * (pr.r + 18)) return "prop";
      if (kind && this.money < BK.GUNS[kind].cost) return "money";
      return null;
    }
    build(kind, x, y) {
      if (!this.gunAvailable(kind)) return null;
      if (this.canPlace(x, y, kind)) return null;
      const d = BK.GUNS[kind];
      this.money -= d.cost;
      const t = {
        id: NEXT_ID++, kind, x, y, ang: -Math.PI / 2 + (this.rng() - 0.5), cd: 0.3, level: this.mods.vets ? 2 : 1, spec: null,
        hp: 1, maxHp: 1, ko: 0, priority: kind === "f75" ? "strong" : "first", manned: false, recoil: 0,
        kills: 0, invest: d.cost, builtWave: this.wave, phaseBuilt: this.phase, target: null, flash: 0,
      };
      t.maxHp = this.towerMaxHp(t);
      t.hp = t.maxHp;
      this.towers.push(t);
      this.stats.built++;
      this.emit("build", { x, y, kind });
      return t;
    }
    upgradeCost(t) {
      if (t.spec) return null;
      return Math.round(BK.GUNS[t.kind].cost * BK.LEVEL_COST[t.level]);
    }
    upgrade(t, specId) {
      const c = this.upgradeCost(t);
      if (c == null || this.money < c) return false;
      if (t.level >= 3) {
        if (!specId) return false;
        t.spec = specId;
      } else t.level++;
      this.money -= c;
      t.invest += c;
      const old = t.maxHp;
      t.maxHp = this.towerMaxHp(t);
      t.hp = Math.min(t.maxHp, t.hp + (t.maxHp - old));
      this.emit("upgrade", { x: t.x, y: t.y, spec: !!specId });
      return true;
    }
    freeUpgrade() {
      const cands = this.towers.filter((t) => t.level < 3);
      if (!cands.length) { this.addMoney(150, true); return; }
      cands.sort((a, b) => BK.GUNS[b.kind].cost - BK.GUNS[a.kind].cost);
      const t = cands[0];
      t.level++;
      t.maxHp = this.towerMaxHp(t);
      t.hp = t.maxHp;
      this.emit("upgrade", { x: t.x, y: t.y });
    }
    sellValue(t) {
      return t.builtWave === this.wave && this.phase === "deploy" && t.phaseBuilt === "deploy" ? t.invest : Math.round(t.invest * 0.7);
    }
    sell(t) {
      if (this.crew === t.id) this.unman();
      this.money += this.sellValue(t);
      this.towers = this.towers.filter((x) => x !== t);
      this.emit("sell", { x: t.x, y: t.y });
    }

    // ------------------------------------------------------------ crew control
    man(t) {
      if (!t || t.ko > 0) return false;
      this.unman();
      t.manned = true;
      this.crew = t.id;
      this.emit("man", { x: t.x, y: t.y });
      return true;
    }
    unman() {
      const t = this.towers.find((x) => x.id === this.crew);
      if (t) t.manned = false;
      this.crew = null;
      this.fireHeld = false;
    }
    crewTower() {
      return this.crew ? this.towers.find((x) => x.id === this.crew) : null;
    }

    // ------------------------------------------------------------ waves
    startWave() {
      if (this.phase !== "deploy") return false;
      if (!this.endless && this.wave >= BK.WAVE_COUNT) return false;
      let bonus = 0;
      if (isFinite(this.earlyT) && this.earlyT > 1) bonus = Math.ceil(this.earlyT * 0.8);
      if (bonus) this.addMoney(bonus, true);
      this.wave++;
      const def = this.wave <= BK.WAVE_COUNT ? BK.WAVES[this.wave - 1] : BK.endlessWave(this.wave, this.rng);
      this.waveDef = def;
      this.queue = this.expandWave(def);
      this.waveT = 0;
      this.phase = "combat";
      this.earlyT = Infinity;
      this.ambushLeft = this.mods.ambush;
      this.emit("waveStart", { wave: this.wave, name: def.name, boss: def.boss, bonus });
      return true;
    }
    hpScale() {
      const extra = this.wave > BK.WAVE_COUNT ? Math.pow(1.13, this.wave - BK.WAVE_COUNT) : 1;
      const w = Math.min(this.wave, BK.WAVE_COUNT);
      return this.map.hp * BK.TUNE.hp * (1 + BK.TUNE.ramp * (w - 1)) * extra;
    }
    expandWave(def) {
      const out = [];
      const nPaths = this.paths.length;
      let squadId = 1000 * this.wave;
      let pathFlip = 0;
      for (const g of def.groups) {
        const at = g.at || 0;
        if (g.squad) {
          squadId++;
          const p = g.path != null ? g.path % nPaths : pathFlip++ % nPaths;
          const sn = Math.round(g.squad * (1 + BK.TUNE.count * (Math.min(this.wave, BK.WAVE_COUNT) - 1)));
          for (let i = 0; i < sn; i++) out.push({ t: at + i * 0.35, kind: "inf", path: p, squad: squadId, lat: ((i % 3) - 1) * 12 + this.rng.range(-3, 3) });
          if (g.officer) out.push({ t: at + sn * 0.35 + 0.2, kind: "officer", path: p, squad: squadId, lat: 0 });
          continue;
        }
        const n = Math.max(1, Math.round(g.n * (1 + BK.TUNE.count * (Math.min(this.wave, BK.WAVE_COUNT) - 1)) * this.map.count));
        for (let i = 0; i < n; i++) {
          const p = g.path === "air" ? "air" : g.path != null ? g.path % nPaths : (pathFlip + i) % nPaths;
          out.push({ t: at + i * (g.gap || 1), kind: g.kind, path: p, lat: g.kind === "inf" ? this.rng.range(-13, 13) : 0 });
        }
        if (g.path !== "air") pathFlip++;
      }
      out.sort((a, b) => a.t - b.t);
      return out;
    }
    spawn(q) {
      const def = BK.ENEMIES[q.kind];
      const hp = def.hp * this.hpScale() * (def.boss ? 0.75 : 1);
      const e = {
        id: NEXT_ID++, kind: q.kind, def, hp, maxHp: hp, armor: def.armor, speed: def.speed * (def.air ? 1 : BK.TUNE.speed),
        x: -100, y: -100, ang: 0, dist: 0, path: q.path, lat: q.lat || 0, air: !!def.air, alt: def.air ? 1 : 0,
        t: 0, flash: 0, slowT: 0, stunT: 0, panicT: 0, trackedT: 0, burnT: 0, burnTick: 0,
        squad: q.squad || 0, cd: 1 + this.rng() * 1.5, seed: this.rng() * 100, boss: !!def.boss,
        ambush: this.ambushLeft-- > 0, smokePopped: false, antennaDown: false, age: 0,
      };
      if (def.turrets) e.turrets = def.turrets.map((tt) => Object.assign({ cd: 1 + this.rng() * 2, ang: 0, maxHp: tt.hp * this.hpScale(), dead: false }, tt, { hp: tt.hp * this.hpScale() }));
      if (e.air) this.initAir(e);
      else {
        const p = this.paths[e.path];
        const [x, y, a] = p.at(0);
        e.x = x; e.y = y; e.ang = a;
      }
      if (this.onSpawn) this.onSpawn(e);
      this.enemies.push(e);
      if (def.boss) { this.emit("bossIn", { name: def.name, tip: def.tip, kind: def.id }); this.slow(0.9); }
      if (q.kind === "stuka" || q.kind === "leader") this.emit("planeIn", { kind: q.kind });
      return e;
    }

    initAir(e) {
      const r = this.rng;
      e.state = "approach";
      e.dives = e.def.dives || 1;
      if (e.def.spotter) {
        e.state = "circle";
        const tw = this.towers.length ? this.towers : [{ x: this.WW / 2, y: this.WH / 2 }];
        e.cx = tw.reduce((a, t) => a + t.x, 0) / tw.length; e.cy = tw.reduce((a, t) => a + t.y, 0) / tw.length; e.cr = 260;
        e.phi = r() * Math.PI * 2;
        e.circleT = 24;
        e.artyT = 4;
        e.x = e.cx + Math.cos(e.phi) * (e.cr + 500);
        e.y = e.cy + Math.sin(e.phi) * (e.cr + 300);
        e.ang = angTo(e.x, e.y, e.cx, e.cy);
        return;
      }
      const side = r.int(0, 2);
      if (side === 0) { e.x = -80; e.y = r.range(80, this.WH - 160); }
      else if (side === 1) { e.x = this.WW + 80; e.y = r.range(80, this.WH - 160); }
      else { e.x = r.range(150, this.WW - 150); e.y = -80; }
      this.pickAirTarget(e);
      e.ang = angTo(e.x, e.y, e.tx, e.ty);
    }
    pickAirTarget(e) {
      const live = this.towers.filter((t) => t.ko <= 0);
      if (live.length) {
        live.sort((a, b) => b.invest - a.invest + (this.rng() - 0.5) * 120);
        const t = live[0];
        e.targetTower = t.id;
        e.tx = t.x; e.ty = t.y;
      } else {
        const p = this.paths[0].at(this.rng.range(200, this.paths[0].len - 200));
        e.targetTower = null;
        e.tx = p[0]; e.ty = p[1];
      }
    }

    // ------------------------------------------------------------ main step
    update(rawDt) {
      // Slow motion is short and dramatic. It eases back up by itself.
      if (this.slowT > 0) {
        this.slowT -= rawDt;
        this.timeScale = BK.lerp(this.timeScale, 0.22, 0.3);
      } else this.timeScale = BK.lerp(this.timeScale, 1, 0.08);
      const dt = rawDt * this.timeScale;
      this.time += dt;

      for (const t of this.towers) {
        t.recoil = Math.max(0, t.recoil - dt * 6);
        t.flash = Math.max(0, t.flash - dt);
      }

      if (this.phase === "deploy" && isFinite(this.earlyT)) {
        this.earlyT -= rawDt;
        if (this.earlyT <= 0 && !this.demo) this.startWave();
      }

      this.updateCrates(dt);
      if (this.updateExtra) this.updateExtra(dt);
      this.updatePending(dt);
      if (this.phase !== "combat") {
        this.updateProjectiles(dt);
        this.updateZones(dt);
        if (this.crew) this.updateTower(this.crewTower(), dt);
        return;
      }

      this.waveT += dt;
      while (this.queue.length && this.queue[0].t <= this.waveT) this.spawn(this.queue.shift());

      for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
      for (const a in this.abil) {
        const ab = this.abil[a];
        if (ab.charge > BK.ABILITIES[a].charge) ab.charge = BK.ABILITIES[a].charge;
      }

      if (this.combo > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.breakCombo();
      }

      this.updateEnemies(dt);
      for (const t of this.towers) this.updateTower(t, dt);
      this.updateProjectiles(dt);
      this.updateZones(dt);
      this.updateMines();
      this.updateStrikes(dt);

      if (this.mods.airCover) {
        this.airCoverT -= dt;
        if (this.airCoverT <= 0) {
          this.airCoverT = 22;
          const front = this.frontEnemy();
          if (front) this.callFighter(front.x, front.y, true);
        }
      }

      this.crateT -= dt * (1 + this.mods.crateRate);
      if (this.crateT <= 0) {
        this.crateT = this.rng.range(24, 36);
        this.dropCrate();
      }

      this.enemies = this.enemies.filter((e) => !e.gone);
      if (!this.queue.length && !this.enemies.length) this.waveCleared();
    }

    breakCombo() {
      if (this.combo >= 10) this.emit("comboEnd", { combo: this.combo });
      this.combo = 0;
    }

    frontEnemy() {
      let best = null;
      for (const e of this.enemies) if (!e.air && (!best || e.dist > best.dist)) best = e;
      return best;
    }

    // ------------------------------------------------------------ enemies
    updateEnemies(dt) {
      const officers = {};
      let commander = null;
      for (const e of this.enemies) {
        if (e.kind === "officer") officers[e.squad] = e;
        if (e.kind === "command" && !e.antennaDown) commander = e;
      }
      for (const e of this.enemies) {
        if (e.gone) continue;
        e.t += dt;
        e.age += dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.air) { this.updateAir(e, dt); continue; }
        let mult = 1;
        if (e.squad && officers[e.squad] && officers[e.squad] !== e) mult *= 1.25;
        let armorBonus = 0;
        if (commander && commander !== e && dist2(e.x, e.y, commander.x, commander.y) < 130 * 130) { mult *= 1.2; armorBonus = 0.08; }
        e.armorNow = Math.min(0.95, e.armor + armorBonus);
        if (e.slowT > 0) { e.slowT -= dt; mult *= 0.5; }
        if (e.panicT > 0) { e.panicT -= dt; mult *= 0.45; }
        if (e.trackedT > 0) { e.trackedT -= dt; mult = 0; }
        if (e.stunT > 0) { e.stunT -= dt; mult = 0; }
        e.moving = mult > 0;
        e.dist += e.speed * mult * dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          e.burnTick -= dt;
          if (e.burnTick <= 0) {
            e.burnTick = 0.25;
            this.damage(e, 4, { pen: 1, src: "burn", quiet: true });
            if (e.kind === "inf" || e.kind === "officer") {
              for (const o of this.enemies) {
                if (o !== e && !o.air && o.burnT <= 0 && (o.kind === "inf" || o.kind === "officer") && dist2(o.x, o.y, e.x, e.y) < 22 * 22 && this.rng() < 0.12) o.burnT = 3;
              }
            }
          }
        }
        const p = this.paths[e.path];
        if (e.dist >= p.len) { this.leak(e); continue; }
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
        if (e.def.shoots && e.x > 0 && e.x < BK.W && e.y > 0 && e.y < BK.H) this.enemyShoot(e, e.def.shoots, e.x, e.y, dt, e);
        if (e.turrets) {
          const c = Math.cos(e.ang), s = Math.sin(e.ang);
          for (const tt of e.turrets) {
            if (tt.dead) continue;
            const wx = e.x + tt.x * c - tt.y * s, wy = e.y + tt.x * s + tt.y * c;
            tt.wx = wx; tt.wy = wy;
            this.enemyShoot(tt, tt, wx, wy, dt, e);
          }
        }
      }
    }

    enemyShoot(holder, spec, x, y, dt, owner) {
      holder.cd -= dt;
      let best = null, bd = spec.range * spec.range;
      for (const t of this.towers) {
        if (t.ko > 0) continue;
        const d = dist2(x, y, t.x, t.y);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) holder.aimAng = turnTo(holder.aimAng == null ? owner.ang : holder.aimAng, angTo(x, y, best.x, best.y), dt * 3);
      if (!best || holder.cd > 0 || owner.stunT > 0) return;
      holder.cd = 1 / spec.rate * (spec.kind === "mg" ? this.rng.range(0.8, 1.3) : 1);
      if (spec.kind === "mg") {
        this.emit("etracer", { x, y, tx: best.x + this.rng.range(-8, 8), ty: best.y + this.rng.range(-8, 8) });
        this.damageTower(best, spec.dmg, "mg");
      } else {
        const T = Math.sqrt(bd) / 520;
        this.projectiles.push({ type: "eshell", x, y, sx: x, sy: y, tx: best.x, ty: best.y, t: 0, T, dmg: spec.dmg, splash: spec.splash || 20 });
        this.emit("eshot", { x, y, ang: angTo(x, y, best.x, best.y), big: true });
      }
    }

    updateAir(e, dt) {
      const W = this.WW, H = this.WH;
      // A searchlight pins aircraft: half speed while it holds them.
      e.lit = false;
      for (const t of this.lights || []) if (dist2(t.x, t.y, e.x, e.y) < 300 * 300) { e.lit = true; break; }
      e.speed = e.def.speed * (e.lit ? 0.5 : 1);
      if (e.stunT > 0) e.stunT -= dt;
      if (e.state === "circle") {
        e.phi += dt * (e.speed / e.cr);
        const gx = e.cx + Math.cos(e.phi) * e.cr, gy = e.cy + Math.sin(e.phi) * e.cr * 0.75;
        const a = angTo(e.x, e.y, gx, gy);
        e.ang = turnTo(e.ang, a, dt * 2.2);
        e.x += Math.cos(e.ang) * e.speed * dt;
        e.y += Math.sin(e.ang) * e.speed * dt;
        e.circleT -= dt;
        e.artyT -= dt;
        if (e.artyT <= 0) {
          e.artyT = 4.5;
          const live = this.towers.filter((t) => t.ko <= 0);
          if (live.length) {
            const t = this.rng.pick(live);
            this.strikes.push({ x: t.x + this.rng.range(-14, 14), y: t.y + this.rng.range(-14, 14), t: 0.9, enemy: true });
            this.emit("whistle", { x: t.x, y: t.y });
          }
        }
        if (e.circleT <= 0) { e.state = "exit"; }
        return;
      }
      if (e.state === "approach") {
        const t = this.towers.find((x) => x.id === e.targetTower);
        if (t) { e.tx = t.x; e.ty = t.y; }
        const a = angTo(e.x, e.y, e.tx, e.ty);
        e.ang = turnTo(e.ang, a, dt * 1.7);
        const d = dist(e.x, e.y, e.tx, e.ty);
        e.x += Math.cos(e.ang) * e.speed * dt;
        e.y += Math.sin(e.ang) * e.speed * dt;
        if (d < 240 && Math.abs(wrapAng(a - e.ang)) < 0.5) {
          e.state = "dive";
          this.emit("siren", { x: e.x, y: e.y, kind: e.kind });
        }
      } else if (e.state === "dive") {
        e.alt = Math.max(0.32, e.alt - dt * 0.6);
        const sp = e.speed * 1.25;
        e.x += Math.cos(e.ang) * sp * dt;
        e.y += Math.sin(e.ang) * sp * dt;
        const toT = (e.tx - e.x) * Math.cos(e.ang) + (e.ty - e.y) * Math.sin(e.ang);
        if (toT < 34) {
          this.projectiles.push({ type: "bomb", x: e.x, y: e.y, vx: Math.cos(e.ang) * 70, vy: Math.sin(e.ang) * 70, t: 0, T: 0.55, dmg: e.def.bomb * (this.map.hp > 1 ? 1.1 : 1) });
          e.dives--;
          e.state = "climb";
          e.climbT = 2.4;
        }
      } else if (e.state === "climb") {
        e.alt = Math.min(1, e.alt + dt * 0.5);
        e.x += Math.cos(e.ang) * e.speed * dt;
        e.y += Math.sin(e.ang) * e.speed * dt;
        e.climbT -= dt;
        if (e.climbT <= 0) {
          if (e.dives > 0) { this.pickAirTarget(e); e.state = "approach"; }
          else e.state = "exit";
        }
      } else if (e.state === "exit") {
        e.alt = Math.min(1, e.alt + dt * 0.5);
        e.x += Math.cos(e.ang) * e.speed * 1.1 * dt;
        e.y += Math.sin(e.ang) * e.speed * 1.1 * dt;
      }
      if (e.state !== "approach" && (e.x < -140 || e.x > W + 140 || e.y < -140 || e.y > H + 140)) {
        e.gone = true;
        if (e.boss) this.emit("banner", { str: "The leader got away", sub: "No bounty this time", color: "#c9b07a" });
      }
    }

    leak(e) {
      e.gone = true;
      const n = e.def.leak;
      this.garrison -= n;
      this.stats.leaks += n;
      this.breakCombo();
      this.emit("leak", { x: e.x, y: e.y, n, boss: e.boss });
      if (this.garrison <= 0 && !this.demo) {
        this.garrison = 0;
        this.endRun(false);
      }
    }

    // ------------------------------------------------------------ damage model
    // Point hit test in the enemy's own frame. Returns null, {part:"body"}, {part:"weak", w}, or {part:"turret", tt}.
    hitTest(e, x, y, tol) {
      tol = tol == null ? 3 : tol;
      const dx = x - e.x, dy = y - e.y;
      const c = Math.cos(-e.ang), s = Math.sin(-e.ang);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      const d = e.def;
      if (d.kind === "foot") return dx * dx + dy * dy <= (d.r + tol + 2) * (d.r + tol + 2) ? { part: "body" } : null;
      if (e.turrets) {
        for (const tt of e.turrets) {
          if (tt.dead) continue;
          const r = tt.big ? 11 : 7;
          if ((lx - tt.x) * (lx - tt.x) + (ly - tt.y) * (ly - tt.y) <= (r + tol) * (r + tol)) return { part: "turret", tt };
        }
      }
      if (d.weak) {
        for (const w of d.weak) {
          if (w.effect === "antenna" && e.antennaDown) continue;
          if (lx >= w.x0 - tol && lx <= w.x1 + tol && ly >= w.y0 - tol && ly <= w.y1 + tol) return { part: "weak", w };
        }
      }
      const hl = d.L / 2 + tol, hw = d.Wd / 2 + tol;
      if (d.kind === "air") {
        // Fuselage plus wings.
        if (Math.abs(lx) <= hl && Math.abs(ly) <= 6 + tol) return { part: "body" };
        if (Math.abs(lx) <= 9 + tol && Math.abs(ly) <= hw) return { part: "body" };
        return null;
      }
      if (Math.abs(lx) <= hl && Math.abs(ly) <= hw) return { part: "body" };
      return null;
    }

    // Auto fire rolls for a weak spot instead of aiming at one.
    rollWeak(e, chance) {
      if (!e.def.weak || this.rng() > chance) return null;
      if (e.turrets && this.rng() < 0.35) {
        const live = e.turrets.filter((t) => !t.dead);
        if (live.length) return { part: "turret", tt: this.rng.pick(live) };
      }
      const prefer = e.def.weak.filter((w) => w.effect === "engine" || w.effect === "fuel" || w.effect === "crew" || w.effect === "tires" || (w.effect === "antenna" && !e.antennaDown && this.rng() < 0.2));
      if (!prefer.length) return null;
      return { part: "weak", w: this.rng.pick(prefer) };
    }

    damage(e, base, o) {
      if (e.gone || e.hp <= 0 || e.surrender) return 0;
      o = o || {};
      let mult = 1, pen = o.pen == null ? 0 : o.pen;
      if (this.mods.penAll) pen = 1 - (1 - pen) * (1 - this.mods.penAll);
      let crit = false, label = null;
      const hit = o.hit;
      if (hit && hit.part === "turret") {
        const tt = hit.tt;
        const dmg = base * (o.manned ? 2 : 1.4) * (1 - 0.55 * (1 - pen));
        tt.hp -= dmg;
        this.emit("dmg", { x: tt.wx || e.x, y: tt.wy || e.y, n: dmg, crit: true });
        if (tt.hp <= 0 && !tt.dead) {
          tt.dead = true;
          this.emit("explosion", { x: tt.wx || e.x, y: tt.wy || e.y, r: 34, size: 1.2 });
          this.emit("text", { x: e.x, y: e.y - 30, str: "TURRET DOWN", color: "#ffd166", size: 26 });
          this.shake(0.5);
          this.addMoney(25, false);
        }
        // Some of the blast reaches the hull.
        base *= 0.35;
      } else if (hit && hit.part === "weak") {
        const w = hit.w;
        crit = true;
        switch (w.effect) {
          case "engine":
            mult *= w.mult * (o.weakMult || 1) * (this.mods.ace ? 2 : 1) * (o.manned ? 1 + this.mods.manned * 0.6 : 1);
            pen = 1;
            label = "ENGINE";
            break;
          case "fuel":
            label = "FUEL";
            this.emit("text", { x: e.x, y: e.y - 24, str: "FUEL DRUMS!", color: "#ff7a3d", size: 24 });
            e.fuelBlown = true;
            mult *= 99;
            pen = 1;
            break;
          case "flametank":
            label = "FUEL TANK";
            e.flameBlown = true;
            mult *= 99;
            pen = 1;
            break;
          case "tires":
            if (e.slowT <= 0) this.emit("text", { x: e.x, y: e.y - 20, str: "TIRES", color: "#f2e3b0", size: 18 });
            e.slowT = 4;
            mult *= w.mult;
            break;
          case "tracks":
            if (e.trackedT <= 0) this.emit("text", { x: e.x, y: e.y - 24, str: "TRACKED", color: "#f2e3b0", size: 22 });
            e.trackedT = e.boss ? 1.6 : 3.2;
            mult *= w.mult;
            break;
          case "crew":
            mult *= w.mult;
            label = "CREW BAY";
            break;
          case "antenna":
            if (!e.antennaDown) {
              e.antennaDown = true;
              if (this.honorEvent) this.honorEvent("antenna");
              for (const o2 of this.enemies) if (!o2.air) o2.stunT = Math.max(o2.stunT, 2.6);
              this.emit("banner", { str: "Radio down", sub: "The column stalls", color: "#ffd166" });
              this.slow(0.5);
              this.shake(0.6);
            }
            break;
        }
        if (this.mods.ace && w.effect !== "engine") mult *= 2;
        this.stats.crits++;
      }
      if (o.manned && !crit) mult *= 1;
      if (e.ambush) mult *= 3;
      if (e.panicT > 0) mult *= 1.5;
      if (o.vsShooters > 1 && (e.def.shoots || e.turrets)) mult *= o.vsShooters;
      if (o.oneshotFoot && e.def.kind === "foot") mult *= 50;
      if (e.air && o.airMult) mult *= o.airMult;
      const armor = e.armorNow == null ? e.armor : e.armorNow;
      if (o.vsTrack && (e.def.kind === "track" || e.def.kind === "half")) mult *= o.vsTrack;
      if (e.inCover) mult *= o.explosive ? 0.75 : 0.6;
      if (e.lit) mult *= 1.5;
      if (o.airDmg && e.air) mult *= o.airDmg;
      if (o.firstShot && o.tower && o.tower.lastTgt !== e.id) { mult *= o.firstShot; o.tower.lastTgt = e.id; }
      const dmg = base * mult * (1 - armor * (1 - pen));
      e.hp -= dmg;
      e.flash = 0.09;
      e.underFire = 1.6;
      if (o.tower && this.gainXp) {
        const real = Math.min(dmg, e.hp + dmg);
        o.tower.waveDmg += real;
        o.tower.dmgDone += real;
        this.gainXp(o.tower, real * 0.1);
      }
      if (o.autoTrack && e.def.kind === "track") e.trackedT = Math.max(e.trackedT, e.boss ? 1 : 2.2);
      if (o.stunVeh && e.def.kind !== "foot") e.stunT = Math.max(e.stunT, o.stunVeh);
      if (!o.quiet) this.emit("dmg", { id: e.id, x: e.x, y: e.y, n: dmg, crit, label, air: e.air, big: dmg > 150, foot: e.def.kind === "foot", explosive: !!o.explosive });
      if (o.stun) e.stunT = Math.max(e.stunT, o.stun);
      if (o.burn) e.burnT = 4;
      if (e.hp <= 0) this.kill(e, o);
      return dmg;
    }

    kill(e, o) {
      if (e.gone) return;
      if (this.onKillExtra) this.onKillExtra(e, o);
      e.gone = true;
      e.hp = 0;
      this.kills++;
      this.combo++;
      this.comboT = this.mods.comboWin;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      const cm = this.comboMult();
      const reward = e.def.reward * BK.TUNE.reward * (1 + this.mods.reward) * (this.buffs.rush > 0 ? 2 : 1) * cm;
      this.money += Math.round(reward);
      this.score += Math.round(e.def.score * cm);
      for (const a in this.abil) this.abil[a].charge += e.def.reward * 0.9 * (1 + this.mods.charge);
      if (o && o.manned) {
        this.stats.crewKills++;
        // A crewed kill through a weak spot on a vehicle gets a beat of slow motion.
        if (o.hit && o.hit.part !== "body" && e.def.kind !== "foot") {
          this.slow(e.boss ? 1 : 0.22);
          this.shake(0.3);
          this.emit("text", { x: e.x, y: e.y - 34, str: e.def.L > 50 ? "PERFECT SHOT" : "WEAK SPOT", color: "#ffd84d", size: e.def.L > 50 ? 30 : 22 });
        }
      }
      const src = o && o.tower;
      if (src) src.kills++;
      this.emit("kill", { id: e.id, x: e.x, y: e.y, kind: e.kind, ang: e.ang, air: e.air, alt: e.alt, coins: Math.round(reward), boss: e.boss, manned: o && o.manned, crit: o && o.hit && o.hit.part === "weak", explosive: !!(o && o.explosive), burn: e.burnT > 0, gun: o && o.gun });

      if ([10, 25, 50, 75, 100, 150, 200].includes(this.combo)) this.emit("streak", { combo: this.combo });
      if (this.mods.bounty && this.combo % 10 === 0) this.addMoney(30, true, e.x, e.y);

      if (e.kind === "officer") {
        for (const x of this.enemies) if (x.squad === e.squad && !x.gone) { x.panicT = 3.5; }
        this.emit("text", { x: e.x, y: e.y - 20, str: "PANIC!", color: "#ffd166", size: 22 });
      }
      if (e.kind === "htrack") {
        for (let i = 0; i < e.def.carries; i++) {
          const b = this.spawn({ kind: "inf", path: e.path, lat: (i - 1) * 13 });
          b.dist = Math.max(0, e.dist - 6 - i * 4);
          b.panicT = 1.6;
          b.hp *= 0.8;
          const [x, y] = this.paths[e.path].at(b.dist);
          b.x = x; b.y = y;
        }
      }
      if (e.kind === "truck") {
        if (e.fuelBlown) {
          this.explode(e.x, e.y, 80, 72, { pen: 0.7, src: "fuel", chainDepth: (o && o.chainDepth) || 0, tower: src });
          if (this.mods.fuelFire) this.zones.push({ kind: "fire", x: e.x, y: e.y, r: 42, t: 5, max: 5, dps: 30 });
          this.shake(0.45);
        } else this.emit("explosion", { x: e.x, y: e.y, r: 40, size: 1 });
      }
      if (o && o.explosive && this.mods.chain && (o.chainDepth || 0) < 3 && e.kind !== "truck") {
        this.explode(e.x, e.y, 30, 46, { pen: 0.5, chainDepth: (o.chainDepth || 0) + 1, tower: src });
      }
      if (o && o.gun === "mg" && this.mods.rico > 0 && this.rng() < this.mods.rico) {
        let best = null, bd = 95 * 95;
        for (const x of this.enemies) {
          if (x.gone || x.air) continue;
          const d = dist2(x.x, x.y, e.x, e.y);
          if (d < bd) { bd = d; best = x; }
        }
        if (best) {
          this.emit("tracer", { x: e.x, y: e.y, tx: best.x, ty: best.y, kind: "rico" });
          this.damage(best, o.base || 8, { pen: o.pen, gun: "mg", tower: src });
        }
      }
      if (e.kind === "recon") this.dropCrate(e.x, e.y);
      if (e.boss) {
        this.bossKills++;
        this.slow(1.2);
        this.shake(1);
        this.emit("bossDown", { x: e.x, y: e.y, name: e.def.name });
        this.dropCrate(e.x + 30, e.y);
        this.dropCrate(e.x - 30, e.y + 10);
      }
      if (!e.air && (e.def.kind === "track" || e.def.kind === "half" || e.def.kind === "wheel")) {
        this.emit("explosion", { x: e.x, y: e.y, r: e.def.L * 0.6, size: e.boss ? 2.2 : e.def.L > 50 ? 1.4 : 1 });
        if (e.def.kind !== "wheel" || e.kind === "armcar") this.shake(e.boss ? 0.8 : 0.22);
      }
    }

    explode(x, y, dmg, r, o) {
      r *= 1 + this.mods.blast;
      if (this.onExplode) this.onExplode(x, y, dmg, r, o || {});
      o = o || {};
      this.emit("explosion", { x, y, r, size: r / 50 });
      for (const e of this.enemies) {
        if (e.gone || (e.air && !o.air)) continue;
        if (!e.air && o.air === "only") continue;
        const rr = r + (e.def.r || e.def.Wd / 2 || 8);
        const d2 = dist2(x, y, e.x, e.y);
        if (d2 > rr * rr) continue;
        const f = 1 - 0.5 * Math.sqrt(d2) / rr;
        this.damage(e, dmg * f, Object.assign({}, o, { explosive: true, quiet: dmg * f < 4 }));
      }
    }

    damageTower(t, dmg, kind) {
      if (t.ko > 0) return;
      t.hp -= dmg;
      t.flash = 0.12;
      if (this.mods.fort && kind === "mg" && t.hp < 1) t.hp = 1;
      if (t.hp <= 0) {
        t.hp = 0;
        t.ko = this.mods.quickRepair ? 7 : 999;
        if (t.manned) this.unman();
        this.emit("towerKO", { x: t.x, y: t.y });
        this.emit("text", { x: t.x, y: t.y - 26, str: "KNOCKED OUT", color: "#ff5a4f", size: 18 });
      } else if (kind !== "mg") this.emit("towerHit", { x: t.x, y: t.y });
    }

    damageTowersArea(x, y, dmg, r) {
      if (this.onExplode) this.onExplode(x, y, dmg, r, { enemy: true });
      for (const t of this.towers) {
        const d = dist(x, y, t.x, t.y);
        if (d < r + 14) this.damageTower(t, dmg * (1 - 0.5 * d / (r + 14)), "boom");
      }
    }

    shake(n) { this.emit("shake", { n }); }
    slow(sec) { this.slowT = Math.max(this.slowT, sec); }

    // ------------------------------------------------------------ towers
    findTarget(t, s) {
      const r2 = s.range * s.range, m2 = s.minRange * s.minRange;
      const canAir = s.air > 0, canGround = s.ground > 0;
      let best = null, bestScore = -Infinity;
      const pri = t.spec === "cb" ? "strong" : t.priority;
      const airFirst = BK.GUNS[t.kind].airFirst;
      for (const e of this.enemies) {
        if (e.gone) continue;
        if (e.air ? !canAir : !canGround) continue;
        if (!e.air && e.x < -10) continue;
        const d2 = dist2(t.x, t.y, e.x, e.y);
        if (d2 > r2 || d2 < m2) continue;
        if (!e.air && this.inSmoke(e.x, e.y)) continue;
        let sc;
        if (pri === "first") sc = e.air ? e.age * 40 : e.dist;
        else if (pri === "last") sc = e.air ? -e.age * 40 : -e.dist;
        else if (pri === "strong") sc = e.hp + (e.boss ? 1e5 : 0);
        else sc = -d2;
        if (airFirst && e.air) sc += 1e7;
        if (sc > bestScore) { bestScore = sc; best = e; }
      }
      return best;
    }

    inSmoke(x, y) {
      for (const z of this.zones) if (z.kind === "smoke" && dist2(x, y, z.x, z.y) < z.r * z.r) return true;
      return false;
    }

    // Where the enemy will be after `time` seconds, for leading shots.
    predict(e, time) {
      if (e.air) {
        const sp = e.state === "dive" ? e.speed * 1.25 : e.speed;
        return [e.x + Math.cos(e.ang) * sp * time, e.y + Math.sin(e.ang) * sp * time];
      }
      let mult = e.moving === false ? 0 : 1;
      if (e.slowT > 0) mult *= 0.5;
      if (e.panicT > 0) mult *= 0.45;
      const p = this.paths[e.path];
      const [x, y, a] = p.at(e.dist + e.speed * mult * time);
      return [x - Math.sin(a) * e.lat, y + Math.cos(a) * e.lat];
    }

    updateTower(t, dt) {
      if (!t) return;
      if (t.ko > 0) {
        t.ko -= dt;
        if (t.ko <= 0) { t.ko = 0; t.hp = t.maxHp * 0.6; this.emit("text", { x: t.x, y: t.y - 24, str: "BACK IN ACTION", color: "#9fe870", size: 16 }); }
        return;
      }
      if (this.mods.fort && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + 4 * dt);
      const s = this.towerStats(t);
      const d = BK.GUNS[t.kind];
      t.cd -= dt;
      // A pinned crew keeps its head down unless you are on the gun yourself.
      if (t.supT > 0 && !t.manned) return;
      if (t.manned) {
        const a = angTo(t.x, t.y, this.aim.x, this.aim.y);
        t.ang = turnTo(t.ang, a, dt * d.turn * 3);
        if (this.fireHeld && t.cd <= 0) {
          t.cd = 1 / s.rate;
          this.fire(t, s, null, this.aim.x, this.aim.y);
        }
        return;
      }
      if (this.phase !== "combat") return;
      let e = t.target ? this.enemies.find((x) => x.id === t.target && !x.gone) : null;
      if (e) {
        const d2 = dist2(t.x, t.y, e.x, e.y);
        if (d2 > s.range * s.range || (!e.air && this.inSmoke(e.x, e.y)) || this.time - (t.retarget || 0) > 0.6) e = null;
      }
      if (!e) { e = this.findTarget(t, s); t.target = e ? e.id : null; t.retarget = this.time; }
      if (!e) return;
      const shotT = s.shot === "lob" ? s.speed : s.shot === "pierce" || s.shot === "flame" ? 0 : dist(t.x, t.y, e.x, e.y) / s.speed;
      const [px, py] = this.predict(e, shotT);
      const want = angTo(t.x, t.y, px, py);
      t.ang = turnTo(t.ang, want, dt * d.turn);
      if (t.cd <= 0 && Math.abs(wrapAng(want - t.ang)) < 0.12) {
        t.cd = 1 / s.rate;
        this.fire(t, s, e, px, py);
      }
    }

    fire(t, s, target, ax, ay) {
      const d = BK.GUNS[t.kind];
      const shot = s.shot, spd = s.speed;
      const manned = t.manned;
      t.recoil = 1;
      const base = {
        tower: t, gun: t.kind, pen: s.pen, manned, weakMult: s.weakMult, stun: s.stun, burn: s.burn,
        airMult: s.air, groundMult: s.ground, vsShooters: s.vsShooters, oneshotFoot: s.oneshotFoot,
        firstShot: s.firstShot, airDmg: s.airDmg, autoTrack: s.autoTrack, stunVeh: s.stunVeh, vsTrack: s.vsTrack,
      };
      let ang = angTo(t.x, t.y, ax, ay);
      if (manned) t.ang = ang;
      if (shot === "flame") { this.fireFlame(t, s, ang, base); return; }
      // Several rifles on one gun fire a fanned volley.
      if (shot === "pierce" && s.shells > 1 && !s._fan) {
        for (let i = 0; i < s.shells; i++) {
          const a2 = ang + (i - (s.shells - 1) / 2) * 0.05;
          this.fire(t, Object.assign({}, s, { shells: 1, _fan: true }), target, t.x + Math.cos(a2) * 300, t.y + Math.sin(a2) * 300);
        }
        return;
      }
      const mx = t.x + Math.cos(t.ang) * 16, my = t.y + Math.sin(t.ang) * 16;
      this.emit("shot", { x: mx, y: my, ang: t.ang, gun: t.kind, manned });

      if (shot === "pierce") {
        const L = s.range * (manned ? 1.1 : 1);
        const ex = t.x + Math.cos(ang) * L, ey = t.y + Math.sin(ang) * L;
        this.emit("tracer", { x: mx, y: my, tx: ex, ty: ey, kind: "pierce" });
        // Walk the line and collect what it passes through, nearest first.
        const hits = [];
        for (const e of this.enemies) {
          if (e.gone || e.air) continue;
          const vx = e.x - t.x, vy = e.y - t.y;
          const along = vx * Math.cos(ang) + vy * Math.sin(ang);
          if (along < 0 || along > L) continue;
          const px = t.x + Math.cos(ang) * along, py = t.y + Math.sin(ang) * along;
          const h = this.hitTest(e, px, py, manned ? 3 : 6);
          if (h) hits.push({ e, h, along });
        }
        hits.sort((a, b) => a.along - b.along);
        let n = 0;
        for (const { e, h } of hits) {
          if (n >= s.pierce) break;
          const hit = h.part === "body" && !manned ? this.rollWeak(e, s.crit) || h : h;
          this.damage(e, s.dmg * s.ground, Object.assign({}, base, { hit }));
          this.emit("hit", { x: e.x, y: e.y, kind: "pierce" });
          n++;
        }
        if (!n && manned) this.emit("miss", { x: ex, y: ey });
        return;
      }

      const spread = manned && t.kind === "mg" ? 0.035 : t.kind === "mg" ? 0.02 : 0;
      for (let i = 0; i < s.shells; i++) {
        let tx = ax, ty = ay;
        if (s.shells > 1) { tx += this.rng.range(-40, 40); ty += this.rng.range(-40, 40); }
        if (spread) {
          const dd = dist(t.x, t.y, tx, ty), a2 = angTo(t.x, t.y, tx, ty) + this.rng.range(-spread, spread);
          tx = t.x + Math.cos(a2) * dd; ty = t.y + Math.sin(a2) * dd;
        }
        const dd = dist(mx, my, tx, ty);
        const T = shot === "lob" ? spd * (manned ? 0.85 : 1) + i * 0.12 : dd / (spd * (manned ? 1.6 : 1));
        const pr = {
          type: shot, gun: t.kind, x: mx, y: my, sx: mx, sy: my, tx, ty, t: 0, T, target: target ? target.id : null,
          dmg: s.dmg, splash: s.splash, airSplash: s.airSplash, crit: s.crit, o: base, manned,
        };
        // A crewed round goes where you clicked: it remembers the exact spot on the unit under the crosshair.
        if (manned && shot !== "lob") {
          let best = null, bh = null;
          for (const e of this.enemies) {
            if (e.gone) continue;
            if (e.air && s.air <= 0) continue;
            const h = this.hitTest(e, tx, ty, t.kind === "mg" ? 4 : 6);
            if (h && (!bh || (bh.part === "body" && h.part !== "body"))) { best = e; bh = h; }
          }
          if (best) {
            const c = Math.cos(-best.ang), sn = Math.sin(-best.ang);
            const dx = tx - best.x, dy = ty - best.y;
            pr.lock = best.id;
            pr.lx = dx * c - dy * sn;
            pr.ly = dx * sn + dy * c;
          }
        }
        this.projectiles.push(pr);
      }
    }

    updateProjectiles(dt) {
      const keep = [];
      for (const p of this.projectiles) {
        p.t += dt;
        const k = Math.min(1, p.t / p.T);
        if (p.type === "bomb") {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.t >= p.T) {
            this.emit("explosion", { x: p.x, y: p.y, r: 48, size: 1.4, bomb: true });
            this.damageTowersArea(p.x, p.y, p.dmg, 48);
            this.shake(0.5);
            continue;
          }
          keep.push(p);
          continue;
        }
        if (p.lock) {
          const e = this.enemies.find((x) => x.id === p.lock && !x.gone);
          if (e) {
            const c = Math.cos(e.ang), sn = Math.sin(e.ang);
            p.tx = e.x + p.lx * c - p.ly * sn;
            p.ty = e.y + p.lx * sn + p.ly * c;
          }
        }
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        if (k < 1) { keep.push(p); continue; }
        this.resolve(p);
      }
      this.projectiles = keep;
    }

    resolve(p) {
      if (p.type === "eshell" || p.type === "elob" || p.type === "grenade") {
        this.emit("explosion", { x: p.tx, y: p.ty, r: p.splash, size: p.type === "grenade" ? 0.5 : 0.9 });
        this.damageTowersArea(p.tx, p.ty, p.dmg, p.splash);
        return;
      }
      const o = Object.assign({ base: p.dmg }, p.o);
      if (p.type === "lob") {
        this.explode(p.tx, p.ty, p.dmg, p.splash, o);
        if (this.onLobImpact) this.onLobImpact(p);
        if (p.manned) {
          // A crewed mortar landing right on a weak spot gets the bonus too.
          for (const e of this.enemies) {
            if (e.gone || e.air) continue;
            const h = this.hitTest(e, p.tx, p.ty, 2);
            if (h && h.part !== "body") this.damage(e, p.dmg * 0.6, Object.assign({}, o, { hit: h }));
          }
        }
        if (p.gun === "f75") this.shake(0.2);
        return;
      }
      if (p.manned) {
        // Crewed rounds land where you aimed. Whatever is under that point takes the hit.
        let hit = null, best = null;
        for (const e of this.enemies) {
          if (e.gone) continue;
          if (e.air && p.type !== "flak" && p.o.airMult <= 0) continue;
          const h = this.hitTest(e, p.tx, p.ty, p.gun === "mg" ? 3 : 4);
          if (h && (!hit || h.part !== "body")) { hit = h; best = e; }
        }
        if (best) {
          const mult = best.air ? 1 : p.o.groundMult;
          this.damage(best, p.dmg * mult, Object.assign({}, o, { hit }));
          this.emit("hit", { x: p.tx, y: p.ty, kind: p.type, crit: hit.part !== "body", air: best.air });
          if (p.splash) this.explode(p.tx, p.ty, p.dmg * 0.5, p.splash, Object.assign({}, o, { hit: null }));
          if (p.airSplash && best.air) this.explode(p.tx, p.ty, p.dmg * 0.6, p.airSplash, Object.assign({}, o, { air: "only", hit: null }));
        } else {
          this.emit("miss", { x: p.tx, y: p.ty, kind: p.type });
          if (p.splash) this.explode(p.tx, p.ty, p.dmg * 0.5, p.splash, Object.assign({}, o, { hit: null }));
        }
        return;
      }
      const e = this.enemies.find((x) => x.id === p.target && !x.gone);
      if (!e) {
        if (p.splash) this.explode(p.tx, p.ty, p.dmg * 0.6, p.splash, o);
        return;
      }
      const hit = this.rollWeak(e, p.crit) || { part: "body" };
      const mult = e.air ? 1 : p.o.groundMult;
      this.damage(e, p.dmg * mult, Object.assign({}, o, { hit }));
      this.emit("hit", { x: e.x, y: e.y, kind: p.type, crit: hit.part !== "body", air: e.air });
      if (p.splash) this.explode(e.x, e.y, p.dmg * 0.45, p.splash, Object.assign({}, o, { hit: null }));
      if (p.airSplash && e.air) this.explode(e.x, e.y, p.dmg * 0.6, p.airSplash, Object.assign({}, o, { air: "only", hit: null }));
    }

    updateZones(dt) {
      for (const z of this.zones) {
        z.t -= dt;
        if (z.kind === "fire") {
          for (const e of this.enemies) {
            if (e.gone || e.air) continue;
            if (dist2(e.x, e.y, z.x, z.y) < z.r * z.r) this.damage(e, z.dps * dt, { pen: 1, quiet: true, src: "fire" });
          }
        }
      }
      this.zones = this.zones.filter((z) => z.t > 0);
    }

    updateMines() {
      for (const m of this.mines) {
        if (m.used) continue;
        for (const e of this.enemies) {
          if (e.gone || e.air) continue;
          if (dist2(e.x, e.y, m.x, m.y) < 20 * 20) {
            m.used = true;
            this.explode(m.x, m.y, 280, 50, { pen: 1, src: "mine" });
            this.shake(0.5);
            break;
          }
        }
      }
      this.mines = this.mines.filter((m) => !m.used);
    }

    updateStrikes(dt) {
      for (const s of this.strikes) {
        s.t -= dt;
        if (s.t <= 0 && !s.done) {
          s.done = true;
          if (s.enemy) {
            this.emit("explosion", { x: s.x, y: s.y, r: 40, size: 1.1 });
            this.damageTowersArea(s.x, s.y, 30, 40);
          } else {
            this.explode(s.x, s.y, 130, 56, { pen: 0.85, src: "arty" });
            this.shake(0.35);
          }
        }
      }
      this.strikes = this.strikes.filter((s) => !s.done);
      for (const f of this.fighters) {
        f.t += dt;
        const k = f.t / f.T;
        f.x = f.ax + (f.bx - f.ax) * k;
        f.y = f.ay + (f.by - f.ay) * k;
        // The guns open up over the middle stretch of the run.
        if (k > 0.2 && k < 0.85) {
          f.tick -= dt;
          if (f.tick <= 0) {
            f.tick = 0.05;
            const gx = f.x + Math.cos(f.ang) * 60, gy = f.y + Math.sin(f.ang) * 60;
            this.emit("strafe", { x: gx + BK.fxr.range(-10, 10), y: gy + BK.fxr.range(-10, 10) });
            for (const e of this.enemies) {
              if (e.gone || f.hitIds.has(e.id)) continue;
              if (dist2(e.x, e.y, gx, gy) < 30 * 30) {
                f.hitIds.add(e.id);
                this.damage(e, e.air ? 110 : 85, { pen: 0.5, src: "fighter", airMult: 1 });
              }
            }
          }
        }
      }
      this.fighters = this.fighters.filter((f) => f.t < f.T);
    }

    // ------------------------------------------------------------ abilities
    abilityReady(id) {
      const a = this.abil[id];
      return a && a.charge >= BK.ABILITIES[id].charge && this.phase === "combat";
    }
    useAbility(id, x, y) {
      if (!this.abilityReady(id)) return false;
      if (id === "mines") {
        // Mines go on the nearest stretch of road.
        let best = null;
        for (let pi = 0; pi < this.paths.length; pi++) {
          const p = this.paths[pi];
          for (let dd = 0; dd < p.len; dd += 6) {
            const [px, py] = p.at(dd);
            const d2 = dist2(x, y, px, py);
            if (!best || d2 < best.d2) best = { d2, dd, pi };
          }
        }
        if (!best || best.d2 > 70 * 70) return false;
        const p = this.paths[best.pi];
        for (let i = -1; i <= 1; i++) {
          const [mx, my] = p.at(best.dd + i * 28);
          this.mines.push({ x: mx, y: my });
        }
        this.emit("mines", { x, y });
      } else if (id === "arty") {
        const n = this.mods.bigArty ? 10 : 5;
        for (let i = 0; i < n; i++) {
          const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * 62;
          this.strikes.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, t: 0.9 + i * 0.22 });
        }
        this.emit("arty", { x, y });
      } else if (id === "fighter") {
        this.callFighter(x, y, false);
      }
      this.abil[id].charge = 0;
      return true;
    }
    callFighter(x, y, auto) {
      // Fly along the road direction nearest the point so the run follows the column.
      let ang = 0, best = Infinity;
      for (const p of this.paths) {
        for (let dd = 0; dd < p.len; dd += 12) {
          const [px, py, a] = p.at(dd);
          const d2 = dist2(x, y, px, py);
          if (d2 < best) { best = d2; ang = a; }
        }
      }
      const L = 900;
      const ax = x - Math.cos(ang) * L / 2 - Math.cos(ang) * 60, ay = y - Math.sin(ang) * L / 2 - Math.sin(ang) * 60;
      this.fighters.push({ ax, ay, bx: ax + Math.cos(ang) * L, by: ay + Math.sin(ang) * L, ang, t: 0, T: 2.2, tick: 0, hitIds: new Set(), x: ax, y: ay });
      this.emit("fighter", { x, y, auto });
    }

    // ------------------------------------------------------------ crates
    dropCrate(x, y) {
      if (this.crates.length >= 3) return;
      if (x == null) {
        // Land near the road where the player is already looking.
        for (let i = 0; i < 20; i++) {
          const p = this.rng.pick(this.paths);
          const [px, py, a] = p.at(this.rng.range(p.len * 0.15, p.len * 0.85));
          const off = this.rng.range(46, 90) * (this.rng() < 0.5 ? -1 : 1);
          x = px - Math.sin(a) * off;
          y = py + Math.cos(a) * off;
          if (x > 40 && x < this.WW - 40 && y > 40 && y < this.WH - 120 && !this.isWater(x, y)) break;
        }
      }
      x = clamp(x, 40, this.WW - 40);
      y = clamp(y, 40, this.WH - 120);
      this.crates.push({ id: NEXT_ID++, x, y, fall: 2.2, life: 11, golden: this.mods.reward >= 1 });
      this.emit("crateDrop", { x, y });
    }
    updateCrates(dt) {
      for (const c of this.crates) {
        if (c.fall > 0) c.fall -= dt;
        else c.life -= dt;
      }
      this.crates = this.crates.filter((c) => c.life > 0);
    }
    crateAt(x, y) {
      return this.crates.find((c) => c.fall <= 0.3 && dist2(x, y, c.x, c.y) < 38 * 38);
    }
    openCrate(c) {
      this.crates = this.crates.filter((x) => x !== c);
      const luck = this.mods.luck;
      const pool = BK.CRATE.map((o) => ({ o, w: o.w * (o.id === "cash" ? 1 / (1 + luck * 0.4) : o.jackpot || o.id === "cash2" || o.id === "upg" ? 1 + luck * 0.7 : 1) }));
      let r = this.rng() * pool.reduce((a, b) => a + b.w, 0);
      let pick = pool[0].o;
      for (const p of pool) { r -= p.w; if (r <= 0) { pick = p.o; break; } }
      this.stats.crates++;
      this.pending = this.pending || [];
      this.pending.push({ t: 1.5, o: pick, times: this.mods.reward >= 1 ? 2 : 1, x: c.x, y: c.y });
      this.emit("crateOpen", { x: c.x, y: c.y, outcome: pick.id, label: pick.label, icon: pick.icon, jackpot: !!pick.jackpot });
      return pick;
    }
    updatePending(dt) {
      if (!this.pending || !this.pending.length) return;
      for (const p of this.pending) {
        p.t -= dt / Math.max(0.2, this.timeScale);
        if (p.t <= 0 && !p.done) {
          p.done = true;
          for (let i = 0; i < p.times; i++) p.o.apply(this);
          this.emit("cratePrize", { x: p.x, y: p.y, label: p.o.label, jackpot: !!p.o.jackpot });
          if (p.o.jackpot) { this.slow(0.8); this.shake(0.4); }
        }
      }
      this.pending = this.pending.filter((p) => !p.done);
    }

    // ------------------------------------------------------------ between waves
    waveCleared() {
      if (this.phase !== "combat") return;
      this.breakCombo();
      const clear = Math.round((BK.TUNE.clear + this.wave * 4));
      const interest = Math.min(this.mods.interestCap, Math.floor(this.money * this.mods.interest));
      this.money += clear + interest;
      for (const t of this.towers) {
        if (t.ko > 0) { t.ko = 0; }
        t.hp = t.maxHp;
      }
      this.zones = this.zones.filter((z) => z.kind !== "smoke");
      this.emit("waveClear", { wave: this.wave, clear, interest });
      if (!this.endless && this.wave >= BK.WAVE_COUNT) { this.endRun(true); return; }
      this.phase = "cards";
      this.offer = this.drawCards(this.waveDef && this.waveDef.boss ? "rare" : this.firstCard && this.mods.luck > 0 ? "rare" : null);
      this.firstCard = false;
    }
    drawCards(minRarity) {
      const order = ["common", "rare", "epic", "legendary"];
      const minI = minRarity ? order.indexOf(minRarity) : 0;
      const out = [];
      const avail = BK.CARDS.filter((c) => (this.cardsTaken[c.id] || 0) < c.max && order.indexOf(c.rarity) >= minI);
      const luckBoost = 1 + this.mods.luck * 0.25 + this.wave * 0.02;
      for (let k = 0; k < 3 && avail.length; k++) {
        let total = 0;
        const ws = avail.map((c) => {
          let w = BK.RARITY[c.rarity].w;
          if (c.rarity !== "common") w *= luckBoost;
          if (out.includes(c)) w = 0;
          total += w;
          return w;
        });
        let r = this.rng() * total;
        for (let i = 0; i < avail.length; i++) {
          r -= ws[i];
          if (r <= 0 && ws[i] > 0) { out.push(avail[i]); break; }
        }
      }
      return out;
    }
    reroll() {
      if (this.phase !== "cards" || this.rerolls <= 0) return false;
      this.rerolls--;
      this.offer = this.drawCards(null);
      return true;
    }
    takeCard(card, silent) {
      this.cardsTaken[card.id] = (this.cardsTaken[card.id] || 0) + 1;
      card.apply(this);
      if (silent) return;
      this.offer = null;
      this.phase = "deploy";
      this.earlyT = this.demo ? Infinity : 30;
      this.emit("card", { id: card.id, rarity: card.rarity });
    }

    endRun(won) {
      if (this.result) return;
      this.phase = won ? "won" : "lost";
      const cleared = won ? this.wave : this.wave - 1;
      const mapMult = { Smaller: [1, 1.2, 1.4][this.mapIndex] || 1, Small: 1.5, Medium: 1.7, Large: 1.9, Huge: 2.2, Gigantic: 2.6 }[this.map.size] || 1;
      let medals = cleared + this.bossKills * 4 + (won ? 10 : 0) + Math.floor(this.score / 6000);
      medals = Math.round(medals * mapMult * (this.endless ? 0.6 : 1));
      for (const h of BK.HONORS || []) if (h.end && h.end(this, { won })) this.earnHonor(h);
      const honorMedals = (BK.HONORS || []).filter((h) => this.honors && this.honors[h.id]).reduce((a, h) => a + h.medals, 0);
      medals += honorMedals;
      this.result = { honorMedals, won, cleared, medals, score: this.score, kills: this.kills, bestCombo: this.bestCombo, wave: this.wave };
      this.unman();
      this.emit(won ? "victory" : "defeat", {});
    }
  }

  BK.Game = Game;

})(typeof window !== "undefined" ? window : globalThis);
