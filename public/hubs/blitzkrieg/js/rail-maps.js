// Fictional bonus battlefields. Their indices are appended so older saves still resume.
(function (root) {
  const BK = root.BK;
  const G = BK.Game.prototype;

  function addMap(map) {
    BK.MAPS.push(Object.assign({ procedural: true, bonus: true, size: "Small", ww: 1760, wh: 990 }, map, {
      paths: map.paths.map((path) => path.map(([x, y]) => [x * 1760, y * 990])),
    }));
  }

  addMap({
    id: "signal-junction", name: "Signal Junction", sub: "Fictional bonus map · turret train",
    time: "dawn", hp: 0.98, count: 1.06, money: 345, seed: 149, railDispatch: true,
    blurb: "Two roads cross the railway. Dispatch a turret train when the column reaches the tracks.",
    briefing: "This is a fictional challenge, not a recreation of a battle. Start with a charged Rail Patrol. Once a wave starts, press V or choose Armored Train, then tap the battlefield to send it. The three turret cars fire on nearby ground units as they pass. It charges again as you defeat enemies. Keep the tracks clear and guard the exit after the train leaves.",
    paths: [
      [[-0.04, 0.21], [0.18, 0.24], [0.36, 0.38], [0.49, 0.55], [0.65, 0.68], [0.81, 0.67], [1.04, 0.67]],
      [[-0.04, 0.83], [0.17, 0.84], [0.35, 0.70], [0.48, 0.45], [0.59, 0.43], [0.70, 0.66], [0.81, 0.67], [1.04, 0.67]],
    ],
    rail: [[-0.09, 0.61], [0.20, 0.58], [0.46, 0.51], [0.72, 0.46], [1.09, 0.50]],
    villages: [[0.58, 0.39], [0.76, 0.73]],
  });

  addMap({
    id: "canal-loop", name: "Canal Loop", sub: "Fictional bonus map · bridge defense",
    time: "noon", hp: 1.04, count: 1.16, money: 365, seed: 194,
    blurb: "Two bridges, one exit. Cover both crossings or concentrate your defenses at the final bend.",
    briefing: "This fictional battlefield has two routes. They cross the canal at different points, then meet near town. Use the wider banks to cover the bridges or save your strongest upgrades for the final bend.",
    paths: [
      [[-0.04, 0.28], [0.18, 0.22], [0.39, 0.25], [0.59, 0.31], [0.70, 0.45], [0.81, 0.53], [1.04, 0.48]],
      [[-0.04, 0.73], [0.18, 0.77], [0.37, 0.72], [0.59, 0.68], [0.70, 0.60], [0.81, 0.53], [1.04, 0.48]],
    ],
    river: [[0.48, -0.05], [0.53, 0.21], [0.51, 0.50], [0.54, 0.75], [0.50, 1.05]],
    riverWidth: 60,
    villages: [[0.70, 0.31], [0.72, 0.70], [0.91, 0.54]],
  });

  // A map loan (not a permanent tech unlock). Normal rail maps still require Command.
  const init = G.initExtra;
  G.initExtra = function (opts) {
    init.call(this, opts);
    if (this.map.railDispatch && this.layout && this.layout.rail && !this.demo) {
      this.abil.train = { charge: BK.ABILITIES.train.charge };
    }
  };

  const onTrack = (g, x, y) => g.map.railDispatch && g.layout && g.layout.rail && g.layout.rail.near(x, y) < 32;
  const place = G.canPlace;
  G.canPlace = function (x, y, ...rest) {
    return place.call(this, x, y, ...rest) || (onTrack(this, x, y) ? "rail" : null);
  };
  const fort = G.canFort;
  G.canFort = function (kind, x, y) {
    return fort.call(this, kind, x, y) || (onTrack(this, x, y) ? "rail" : null);
  };

  const ready = G.abilityReady;
  G.abilityReady = function (id) {
    if (id === "train" && this.map.railDispatch && this.trains.length) return false;
    return ready.call(this, id);
  };
  const use = G.useAbility;
  G.useAbility = function (id, x, y) {
    if (id !== "train" || !this.map.railDispatch) return use.call(this, id, x, y);
    if (!this.abilityReady(id) || !this.layout || !this.layout.rail) return false;
    // Reuse the existing rail movement/render lifecycle; this train uses gun-car pulses,
    // not the original locomotive's area effect. A turret keeps its own aim and cadence.
    this.trains.push({
      d: -45, speed: 174, fireT: Infinity,
      railTurrets: [0, 0.18, 0.35].map((cooldown) => ({ cooldown, angle: null })),
    });
    this.abil.train.charge = 0;
    this.emit("train", { railPatrol: true });
    return true;
  };

  const extra = G.updateExtra;
  G.updateExtra = function (dt) {
    extra.call(this, dt);
    const rail = this.layout && this.layout.rail;
    if (!this.map.railDispatch || this.phase !== "combat" || !rail) return;
    for (const train of this.trains) {
      for (let i = 0; i < (train.railTurrets || []).length; i++) {
        const gun = train.railTurrets[i];
        const at = train.d - (i + 1) * 66;
        if (at < 0 || at >= rail.len) continue;
        const [x, y, heading] = rail.at(at);
        if (!this.inWorld(x, y)) continue;
        gun.cooldown = Math.max(0, gun.cooldown - dt);
        let target = null, nearest = 180 * 180;
        for (const enemy of this.enemies) {
          if (enemy.gone || enemy.air || enemy.surrender || !this.inWorld(enemy.x, enemy.y)) continue;
          const d = BK.dist2(x, y, enemy.x, enemy.y);
          if (d < nearest) { nearest = d; target = enemy; }
        }
        gun.angle = target ? BK.angTo(x, y, target.x, target.y) : heading;
        if (target && gun.cooldown === 0) {
          gun.cooldown = 0.68;
          this.emit("tracer", { x, y, tx: target.x, ty: target.y });
          this.damage(target, 45, { pen: 0.22, src: "railPatrol" });
        }
      }
    }
  };

  const cleared = G.waveCleared;
  G.waveCleared = function () {
    if (this.map.railDispatch) this.trains = this.trains.filter((tr) => !tr.railTurrets);
    return cleared.call(this);
  };
})(typeof window !== "undefined" ? window : globalThis);
