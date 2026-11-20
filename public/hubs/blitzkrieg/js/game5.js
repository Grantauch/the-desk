// Boss phases for the command tank and the Neubaufahrzeug, and the Sd.Kfz. 231 eight wheeled armored car.
// Loaded after game4.js.
(function (root) {
  const BK = root.BK;
  const { dist2 } = BK;
  const G = BK.Game.prototype;

  // ------------------------------------------------------------------ the eight wheeler
  const S = BK.US;
  BK.ENEMIES.armcar8 = {
    id: "armcar8", name: "Sd.Kfz. 231", hp: 260, speed: 64, armor: 0.5, reward: 22, leak: 3, L: 50 * S, Wd: 22 * S,
    kind: "wheel", score: 110,
    weak: [
      { id: "tires", x0: -22 * S, x1: 22 * S, y0: -14 * S, y1: -9 * S, mult: 1.5, effect: "tires" },
      { id: "tires", x0: -22 * S, x1: 22 * S, y0: 9 * S, y1: 14 * S, mult: 1.5, effect: "tires" },
      { id: "engine", x0: -25 * S, x1: -17 * S, y0: -6 * S, y1: 6 * S, mult: 2.5, effect: "engine" },
    ],
    shoots: { range: 165, rate: 2.2, dmg: 5, kind: "mg" },
    tip: "The eight wheeled Sd.Kfz. 231 is fast and its 20mm chews up guns. Shoot the tires, or hit the engine at the back.",
  };
  BK.DROPS.armcar8 = { radio: 0.4, parts: 0.4, ammo: 0.2 };
  const W = BK.WAVES;
  W[8].groups.push({ kind: "armcar8", n: 2, gap: 2.5, at: 6 });
  W[10].groups.push({ kind: "armcar8", n: 3, gap: 2, at: 5 });
  W[12].groups.push({ kind: "armcar8", n: 3, gap: 2, at: 8 });
  W[13].groups.push({ kind: "armcar8", n: 2, gap: 2, at: 10 });

  // ------------------------------------------------------------------ boss phases
  // Each boss changes how it fights as it loses health. The banner tells the player what changed.
  const PHASES = {
    command: [
      { at: 0.6, title: "The column surges", sub: "The command tank orders everyone forward and lays smoke", run(g, e) {
        g.zones.push({ kind: "smoke", x: e.x, y: e.y, r: 80, t: 6, max: 6 });
        for (const o of g.enemies) if (!o.gone && !o.air && o !== e && dist2(o.x, o.y, e.x, e.y) < 320 * 320) o.rushT = 5;
      } },
      { at: 0.3, title: "Buttoned up", sub: "Hatches shut, more armor, and motorcycles called up the road", run(g, e) {
        e.armor = Math.min(0.9, e.armor + 0.07);
        for (let i = 0; i < 3; i++) g.queue.push({ t: g.waveT + 0.6 + i * 0.7, kind: "moto", path: e.path, lat: (i - 1) * 10 });
        g.queue.sort((a, b) => a.t - b.t);
      } },
    ],
    nbfz: [
      { at: 0.66, title: "All turrets traverse", sub: "The monster's guns fire faster", run(g, e) {
        for (const t of e.turrets || []) if (!t.dead) t.rate *= 1.5;
      } },
      { at: 0.33, title: "Last push", sub: "Smoke, then full speed for the town", run(g, e) {
        g.zones.push({ kind: "smoke", x: e.x, y: e.y, r: 90, t: 5, max: 5 });
        e.speed *= 1.5;
        e.rushT = 0;
      } },
    ],
  };

  const baseExtra = G.updateExtra;
  G.updateExtra = function (dt) {
    baseExtra.call(this, dt);
    if (this.phase !== "combat") return;
    for (const e of this.enemies) {
      if (e.gone) continue;
      // Units called forward move faster for a few seconds.
      if (e.rushT > 0) {
        if (!e.rushBase) { e.rushBase = e.speed; e.speed *= 1.4; }
        e.rushT -= dt;
        if (e.rushT <= 0 && e.rushBase) { e.speed = e.rushBase; e.rushBase = 0; }
      }
      const ph = PHASES[e.kind];
      if (!ph || e.hp <= 0) continue;
      e.phaseN = e.phaseN || 0;
      while (e.phaseN < ph.length && e.hp / e.maxHp <= ph[e.phaseN].at) {
        const p = ph[e.phaseN++];
        p.run(this, e);
        this.emit("banner", { str: p.title, sub: p.sub, color: "#ff8a70" });
        this.emit("text", { x: e.x, y: e.y - 40, str: p.title.toUpperCase(), color: "#ff8a70", size: 22 });
        this.shake(0.4);
      }
    }
  };

  // The eight wheeler joins the endless mix.
  const baseEndless = BK.endlessWave;
  BK.endlessWave = function (n, rng) {
    const w = baseEndless(n, rng);
    if (n > 3) w.groups.push({ kind: "armcar8", n: Math.min(6, 1 + Math.floor(n / 6)), gap: 2, at: 6 });
    return w;
  };

  // ------------------------------------------------------------------ the Command tech tree
  // Four branches of permanent upgrades bought with medals. The old unlocks sit in the branches,
  // each step needs the one before it, and new perks fill the gaps.
  const NEW = [
    { id: "art_drill", name: "Gun Drill", type: "Perk", cost: 20, desc: "Every gun deals 5% more damage.", apply: (g) => { g.mods.dmg += 0.05; } },
    { id: "art_tables", name: "Firing Tables", type: "Perk", cost: 30, desc: "Every blast is 10% wider.", apply: (g) => { g.mods.splash += 0.1; } },
    { id: "art_range", name: "Range Finders", type: "Perk", cost: 45, desc: "Every gun reaches 5% farther.", apply: (g) => { g.mods.range += 0.05; } },
    { id: "eng_bags", name: "Deeper Pits", type: "Perk", cost: 18, desc: "Every gun has 15% more health.", apply: (g) => { g.mods.hp += 0.15; } },
    { id: "eng_stores", name: "Engineer Stores", type: "Perk", cost: 25, desc: "Start every battle with 2 Armor Plate and 2 Engine Parts.", apply: (g) => { g.inv.steel = (g.inv.steel || 0) + 2; g.inv.parts = (g.inv.parts || 0) + 2; } },
    { id: "log_ammo", name: "Ammunition Dump", type: "Perk", cost: 20, desc: "Start every battle with 2 Ammo Crates and 1 Explosives.", apply: (g) => { g.inv.ammo = (g.inv.ammo || 0) + 2; g.inv.explosives = (g.inv.explosives || 0) + 1; } },
    { id: "log_interest", name: "Paymaster", type: "Perk", cost: 25, desc: "The interest cap rises by 15 zł.", apply: (g) => { g.mods.interestCap += 15; } },
    { id: "int_radio", name: "Signals Company", type: "Perk", cost: 22, desc: "Abilities charge 15% faster.", apply: (g) => { g.mods.charge += 0.15; } },
    { id: "int_maps", name: "Staff Maps", type: "Perk", cost: 30, desc: "Start every battle with an Officer's Map, Optics and a Field Radio.", apply: (g) => { for (const k of ["maps", "optics", "radio"]) g.inv[k] = (g.inv[k] || 0) + 1; } },
  ];
  for (const n of NEW) if (!BK.UNLOCKS.some((u) => u.id === n.id)) BK.UNLOCKS.push(n);
  BK.TECH = [
    { id: "art", name: "Artillery", icon: "shell", nodes: ["atr", "art_drill", "f75", "art_tables", "how100", "art_range"] },
    { id: "eng", name: "Engineering", icon: "wrench", nodes: ["mines", "eng_bags", "garrison1", "tks", "eng_stores"] },
    { id: "log", name: "Logistics", icon: "crate", nodes: ["cash1", "reroll1", "log_ammo", "cash2", "log_interest", "vet"] },
    { id: "int", name: "Intelligence", icon: "radio", nodes: ["fighter", "int_radio", "luck1", "uhlans", "int_maps", "train"] },
  ];
  BK.UNLOCK_BY_ID = Object.fromEntries(BK.UNLOCKS.map((u) => [u.id, u]));
  for (const b of BK.TECH) {
    b.nodes = b.nodes.filter((id) => BK.UNLOCK_BY_ID[id]);
    b.nodes.forEach((id, i) => { const u = BK.UNLOCK_BY_ID[id]; u.branch = b.id; u.requires = i ? b.nodes[i - 1] : null; });
  }
  const baseInit = G.initExtra;
  G.initExtra = function (opts) {
    baseInit.call(this, opts);
    if (this.demo) return;
    const U = (this.save && this.save.unlocks) || {};
    for (const n of NEW) if (U[n.id]) n.apply(this);
    // Health perks reach guns built later through towerMaxHp, which reads mods.hp.
  };
})(typeof window !== "undefined" ? window : globalThis);
