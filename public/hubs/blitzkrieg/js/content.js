// Content for the campaign expansion: larger battlefields, gun upgrade trees, field items,
// fortifications, special enemy units, weather, crews, battle honors and briefings.
(function (root) {
  const BK = root.BK;

  // ---------------------------------------------------------------- maps
  // Small maps keep the painted terrain. Larger ones are generated farmland with more roads in.
  for (const m of BK.MAPS) { m.size = "Smaller"; m.ww = 1280; m.wh = 720; }
  BK.MAPS[1].unlock = null;
  BK.MAPS[2].unlock = null;
  BK.MAPS.push(
    {
      id: "mokra", name: "Mokra", sub: "1 September, near Kłobuck", time: "dawn", size: "Small", ww: 1760, wh: 990,
      procedural: true, hp: 1.25, count: 1.3, money: 340, seed: 51,
      blurb: "Two roads meet in a farming village. The column comes down both.",
      paths: [
        [[-0.03, 0.25], [0.15, 0.28], [0.3, 0.4], [0.45, 0.43], [0.55, 0.56], [0.7, 0.6], [0.85, 0.5], [1.03, 0.52]],
        [[0.4, -0.04], [0.42, 0.15], [0.38, 0.3], [0.45, 0.43], [0.55, 0.56], [0.7, 0.6], [0.85, 0.5], [1.03, 0.52]],
      ],
      villages: [[0.5, 0.48]],
      briefing: "On 1 September 1939 the Wołyńska Cavalry Brigade under Colonel Julian Filipowicz dug in near Mokra, across the path of the German 4th Panzer Division. Dismounted cavalry with anti tank guns and anti tank rifles, backed by armored train No. 53 Śmiały, held the line through the day. German armor losses were heavy, and the brigade withdrew in good order that night.",
    },
    {
      id: "mlawa", name: "Mława Line", sub: "1 to 3 September", time: "noon", size: "Medium", ww: 2400, wh: 1350,
      procedural: true, hp: 1.35, count: 1.45, money: 380, seed: 63,
      blurb: "Three roads converge on a river crossing. Hold the bridge and the bunkers behind it.",
      paths: [
        [[-0.02, 0.7], [0.12, 0.68], [0.25, 0.58], [0.38, 0.52], [0.5, 0.5], [0.62, 0.52], [0.75, 0.6], [0.88, 0.55], [1.02, 0.56]],
        [[-0.02, 0.15], [0.12, 0.2], [0.22, 0.32], [0.36, 0.42], [0.5, 0.5], [0.62, 0.52], [0.75, 0.6], [0.88, 0.55], [1.02, 0.56]],
        [[0.48, -0.03], [0.46, 0.15], [0.52, 0.3], [0.5, 0.5], [0.62, 0.52], [0.75, 0.6], [0.88, 0.55], [1.02, 0.56]],
      ],
      river: [[0.6, -0.05], [0.64, 0.25], [0.6, 0.5], [0.66, 0.75], [0.62, 1.05]], riverWidth: 70,
      villages: [[0.44, 0.47], [0.8, 0.5]],
      briefing: "From 1 to 3 September the Polish 20th Infantry Division held prepared positions at Mława, with concrete bunkers, trenches and anti tank obstacles, against the German Third Army. Repeated attacks by Panzer Division Kempf broke down in front of the line. The division withdrew on 3 September only after German units worked around its eastern flank.",
    },
    {
      id: "wizna", name: "Wizna", sub: "7 to 10 September, on the Narew", time: "dusk", size: "Large", ww: 3040, wh: 1710,
      procedural: true, hp: 1.5, count: 1.6, money: 420, seed: 77,
      blurb: "Four roads, two bridges over the Narew and a railway. They come from every side.",
      paths: [
        [[0.25, -0.03], [0.27, 0.2], [0.33, 0.4], [0.45, 0.55], [0.55, 0.6], [0.7, 0.65], [0.82, 0.78], [1.02, 0.82]],
        [[0.65, -0.03], [0.62, 0.2], [0.58, 0.42], [0.55, 0.6], [0.7, 0.65], [0.82, 0.78], [1.02, 0.82]],
        [[-0.02, 0.6], [0.15, 0.62], [0.3, 0.68], [0.45, 0.62], [0.55, 0.6], [0.7, 0.65], [0.82, 0.78], [1.02, 0.82]],
        [[-0.02, 0.95], [0.2, 0.88], [0.4, 0.8], [0.58, 0.74], [0.7, 0.65], [0.82, 0.78], [1.02, 0.82]],
      ],
      river: [[-0.05, 0.3], [0.2, 0.36], [0.45, 0.3], [0.7, 0.38], [1.05, 0.32]], riverWidth: 90,
      rail: [[-0.05, 0.48], [0.4, 0.47], [0.8, 0.52], [1.05, 0.62]],
      villages: [[0.5, 0.56], [0.78, 0.7]],
      briefing: "From 7 to 10 September Captain Władysław Raginis held the bunkers at Wizna on the Narew with about 720 men against General Heinz Guderian's XIX Corps, roughly 40,000 strong. The line held for three days. When the last bunker could no longer fight, Raginis ordered his men to surrender and took his own life rather than be captured.",
    },
    {
      id: "bzura", name: "Bzura", sub: "9 to 22 September", time: "noon", size: "Huge", ww: 3680, wh: 2070,
      procedural: true, hp: 1.65, count: 1.8, money: 480, seed: 91,
      blurb: "Five roads, a winding river and a railway across open country. The largest battle of the campaign.",
      paths: [
        [[-0.02, 0.2], [0.15, 0.25], [0.3, 0.32], [0.45, 0.42], [0.6, 0.5], [0.75, 0.48], [0.88, 0.52], [1.02, 0.5]],
        [[-0.02, 0.78], [0.15, 0.72], [0.32, 0.64], [0.48, 0.55], [0.6, 0.5], [0.75, 0.48], [0.88, 0.52], [1.02, 0.5]],
        [[0.55, -0.03], [0.55, 0.15], [0.5, 0.3], [0.55, 0.42], [0.6, 0.5], [0.75, 0.48], [0.88, 0.52], [1.02, 0.5]],
        [[0.45, 1.03], [0.48, 0.85], [0.55, 0.7], [0.6, 0.5], [0.75, 0.48], [0.88, 0.52], [1.02, 0.5]],
        [[0.9, -0.03], [0.86, 0.18], [0.8, 0.35], [0.75, 0.48], [0.88, 0.52], [1.02, 0.5]],
      ],
      river: [[-0.05, 0.6], [0.2, 0.5], [0.4, 0.62], [0.6, 0.68], [0.8, 0.6], [1.05, 0.68]], riverWidth: 100,
      rail: [[-0.05, 0.4], [0.5, 0.36], [1.05, 0.3]],
      villages: [[0.58, 0.46], [0.3, 0.3], [0.83, 0.55]],
      briefing: "On 9 September General Tadeusz Kutrzeba turned the Poznań and Pomorze Armies south across the Bzura and struck the flank of the German 8th Army. It was the largest battle of the campaign. The Polish attack drove the Germans back for several days before German reinforcements and constant air attack closed a ring around the armies. Some units fought their way out to Warsaw.",    },
    {
      id: "warsaw", name: "Warsaw", sub: "8 to 28 September", time: "dusk", size: "Gigantic", ww: 4320, wh: 2430,
      procedural: true, hp: 1.8, count: 2, money: 540, seed: 117,
      blurb: "Six roads into the capital, the Vistula, two railways and every suburb on fire. The last stand.",
      paths: [
        [[-0.02, 0.15], [0.14, 0.2], [0.28, 0.3], [0.4, 0.4], [0.5, 0.48], [0.62, 0.5], [0.76, 0.46], [0.9, 0.5], [1.02, 0.5]],
        [[-0.02, 0.55], [0.14, 0.52], [0.28, 0.5], [0.4, 0.46], [0.5, 0.48], [0.62, 0.5], [0.76, 0.46], [0.9, 0.5], [1.02, 0.5]],
        [[-0.02, 0.92], [0.15, 0.85], [0.3, 0.72], [0.42, 0.6], [0.5, 0.48], [0.62, 0.5], [0.76, 0.46], [0.9, 0.5], [1.02, 0.5]],
        [[0.35, -0.03], [0.38, 0.12], [0.44, 0.25], [0.5, 0.48], [0.62, 0.5], [0.76, 0.46], [0.9, 0.5], [1.02, 0.5]],
        [[0.62, 1.03], [0.6, 0.85], [0.64, 0.68], [0.62, 0.5], [0.76, 0.46], [0.9, 0.5], [1.02, 0.5]],
        [[0.72, -0.03], [0.7, 0.15], [0.74, 0.3], [0.76, 0.46], [0.9, 0.5], [1.02, 0.5]],
      ],
      river: [[0.82, -0.05], [0.85, 0.25], [0.8, 0.5], [0.84, 0.75], [0.8, 1.05]], riverWidth: 120,
      rail: [[-0.05, 0.36], [0.5, 0.34], [1.05, 0.28]],
      villages: [[0.5, 0.45], [0.3, 0.6], [0.62, 0.55], [0.72, 0.3], [0.9, 0.55]],
      briefing: "German forces reached the edge of Warsaw on 8 September. Mayor Stefan Starzyński stayed in the city and spoke to its people on the radio every day while General Juliusz Rómmel commanded the defense. The Luftwaffe bombed the city without letup, and on 25 September more than 1,100 aircraft sorties hit it in a single day. Warsaw surrendered on 28 September with water and power gone and about 25,000 civilians dead.",
    }
  );
  // Map coordinates for the larger maps are written as fractions of the world.
  for (const m of BK.MAPS) {
    if (!m.procedural) continue;
    m.paths = m.paths.map((p) => p.map(([x, y]) => [x * m.ww, y * m.wh]));
  }
  BK.UNLOCKS = BK.UNLOCKS.filter((u) => u.id !== "orchard" && u.id !== "river");
  BK.UNLOCKS.push(
    { id: "train", name: "Armored Train", type: "Ability", cost: 35, desc: "Call armored train Śmiały to shell everything along the railway. Rail maps only." },
    { id: "uhlans", name: "Uhlan Raid", type: "Ability", cost: 25, desc: "A cavalry squadron rides down a road and sabers the infantry on it." }
  );
  BK.UNLOCK_BY_ID = Object.fromEntries(BK.UNLOCKS.map((u) => [u.id, u]));

  // ---------------------------------------------------------------- items
  BK.ITEMS = {
    ammo: { name: "Ammo Crate", icon: "bullets", desc: "Belts, clips and shells taken from enemy supply." },
    steel: { name: "Armor Plate", icon: "shield", desc: "Plate cut from knocked out armor." },
    optics: { name: "Optics", icon: "target", desc: "Binoculars and periscopes for better sights." },
    parts: { name: "Engine Parts", icon: "wrench", desc: "Gears, springs and motors stripped from wrecks." },
    mg34: { name: "Captured MG 34", icon: "bullets", desc: "A belt fed German machine gun." },
    explosives: { name: "Explosives", icon: "burst", desc: "Demolition charges and grenades." },
    radio: { name: "Field Radio", icon: "radio", desc: "A working set with spare batteries." },
    fuel: { name: "Fuel Can", icon: "flame", desc: "Twenty liters of petrol." },
    maps: { name: "Officer's Map", icon: "book", desc: "Marked routes and unit positions." },
  };
  BK.DROPS = {
    inf: { ammo: 0.05, mg34: 0.02 }, officer: { maps: 0.5, optics: 0.3 }, moto: { parts: 0.2, fuel: 0.1 },
    truck: { ammo: 0.5, fuel: 0.4 }, armcar: { radio: 0.3, parts: 0.3 }, ltank: { steel: 0.4, parts: 0.2, optics: 0.1 },
    smoke: { steel: 0.4, explosives: 0.2 }, htrack: { mg34: 0.35, ammo: 0.3 }, mtank: { steel: 0.7, optics: 0.3, parts: 0.3 },
    stuka: { parts: 0.6, fuel: 0.3 }, recon: { radio: 0.6, optics: 0.4 }, pioneer: { explosives: 0.5, fuel: 0.3 },
    sniper: { optics: 0.6 }, mortarteam: { explosives: 0.4, ammo: 0.3 }, engineer: { explosives: 0.3, parts: 0.3 },
    command: { radio: 1, maps: 1, steel: 1 }, leader: { parts: 1, optics: 1, radio: 1 }, nbfz: { steel: 1, parts: 1, explosives: 1 },
  };

  // ---------------------------------------------------------------- special enemy units
  Object.assign(BK.ENEMIES, {
    pioneer: { id: "pioneer", name: "Flamethrower Team", hp: 75, speed: 34, armor: 0.05, reward: 12, leak: 1, r: 8, kind: "foot", score: 60, assault: true,
      weak: [{ id: "fuel", x0: -9, x1: -3, y0: -5, y1: 5, mult: 1, effect: "flametank" }],
      tip: "Pioneers leave the road to burn out your guns. Hit the fuel tank on the back." },
    sniper: { id: "sniper", name: "Sniper", hp: 50, speed: 30, armor: 0, reward: 15, leak: 1, r: 7, kind: "foot", score: 70, snipe: true,
      tip: "Snipers hide in cover and pin your crews down. They are hard to spot unless a gun is close or crewed." },
    mortarteam: { id: "mortarteam", name: "Mortar Team", hp: 85, speed: 30, armor: 0, reward: 16, leak: 1, r: 9, kind: "foot", score: 70, mortar: true,
      tip: "Mortar teams set up off the road and lob bombs onto your guns. Go after them first." },
    engineer: { id: "engineer", name: "Engineers", hp: 65, speed: 34, armor: 0, reward: 12, leak: 1, r: 8, kind: "foot", score: 50, engineer: true,
      tip: "Engineers clear your wire, roadblocks and mines, and patch up damaged vehicles." },
  });
  // Scale the new units like the rest.
  for (const k of ["pioneer", "sniper", "mortarteam", "engineer"]) {
    const d = BK.ENEMIES[k];
    d.r *= BK.US;
    if (d.weak) d.weak = d.weak.map((w) => Object.assign({}, w, { x0: w.x0 * BK.US, x1: w.x1 * BK.US, y0: w.y0 * BK.US, y1: w.y1 * BK.US }));
  }
  // Fold the specialists into the campaign so every few waves something new hits the guns.
  const W = BK.WAVES;
  W[2].groups.push({ kind: "engineer", n: 2, gap: 1.5, at: 6 });
  W[3].groups.push({ kind: "pioneer", n: 2, gap: 2, at: 8 });
  W[5].groups.push({ kind: "sniper", n: 2, gap: 4, at: 3 }, { kind: "mortarteam", n: 1, at: 7 });
  W[6].groups.push({ kind: "pioneer", n: 3, gap: 1.5, at: 10 });
  W[7].groups.push({ kind: "engineer", n: 3, gap: 1.2, at: 2 }, { kind: "mortarteam", n: 2, gap: 4, at: 8 });
  W[8].groups.push({ kind: "sniper", n: 3, gap: 3, at: 5 });
  W[10].groups.push({ kind: "pioneer", n: 4, gap: 1.2, at: 6 }, { kind: "mortarteam", n: 2, gap: 4, at: 4 });
  W[11].groups.push({ kind: "sniper", n: 3, gap: 2, at: 2 }, { kind: "engineer", n: 4, gap: 1, at: 8 });
  W[12].groups.push({ kind: "mortarteam", n: 3, gap: 3, at: 6 }, { kind: "pioneer", n: 4, gap: 1.2, at: 10 });
  W[13].groups.push({ kind: "sniper", n: 4, gap: 2, at: 3 }, { kind: "engineer", n: 4, gap: 1, at: 6 }, { kind: "mortarteam", n: 3, gap: 3, at: 9 });
  W[14].groups.push({ kind: "pioneer", n: 5, gap: 1, at: 8 }, { kind: "sniper", n: 3, gap: 2, at: 4 });

  // ---------------------------------------------------------------- fortifications
  // Built between waves. Cover, wire and obstacles change how both sides fight.
  BK.FORTS = {
    sandbag: { id: "sandbag", name: "Sandbag Wall", short: "Sandbags", cost: 25, key: "1", hp: 220, where: "off", r: 18,
      desc: "Guns within reach take 20% less damage. Two walls stack." },
    wire: { id: "wire", name: "Barbed Wire", short: "Wire", cost: 20, key: "2", hp: 70, where: "any", r: 26,
      desc: "Infantry crossing it slow to a crawl and bleed. Tanks flatten it." },
    roadblock: { id: "roadblock", name: "Roadblock", short: "Roadblock", cost: 55, key: "3", hp: 520, where: "road", r: 30,
      desc: "Vehicles must stop and shoot it apart. Park it in your kill zone." },
    traps: { id: "traps", name: "Tank Traps", short: "Tank Traps", cost: 40, key: "4", hp: 900, where: "road", r: 30,
      desc: "Steel hedgehogs. Vehicles weave through at a crawl." },
    dig: { id: "dig", name: "Dig In", short: "Dig In", cost: 15, key: "5", hp: 0, where: "off", r: 20,
      desc: "Dig a gun pit. Build a gun in it for crater cover." },
  };
  BK.FORT_ORDER = ["sandbag", "wire", "roadblock", "traps", "dig"];

  // Cover rules for a gun sitting in a crater, ruin, or behind sandbags.
  BK.COVER = {
    crater: { taken: 0.65, directRange: 0.85, mortarRate: 1.15, mortarSplash: 1.1, label: "In a crater" },
    ruin: { taken: 0.6, directRange: 0.95, label: "In ruins" },
    sandbag: { taken: 0.8, label: "Sandbags" },
  };

  // ---------------------------------------------------------------- ranks and crews
  BK.RANKS = [
    { short: "Szer.", name: "Private", xp: 0 },
    { short: "Kpr.", name: "Corporal", xp: 60 },
    { short: "Plut.", name: "Platoon Sergeant", xp: 200 },
    { short: "Sierż.", name: "Sergeant", xp: 450 },
    { short: "Chor.", name: "Warrant Officer", xp: 900 },
  ];
  BK.SURNAMES = ["Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Krawczyk", "Piotrowski", "Grabowski", "Pawłowski", "Michalski", "Adamczyk", "Dudek", "Zając", "Wieczorek", "Jabłoński", "Król", "Majewski", "Olszewski", "Jaworski", "Malinowski", "Górski", "Sikora", "Baran", "Rutkowski", "Wróbel"];

  // ---------------------------------------------------------------- upgrade trees
  // Each gun starts as its root form. Every upgrade is one step down a branch, and each step
  // can change the gun into something new. Tier needs rank, złoty and items.
  // mods multiply (dmg, rate, range, splash, taken), add (crit) or set (everything else).
  const N = (o) => o;
  BK.TREES = {
    mg: {
      mg: N({ name: "CKM wz.30 Nest", tier: 0, look: { base: "sandbag", w: "mg" } }),
      twin: N({ parent: "mg", name: "Twin Mount", tier: 1, cost: 70, items: { ammo: 1 }, desc: "A second gun on the mount. Fire rate doubles.", mods: { rate: 2 }, look: { base: "sandbag", w: "mg2" } }),
      quad: N({ parent: "twin", name: "Quad Mount", tier: 2, cost: 130, items: { ammo: 2, parts: 1 }, desc: "Four guns on a pivot. Full damage against aircraft.", mods: { rate: 1.4, air: 1 }, look: { base: "sandbag", w: "mg4" } }),
      flaknest: N({ parent: "quad", name: "Flak Nest", tier: 3, cost: 210, items: { parts: 2, optics: 1 }, desc: "Raised platform with ring sights. Bursts splash every plane nearby and aircraft take double.", mods: { airSplash: 55, airDmg: 2, range: 1.2 }, look: { base: "tower", w: "mg4", sight: true } }),
      hail: N({ parent: "quad", name: "Hailstorm", tier: 3, cost: 220, items: { ammo: 3, mg34: 1 }, desc: "Four Brownings and a captured MG 34. Infantry in range are pinned and slow to a crawl. Kills ricochet.", mods: { rate: 1.4, suppress: true, rico: 0.5 }, look: { base: "deep", w: "mg4", side: "mg34" } }),
      pillbox: N({ parent: "mg", name: "Pillbox", tier: 1, cost: 80, items: { steel: 1 }, desc: "Poured concrete. Takes half damage, sees a little less.", mods: { taken: 0.5, range: 0.92 }, look: { base: "concrete", w: "mg" } }),
      cas20: N({ parent: "pillbox", name: "20mm Casemate", tier: 2, cost: 150, items: { steel: 1, parts: 1 }, desc: "The MG gives way to a 20mm wz.38 cannon. Triple damage, half the rate, real armor piercing.", mods: { dmg: 3, rate: 0.5, pen: 0.6, shot: "shell", speed: 1000 }, look: { base: "concrete", w: "can20" } }),
      fortress: N({ parent: "cas20", name: "Fortress Casemate", tier: 3, cost: 240, items: { steel: 2, ammo: 2 }, desc: "A two gun casemate. Hits harder, fires faster and shrugs off almost everything.", mods: { dmg: 1.4, rate: 1.6, taken: 0.55 }, look: { base: "casemate", w: "can20", side: "mg" } }),
      flamebunker: N({ parent: "cas20", name: "Flame Bunker", tier: 3, cost: 230, items: { fuel: 2, explosives: 1 }, desc: "A flamethrower nozzle in a low bunker. Burns everything in a short cone and leaves the road on fire.", mods: { shot: "flame", range: 0.62, rate: 6, dmg: 0.45, burnGround: true }, look: { base: "concrete", w: "flamer" } }),
    },
    atr: {
      atr: N({ name: "Ur wz.35 Team", tier: 0, look: { base: "sandbag", w: "atr" } }),
      scoped: N({ parent: "atr", name: "Scoped Rifle", tier: 1, cost: 80, items: { optics: 1 }, desc: "A telescopic sight. Weak spot chance +30%, range +15%.", mods: { crit: 0.3, range: 1.15 }, look: { base: "sandbag", w: "atr", scope: true } }),
      hide: N({ parent: "scoped", name: "Sniper Hide", tier: 2, cost: 130, items: { optics: 1 }, desc: "Camouflaged. Enemies cannot shoot what they cannot see. Hunts officers, snipers and pioneers first.", mods: { camo: true, hunt: true, range: 1.15 }, look: { base: "camo", w: "atr", scope: true } }),
      ghost: N({ parent: "hide", name: "Ghost Team", tier: 3, cost: 210, items: { optics: 2, maps: 1 }, desc: "One shot, one kill on any soldier. Vehicles hit are stunned for a second.", mods: { footKill: true, stunVeh: 1, rate: 1.2 }, look: { base: "camo", w: "atr", scope: true, ghillie: true } }),
      spotter: N({ parent: "hide", name: "Spotter Post", tier: 3, cost: 200, items: { radio: 1, optics: 1 }, desc: "Calls targets by radio. Every gun nearby deals 25% more, and hidden snipers show up.", mods: { spot: 220 }, look: { base: "post", w: "atr", radio: true } }),
      twinur: N({ parent: "atr", name: "Twin Team", tier: 1, cost: 85, items: { ammo: 1 }, desc: "Two rifles fire together.", mods: { shells: 2 }, look: { base: "sandbag", w: "atr2" } }),
      breaker: N({ parent: "twinur", name: "Tank Breaker", tier: 2, cost: 140, items: { steel: 1 }, desc: "Tungsten cored rounds. Ignores armor and deals 60% more to tracked vehicles.", mods: { pen: 1, vsTrack: 1.6 }, look: { base: "sandbag", w: "atr2", scope: true } }),
      battery: N({ parent: "breaker", name: "Ur Battery", tier: 3, cost: 220, items: { ammo: 2, steel: 1 }, desc: "Four rifles behind one wall. A fanned volley that goes through five targets.", mods: { shells: 4, pierce: 5 }, look: { base: "battery", w: "atr4" } }),
      sappers: N({ parent: "breaker", name: "Sapper Section", tier: 3, cost: 200, items: { explosives: 2 }, desc: "Keeps firing and sends sappers to plant anti tank mines on the nearest road every 12 seconds.", mods: { minelayer: 12 }, look: { base: "sandbag", w: "atr2", crates: true } }),
    },
    at37: {
      at37: N({ name: "37mm Bofors wz.36", tier: 0, look: { base: "sandbag", w: "at37" } }),
      hardcore: N({ parent: "at37", name: "Hard Core Shot", tier: 1, cost: 110, items: { steel: 1 }, desc: "Weak spot chance +30%, and weak spot hits deal more.", mods: { crit: 0.3, weakMult: 1.35 }, look: { base: "sandbag", w: "at37", bands: true } }),
      ambush: N({ parent: "hardcore", name: "Ambush Gun", tier: 2, cost: 160, items: { optics: 1 }, desc: "Under a camouflage net. The first round into every new target deals triple.", mods: { firstShot: 3, camo: true }, look: { base: "camo", w: "at37" } }),
      hunter: N({ parent: "ambush", name: "Tank Hunter", tier: 3, cost: 250, items: { steel: 2, optics: 1 }, desc: "Every hit on a tank throws a track, and weak spots take quadruple.", mods: { autoTrack: true, weakMult: 1.5, dmg: 1.3 }, look: { base: "camo", w: "at37", scope: true, branches: true } }),
      twin37: N({ parent: "ambush", name: "Twin 37", tier: 3, cost: 260, items: { ammo: 2, parts: 1 }, desc: "Two barrels on one carriage. Double the fire.", mods: { rate: 2 }, look: { base: "sandbag", w: "at37x2" } }),
      fastload: N({ parent: "at37", name: "Fast Loader", tier: 1, cost: 100, items: { ammo: 1 }, desc: "Fire rate x1.8.", mods: { rate: 1.8 }, look: { base: "sandbag", w: "at37", loader: true } }),
      tank7tp: N({ parent: "fastload", name: "7TP Tank", tier: 2, cost: 220, items: { parts: 2 }, desc: "The 37mm goes into a Polish 7TP light tank. Twice the health, and it can move between waves.", mods: { hp: 2, mobile: true, range: 1.1 }, look: { base: "tank7tp" } }),
      vet7tp: N({ parent: "tank7tp", name: "7TP Veteran", tier: 3, cost: 260, items: { steel: 2, mg34: 1 }, desc: "Extra armor and a hull machine gun that cuts down infantry while the main gun works.", mods: { taken: 0.6, hullMg: true, dmg: 1.2 }, look: { base: "tank7tp", vet: true } }),
      cas37: N({ parent: "tank7tp", name: "Casemate 37", tier: 3, cost: 240, items: { steel: 3 }, desc: "Dug in under concrete. Takes 60% less damage and reaches 20% farther.", mods: { taken: 0.4, range: 1.2, mobile: false }, look: { base: "casemate", w: "at37" } }),
    },
    mortar: {
      mortar: N({ name: "81mm wz.31 Mortar", tier: 0, look: { base: "sandbag", w: "mortar" } }),
      barrage: N({ parent: "mortar", name: "Barrage", tier: 1, cost: 110, items: { ammo: 1 }, desc: "Three bombs each firing.", mods: { shells: 3 }, look: { base: "sandbag", w: "mortar", crates: true } }),
      twintube: N({ parent: "barrage", name: "Twin Tubes", tier: 2, cost: 160, items: { ammo: 1, parts: 1 }, desc: "Two tubes, six bombs a firing.", mods: { shells: 6, rate: 1.2 }, look: { base: "sandbag", w: "mortar2" } }),
      saturation: N({ parent: "twintube", name: "Saturation Battery", tier: 3, cost: 240, items: { ammo: 3 }, desc: "Four tubes walk ten bombs across the road.", mods: { shells: 10, splash: 1.1 }, look: { base: "deep", w: "mortar4" } }),
      smokefire: N({ parent: "twintube", name: "Smoke and Fire", tier: 3, cost: 230, items: { fuel: 1, explosives: 1 }, desc: "Incendiary bombs leave burning ground. Smoke blinds enemy gunners.", mods: { burnGround: true, smokeShells: true }, look: { base: "sandbag", w: "mortar2", phos: true } }),
      heavyb: N({ parent: "mortar", name: "Heavy Bombs", tier: 1, cost: 110, items: { explosives: 1 }, desc: "Splash +60% and every hit stuns for half a second.", mods: { splash: 1.6, stun: 0.5 }, look: { base: "sandbag", w: "mortar", bands: true } }),
      m120: N({ parent: "heavyb", name: "120mm Heavy Mortar", tier: 2, cost: 190, items: { steel: 1, explosives: 1 }, desc: "Damage x2.5, splash x1.5, range +30%, slower.", mods: { dmg: 2.5, splash: 1.5, range: 1.3, rate: 0.66 }, look: { base: "deep", w: "mortar120" } }),
      siege: N({ parent: "m120", name: "Siege Mortar", tier: 3, cost: 260, items: { explosives: 2, parts: 1 }, desc: "Each bomb tears a deep crater that bogs down vehicles and stuns everything near it.", mods: { craterShells: true, stun: 1.2, dmg: 1.3 }, look: { base: "deep", w: "mortarSiege" } }),
      obsbat: N({ parent: "m120", name: "Observed Battery", tier: 3, cost: 250, items: { radio: 1, optics: 1 }, desc: "A forward observer on the radio. Reaches across the map and goes for the biggest target.", mods: { range: 2.4, priority: "strong" }, look: { base: "deep", w: "mortar120", radio: true } }),
    },
    aa: {
      aa: N({ name: "40mm Bofors AA", tier: 0, look: { base: "sandbag", w: "aa" } }),
      prox: N({ parent: "aa", name: "Proximity Bursts", tier: 1, cost: 120, items: { parts: 1 }, desc: "Shells burst near aircraft and splash every plane nearby.", mods: { airSplash: 55 }, look: { base: "sandbag", w: "aa", sight: true } }),
      twinbof: N({ parent: "prox", name: "Twin Bofors", tier: 2, cost: 180, items: { ammo: 1, parts: 1 }, desc: "Two barrels. Fire rate doubles.", mods: { rate: 2 }, look: { base: "sandbag", w: "aa2" } }),
      flaktower: N({ parent: "twinbof", name: "Flak Tower", tier: 3, cost: 270, items: { steel: 2, parts: 2 }, desc: "A concrete tower. Range +40% and full damage on the ground.", mods: { range: 1.4, ground: 1 }, look: { base: "tower", w: "aa2" } }),
      searchlight: N({ parent: "twinbof", name: "Searchlight Battery", tier: 3, cost: 240, items: { radio: 1, optics: 1 }, desc: "A searchlight pins aircraft. Planes in range fly at half speed and take 50% more from every gun.", mods: { airSlow: true }, look: { base: "sandbag", w: "aa2", light: true } }),
      sweep: N({ parent: "aa", name: "Ground Sweep", tier: 1, cost: 110, items: { ammo: 1 }, desc: "Full damage against ground targets and +25% range.", mods: { ground: 1, range: 1.25 }, look: { base: "sandbag", w: "aa", crates: true } }),
      gtruck: N({ parent: "sweep", name: "Gun Truck", tier: 2, cost: 190, items: { parts: 2 }, desc: "The Bofors goes onto a truck bed. Fires 30% faster and can move between waves.", mods: { rate: 1.3, mobile: true }, look: { base: "truck" } }),
      armtruck: N({ parent: "gtruck", name: "Armored Gun Truck", tier: 3, cost: 250, items: { steel: 2 }, desc: "Plated sides. Takes half damage and reaches 15% farther.", mods: { taken: 0.5, range: 1.15 }, look: { base: "truck", armored: true } }),
      autonest: N({ parent: "gtruck", name: "Autocannon Nest", tier: 3, cost: 240, items: { explosives: 1, ammo: 2 }, desc: "Dug in with high explosive clips. Every shell splashes on the ground.", mods: { splash: 34, mobile: false, dmg: 1.2 }, look: { base: "deep", w: "aa", crates: true } }),
    },
    f75: {
      f75: N({ name: "75mm wz.1897 Gun", tier: 0, look: { base: "sandbag", w: "f75" } }),
      cbat: N({ parent: "f75", name: "Counter Battery", tier: 1, cost: 150, items: { optics: 1 }, desc: "Goes for the toughest target and deals double to tanks that shoot back.", mods: { vsShooters: 2, priority: "strong" }, look: { base: "sandbag", w: "f75", sight: true } }),
      longb: N({ parent: "cbat", name: "Long Barrel", tier: 2, cost: 220, items: { steel: 1, parts: 1 }, desc: "Range +25%, damage +40%.", mods: { range: 1.25, dmg: 1.4 }, look: { base: "sandbag", w: "f75long" } }),
      fortgun: N({ parent: "longb", name: "Fortress Gun", tier: 3, cost: 320, items: { steel: 3 }, desc: "An armored turret set in concrete. Double damage and very hard to kill.", mods: { dmg: 2, taken: 0.45 }, look: { base: "turret75" } }),
      twin75: N({ parent: "longb", name: "Direct Fire Battery", tier: 3, cost: 300, items: { ammo: 2, parts: 1 }, desc: "Two guns firing over open sights. Double the rate.", mods: { rate: 2 }, look: { base: "battery", w: "f75x2" } }),
      shrapnel: N({ parent: "f75", name: "Shrapnel", tier: 1, cost: 140, items: { ammo: 1 }, desc: "Splash x2.2 and soldiers die in one hit.", mods: { splash: 2.2, footKill: true }, look: { base: "sandbag", w: "f75", bands: true } }),
      howitzer: N({ parent: "shrapnel", name: "100mm Howitzer", tier: 2, cost: 230, items: { explosives: 1, steel: 1 }, desc: "Lobs shells over cover onto the road. Splash x2.", mods: { shot: "lob", speed: 1.4, splash: 2, minRange: 90 }, look: { base: "sandbag", w: "howitzer" } }),
      grand: N({ parent: "howitzer", name: "Grand Battery", tier: 3, cost: 320, items: { explosives: 2, ammo: 2 }, desc: "Three howitzers fire as one.", mods: { shells: 3 }, look: { base: "battery", w: "howitzer3" } }),
      firestorm: N({ parent: "howitzer", name: "Firestorm", tier: 3, cost: 290, items: { fuel: 2, explosives: 1 }, desc: "Incendiary shells. The road burns where they land.", mods: { burnGround: true, dmg: 1.2 }, look: { base: "sandbag", w: "howitzer", phos: true } }),
    },
  };
  for (const [gun, tree] of Object.entries(BK.TREES)) {
    for (const [id, n] of Object.entries(tree)) { n.id = id; n.gun = gun; n.mods = n.mods || {}; n.items = n.items || {}; }
    for (const n of Object.values(tree)) n.next = Object.values(tree).filter((m) => m.parent === n.id).map((m) => m.id);
  }
  BK.RANK_FOR_TIER = [0, 1, 2, 3];

  // ---------------------------------------------------------------- weather
  BK.WEATHER = {
    clear: { name: "Clear", sight: 1, desc: "Clear skies. Good flying weather for the Luftwaffe." },
    fog: { name: "Morning Fog", sight: 0.78, desc: "Fog cuts every gun's range by a fifth until it lifts." },
    rain: { name: "Rain", sight: 0.9, wheelSlow: 0.85, desc: "Rain softens the roads. Wheeled vehicles slow down." },
    smoke: { name: "Burning Fields", sight: 0.88, desc: "Smoke from burning villages drifts across the battlefield." },
  };

  // ---------------------------------------------------------------- battle honors
  BK.HONORS = [
    { id: "first", name: "First Blood", desc: "Win a wave.", medals: 2, test: (g) => g.wave >= 1 && g.phase !== "combat" },
    { id: "perfect", name: "Not One Step", desc: "Hold all 15 waves without losing any garrison.", medals: 15, end: (g, r) => r.won && g.stats.leaks === 0 },
    { id: "radio", name: "Silence the Radio", desc: "Cut the command tank's antenna.", medals: 4, ev: "antenna" },
    { id: "stukamg", name: "Hornet's Nest", desc: "Down a Stuka with a machine gun.", medals: 4, ev: "stukaMg" },
    { id: "combo50", name: "Iron Wall", desc: "Reach a 50 kill combo.", medals: 5, test: (g) => g.bestCombo >= 50 },
    { id: "chief", name: "Chief of Ordnance", desc: "Take any gun to its final form.", medals: 5, ev: "tier3" },
    { id: "elite", name: "Old Soldiers", desc: "Promote a crew to Warrant Officer.", medals: 5, ev: "rank4" },
    { id: "prisoners", name: "Take Them Alive", desc: "Capture 10 prisoners in one battle.", medals: 4, test: (g) => g.stats.prisoners >= 10 },
    { id: "salvage", name: "Scavenger", desc: "Salvage 10 wrecks in one battle.", medals: 3, test: (g) => g.stats.salvaged >= 10 },
    { id: "wall", name: "The Wall", desc: "Build 10 fortifications in one battle.", medals: 3, test: (g) => g.stats.forts >= 10 },
    { id: "gigantic", name: "Warsaw Defiant", desc: "Hold Warsaw, the gigantic map.", medals: 25, end: (g, r) => r.won && g.map.id === "warsaw" },
    { id: "bzura", name: "The Bzura", desc: "Win the Battle of the Bzura.", medals: 18, end: (g, r) => r.won && g.map.id === "bzura" },
    { id: "wizna", name: "Polish Thermopylae", desc: "Win at Wizna.", medals: 15, end: (g, r) => r.won && g.map.id === "wizna" },
  ];

  // ---------------------------------------------------------------- new abilities
  BK.ABILITIES.train = { id: "train", name: "Armored Train", desc: "Armored train Śmiały shells everything near the railway.", charge: 160, key: "V", unlock: "train", rail: true };
  BK.ABILITIES.uhlans = { id: "uhlans", name: "Uhlan Raid", desc: "A cavalry squadron rides down the road you pick and sabers the infantry on it.", charge: 120, key: "B", unlock: "uhlans" };
  BK.ABILITIES.arty.key = "Z";
  BK.ABILITIES.fighter.key = "X";
  BK.ABILITIES.mines.key = "C";
})(typeof window !== "undefined" ? window : globalThis);
