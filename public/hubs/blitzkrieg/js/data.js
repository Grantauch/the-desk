// Game content: guns, enemy units, cards, crate prizes, maps, waves and unlocks.
(function (root) {
  const BK = root.BK;

  // ---------------------------------------------------------------- guns
  // rate is shots per second. pen is how much armor a round ignores (1 ignores all of it).
  BK.GUNS = {
    mg: {
      id: "mg", name: "CKM wz.30 Nest", short: "MG Nest", role: "Shreds infantry and bikes",
      cost: 70, range: 150, rate: 7, dmg: 7, pen: 0.12, splash: 0, shot: "bullet", speed: 1100,
      air: 0.45, hp: 90, turn: 9, crit: 0.04, key: "1",
      history: "The Polish heavy machine gun of 1939, a licensed Browning that fired 8mm Mauser rounds from 330 round belts.",
      specs: [
        { id: "twin", name: "Twin Mount", desc: "Second gun on the mount. Fire rate doubles." },
        { id: "fire", name: "Incendiary Belts", desc: "Hits set targets burning for 4 seconds. Fire spreads between infantry." },
      ],
    },
    atr: {
      id: "atr", name: "Ur wz.35 Rifle Team", short: "AT Rifle", role: "Punches through a whole line",
      cost: 95, range: 230, rate: 0.9, dmg: 46, pen: 0.85, splash: 0, shot: "pierce", pierce: 3,
      air: 0, hp: 60, turn: 5, crit: 0.1, key: "2", unlock: "atr",
      history: "Poland's secret anti tank rifle. Crates were stamped as survey gear and kept sealed until the war began.",
      specs: [
        { id: "mark", name: "Marksman", desc: "Range +30% and every shot finds a weak spot 40% of the time." },
        { id: "over", name: "Overpenetration", desc: "Rounds pass through 7 targets and keep full damage." },
      ],
    },
    at37: {
      id: "at37", name: "37mm Bofors wz.36", short: "37mm AT", role: "Kills light armor",
      cost: 130, range: 195, rate: 0.75, dmg: 78, pen: 0.95, splash: 0, shot: "shell", speed: 900,
      air: 0, hp: 110, turn: 3.2, crit: 0.08, key: "3",
      history: "The 37mm gun was small enough for a crew to push by hand and still went through every German tank fielded in 1939.",
      specs: [
        { id: "tung", name: "Hard Core Shot", desc: "Weak spot chance +30% and weak spot hits deal x4." },
        { id: "load", name: "Fast Loader", desc: "Fire rate x1.8." },
      ],
    },
    mortar: {
      id: "mortar", name: "81mm wz.31 Mortar", short: "Mortar", role: "Splash over a bend",
      cost: 140, range: 280, minRange: 70, rate: 0.42, dmg: 44, pen: 0.55, splash: 58, shot: "lob", speed: 1.1,
      air: 0, hp: 80, turn: 6, crit: 0.05, key: "4",
      history: "The 81mm mortar lobbed bombs high over hedges and buildings. Crews worked it from behind cover.",
      specs: [
        { id: "barr", name: "Barrage", desc: "Each firing drops three bombs in a spread." },
        { id: "heavy", name: "Heavy Bombs", desc: "Splash +60% and every hit stuns for half a second." },
      ],
    },
    aa: {
      id: "aa", name: "40mm Bofors wz.36 AA", short: "Bofors AA", role: "Blows planes out of the sky",
      cost: 160, range: 250, rate: 2.1, dmg: 24, pen: 0.4, splash: 0, shot: "flak", speed: 1000,
      air: 1, ground: 0.45, hp: 120, turn: 5, crit: 0.06, key: "5", airFirst: true,
      history: "Poland built the Swedish Bofors 40mm under license. It became the most widely used light anti aircraft gun of the war.",
      specs: [
        { id: "burst", name: "Proximity Bursts", desc: "Shells burst near aircraft and splash every plane nearby." },
        { id: "sweep", name: "Ground Sweep", desc: "Full damage against ground targets and +25% range." },
      ],
    },
    f75: {
      id: "f75", name: "75mm wz.1897 Field Gun", short: "75mm", role: "Huge range, huge hits",
      cost: 230, range: 340, rate: 0.32, dmg: 170, pen: 0.9, splash: 40, shot: "shell", speed: 760,
      air: 0, hp: 150, turn: 1.6, crit: 0.08, key: "6", unlock: "f75",
      history: "A French design from 1897 that Poland still fielded in numbers. Crews fired it straight at tanks over open sights.",
      specs: [
        { id: "cb", name: "Counter Battery", desc: "Targets the toughest enemy first and deals x2 to tanks that shoot back." },
        { id: "shrap", name: "Shrapnel", desc: "Splash x2.2 and infantry die in one hit." },
      ],
    },
  };
  BK.GUN_ORDER = ["mg", "atr", "at37", "mortar", "aa", "f75"];
  BK.LEVEL_COST = [0, 0.65, 1.05, 1.5]; // fraction of the gun's price to reach level 2, 3, and the specialization

  // ---------------------------------------------------------------- enemies
  // Shapes are in pixels facing +x. Weak spots use the same local frame.
  const airTargets = () => [
    { id: "air-upper", x0: -5, x1: 5, y0: -19, y1: -10, mult: 1.75, effect: "softspot" },
    { id: "air-lower", x0: -5, x1: 5, y0: 10, y1: 19, mult: 1.75, effect: "softspot" },
  ];
  BK.ENEMIES = {
    inf: {
      id: "inf", name: "Rifleman", hp: 24, speed: 34, armor: 0, reward: 3, leak: 1, r: 7,
      kind: "foot", score: 10,
    },
    officer: {
      id: "officer", name: "Officer", hp: 56, speed: 34, armor: 0, reward: 10, leak: 1, r: 8,
      kind: "foot", score: 40, aura: 70,
      tip: "Officers drive the squad on. Drop one and the squad panics.",
    },
    moto: {
      id: "moto", name: "Motorcycle", hp: 42, speed: 92, armor: 0.05, reward: 5, leak: 1, L: 26, Wd: 16,
      kind: "wheel", score: 20,
      weak: [{ id: "bike-mark", x0: -6, x1: 5, y0: 4, y1: 10, mult: 1.9, effect: "softspot" }],
      tip: "Motorcycles are fast. Crew a gun and aim for the gold target for a bonus hit and brief slowdown.",
    },
    truck: {
      id: "truck", name: "Supply Truck", hp: 125, speed: 44, armor: 0.12, reward: 11, leak: 2, L: 46, Wd: 20,
      kind: "wheel", score: 40,
      weak: [{ id: "fuel", x0: -23, x1: -14, y0: -10, y1: 10, mult: 1, effect: "fuel" }],
      tip: "Hit the red fuel drums and the truck goes up, taking its neighbors with it.",
    },
    armcar: {
      id: "armcar", name: "Armored Car", hp: 112, speed: 70, armor: 0.4, reward: 13, leak: 2, L: 38, Wd: 20,
      kind: "wheel", score: 60,
      weak: [{ id: "tires", x0: -16, x1: 16, y0: -13, y1: -8, mult: 1.5, effect: "tires" }, { id: "tires", x0: -16, x1: 16, y0: 8, y1: 13, mult: 1.5, effect: "tires" }],
      shoots: { range: 135, rate: 5, dmg: 1.6, kind: "mg" },
      tip: "Armored cars rake your nests with MG fire. Shoot the tires to slow them.",
    },
    ltank: {
      id: "ltank", name: "Light Tank", hp: 238, speed: 34, armor: 0.75, reward: 18, leak: 3, L: 46, Wd: 28,
      kind: "track", score: 90,
      weak: [
        { id: "engine", x0: -23, x1: -12, y0: -8, y1: 8, mult: 3, effect: "engine" },
        { id: "tracks", x0: -21, x1: 21, y0: -14, y1: -10, mult: 1.2, effect: "tracks" },
        { id: "tracks", x0: -21, x1: 21, y0: 10, y1: 14, mult: 1.2, effect: "tracks" },
      ],
      tip: "Engine deck at the back takes x3 and ignores armor. Tracks stop it cold.",
    },
    smoke: {
      id: "smoke", name: "Smoke Tank", hp: 265, speed: 34, armor: 0.75, reward: 22, leak: 3, L: 46, Wd: 28,
      kind: "track", score: 110, smoke: true,
      weak: [
        { id: "engine", x0: -23, x1: -12, y0: -8, y1: 8, mult: 3, effect: "engine" },
        { id: "tracks", x0: -21, x1: 21, y0: -14, y1: -10, mult: 1.2, effect: "tracks" },
        { id: "tracks", x0: -21, x1: 21, y0: 10, y1: 14, mult: 1.2, effect: "tracks" },
      ],
      tip: "Pops a smoke screen when hurt. Your guns cannot see into smoke, but you can.",
    },
    htrack: {
      id: "htrack", name: "Half Track", hp: 185, speed: 42, armor: 0.45, reward: 14, leak: 2, L: 54, Wd: 22,
      kind: "half", score: 70, carries: 3,
      weak: [{ id: "crew", x0: -20, x1: 6, y0: -7, y1: 7, mult: 2, effect: "crew" }],
      tip: "The open crew bay takes double damage. Kill it and the riflemen inside bail out.",
    },
    mtank: {
      id: "mtank", name: "Panzer IV", hp: 615, speed: 26, armor: 0.85, reward: 40, leak: 5, L: 60, Wd: 32,
      kind: "track", score: 250,
      weak: [
        { id: "engine", x0: -30, x1: -17, y0: -10, y1: 10, mult: 3, effect: "engine" },
        { id: "tracks", x0: -28, x1: 28, y0: -16, y1: -12, mult: 1.2, effect: "tracks" },
        { id: "tracks", x0: -28, x1: 28, y0: 12, y1: 16, mult: 1.2, effect: "tracks" },
      ],
      shoots: { range: 215, rate: 0.26, dmg: 42, kind: "cannon", splash: 26 },
      tip: "It shells your guns from range. Crew a gun and put one in the engine deck.",
    },
    stuka: {
      id: "stuka", name: "Stuka", hp: 90, speed: 170, armor: 0.1, reward: 20, leak: 0, L: 44, Wd: 56,
      kind: "air", air: true, score: 120, bomb: 70,
      weak: [{ id: "engine", x0: 12, x1: 22, y0: -5, y1: 5, mult: 3, effect: "engine" }, ...airTargets()],
      tip: "Dive bombers go after your guns. The Bofors can reach them; crew it and aim for a gold target.",
    },
    recon: {
      id: "recon", name: "Spotter Plane", hp: 70, speed: 95, armor: 0.05, reward: 26, leak: 0, L: 38, Wd: 54,
      kind: "air", air: true, score: 150, spotter: true,
      weak: [{ id: "engine", x0: 10, x1: 19, y0: -5, y1: 5, mult: 3, effect: "engine" }, ...airTargets()],
      tip: "While it circles, artillery falls on your guns. Gold targets give crewed shots a bonus.",
    },
    // ----- bosses
    command: {
      id: "command", name: "Command Tank", hp: 1100, speed: 24, armor: 0.78, reward: 120, leak: 6, L: 64, Wd: 34,
      kind: "track", boss: true, score: 1000, aura: 130,
      weak: [
        { id: "antenna", x0: -26, x1: 8, y0: -15, y1: 15, mult: 1, effect: "antenna", ring: true },
        { id: "engine", x0: -32, x1: -19, y0: -10, y1: 10, mult: 3, effect: "engine" },
        { id: "tracks", x0: -30, x1: 30, y0: -17, y1: -13, mult: 1.2, effect: "tracks" },
        { id: "tracks", x0: -30, x1: 30, y0: 13, y1: 17, mult: 1.2, effect: "tracks" },
      ],
      tip: "The frame antenna drives the whole column. Hit the frame to cut the radio.",
    },
    leader: {
      id: "leader", name: "Staffel Leader", hp: 820, speed: 175, armor: 0.25, reward: 140, leak: 0, L: 52, Wd: 66,
      kind: "air", air: true, boss: true, score: 1200, bomb: 95, dives: 3,
      weak: [{ id: "engine", x0: 14, x1: 26, y0: -6, y1: 6, mult: 3, effect: "engine" }, ...airTargets()],
      tip: "The leader dives three times. Aim for the gold targets before it gets away.",
    },
    nbfz: {
      id: "nbfz", name: "Neubaufahrzeug", hp: 3600, speed: 19, armor: 0.88, reward: 260, leak: 12, L: 86, Wd: 38,
      kind: "track", boss: true, score: 3000,
      turrets: [
        { x: 6, y: 0, hp: 600, range: 230, rate: 0.3, dmg: 46, kind: "cannon", splash: 28, big: true },
        { x: 26, y: -11, hp: 260, range: 150, rate: 4, dmg: 1.4, kind: "mg" },
        { x: -22, y: 11, hp: 260, range: 150, rate: 4, dmg: 1.4, kind: "mg" },
      ],
      weak: [
        { id: "engine", x0: -43, x1: -30, y0: -11, y1: 11, mult: 3, effect: "engine" },
        { id: "tracks", x0: -40, x1: 40, y0: -19, y1: -15, mult: 1.2, effect: "tracks" },
        { id: "tracks", x0: -40, x1: 40, y0: 15, y1: 19, mult: 1.2, effect: "tracks" },
      ],
      tip: "Three turrets, each one a target. Knock them out and the monster is blind.",
    },
  };

  // ---------------------------------------------------------------- abilities
  BK.ABILITIES = {
    arty: { id: "arty", name: "Artillery", desc: "Five heavy shells on a spot you pick.", charge: 100, key: "Z" },
    fighter: { id: "fighter", name: "P.11 Strafe", desc: "A PZL P.11 fighter strafes a line you draw. Hits planes too.", charge: 140, key: "W", unlock: "fighter" },
    mines: { id: "mines", name: "Mines", desc: "Three anti tank mines on the road.", charge: 90, key: "E", unlock: "mines" },
  };

  // ---------------------------------------------------------------- cards
  // Each card changes the run's modifier table. max limits how many times it can stack.
  const R = { c: "common", r: "rare", e: "epic", l: "legendary" };
  BK.RARITY = {
    common: { w: 62, label: "Common" },
    rare: { w: 27, label: "Rare" },
    epic: { w: 9, label: "Epic" },
    legendary: { w: 2.2, label: "Legendary" },
  };
  BK.CARDS = [
    { id: "drill", name: "Sharper Drill", rarity: R.c, icon: "clock", max: 5, desc: "All guns fire 10% faster.", apply: (g) => (g.mods.rate += 0.1) },
    { id: "hot", name: "Hot Loads", rarity: R.c, icon: "flame", max: 5, desc: "All guns deal 12% more damage.", apply: (g) => (g.mods.dmg += 0.12) },
    { id: "bonds", name: "War Bonds", rarity: R.c, icon: "coin", max: 9, desc: "Take 140 zł right now.", apply: (g) => g.addMoney(140, true) },
    { id: "bags", name: "Extra Sandbags", rarity: R.c, icon: "shield", max: 3, desc: "Guns get 40% more health.", apply: (g) => { g.mods.hp += 0.4; g.towers.forEach((t) => { t.maxHp = g.towerMaxHp(t); t.hp = t.maxHp; }); } },
    { id: "range", name: "Range Cards", rarity: R.c, icon: "target", max: 3, desc: "All guns reach 10% farther.", apply: (g) => (g.mods.range += 0.1) },
    { id: "scav", name: "Scavengers", rarity: R.c, icon: "coin", max: 4, desc: "Kills pay 15% more.", apply: (g) => (g.mods.reward += 0.15) },
    { id: "hosp", name: "Field Hospital", rarity: R.c, icon: "heart", max: 9, desc: "Garrison +4.", apply: (g) => { g.garrison += 4; } },
    { id: "belt", name: "Long Belts", rarity: R.c, icon: "bullets", max: 3, desc: "MG nests deal 30% more damage.", apply: (g) => (g.mods.gun.mg = (g.mods.gun.mg || 0) + 0.3) },
    { id: "apshot", name: "AP Shot", rarity: R.c, icon: "shell", max: 3, desc: "37mm and AT rifles deal 25% more damage.", apply: (g) => { g.mods.gun.at37 = (g.mods.gun.at37 || 0) + 0.25; g.mods.gun.atr = (g.mods.gun.atr || 0) + 0.25; } },
    { id: "tables", name: "Firing Tables", rarity: R.c, icon: "target", max: 3, desc: "Mortar and 75mm splash +25%.", apply: (g) => (g.mods.splash += 0.25) },
    { id: "spot", name: "Sky Watchers", rarity: R.c, icon: "plane", max: 3, desc: "All guns deal 30% more to aircraft.", apply: (g) => (g.mods.air += 0.3) },
    { id: "charge", name: "Radio Net", rarity: R.c, icon: "radio", max: 3, desc: "Abilities charge 25% faster.", apply: (g) => (g.mods.charge += 0.25) },

    { id: "fuelfire", name: "Fuel Fires", rarity: R.r, icon: "flame", max: 1, desc: "Exploding trucks leave burning fuel on the road for 5 seconds.", apply: (g) => (g.mods.fuelFire = true) },
    { id: "rico", name: "Ricochets", rarity: R.r, icon: "bullets", max: 2, desc: "MG kills have a 35% chance to bounce into the next target.", apply: (g) => (g.mods.rico += 0.35) },
    { id: "hunter", name: "Tank Hunters", rarity: R.r, icon: "crosshair", max: 2, desc: "Every gun gets +15% chance to find a weak spot.", apply: (g) => (g.mods.crit += 0.15) },
    { id: "interest", name: "Quartermaster", rarity: R.r, icon: "coin", max: 3, desc: "Interest +5% and its cap +25 zł.", apply: (g) => { g.mods.interest += 0.05; g.mods.interestCap += 25; } },
    { id: "repair", name: "Field Workshop", rarity: R.r, icon: "wrench", max: 1, desc: "Knocked out guns come back after 7 seconds instead of after the wave.", apply: (g) => (g.mods.quickRepair = true) },
    { id: "ambush", name: "Ambush", rarity: R.r, icon: "skull", max: 1, desc: "The first five enemies of each wave take triple damage.", apply: (g) => (g.mods.ambush = 5) },
    { id: "combo", name: "Steady Hands", rarity: R.r, icon: "clock", max: 2, desc: "Combo window +0.8 seconds.", apply: (g) => (g.mods.comboWin += 0.8) },
    { id: "supply", name: "Supply Lines", rarity: R.r, icon: "crate", max: 2, desc: "Supply crates drop 50% more often.", apply: (g) => (g.mods.crateRate += 0.5) },
    { id: "vets", name: "Veteran Crews", rarity: R.r, icon: "star", max: 1, desc: "New guns arrive at level 2.", apply: (g) => (g.mods.vets = true) },
    { id: "eye", name: "Gunner's Eye", rarity: R.r, icon: "crosshair", max: 2, desc: "Crewed guns deal 50% more and weak spots hit even harder.", apply: (g) => (g.mods.manned += 0.5) },
    { id: "shrapnel", name: "Shrapnel Fill", rarity: R.r, icon: "burst", max: 2, desc: "Every explosion is 30% wider.", apply: (g) => (g.mods.blast += 0.3) },
    { id: "luck", name: "Lucky Medal", rarity: R.r, icon: "star", max: 2, desc: "Crates roll better prizes.", apply: (g) => (g.mods.luck += 1) },
    { id: "reroll", name: "Staff Officer", rarity: R.r, icon: "dice", max: 3, desc: "+2 card rerolls.", apply: (g) => (g.rerolls += 2) },

    { id: "cover", name: "Air Cover", rarity: R.e, icon: "plane", max: 1, desc: "A P.11 fighter strafes the road by itself every 22 seconds.", apply: (g) => (g.mods.airCover = true) },
    { id: "chain", name: "Chain Reaction", rarity: R.e, icon: "burst", max: 1, desc: "Anything killed by an explosion explodes too.", apply: (g) => (g.mods.chain = true) },
    { id: "fort", name: "Fortress", rarity: R.e, icon: "shield", max: 1, desc: "Guns repair 4 health a second and never get knocked out by bullets.", apply: (g) => (g.mods.fort = true) },
    { id: "bounty", name: "Bounty", rarity: R.e, icon: "coin", max: 1, desc: "Every 10 combo pays 30 zł.", apply: (g) => (g.mods.bounty = true) },
    { id: "barrage", name: "Heavy Barrage", rarity: R.e, icon: "burst", max: 1, desc: "Artillery fires twice as many shells.", apply: (g) => (g.mods.bigArty = true) },
    { id: "overdrive", name: "Adrenaline", rarity: R.e, icon: "bolt", max: 1, desc: "At 25 combo every gun fires 50% faster until the combo breaks.", apply: (g) => (g.mods.adrenaline = true) },

    { id: "secret", name: "The Secret Round", rarity: R.l, icon: "shell", max: 1, desc: "Every gun ignores half of all armor.", apply: (g) => (g.mods.penAll = 0.5) },
    { id: "last", name: "Last Stand", rarity: R.l, icon: "skull", max: 1, desc: "At 6 garrison or less, guns deal +70% and fire 40% faster.", apply: (g) => (g.mods.lastStand = true) },
    { id: "golden", name: "Golden Hour", rarity: R.l, icon: "coin", max: 1, desc: "Coins and crates are doubled for the rest of the run.", apply: (g) => { g.mods.reward += 1; g.mods.crateRate += 1; } },
    { id: "ace", name: "Ace Crew", rarity: R.l, icon: "star", max: 1, desc: "Every weak spot hit by any gun is a guaranteed crit for x2 more.", apply: (g) => (g.mods.ace = true) },
  ];
  BK.CARD_BY_ID = Object.fromEntries(BK.CARDS.map((c) => [c.id, c]));

  // ---------------------------------------------------------------- supply crate reel
  BK.CRATE = [
    { id: "cash", label: "+120 zł", icon: "coin", w: 30, apply: (g) => g.addMoney(120, true) },
    { id: "cash2", label: "+300 zł", icon: "coin", w: 8, apply: (g) => g.addMoney(300, true) },
    { id: "charge", label: "Artillery ready", icon: "radio", w: 16, apply: (g) => { g.abil.arty.charge = BK.ABILITIES.arty.charge; } },
    { id: "heal", label: "+3 Garrison", icon: "heart", w: 14, apply: (g) => (g.garrison += 3) },
    { id: "rush", label: "Gold Rush 15s", icon: "coin", w: 12, apply: (g) => (g.buffs.rush = 15) },
    { id: "frenzy", label: "Overdrive 12s", icon: "bolt", w: 12, apply: (g) => (g.buffs.frenzy = 12) },
    { id: "upg", label: "Free upgrade", icon: "star", w: 9, apply: (g) => g.freeUpgrade() },
    { id: "jack", label: "JACKPOT", icon: "crown", w: 3, jackpot: true, apply: (g) => { g.addMoney(500, true); g.buffs.frenzy = 15; g.garrison += 2; } },
  ];

  // ---------------------------------------------------------------- maps
  BK.MAPS = [
    {
      id: "frontier", name: "Frontier Road", sub: "Dawn, 1 September", time: "dawn", flip: false,
      blurb: "Long switchbacks. One good gun can cover the road three times.",
      hp: 1, count: 1, money: 260, seed: 11,
      paths: [[[-60, 150], [300, 140], [560, 175], [650, 300], [560, 410], [330, 430], [230, 520], [380, 600], [700, 590], [880, 500], [880, 350], [990, 250], [1180, 250], [1340, 300]]],
    },
    {
      id: "orchard", name: "Orchard Bend", sub: "Noon, near Mokra", time: "noon", flip: true, unlock: "orchard",
      blurb: "A tight opening loop, then a long straight run to the exit.",
      hp: 1.5, count: 1.15, money: 280, seed: 23,
      paths: [[[930, -60], [920, 150], [760, 250], [540, 220], [330, 280], [300, 430], [520, 520], [820, 470], [1000, 560], [1340, 560]]],
    },
    {
      id: "river", name: "River Crossing", sub: "Dusk on the Bzura", time: "dusk", flip: false, unlock: "river",
      blurb: "Two roads meet at the bridgehead. Columns come from both.",
      hp: 1.75, count: 1.3, money: 320, seed: 37,
      paths: [
        [[-60, 330], [250, 320], [470, 250], [700, 300], [820, 420], [1050, 430], [1340, 330]],
        [[620, -60], [640, 120], [560, 210], [700, 300], [820, 420], [1050, 430], [1340, 330]],
      ],
    },
  ];

  // ---------------------------------------------------------------- waves
  // Each entry: kind, count, gap seconds between units, path index (or "air"), and start delay.
  const sq = (n, off, path) => ({ squad: n, officer: off, path: path || 0 });
  BK.WAVES = [
    { name: "Dawn patrol", groups: [{ kind: "inf", n: 6, gap: 0.7 }, { kind: "moto", n: 3, gap: 1.2, at: 6 }] },
    { name: "Outriders", groups: [sq(4, true), { kind: "moto", n: 6, gap: 0.9, at: 4 }, sq(4, false, 0), ], tip: "officer" },
    { name: "Supply column", groups: [{ kind: "truck", n: 4, gap: 2.4 }, sq(5, true), { kind: "moto", n: 4, gap: 0.8, at: 9 }], tip: "truck" },
    { name: "Armored scouts", groups: [{ kind: "armcar", n: 3, gap: 2.2 }, sq(5, true), { kind: "truck", n: 3, gap: 2, at: 8 }, { kind: "moto", n: 5, gap: 0.7, at: 12 }], tip: "armcar" },
    { name: "The command column", boss: "command", groups: [{ kind: "ltank", n: 2, gap: 3 }, { kind: "command", n: 1, at: 5 }, { kind: "ltank", n: 2, gap: 3, at: 9 }, sq(5, true)], tip: "command" },
    { name: "First armor", groups: [{ kind: "ltank", n: 4, gap: 2.6 }, { kind: "htrack", n: 3, gap: 3, at: 4 }, { kind: "truck", n: 3, gap: 1.8, at: 10 }], tip: "htrack" },
    { name: "Engines overhead", groups: [{ kind: "stuka", n: 3, gap: 4, path: "air", at: 4 }, { kind: "armcar", n: 4, gap: 1.8 }, sq(5, true), sq(5, true)], tip: "stuka" },
    { name: "Under the smoke", groups: [{ kind: "recon", n: 1, path: "air", at: 2 }, { kind: "smoke", n: 3, gap: 3.5 }, { kind: "ltank", n: 3, gap: 3, at: 6 }, { kind: "htrack", n: 3, gap: 3, at: 10 }], tip: "smoke" },
    { name: "The heavy fist", groups: [{ kind: "mtank", n: 2, gap: 6 }, { kind: "truck", n: 5, gap: 1.6, at: 3 }, { kind: "moto", n: 8, gap: 0.6, at: 8 }, sq(5, true)], tip: "mtank" },
    { name: "The Staffel", boss: "leader", groups: [{ kind: "leader", n: 1, path: "air", at: 3 }, { kind: "stuka", n: 4, gap: 3, path: "air", at: 6 }, { kind: "ltank", n: 4, gap: 2.5 }, { kind: "armcar", n: 4, gap: 1.5, at: 8 }], tip: "leader" },
    { name: "Noon", groups: [{ kind: "mtank", n: 3, gap: 5 }, { kind: "htrack", n: 4, gap: 2.5, at: 3 }, { kind: "recon", n: 1, path: "air", at: 6 }, { kind: "armcar", n: 6, gap: 1.2, at: 9 }] },
    { name: "The corridor", groups: [{ kind: "smoke", n: 3, gap: 3 }, { kind: "ltank", n: 4, gap: 2.4, at: 3 }, { kind: "stuka", n: 4, gap: 3, path: "air", at: 5 }, { kind: "truck", n: 6, gap: 1.2, at: 9 }, sq(5, true), sq(5, true)] },
    { name: "Stubble and steel", groups: [{ kind: "mtank", n: 4, gap: 4.5 }, { kind: "htrack", n: 6, gap: 2, at: 2 }, { kind: "recon", n: 2, gap: 9, path: "air", at: 4 }, { kind: "moto", n: 10, gap: 0.5, at: 12 }] },
    { name: "Everything they have", groups: [{ kind: "mtank", n: 5, gap: 4 }, { kind: "ltank", n: 6, gap: 2, at: 3 }, { kind: "stuka", n: 6, gap: 2.5, path: "air", at: 4 }, sq(5, true), sq(5, true), { kind: "armcar", n: 4, gap: 1.4, at: 14 }] },
    { name: "The monster", boss: "nbfz", groups: [{ kind: "mtank", n: 2, gap: 4 }, { kind: "nbfz", n: 1, at: 6 }, { kind: "ltank", n: 4, gap: 2.5, at: 10 }, { kind: "stuka", n: 3, gap: 3, path: "air", at: 12 }, { kind: "recon", n: 1, path: "air", at: 16 }, { kind: "htrack", n: 3, gap: 2.5, at: 18 }] },
  ];
  BK.WAVE_COUNT = BK.WAVES.length;

  // Guns reach a little farther now that everything sits wider apart.
  for (const g of Object.values(BK.GUNS)) g.range = Math.round(g.range * 1.12);

  // Units are drawn and hit tested 30% larger than their art coordinates so they read on small screens.
  BK.US = 1.6;
  for (const d of Object.values(BK.ENEMIES)) {
    const S = BK.US;
    if (d.L) d.L *= S;
    if (d.Wd) d.Wd *= S;
    if (d.r) d.r *= S;
    if (d.aura) d.aura *= 1;
    if (d.weak) d.weak = d.weak.map((w) => Object.assign({}, w, { x0: w.x0 * S, x1: w.x1 * S, y0: w.y0 * S, y1: w.y1 * S }));
    if (d.turrets) d.turrets = d.turrets.map((t) => Object.assign({}, t, { x: t.x * S, y: t.y * S }));
  }
  BK.TUNE = { hp: 3, ramp: 0.3, reward: 0.6, count: 0.05, clear: 20, speed: 1.35 };

  // Endless waves past the campaign: a budget spent on a random mix, getting tougher each time.
  BK.endlessWave = function (n, rng) {
    const pool = [["inf", 3], ["moto", 5], ["truck", 11], ["armcar", 13], ["ltank", 18], ["smoke", 22], ["htrack", 14], ["mtank", 40], ["stuka", 20], ["recon", 26]];
    let budget = 260 + n * 46;
    const groups = [];
    let at = 0;
    while (budget > 0) {
      const [kind, cost] = rng.pick(pool);
      const count = Math.max(1, Math.min(8, Math.floor(rng.range(2, 6) * (kind === "inf" ? 2 : 1))));
      groups.push({ kind, n: count, gap: kind === "moto" ? 0.6 : 2, at, path: kind === "stuka" || kind === "recon" ? "air" : undefined });
      budget -= cost * count;
      at += rng.range(2, 5);
    }
    if (n % 5 === 0) groups.push({ kind: rng.pick(["command", "leader", "nbfz"]), n: 1, at: 4, path: undefined });
    return { name: "Endless " + n, groups, endless: true };
  };

  // ---------------------------------------------------------------- unlocks bought with medals
  BK.UNLOCKS = [
    { id: "atr", name: "wz.35 AT Rifle", type: "Gun", cost: 12, desc: "Cheap rifle team whose rounds go through three targets in a line." },
    { id: "orchard", name: "Orchard Bend", type: "Battlefield", cost: 18, desc: "A tighter road at noon. Tougher columns, better pay." },
    { id: "mines", name: "Mines", type: "Ability", cost: 20, desc: "Drop three anti tank mines on the road." },
    { id: "cash1", name: "Pay Chest I", type: "Perk", cost: 10, desc: "Start every run with 60 more zł." },
    { id: "reroll1", name: "Reroll Pass", type: "Perk", cost: 14, desc: "Start every run with one more card reroll." },
    { id: "fighter", name: "P.11 Strafe", type: "Ability", cost: 30, desc: "Call a fighter to strafe a line. It hits planes too." },
    { id: "garrison1", name: "Reserves", type: "Perk", cost: 16, desc: "Start with 4 more garrison." },
    { id: "f75", name: "75mm Field Gun", type: "Gun", cost: 40, desc: "Long range, slow and brutal." },
    { id: "river", name: "River Crossing", type: "Battlefield", cost: 45, desc: "Two roads into one bridgehead, at dusk." },
    { id: "luck1", name: "Quartermaster's Favor", type: "Perk", cost: 28, desc: "Crates roll better and your first card is always rare or better." },
    { id: "cash2", name: "Pay Chest II", type: "Perk", cost: 35, desc: "Start with another 90 zł.", requires: "cash1" },
    { id: "vet", name: "Veteran Start", type: "Perk", cost: 50, desc: "Begin each run with Veteran Crews already in hand." },
  ];
  BK.UNLOCK_BY_ID = Object.fromEntries(BK.UNLOCKS.map((u) => [u.id, u]));
})(typeof window !== "undefined" ? window : globalThis);
