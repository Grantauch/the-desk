// Five more guns for the build bar, each with its own upgrade tree, and their medal unlocks.
// Loaded after content.js. The rules that make the new mechanics work live in game3.js.
(function (root) {
  const BK = root.BK;

  // fx tells the renderer and the sound which existing gun each new one fires like.
  Object.assign(BK.GUNS, {
    rkm: {
      id: "rkm", name: "RKM wz.28 Team", short: "BAR Team", role: "Cheap fast fire on infantry",
      cost: 50, range: 150, rate: 6, dmg: 7, pen: 0.14, splash: 0, shot: "bullet", speed: 1100,
      air: 0.35, hp: 60, turn: 11, crit: 0.04, key: "7", fx: "mg",
      history: "The Polish Browning automatic rifle, built at Warsaw from 1928. Every rifle squad carried one, fed from twenty round box magazines.",
    },
    gran: {
      id: "gran", name: "Granatnik wz.36", short: "Granatnik", role: "Short lob over cover",
      cost: 65, range: 180, minRange: 36, rate: 1, dmg: 27, pen: 0.45, splash: 38, shot: "lob", speed: 0.75,
      air: 0, hp: 70, turn: 8, crit: 0.04, key: "8", fx: "mortar",
      history: "A 46mm light mortar small enough for one man to carry. Each rifle platoon had one to drop bombs into trenches and behind hedges.",
    },
    tks: {
      id: "tks", name: "TKS Tankette", short: "TKS", role: "Armored, moves between waves",
      cost: 150, range: 185, rate: 6, dmg: 9, pen: 0.3, splash: 0, shot: "bullet", speed: 1100,
      air: 0.3, hp: 150, turn: 6, crit: 0.05, key: "9", unlock: "tks", mobile: true, fx: "mg",
      history: "A two man tankette with a hull machine gun. About two dozen were refitted with the 20mm FK cannon, and one of them knocked out several German tanks in a single day.",
    },
    how100: {
      id: "how100", name: "100mm wz.14/19 Howitzer", short: "100mm", role: "Long range, slow, huge splash",
      cost: 260, range: 400, minRange: 120, rate: 0.2, dmg: 120, pen: 0.7, splash: 66, shot: "lob", speed: 1.6,
      air: 0, hp: 130, turn: 1.2, crit: 0.05, key: "0", unlock: "how100", fx: "f75", priority: "strong",
      history: "A Škoda design that Poland bought and then built at home. Divisional artillery fired it from behind hills at targets the crews never saw.",
    },
    obs: {
      id: "obs", name: "Observation Post", short: "Observer", role: "Guns nearby reach farther",
      cost: 90, range: 210, rate: 0, dmg: 0, pen: 0, splash: 0, shot: "none", speed: 1,
      air: 0, hp: 70, turn: 2, crit: 0, key: "t", support: true,
      history: "Artillery observers with trench periscopes and field telephones. They saw the road for the guns and called every shot.",
    },
  });
  BK.GUN_ORDER.push("rkm", "gran", "tks", "how100", "obs");

  BK.UNLOCKS.push(
    { id: "tks", name: "TKS Tankette", type: "Gun", cost: 30, desc: "An armored tankette that moves between waves. One branch carries supplies and repairs." },
    { id: "how100", name: "100mm Howitzer", type: "Gun", cost: 38, desc: "Divisional artillery. The longest reach in the army and a huge blast." }
  );
  BK.UNLOCK_BY_ID = Object.fromEntries(BK.UNLOCKS.map((u) => [u.id, u]));

  // ---------------------------------------------------------------- balance
  // Tuned with the headless bot. Enemy health climbs a little faster each wave (ramp2 in game3.js),
  // the 75mm no longer outshoots everything, and each field has its own toughness.
  BK.GUNS.f75.dmg = 135;
  Object.assign(BK.TUNE, { hp: 3.35, ramp: 0.3, ramp2: 0.04 });
  const MAP_HP = { frontier: 1.45, orchard: 1.85, river: 1.55, mokra: 1.95, mlawa: 2.1, wizna: 2, bzura: 2.1, warsaw: 2.2 };
  for (const m of BK.MAPS) if (MAP_HP[m.id]) m.hp = MAP_HP[m.id];

  // ---------------------------------------------------------------- trees
  // New mods read by game3.js: grenade (seconds between grenade bundles), slowAura, income (zł per
  // wave), aura { r, range, rate, dmg, xp, repair }, mark, callFire (seconds), callShells, chargeBoost.
  const N = (o) => o;
  Object.assign(BK.TREES, {
    rkm: {
      rkm: N({ name: "RKM wz.28 Team", tier: 0, look: { base: "foxhole", w: "rkm" } }),
      mags: N({ parent: "rkm", name: "Spare Magazines", tier: 1, cost: 45, items: { ammo: 1 }, desc: "A second man loads full magazines. Fire rate x1.6.", mods: { rate: 1.6 }, look: { base: "foxhole", w: "rkm", crates: true } }),
      section: N({ parent: "mags", name: "Rifle Section", tier: 2, cost: 90, items: { ammo: 2 }, desc: "The whole section joins in. Infantry in range are pinned and crawl.", mods: { suppress: true, range: 1.12, dmg: 1.2 }, look: { base: "trench", w: "rkmsec" } }),
      storm: N({ parent: "section", name: "Storm Section", tier: 3, cost: 150, items: { explosives: 2 }, desc: "Grenadiers throw a bundle of grenades into the thickest infantry every 5 seconds.", mods: { grenade: 5, dmg: 1.2 }, look: { base: "trench", w: "rkmsec", crates: true, phos: true } }),
      aasec: N({ parent: "section", name: "AA Section", tier: 3, cost: 140, items: { parts: 1, optics: 1 }, desc: "The RKM goes up on an anti aircraft tripod. Full damage on planes, and planes take 60% more.", mods: { air: 1, airDmg: 1.6, range: 1.15 }, look: { base: "trench", w: "rkmaa", sight: true } }),
      scout: N({ parent: "rkm", name: "Scout Team", tier: 1, cost: 50, items: { optics: 1 }, desc: "Binoculars and a good eye. Range +20% and more weak spot hits.", mods: { range: 1.2, crit: 0.1 }, look: { base: "foxhole", w: "rkm", scope: true } }),
      mounted: N({ parent: "scout", name: "Mounted Rifles", tier: 2, cost: 95, items: { maps: 1 }, desc: "Cavalry riflemen with their horses close by. Faster, harder, and they move between waves.", mods: { mobile: true, rate: 1.3, dmg: 1.25 }, look: { base: "horses", w: "rkm" } }),
      screen: N({ parent: "mounted", name: "Cavalry Screen", tier: 3, cost: 150, items: { maps: 1, ammo: 1 }, desc: "Riders harass the column. Ground units in range move at half speed. Bosses ignore it.", mods: { slowAura: true, range: 1.1 }, look: { base: "horses", w: "rkmcav", pennant: true } }),
      ambushl: N({ parent: "mounted", name: "Ambush Line", tier: 3, cost: 140, items: { optics: 1, explosives: 1 }, desc: "Hidden in the brush. Enemies cannot shoot it, it hunts officers first, and its first burst on a target deals triple.", mods: { camo: true, hunt: true, firstShot: 3, dmg: 1.3, mobile: false }, look: { base: "camo", w: "rkm", ghillie: true } }),
    },
    gran: {
      gran: N({ name: "Granatnik wz.36", tier: 0, look: { base: "foxhole", w: "gran" } }),
      quick: N({ parent: "gran", name: "Quick Hands", tier: 1, cost: 55, items: { ammo: 1 }, desc: "A practiced crew. Fire rate x1.5.", mods: { rate: 1.5 }, look: { base: "foxhole", w: "gran", crates: true } }),
      three: N({ parent: "quick", name: "Section of Three", tier: 2, cost: 100, items: { ammo: 1, parts: 1 }, desc: "Three tubes fire together. Three bombs each firing.", mods: { shells: 3 }, look: { base: "trench", w: "gran3" } }),
      gstorm: N({ parent: "three", name: "Grenade Storm", tier: 3, cost: 160, items: { ammo: 2, explosives: 1 }, desc: "Five bombs each firing, and every hit stuns.", mods: { shells: 5, stun: 0.35 }, look: { base: "trench", w: "gran3", crates: true } }),
      firebomb: N({ parent: "three", name: "Fire Bombs", tier: 3, cost: 150, items: { fuel: 2 }, desc: "Incendiary bombs leave the road burning. Damage +25%.", mods: { burnGround: true, dmg: 1.25 }, look: { base: "trench", w: "gran3", phos: true } }),
      longc: N({ parent: "gran", name: "Long Charge", tier: 1, cost: 55, items: { explosives: 1 }, desc: "Extra propellant. Range +35% and a wider blast.", mods: { range: 1.35, splash: 1.2 }, look: { base: "foxhole", w: "gran", bands: true } }),
      hollow: N({ parent: "longc", name: "Hollow Charge", tier: 2, cost: 110, items: { steel: 1, explosives: 1 }, desc: "Shaped charge bombs. Ignore most armor and deal 80% more to tracks.", mods: { pen: 0.95, vsTrack: 1.8, dmg: 1.6 }, look: { base: "foxhole", w: "gran", bands: true, heat: true } }),
      tankamb: N({ parent: "hollow", name: "Tank Ambush", tier: 3, cost: 170, items: { explosives: 2, optics: 1 }, desc: "Under a net beside the road. Every hit on a tank throws a track, and tracks take far more.", mods: { camo: true, autoTrack: true, vsTrack: 2.6 }, look: { base: "camo", w: "gran", heat: true } }),
      demo: N({ parent: "hollow", name: "Demolition Bombs", tier: 3, cost: 160, items: { explosives: 2, parts: 1 }, desc: "Heavy bombs tear craters that bog vehicles down and stun everything near.", mods: { craterShells: true, stun: 0.7, dmg: 1.35 }, look: { base: "deep", w: "gran", heat: true, crates: true } }),
    },
    tks: {
      tks: N({ name: "TKS Tankette", tier: 0, look: { base: "tks" } }),
      fk20: N({ parent: "tks", name: "20mm FK Refit", tier: 1, cost: 110, items: { parts: 1 }, desc: "The hull MG gives way to a 20mm cannon. Real armor piercing at a slower rate.", mods: { shot: "shell", speed: 1000, dmg: 3.6, rate: 0.45, pen: 0.62 }, look: { base: "tks", gun20: true } }),
      ace: N({ parent: "fk20", name: "Scout Ace", tier: 2, cost: 150, items: { optics: 1 }, desc: "A crew with kills to its name. More weak spot hits, range +15% and 40% more health.", mods: { crit: 0.2, range: 1.15, hp: 1.4 }, look: { base: "tks", gun20: true, vet: true } }),
      platoon: N({ parent: "ace", name: "Tankette Platoon", tier: 3, cost: 230, items: { parts: 2, ammo: 1 }, desc: "Two more tankettes join. Double the fire and 30% more health.", mods: { rate: 2, hp: 1.3 }, look: { base: "tks", gun20: true, vet: true, platoon: true } }),
      hulldown: N({ parent: "ace", name: "Hull Down", tier: 3, cost: 210, items: { steel: 2 }, desc: "Dug in up to the turret. Takes 55% less damage, reaches 25% farther and hits harder. It stays put.", mods: { taken: 0.45, range: 1.25, dmg: 1.3, mobile: false }, look: { base: "tksdug", gun20: true, vet: true } }),
      runs: N({ parent: "tks", name: "Supply Runs", tier: 1, cost: 90, items: { fuel: 1 }, desc: "Tows an ammunition trailer between positions. Pays 35 zł after every wave.", mods: { income: 35 }, look: { base: "tks", trailer: true } }),
      carrier: N({ parent: "runs", name: "Ammo Carrier", tier: 2, cost: 130, items: { parts: 1, ammo: 1 }, desc: "Keeps the guns around it fed. Guns nearby fire 12% faster. Pays 50 zł a wave.", mods: { income: 50, aura: { r: 170, rate: 1.12 } }, look: { base: "tks", trailer: true, crates: true } }),
      column: N({ parent: "carrier", name: "Supply Column", tier: 3, cost: 180, items: { fuel: 2, parts: 1 }, desc: "A whole supply train behind it. Pays 110 zł a wave and keeps feeding the guns nearby.", mods: { income: 110, aura: { r: 190, rate: 1.15 } }, look: { base: "tks", trailer: true, crates: true, column: true } }),
      repair: N({ parent: "carrier", name: "Repair Crew", tier: 3, cost: 190, items: { parts: 2, steel: 1 }, desc: "Mechanics with tools and spares. Guns nearby repair 8 health a second and come back from a knockout in 6 seconds.", mods: { income: 50, aura: { r: 190, rate: 1.12, repair: 8 } }, look: { base: "tks", trailer: true, tools: true } }),
    },
    how100: {
      how100: N({ name: "100mm wz.14/19", tier: 0, look: { base: "gunpit", w: "how100" } }),
      plan: N({ parent: "how100", name: "Fire Plan", tier: 1, cost: 150, items: { maps: 1 }, desc: "Ranges worked out in advance. Fire rate x1.3.", mods: { rate: 1.3 }, look: { base: "gunpit", w: "how100", crates: true } }),
      pair: N({ parent: "plan", name: "Battery of Two", tier: 2, cost: 230, items: { ammo: 2 }, desc: "A second howitzer joins. Two shells each firing.", mods: { shells: 2 }, look: { base: "battery", w: "how100x2" } }),
      massed: N({ parent: "pair", name: "Massed Fire", tier: 3, cost: 320, items: { ammo: 2, parts: 1 }, desc: "The whole battery fires as one. Four shells each firing.", mods: { shells: 4, splash: 1.1 }, look: { base: "battery", w: "how100x4", crates: true } }),
      shrapb: N({ parent: "pair", name: "Shrapnel Battery", tier: 3, cost: 290, items: { explosives: 1, ammo: 1 }, desc: "Air burst shells. Soldiers die in one hit, the blast is 40% wider and it stuns.", mods: { footKill: true, splash: 1.4, stun: 0.6 }, look: { base: "battery", w: "how100x2", bands: true } }),
      heavy: N({ parent: "how100", name: "Heavy Shell", tier: 1, cost: 150, items: { explosives: 1 }, desc: "A heavier filling. Damage +40% and a wider blast.", mods: { dmg: 1.4, splash: 1.15 }, look: { base: "gunpit", w: "how100", bands: true } }),
      sound: N({ parent: "heavy", name: "Sound Ranging", tier: 2, cost: 210, items: { radio: 1, optics: 1 }, desc: "Microphones find the enemy guns. Range +30% and it goes for the toughest target.", mods: { range: 1.3, priority: "strong" }, look: { base: "gunpit", w: "how100", radio: true, sight: true } }),
      breaker: N({ parent: "sound", name: "Fortress Breaker", tier: 3, cost: 300, items: { explosives: 2, steel: 1 }, desc: "Shells that dig craters, stun everything nearby and hit 60% harder.", mods: { dmg: 1.6, craterShells: true, stun: 1 }, look: { base: "deep", w: "how100heavy" } }),
      corps: N({ parent: "sound", name: "Corps Battery", tier: 3, cost: 290, items: { radio: 1, maps: 1 }, desc: "Tied into the corps fire net. Reaches across the map and fires 25% faster.", mods: { range: 1.6, rate: 1.25 }, look: { base: "gunpit", w: "how100long", radio: true } }),
    },
    obs: {
      obs: N({ name: "Observation Post", tier: 0, mods: { aura: { r: 210, range: 1.1 } }, look: { base: "obspost", w: "scope" } }),
      phone: N({ parent: "obs", name: "Field Telephone", tier: 1, cost: 70, items: { radio: 1 }, desc: "A wire to every gun. The post reaches 25% farther and guns nearby fire 8% faster.", mods: { aura: { r: 262, range: 1.1, rate: 1.08 } }, look: { base: "obspost", w: "scope", radio: true } }),
      otower: N({ parent: "phone", name: "Observation Tower", tier: 2, cost: 120, items: { parts: 1, optics: 1 }, desc: "A timber tower above the trees. Guns nearby reach 18% farther.", mods: { aura: { r: 300, range: 1.18, rate: 1.08 } }, look: { base: "obstower", w: "scope" } }),
      balloon: N({ parent: "otower", name: "Balloon Post", tier: 3, cost: 180, items: { parts: 2, radio: 1 }, desc: "A tethered balloon sees the whole field. The post covers a huge circle.", mods: { aura: { r: 470, range: 1.18, rate: 1.1 } }, look: { base: "balloon", w: "scope" } }),
      fdc: N({ parent: "otower", name: "Fire Direction Center", tier: 3, cost: 190, items: { radio: 2, maps: 1 }, desc: "Plots every target on one map. Guns nearby deal 12% more and abilities charge 50% faster.", mods: { aura: { r: 320, range: 1.2, rate: 1.1, dmg: 1.12 }, chargeBoost: 0.5 }, look: { base: "obstower", w: "scope", radio: true, maptable: true } }),
      flares: N({ parent: "obs", name: "Marking Flares", tier: 1, cost: 65, items: { ammo: 1 }, desc: "Flares mark the column. Enemies near the post take 15% more damage from everything.", mods: { mark: 1.15 }, look: { base: "obspost", w: "flare" } }),
      rpost: N({ parent: "flares", name: "Radio Post", tier: 2, cost: 120, items: { radio: 1 }, desc: "Calls a battery on the radio. A heavy shell lands on the toughest enemy near the post every 9 seconds.", mods: { mark: 1.15, callFire: 9 }, look: { base: "obspost", w: "flare", radio: true } }),
      fo: N({ parent: "rpost", name: "Forward Observer", tier: 3, cost: 180, items: { radio: 1, maps: 1, optics: 1 }, desc: "A whole battery on call. Two heavy shells every 4 seconds.", mods: { mark: 1.2, callFire: 4, callShells: 2 }, look: { base: "obspost", w: "flare", radio: true, sight: true } }),
      liaison: N({ parent: "rpost", name: "Liaison Officer", tier: 3, cost: 170, items: { maps: 2 }, desc: "A staff officer who knows every crew. Guns nearby earn experience 75% faster and deal 10% more.", mods: { mark: 1.15, callFire: 9, aura: { r: 260, xp: 1.75, dmg: 1.1 } }, look: { base: "tent", w: "officer" } }),
    },
  });
  for (const gun of ["rkm", "gran", "tks", "how100", "obs"]) {
    const tree = BK.TREES[gun];
    for (const [id, n] of Object.entries(tree)) { n.id = id; n.gun = gun; n.mods = n.mods || {}; n.items = n.items || {}; }
    for (const n of Object.values(tree)) n.next = Object.values(tree).filter((m) => m.parent === n.id).map((m) => m.id);
  }
})(typeof window !== "undefined" ? window : globalThis);
