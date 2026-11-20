// Student playtest additions: buildable logistics, road reinforcements and three fictional encounters.
(function (root) {
  const BK = root.BK, G = BK.Game.prototype;
  const { dist2 } = BK;

  function support(id, name, short, role, key, cost, range, hp) {
    BK.GUNS[id] = { id, name, short, role, key, cost, range, hp, support: true,
      rate: 0, dmg: 0, pen: 0, splash: 0, shot: "none", speed: 1, air: 0, turn: 2, crit: 0,
      history: "A fictional support option added from classroom playtesting." };
    BK.GUN_ORDER.push(id);
  }
  support("fieldpay", "Supply Farm", "Supply Farm", "Earn 18 zł after each full wave. Farms together pay up to 64 zł a wave.", "j", 105, 62, 78);
  support("repairpost", "Repair Station", "Repair Post", "Restores 5 HP per second to nearby guns during a wave.", "k", 95, 144, 80);
  support("dispatch", "Dispatch Depot", "Dispatch", "Sends a friendly scout along the nearest lane each wave.", "y", 115, 112, 95);

  function forms(kind, nodes) {
    BK.TREES[kind] = Object.fromEntries(nodes.map((n, i) => [n.id, Object.assign(
      { gun: kind, tier: i ? 1 : 0, items: {}, mods: {}, look: { base: "student_" + kind, w: "student_noop", studentForm: n.id } }, n)]));
    for (const n of Object.values(BK.TREES[kind])) {
      n.next = nodes.filter((child) => child.parent === n.id).map((child) => child.id);
    }
  }
  forms("fieldpay", [
    { id: "fieldpay", name: "Supply Farm" },
    { id: "fieldpay_market", parent: "fieldpay", name: "Supply Market", cost: 85, desc: "Raises the payout to 32 zł per full wave.", mods: { farm: 32 } },
  ]);
  forms("repairpost", [
    { id: "repairpost", name: "Repair Station" },
    { id: "repairpost_crew", parent: "repairpost", name: "Workshop Crew", cost: 80, desc: "Restores 9 HP per second, reaches farther, and limits nearby knockouts to five seconds.", mods: { service: 9, range: 1.25 } },
  ]);
  forms("dispatch", [
    { id: "dispatch", name: "Dispatch Depot" },
    { id: "dispatch_patrol", parent: "dispatch", name: "Road Patrol", cost: 85, desc: "Dispatches a scout and a foot patrol together each wave.", mods: { dispatchKind: "patrol" } },
    { id: "dispatch_air", parent: "dispatch", name: "Air Dispatch", cost: 105, desc: "Dispatches a bomber for one flyover along the lane, hitting nearby ground enemies at most once each.", mods: { dispatchKind: "bomber" } },
  ]);

  const MINI = {
    class_vanguard: { art: "officer", wave: 3, from: "inf",
      fields: { name: "Vanguard Captain", hp: 105, reward: 27, leak: 2, score: 170, speed: 39,
        tip: "A faster foot leader. A balanced line can catch the Vanguard before it slips past." } },
    class_bulwark: { art: "ltank", wave: 6, from: "ltank",
      fields: { name: "Bulwark", hp: 480, armor: 0.62, reward: 45, leak: 4, score: 330, speed: 23,
        tip: "A slow mini-boss with extra armor. Open more than one lane of fire so it cannot outlast your first crew." } },
    class_skyguard: { art: "stuka", wave: 8, from: "stuka",
      fields: { name: "Skyguard", hp: 145, armor: 0.05, reward: 40, score: 280, dives: 2, bomb: 50,
        tip: "A fictional ace with two passes. Anti-air defenses can cover more of the board." } },
  };
  BK.STUDENT_BOSSES = {};
  for (const [kind, { art, from, fields }] of Object.entries(MINI)) {
    const base = BK.ENEMIES[from];
    BK.STUDENT_BOSSES[kind] = art;
    BK.ENEMIES[kind] = Object.assign({}, base, { id: kind, boss: true, studentBoss: true }, fields);
  }

  // Replace one existing enemy rather than increasing wave length or total body count.
  // Protect hand-set boss waves and keep the title demo/daily challenge roster unchanged.
  const baseExpand = G.expandWave;
  G.expandWave = function (def) {
    const queue = baseExpand.call(this, def);
    if (this.demo || this.daily || def.boss) return queue;
    const mini = Object.entries(MINI).find(([, d]) => d.wave === this.wave);
    if (!mini) return queue;
    const [kind, d] = mini;
    const replace = queue.findLastIndex((q) => q.kind === d.from);
    if (replace >= 0) queue[replace] = Object.assign({}, queue[replace], { kind });
    else if (kind === "class_bulwark") {
      const alt = queue.findLastIndex((q) => !BK.ENEMIES[q.kind].boss && BK.ENEMIES[q.kind].kind === "track");
      if (alt >= 0) queue[alt] = Object.assign({}, queue[alt], { kind });
    } else if (kind === "class_skyguard") {
      const alt = queue.findLastIndex((q) => BK.ENEMIES[q.kind].air && !BK.ENEMIES[q.kind].boss);
      if (alt >= 0) queue[alt] = Object.assign({}, queue[alt], { kind });
    }
    return queue;
  };

  const UNIT = {
    scout: { speed: 105, radius: 86, interval: 0.78, dmg: 22, duration: 13 },
    patrol: { speed: 68, radius: 73, interval: 0.55, dmg: 12, duration: 12 },
    bomber: { speed: 210, radius: 98, interval: 0.24, dmg: 48, duration: 22 },
  };

  function laneNear(game, t) {
    let bestD2 = Infinity, found = null;
    game.paths.forEach((p, path) => {
      for (let d = 0; d <= p.len; d += 16) {
        const [x, y] = p.at(d);
        if (!game.inWorld(x, y, 16)) continue;
        const d2 = dist2(x, y, t.x, t.y);
        if (d2 < bestD2) { bestD2 = d2; found = { d, path, x, y }; }
      }
    });
    return found;
  }

  const baseStart = G.startWave;
  G.startWave = function () {
    if (!baseStart.call(this)) return false;
    this.studentAllies = [];
    this.studentRepairClock = 0;
    for (const t of this.towers) if (t.kind === "dispatch" && t.ko <= 0) {
      const lane = laneNear(this, t);
      if (!lane) continue;
      const mode = this.towerStats(t).dispatchKind;
      const units = mode === "bomber" ? ["bomber"] : mode === "patrol" ? ["scout", "patrol"] : ["scout"];
      let launch = false;
      for (const kind of units) {
        if (this.studentAllies.length >= 6) break;
        launch = true;
        this.studentAllies.push({ kind, towerId: t.id, path: lane.path, d: lane.d,
          x: lane.x, y: lane.y, ang: 0, age: 0, cd: 0.6, flash: 0, done: false, hits: new Set() });
      }
      if (launch) this.emit("text", { x: t.x, y: t.y - 25, str: mode === "bomber" ? "BOMBER INBOUND" : "PATROL OUT", color: "#93e2e6", size: 14 });
    }
    return true;
  };

  G.tickStudentAllies = function (dt) {
    for (const u of this.studentAllies || []) {
      if (u.done) continue;
      const rule = UNIT[u.kind], path = this.paths[u.path], bomb = u.kind === "bomber";
      u.age += dt;
      u.flash = Math.max(0, u.flash - dt);
      if (u.age >= rule.duration || u.d < 0) { u.done = true; continue; }
      // Start next to the dispatch building and run back along the path toward the oncoming column.
      // At the entry, there is nothing left to cover, so leave instead of stacking at that endpoint.
      u.d -= rule.speed * dt;
      const [x, y, a] = path.at(Math.max(0, u.d));
      u.x = x; u.y = y; u.ang = a + Math.PI;
      u.cd -= dt;
      if (u.cd > 0 || !this.inWorld(x, y)) continue;
      let tgt = null, best = rule.radius ** 2;
      for (const e of this.enemies) {
        if (e.gone || e.air || e.surrender || e.path !== u.path || (bomb && u.hits.has(e.id))) continue;
        const d = dist2(x, y, e.x, e.y);
        if (d < best) { best = d; tgt = e; }
      }
      if (!tgt) { u.cd = 0.15; continue; }
      const tower = this.towers.find((t) => t.id === u.towerId);
      if (bomb) u.hits.add(tgt.id);
      u.cd = rule.interval;
      u.flash = 0.16;
      this.damage(tgt, rule.dmg, { pen: 0.36, tower, src: "dispatch", quiet: true });
      if (bomb) this.emit("studentBurst", { x: tgt.x, y: tgt.y });
      else this.emit("tracer", { x, y, tx: tgt.x, ty: tgt.y });
    }
    this.studentAllies = (this.studentAllies || []).filter((u) => !u.done);
  };

  // Only the strongest station applies to a tower. A repair station can't heal itself.
  G.tickStudentRepair = function (dt) {
    const stations = this.towers.filter((t) => t.kind === "repairpost" && t.ko <= 0)
      .map((t) => { const s = this.towerStats(t); return { t, range: s.range ** 2, rate: s.service || 5 }; });
    if (!stations.length) return;
    for (const target of this.towers) {
      if (target.hp >= target.maxHp && target.ko <= 0) continue;
      let best = null;
      for (const station of stations) if (station.t !== target && (!best || station.rate > best.rate)
        && dist2(station.t.x, station.t.y, target.x, target.y) <= station.range) best = station;
      if (!best) continue;
      if (target.ko > 0) {
        if (best.rate > 5) target.ko = Math.min(target.ko, 5);
        continue;
      }
      const hp = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + dt * best.rate);
      this.gainXp(best.t, (target.hp - hp) * 0.16);
    }
  };

  const baseUpdate = G.updateExtra;
  G.updateExtra = function (dt) {
    baseUpdate.call(this, dt);
    if (this.phase !== "combat") return;
    this.tickStudentAllies(dt);
    // The radius scan stays bounded on low-power devices when several posts overlap.
    this.studentRepairClock = (this.studentRepairClock || 0) + dt;
    if (this.studentRepairClock >= 0.16) {
      this.tickStudentRepair(this.studentRepairClock);
      this.studentRepairClock = 0;
    }
  };

  const baseClear = G.waveCleared;
  G.waveCleared = function () {
    if (this.phase === "combat") {
      let remaining = 64;
      for (const t of this.towers) if (t.kind === "fieldpay" && t.ko <= 0 && t.builtWave < this.wave && remaining > 0) {
        const pay = Math.min(remaining, this.towerStats(t).farm || 18);
        remaining -= pay;
        this.stats.supply = (this.stats.supply || 0) + pay;
        this.addMoney(pay, false);
        this.gainXp(t, pay * 0.46);
        this.emit("text", { x: t.x, y: t.y - 25, str: "+" + pay + " zł", color: "#ffd84d", size: 15 });
      }
      this.studentAllies = [];
    }
    return baseClear.call(this);
  };
})(typeof window !== "undefined" ? window : globalThis);
