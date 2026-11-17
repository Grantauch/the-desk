(() => {
  // icons.tsx
  function Icon({ children, ...props }) {
    return /* @__PURE__ */ React.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        width: "24",
        height: "24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        ...props
      },
      children
    );
  }
  function Coins(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "6" }), /* @__PURE__ */ React.createElement("path", { d: "M18.09 10.37A6 6 0 1 1 10.34 18" }), /* @__PURE__ */ React.createElement("path", { d: "M7 6h1v4" }), /* @__PURE__ */ React.createElement("path", { d: "m16.71 13.88.7.71-2.82 2.82" }));
  }
  function Crosshair(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "22", x2: "18", y1: "12", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "6", x2: "2", y1: "12", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "12", x2: "12", y1: "6", y2: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "12", x2: "12", y1: "22", y2: "18" }));
  }
  function Heart(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" }));
  }
  function Pause(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("rect", { x: "14", y: "4", width: "4", height: "16", rx: "1" }), /* @__PURE__ */ React.createElement("rect", { x: "6", y: "4", width: "4", height: "16", rx: "1" }));
  }
  function Play(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("polygon", { points: "6 3 20 12 6 21 6 3" }));
  }
  function RotateCcw(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }), /* @__PURE__ */ React.createElement("path", { d: "M3 3v5h5" }));
  }
  function Volume2(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("path", { d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" }), /* @__PURE__ */ React.createElement("path", { d: "M16 9a5 5 0 0 1 0 6" }), /* @__PURE__ */ React.createElement("path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728" }));
  }
  function VolumeX(props) {
    return /* @__PURE__ */ React.createElement(Icon, { ...props }, /* @__PURE__ */ React.createElement("path", { d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" }), /* @__PURE__ */ React.createElement("line", { x1: "22", x2: "16", y1: "9", y2: "15" }), /* @__PURE__ */ React.createElement("line", { x1: "16", x2: "22", y1: "9", y2: "15" }));
  }

  // game/data.ts
  var COLS = 16;
  var ROWS = 10;
  var CELL = 78;
  var WORLD_W = COLS * CELL;
  var WORLD_H = ROWS * CELL;
  var START_GOLD = 220;
  var START_LIVES = 22;
  var SELL_RATE = 0.6;
  var MANUAL_BONUS = 1.25;
  var DMG_MULT = [1, 1.4, 1.85, 2.45];
  var RATE_MULT = [1, 1.3, 1.65, 2.05];
  var TOWERS = {
    ckm: {
      kind: "ckm",
      name: "CKM nest",
      short: "Nest",
      blurb: "Fast fire. Melts infantry. Armor shrugs it off.",
      cost: 75,
      range: 168,
      minRange: 0,
      damage: 8,
      rate: 6.2,
      vsArmor: 0.2,
      splash: 0,
      shotSpeed: 760,
      tone: "Rapid · light"
    },
    at: {
      kind: "at",
      name: "37mm anti-tank",
      short: "37mm",
      blurb: "The answer to tanks. Slow, heavy, single shots.",
      cost: 150,
      range: 230,
      minRange: 0,
      damage: 46,
      rate: 0.68,
      vsArmor: 1.55,
      splash: 0,
      shotSpeed: 540,
      tone: "Slow · armor-piercing"
    },
    mortar: {
      kind: "mortar",
      name: "81mm mortar",
      short: "Mortar",
      blurb: "Arcing blast with a minimum range. Slows a patch of road.",
      cost: 165,
      range: 300,
      minRange: 92,
      damage: 38,
      rate: 0.5,
      vsArmor: 0.82,
      splash: 64,
      shotSpeed: 0,
      tone: "Lobbed · splash"
    },
    aa: {
      kind: "aa",
      name: "Bofors 40mm",
      short: "Bofors",
      blurb: "The only gun that can touch aircraft. Honest against trucks.",
      cost: 190,
      range: 280,
      minRange: 0,
      damage: 22,
      rate: 2.6,
      vsArmor: 0.62,
      splash: 0,
      shotSpeed: 700,
      tone: "Long · anti-air"
    }
  };
  var TOWER_ORDER = ["ckm", "at", "mortar", "aa"];
  var ENEMIES = {
    infantry: {
      kind: "infantry",
      name: "Infantry",
      hp: 48,
      speed: 48,
      gold: 5,
      leak: 1,
      armor: 0,
      air: false,
      art: "enemy-infantry",
      draw: 74
    },
    recon: {
      kind: "recon",
      name: "Motorcycle",
      hp: 34,
      speed: 92,
      gold: 6,
      leak: 1,
      armor: 0,
      air: false,
      art: "enemy-recon",
      draw: 68
    },
    truck: {
      kind: "truck",
      name: "Truck",
      hp: 125,
      speed: 42,
      gold: 9,
      leak: 2,
      armor: 0.12,
      air: false,
      art: "enemy-truck",
      draw: 82
    },
    panzer: {
      kind: "panzer",
      name: "Light tank",
      hp: 300,
      speed: 36,
      gold: 14,
      leak: 3,
      armor: 0.88,
      air: false,
      art: "enemy-panzer",
      draw: 80
    },
    halftrack: {
      kind: "halftrack",
      name: "Half-track",
      hp: 165,
      speed: 44,
      gold: 12,
      leak: 2,
      armor: 0.45,
      air: false,
      art: "enemy-halftrack",
      draw: 84
    },
    armored: {
      kind: "armored",
      name: "Armored car",
      hp: 140,
      speed: 50,
      gold: 13,
      leak: 2,
      armor: 0.55,
      air: false,
      art: "enemy-armored",
      draw: 74
    },
    heavy: {
      kind: "heavy",
      name: "Heavy tank",
      hp: 980,
      speed: 28,
      gold: 30,
      leak: 5,
      armor: 1,
      air: false,
      art: "enemy-heavy",
      draw: 102
    },
    bomber: {
      kind: "bomber",
      name: "Dive bomber",
      hp: 110,
      speed: 82,
      gold: 12,
      leak: 2,
      armor: 0,
      air: true,
      art: "enemy-bomber",
      draw: 92
    }
  };
  var WAVES = [
    {
      name: "Dawn patrol",
      hint: "Infantry on the road. A machine-gun nest will hold.",
      groups: [{ kind: "infantry", n: 8, every: 0.85 }]
    },
    {
      name: "Outriders",
      hint: "Motorcycles slip past a gun that is looking the wrong way.",
      groups: [
        { kind: "infantry", n: 8, every: 0.7 },
        { kind: "recon", n: 5, every: 1.05 }
      ]
    },
    {
      name: "Supply column",
      hint: "Trucks. A mortar on the bend earns its iron.",
      groups: [
        { kind: "truck", n: 6, every: 1.25 },
        { kind: "infantry", n: 8, every: 0.5 }
      ]
    },
    {
      name: "First armor",
      hint: "Light tanks ignore rifle-caliber fire. Use the 37mm.",
      groups: [
        { kind: "panzer", n: 4, every: 1.7 },
        { kind: "infantry", n: 10, every: 0.48 },
        { kind: "recon", n: 3, every: 0.85 }
      ]
    },
    {
      name: "Combined column",
      hint: "Armor and carriers together. Cover the second bend.",
      groups: [
        { kind: "truck", n: 4, every: 1.1 },
        { kind: "panzer", n: 5, every: 1.45 },
        { kind: "halftrack", n: 3, every: 1.3 },
        { kind: "infantry", n: 8, every: 0.42 }
      ]
    },
    {
      name: "Engines overhead",
      hint: "Dive bombers. Only the Bofors can touch them.",
      groups: [
        { kind: "bomber", n: 5, every: 1.55 },
        { kind: "infantry", n: 8, every: 0.48 },
        { kind: "recon", n: 4, every: 0.7 }
      ]
    },
    {
      name: "The corridor",
      hint: "They come thick. Man the gun that is about to leak.",
      groups: [
        { kind: "panzer", n: 5, every: 1.25 },
        { kind: "halftrack", n: 4, every: 1 },
        { kind: "truck", n: 4, every: 0.95 },
        { kind: "infantry", n: 10, every: 0.36 }
      ]
    },
    {
      name: "Armored spear",
      hint: "Faster hulls, and aircraft again. Keep a Bofors crewed.",
      groups: [
        { kind: "armored", n: 6, every: 0.95 },
        { kind: "panzer", n: 4, every: 1.2 },
        { kind: "bomber", n: 4, every: 1.7 },
        { kind: "recon", n: 5, every: 0.45 }
      ]
    },
    {
      name: "Stubble and steel",
      hint: "The first heavy tanks. Ordnance upgrades matter.",
      groups: [
        { kind: "heavy", n: 2, every: 2.6 },
        { kind: "panzer", n: 6, every: 0.85 },
        { kind: "bomber", n: 4, every: 1.2 },
        { kind: "halftrack", n: 5, every: 0.75 }
      ]
    },
    {
      name: "Noon",
      hint: "The longest column of the day.",
      groups: [
        { kind: "heavy", n: 3, every: 2.2 },
        { kind: "panzer", n: 7, every: 0.75 },
        { kind: "armored", n: 5, every: 0.7 },
        { kind: "bomber", n: 5, every: 1.05 },
        { kind: "infantry", n: 12, every: 0.28 }
      ]
    },
    {
      name: "The bend",
      hint: "Man a critical gun. Do not let the heavies through.",
      groups: [
        { kind: "heavy", n: 4, every: 1.8 },
        { kind: "panzer", n: 6, every: 0.8 },
        { kind: "halftrack", n: 6, every: 0.6 },
        { kind: "bomber", n: 5, every: 1.05 }
      ]
    },
    {
      name: "Until night",
      hint: "Last light. Hold this road.",
      groups: [
        { kind: "heavy", n: 4, every: 1.6 },
        { kind: "panzer", n: 7, every: 0.7 },
        { kind: "bomber", n: 6, every: 0.9 },
        { kind: "armored", n: 5, every: 0.65 },
        { kind: "halftrack", n: 5, every: 0.6 },
        { kind: "infantry", n: 14, every: 0.26 }
      ]
    }
  ];
  var PATH_CELLS = [
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 2],
    [9, 2],
    [10, 2],
    [10, 3],
    [10, 4],
    [10, 5],
    [9, 5],
    [8, 5],
    [7, 5],
    [6, 5],
    [5, 5],
    [4, 5],
    [3, 5],
    [3, 6],
    [4, 6],
    [5, 6],
    [6, 6],
    [7, 6],
    [8, 6],
    [9, 6],
    [10, 6],
    [11, 6],
    [12, 6],
    [13, 6],
    [13, 5],
    [13, 4],
    [14, 4],
    [15, 4]
  ];
  var PROPS = [
    { c: 1, r: 0, kind: "tree" },
    { c: 4, r: 0, kind: "pine" },
    { c: 7, r: 0, kind: "hay" },
    { c: 12, r: 1, kind: "pine" },
    { c: 14, r: 1, kind: "tree" },
    { c: 2, r: 4, kind: "tree" },
    { c: 6, r: 3, kind: "pine" },
    { c: 8, r: 4, kind: "hay" },
    { c: 0, r: 5, kind: "pine" },
    { c: 5, r: 7, kind: "tree" },
    { c: 8, r: 7, kind: "hay" },
    { c: 11, r: 7, kind: "pine" },
    { c: 15, r: 2, kind: "sand" },
    { c: 14, r: 6, kind: "tree" },
    { c: 1, r: 7, kind: "hay" },
    { c: 15, r: 6, kind: "sand" },
    { c: 6, r: 7, kind: "pine" },
    { c: 11, r: 1, kind: "tree" }
  ];
  function cellKey(c, r) {
    return c + r * COLS;
  }
  var PATH_SET = new Set(
    PATH_CELLS.map(([c, r]) => cellKey(c, r))
  );
  var BLOCK_SET = /* @__PURE__ */ new Set([
    ...Array.from({ length: COLS }, (_, c) => cellKey(c, 8)),
    ...Array.from({ length: COLS }, (_, c) => cellKey(c, 9)),
    ...PROPS.map((p) => cellKey(p.c, p.r))
  ]);
  var WAYPOINTS = PATH_CELLS.map(([c, r]) => ({
    x: (c + 0.5) * CELL,
    y: (r + 0.5) * CELL
  }));
  function upgradeCost(kind, track, rank) {
    const base = track === "dmg" ? [55, 95, 150] : [45, 80, 130];
    const scale = kind === "ckm" ? 0.75 : kind === "at" ? 1 : kind === "mortar" ? 1.05 : 1.15;
    const row = base[rank];
    if (row === void 0) return 0;
    return Math.round(row * scale);
  }
  function towerDamage(kind, dmgRank) {
    return TOWERS[kind].damage * (DMG_MULT[dmgRank] ?? 1);
  }
  function towerRate(kind, rateRank) {
    return TOWERS[kind].rate * (RATE_MULT[rateRank] ?? 1);
  }
  function assertMap() {
    for (const p of PROPS) {
      if (PATH_SET.has(cellKey(p.c, p.r))) {
        throw new Error(`prop on path ${p.c},${p.r}`);
      }
      if (p.r >= 8) throw new Error(`prop in water ${p.c},${p.r}`);
    }
    for (const [c, r] of PATH_CELLS) {
      if (BLOCK_SET.has(cellKey(c, r))) throw new Error(`path blocked ${c},${r}`);
    }
  }
  assertMap();
  function buildSchedule(wave) {
    const out = [];
    let start = 0.6;
    for (const group of wave.groups) {
      for (let i = 0; i < group.n; i++) {
        out.push({ t: start + i * group.every, kind: group.kind });
      }
      start += 1.35;
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  var ART_URLS = {
    terrain: "./game/terrain.jpg",
    "tower-ckm": "./game/tower-ckm.png",
    "tower-at": "./game/tower-at.png",
    "tower-mortar": "./game/tower-mortar.png",
    "tower-aa": "./game/tower-aa.png",
    "enemy-infantry": "./game/enemy-infantry.png",
    "enemy-recon": "./game/enemy-recon.png",
    "enemy-truck": "./game/enemy-truck.png",
    "enemy-panzer": "./game/enemy-panzer.png",
    "enemy-halftrack": "./game/enemy-halftrack.png",
    "enemy-armored": "./game/enemy-armored.png",
    "enemy-heavy": "./game/enemy-heavy.png",
    "enemy-bomber": "./game/enemy-bomber.png",
    "shot-ckm": "./game/shot-mg.png",
    "shot-at": "./game/shot-shell.png",
    "shot-mortar": "./game/shot-bomb.png",
    "shot-aa": "./game/shot-aa.png",
    "fx-0": "./game/fx-1.png",
    "fx-1": "./game/fx-2.png",
    "fx-2": "./game/fx-3.png",
    "fx-3": "./game/fx-4.png",
    "prop-tree": "./game/prop-tree.png",
    "prop-pine": "./game/prop-pine.png",
    "prop-hay": "./game/prop-hay.png",
    "prop-sand": "./game/prop-sand.png"
  };

  // game/draw.ts
  var CREAM = "#f4ead7";
  var CRIMSON = "#c8102e";
  var BRASS = "#d4a017";
  var INK = "#14110e";
  function paint(game, ctx) {
    const { cssW, cssH, dpr, camX, camY, camZoom } = game;
    const viewW = WORLD_W / camZoom;
    const viewH = WORLD_H / camZoom;
    const scale = Math.min(cssW / viewW, cssH / viewH);
    const ox = (cssW - viewW * scale) / 2;
    const oy = (cssH - viewH * scale) / 2;
    const shake = game.reduce ? 0 : Math.sin(performance.now() * 0.05) * game.shake;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(ox + shake, oy);
    ctx.scale(scale, scale);
    ctx.translate(-(camX - viewW / 2), -(camY - viewH / 2));
    const terrain = game.images.get("terrain");
    if (terrain) ctx.drawImage(terrain, 0, 0, WORLD_W, WORLD_H);
    else {
      ctx.fillStyle = "#6a6238";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    ctx.fillStyle = "rgba(20, 16, 12, 0.12)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    drawRoad(ctx);
    drawProps(game, ctx);
    if (game.armed && game.phase !== "briefing") drawBuildGrid(game, ctx);
    const manned = game.towers.find((t) => t.id === game.mannedId);
    const selected = game.towers.find((t) => t.id === game.selectedId);
    if (game.armed && game.hover && game.phase !== "briefing" && game.phase !== "victory" && game.phase !== "defeat") {
      drawRange(ctx, (game.hover.c + 0.5) * CELL, (game.hover.r + 0.5) * CELL, TOWERS[game.armed].range, TOWERS[game.armed].minRange, true);
      drawSprite(ctx, game, `tower-${game.armed}`, (game.hover.c + 0.5) * CELL, (game.hover.r + 0.5) * CELL, CELL * 1.05, -Math.PI / 2, game.canBuild(game.hover.c, game.hover.r) ? 0.75 : 0.35);
    }
    if (selected) {
      drawRange(ctx, selected.x, selected.y, TOWERS[selected.kind].range, TOWERS[selected.kind].minRange, false);
    }
    const layers = [];
    for (const e of game.creeps) {
      const visual = creepVisual(e);
      layers.push({ y: visual.y, draw: () => drawCreep(game, ctx, e) });
    }
    for (const t of game.towers) {
      layers.push({ y: t.y, draw: () => drawTower(game, ctx, t) });
    }
    layers.sort((a, b) => a.y - b.y);
    for (const layer of layers) layer.draw();
    for (const shot of game.shots) drawShot(game, ctx, shot);
    for (const boom of game.booms) drawBoom(game, ctx, boom);
    drawParticles(game, ctx);
    drawFloaters(ctx, game);
    if (manned) {
      const def = TOWERS[manned.kind];
      const dist = Math.hypot(game.aim.x - manned.x, game.aim.y - manned.y);
      const ok = dist <= def.range && dist >= def.minRange;
      ctx.save();
      ctx.translate(game.aim.x, game.aim.y);
      ctx.strokeStyle = ok ? BRASS : CRIMSON;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.moveTo(-18, 0);
      ctx.lineTo(-6, 0);
      ctx.moveTo(6, 0);
      ctx.lineTo(18, 0);
      ctx.moveTo(0, -18);
      ctx.lineTo(0, -6);
      ctx.moveTo(0, 6);
      ctx.lineTo(0, 18);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(200, 16, 46, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(manned.x, manned.y, 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (game.flash > 0 && game.phase !== "briefing") {
      ctx.fillStyle = `rgba(200, 16, 46, ${Math.min(0.35, game.flash * 0.28)})`;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (manned) {
      const g = ctx.createRadialGradient(cssW / 2, cssH / 2, cssW * 0.2, cssW / 2, cssH / 2, cssW * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(12, 8, 6, 0.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }
  }
  function drawRoad(ctx) {
    if (WAYPOINTS.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#5a4328";
    ctx.lineWidth = CELL * 0.78;
    strokePath(ctx);
    ctx.strokeStyle = "#b08958";
    ctx.lineWidth = CELL * 0.56;
    strokePath(ctx);
    ctx.strokeStyle = "rgba(90, 67, 40, 0.35)";
    ctx.lineWidth = CELL * 0.08;
    strokePath(ctx);
    ctx.fillStyle = "rgba(36, 24, 14, 0.55)";
    for (let i = 2; i < WAYPOINTS.length - 1; i += 3) {
      const a = WAYPOINTS[i - 1];
      const b = WAYPOINTS[i];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-6, -6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const start = WAYPOINTS[0];
    const end = WAYPOINTS[WAYPOINTS.length - 1];
    drawBanner(ctx, end.x + 8, end.y - 8);
    ctx.fillStyle = "rgba(20, 16, 12, 0.72)";
    ctx.beginPath();
    ctx.arc(start.x - 8, start.y, 7, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, start.x, start.y - 28, "BORDER");
    label(ctx, end.x, end.y + 36, "HOLD");
  }
  function strokePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i++) ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    ctx.stroke();
  }
  function drawBanner(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#2a241c";
    ctx.fillRect(-2, -4, 4, 34);
    ctx.fillStyle = CREAM;
    ctx.fillRect(2, -30, 22, 11);
    ctx.fillStyle = CRIMSON;
    ctx.fillRect(2, -19, 22, 11);
    ctx.restore();
  }
  function label(ctx, x, y, text) {
    ctx.save();
    ctx.font = "600 13px Barlow Condensed, sans-serif";
    ctx.fillStyle = "rgba(244, 234, 215, 0.88)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function drawProps(game, ctx) {
    for (const prop of PROPS) {
      const x = (prop.c + 0.5) * CELL;
      const y = (prop.r + 0.5) * CELL;
      shadow(ctx, x, y + 10, 26, 8);
      drawSprite(ctx, game, `prop-${prop.kind}`, x, y, prop.kind === "sand" ? 78 : 108, -Math.PI / 2, 1);
    }
  }
  function drawBuildGrid(game, ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ok = game.canBuild(c, r);
        ctx.fillStyle = ok ? "rgba(212, 160, 23, 0.13)" : "rgba(200, 16, 46, 0.08)";
        ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
      }
    }
  }
  function drawRange(ctx, x, y, range, minRange, ghost) {
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fillStyle = ghost ? "rgba(212, 160, 23, 0.1)" : "rgba(212, 160, 23, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212, 160, 23, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (minRange > 0) {
      ctx.beginPath();
      ctx.arc(x, y, minRange, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(200, 16, 46, 0.7)";
      ctx.stroke();
    }
  }
  function drawTower(game, ctx, tower) {
    shadow(ctx, tower.x, tower.y + 12, 24, 9);
    drawSprite(ctx, game, `tower-${tower.kind}`, tower.x, tower.y, CELL * 1.12, tower.angle, 1);
    if (tower.id === game.selectedId) {
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 2;
      ctx.strokeRect(tower.x - CELL * 0.42, tower.y - CELL * 0.42, CELL * 0.84, CELL * 0.84);
    }
    const pips = tower.dmgRank + tower.rateRank;
    if (pips > 0) {
      ctx.fillStyle = BRASS;
      for (let i = 0; i < pips; i++) {
        ctx.fillRect(tower.x - 12 + i * 5, tower.y + 30, 3, 3);
      }
    }
  }
  function drawCreep(game, ctx, e) {
    const def = ENEMIES[e.kind];
    const visual = creepVisual(e);
    if (def.air) {
      ctx.fillStyle = "rgba(20, 16, 12, 0.28)";
      ctx.beginPath();
      ctx.ellipse(visual.shadowX, visual.shadowY, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      shadow(ctx, visual.x, visual.y + 8, def.draw * 0.22, 7);
    }
    if (e.flash > 0) ctx.globalAlpha = 0.65;
    drawSprite(ctx, game, def.art, visual.x, visual.y, def.draw, e.angle, 1);
    ctx.globalAlpha = 1;
    const bw = 28;
    const bh = 4;
    const bx = visual.x - bw / 2;
    const by = visual.y - def.draw * 0.48;
    ctx.fillStyle = "rgba(20,16,12,0.7)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = e.hp / e.maxHp > 0.45 ? BRASS : CRIMSON;
    ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    if (e.slow > 0) {
      ctx.fillStyle = CREAM;
      ctx.fillRect(bx, by + 5, bw * 0.45, 2);
    }
  }
  function creepVisual(e) {
    const px = -Math.sin(e.angle) * e.lane;
    const py = Math.cos(e.angle) * e.lane;
    const air = ENEMIES[e.kind].air;
    return {
      x: e.x + px,
      y: e.y + py - (air ? 34 : 0),
      shadowX: e.x + px,
      shadowY: e.y + py
    };
  }
  function drawShot(game, ctx, shot) {
    if (shot.mortar) {
      const t = Math.min(1, shot.age / Math.max(0.01, shot.duration));
      const lift = Math.sin(t * Math.PI) * 78;
      ctx.fillStyle = "rgba(20,16,12,0.3)";
      ctx.beginPath();
      ctx.ellipse(shot.x, shot.y, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      const ang2 = Math.atan2(shot.ty - shot.sy, shot.tx - shot.sx);
      drawSprite(ctx, game, "shot-mortar", shot.x, shot.y - lift, 42, ang2, 1);
      return;
    }
    const ang = Math.atan2(shot.vy, shot.vx);
    const size = shot.kind === "ckm" ? 46 : shot.kind === "aa" ? 40 : 36;
    drawSprite(ctx, game, `shot-${shot.kind}`, shot.x, shot.y, size, ang, 1);
  }
  function drawBoom(game, ctx, boom) {
    const frame = Math.min(3, Math.floor(boom.age / boom.life * 4));
    const img = game.images.get(`fx-${frame}`);
    const size = 86 * boom.scale;
    if (!img) {
      ctx.fillStyle = BRASS;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.drawImage(img, boom.x - size / 2, boom.y - size / 2, size, size);
  }
  function drawParticles(game, ctx) {
    for (const p of game.particles) {
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.tone === "brass" ? BRASS : p.tone === "cream" ? CREAM : CRIMSON;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  function drawFloaters(ctx, game) {
    ctx.save();
    ctx.font = "700 16px Barlow Condensed, sans-serif";
    ctx.textAlign = "center";
    for (const f of game.floaters) {
      const alpha = 1 - f.age / f.life;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = f.tone === "accent" ? BRASS : f.tone === "primary" ? CRIMSON : CREAM;
      ctx.fillText(f.text, f.x, f.y - f.age * 28);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function drawSprite(ctx, game, key, x, y, size, angle, alpha) {
    const img = game.images.get(key);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.globalAlpha = alpha;
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = BRASS;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function shadow(ctx, x, y, rx, ry) {
    ctx.fillStyle = "rgba(20, 16, 12, 0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // game/audio.ts
  var Soundboard = class {
    muted = false;
    ctx = null;
    last = /* @__PURE__ */ new Map();
    unlock() {
      if (typeof window === "undefined") return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.ctx) this.ctx = new Ctx();
      if (this.ctx.state === "suspended") void this.ctx.resume();
    }
    resume() {
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    }
    toggle() {
      this.muted = !this.muted;
      if (!this.muted) this.unlock();
      return this.muted;
    }
    play(cue) {
      if (this.muted || typeof window === "undefined") return;
      this.unlock();
      const ctx = this.ctx;
      if (!ctx) return;
      const now = ctx.currentTime;
      if (cue === "ckm" || cue === "aa") {
        const prev = this.last.get(cue) ?? -10;
        if (now - prev < (cue === "ckm" ? 0.06 : 0.08)) return;
        this.last.set(cue, now);
      }
      if (cue === "ui") this.blip(ctx, 660, 0.04, 0.04);
      else if (cue === "place") this.blip(ctx, 220, 0.09, 0.06);
      else if (cue === "ckm") this.noise(ctx, 0.05, 1800, 0.05);
      else if (cue === "at") {
        this.noise(ctx, 0.18, 420, 0.12);
        this.blip(ctx, 140, 0.16, 0.07);
      } else if (cue === "mortar") this.noise(ctx, 0.12, 180, 0.1);
      else if (cue === "aa") this.noise(ctx, 0.06, 2400, 0.05);
      else if (cue === "boom") this.noise(ctx, 0.28, 300, 0.14);
      else if (cue === "leak") this.blip(ctx, 90, 0.28, 0.08);
      else if (cue === "win") {
        this.blip(ctx, 392, 0.16, 0.05);
        this.blip(ctx, 523, 0.22, 0.05, 0.12);
      } else if (cue === "lose") this.blip(ctx, 110, 0.4, 0.07);
    }
    blip(ctx, freq, dur, gain, delay = 0) {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(1e-3, t + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    noise(ctx, dur, cutoff, gain) {
      const count = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < count; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / count);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start();
    }
  };

  // game/game.ts
  var SAVE_KEY = "blitzkrieg-save-v1";
  var AIR_LIFT = 34;
  function loadSave() {
    if (typeof localStorage === "undefined") return { v: 1, bestWave: 0, victories: 0 };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { v: 1, bestWave: 0, victories: 0 };
      const parsed = JSON.parse(raw);
      if (parsed.v !== 1) return { v: 1, bestWave: 0, victories: 0 };
      return {
        v: 1,
        bestWave: typeof parsed.bestWave === "number" ? parsed.bestWave : 0,
        victories: typeof parsed.victories === "number" ? parsed.victories : 0
      };
    } catch {
      return { v: 1, bestWave: 0, victories: 0 };
    }
  }
  function aimOf(e) {
    return { x: e.x, y: e.y - (ENEMIES[e.kind].air ? AIR_LIFT : 0) };
  }
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function hypot(x, y) {
    return Math.hypot(x, y);
  }
  var Game = class {
    phase = "briefing";
    gold = START_GOLD;
    lives = START_LIVES;
    waveIndex = 0;
    paused = false;
    speed = 1;
    towers = [];
    creeps = [];
    shots = [];
    booms = [];
    floaters = [];
    particles = [];
    armed = null;
    selectedId = null;
    mannedId = null;
    aim = { x: WORLD_W / 2, y: WORLD_H / 2 };
    hover = null;
    mouseFire = false;
    keyFire = false;
    btnFire = false;
    hint = "";
    hintT = 0;
    flash = 0;
    shake = 0;
    camX = WORLD_W / 2;
    camY = WORLD_H / 2;
    camZoom = 1;
    cssW = 800;
    cssH = 600;
    dpr = 1;
    reduce = false;
    images = /* @__PURE__ */ new Map();
    clock = 0;
    spawnI = 0;
    schedule = [];
    save = { v: 1, bestWave: 0, victories: 0 };
    audio;
    nextId = 1;
    acc = 0;
    hudAcc = 0;
    dirty = true;
    listeners = /* @__PURE__ */ new Set();
    constructor(audio) {
      this.audio = audio ?? new Soundboard();
    }
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    emit() {
      for (const fn of this.listeners) fn();
    }
    hydrateSave() {
      this.save = loadSave();
      this.dirty = true;
      this.emit();
    }
    markDirty() {
      this.dirty = true;
    }
    setImage(key, img) {
      this.images.set(key, img);
      this.dirty = true;
    }
    setView(w, h, dpr) {
      this.cssW = Math.max(1, w);
      this.cssH = Math.max(1, h);
      this.dpr = dpr;
    }
    hud() {
      const selected = this.towers.find((t) => t.id === this.selectedId) ?? null;
      const wave = WAVES[this.waveIndex];
      const left = this.phase === "combat" ? this.creeps.length + Math.max(0, this.schedule.length - this.spawnI) : 0;
      return {
        phase: this.phase,
        gold: this.gold,
        lives: this.lives,
        wave: this.waveIndex,
        waveCount: WAVES.length,
        waveName: wave?.name ?? "",
        hint: this.hint,
        armed: this.armed,
        paused: this.paused,
        speed: this.speed,
        muted: this.audio.muted,
        mannedId: this.mannedId,
        selected: selected ? {
          id: selected.id,
          kind: selected.kind,
          dmgRank: selected.dmgRank,
          rateRank: selected.rateRank,
          priority: selected.priority,
          spent: selected.spent
        } : null,
        bestWave: this.save.bestWave,
        victories: this.save.victories,
        left,
        flash: this.flash
      };
    }
    frame(dt) {
      const step = 1 / 60;
      const simDt = this.paused || this.phase !== "combat" ? 0 : dt * this.speed;
      this.acc += simDt;
      let guard = 0;
      while (this.acc >= step && guard < 8) {
        this.tick(step);
        this.acc -= step;
        guard++;
      }
      if (this.acc > step * 2) this.acc = 0;
      this.tickView(dt);
      this.hudAcc += dt;
      if (this.dirty || this.hudAcc > 0.12) {
        this.dirty = false;
        this.hudAcc = 0;
        this.emit();
      }
    }
    tickView(dt) {
      const manned = this.towers.find((t) => t.id === this.mannedId);
      const zoom = manned ? 1.62 : 1;
      let cx = manned ? manned.x : WORLD_W / 2;
      let cy = manned ? manned.y : WORLD_H / 2;
      const viewW = WORLD_W / zoom;
      const viewH = WORLD_H / zoom;
      cx = Math.max(viewW / 2, Math.min(WORLD_W - viewW / 2, cx));
      cy = Math.max(viewH / 2, Math.min(WORLD_H - viewH / 2, cy));
      const k = 1 - Math.exp(-dt * 7);
      this.camZoom += (zoom - this.camZoom) * k;
      this.camX += (cx - this.camX) * k;
      this.camY += (cy - this.camY) * k;
      if (this.phase !== "combat") {
        this.ageJuice(dt);
      }
    }
    tick(dt) {
      if (this.phase !== "combat") return;
      this.clock += dt;
      if (this.hintT > 0) {
        this.hintT -= dt;
        if (this.hintT <= 0) {
          this.hint = "";
          this.dirty = true;
        }
      }
      while (this.spawnI < this.schedule.length && this.schedule[this.spawnI].t <= this.clock) {
        if (this.phase !== "combat") break;
        this.spawn(this.schedule[this.spawnI].kind);
        this.spawnI++;
      }
      for (const e of this.creeps) this.moveCreep(e, dt);
      for (const tower of this.towers) this.runTower(tower, dt);
      for (const shot of this.shots) this.moveShot(shot, dt);
      this.shots = this.shots.filter((s) => s.ttl > 0);
      this.creeps = this.creeps.filter((e) => e.alive);
      this.ageJuice(dt);
      if (this.phase === "combat" && this.spawnI >= this.schedule.length && this.creeps.length === 0) {
        this.clearWave();
      }
    }
    ageJuice(dt) {
      for (const b of this.booms) b.age += dt;
      for (const f of this.floaters) f.age += dt;
      for (const p of this.particles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
      }
      this.booms = this.booms.filter((b) => b.age < b.life);
      this.floaters = this.floaters.filter((f) => f.age < f.life);
      this.particles = this.particles.filter((p) => p.age < p.life);
      if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
      this.shake = Math.max(0, this.shake - dt * 8);
      this.flash = Math.max(0, this.flash - dt * 1.6);
      for (const e of this.creeps) e.flash = Math.max(0, e.flash - dt);
    }
    clearWave() {
      const cleared = this.waveIndex + 1;
      this.noteCleared(cleared);
      if (this.waveIndex >= WAVES.length - 1) {
        this.phase = "victory";
        this.save.victories += 1;
        this.persist();
        this.audio.play("win");
        this.unman();
        this.dirty = true;
        return;
      }
      this.waveIndex += 1;
      this.phase = "deploy";
      this.audio.play("ui");
      this.hint = "Road clear. Reinforce, then send the next column.";
      this.hintT = 3.2;
      this.dirty = true;
    }
    noteCleared(n) {
      if (n > this.save.bestWave) {
        this.save.bestWave = n;
        this.persist();
      }
    }
    persist() {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
      } catch {
      }
    }
    dismissBriefing() {
      if (this.phase !== "briefing") return;
      this.phase = "deploy";
      this.audio.unlock();
      this.audio.play("ui");
      this.dirty = true;
    }
    restart() {
      this.phase = "deploy";
      this.gold = START_GOLD;
      this.lives = START_LIVES;
      this.waveIndex = 0;
      this.paused = false;
      this.towers = [];
      this.creeps = [];
      this.shots = [];
      this.booms = [];
      this.floaters = [];
      this.particles = [];
      this.armed = null;
      this.selectedId = null;
      this.mannedId = null;
      this.mouseFire = false;
      this.keyFire = false;
      this.btnFire = false;
      this.hint = "The road is yours again. Place a gun before you call them in.";
      this.hintT = 4;
      this.flash = 0;
      this.shake = 0;
      this.clock = 0;
      this.spawnI = 0;
      this.schedule = [];
      this.audio.play("ui");
      this.dirty = true;
    }
    togglePause() {
      if (this.phase !== "combat") return;
      this.paused = !this.paused;
      this.dirty = true;
    }
    toggleSpeed() {
      this.speed = this.speed === 1 ? 2 : 1;
      this.dirty = true;
    }
    toggleMute() {
      this.audio.toggle();
      this.dirty = true;
    }
    arm(kind) {
      if (this.phase === "briefing" || this.phase === "victory" || this.phase === "defeat") return;
      this.armed = this.armed === kind ? null : kind;
      if (this.armed) this.audio.play("ui");
      this.dirty = true;
    }
    startWave() {
      if (this.phase !== "deploy") return;
      const wave = WAVES[this.waveIndex];
      if (!wave) return;
      this.schedule = buildSchedule(wave);
      this.spawnI = 0;
      this.clock = 0;
      this.phase = "combat";
      this.paused = false;
      this.hint = wave.hint;
      this.hintT = 4.2;
      this.audio.play("ui");
      this.dirty = true;
    }
    man(id) {
      if (id === null) {
        this.unman();
        return;
      }
      const tower = this.towers.find((t) => t.id === id);
      if (!tower) return;
      this.mannedId = tower.id;
      this.selectedId = tower.id;
      this.armed = null;
      const spot = nearestWaypoint(tower.x, tower.y);
      this.aim = spot;
      this.audio.play("place");
      this.dirty = true;
    }
    unman() {
      if (this.mannedId === null && !this.mouseFire) return;
      this.mannedId = null;
      this.mouseFire = false;
      this.keyFire = false;
      this.btnFire = false;
      this.dirty = true;
    }
    setPriority(priority) {
      const tower = this.towers.find((t) => t.id === this.selectedId);
      if (!tower) return;
      tower.priority = priority;
      this.dirty = true;
    }
    upgrade(id, track) {
      const tower = this.towers.find((t) => t.id === id);
      if (!tower) return false;
      const rank = track === "dmg" ? tower.dmgRank : tower.rateRank;
      if (rank >= 3) return false;
      const cost = upgradeCost(tower.kind, track, rank);
      if (this.gold < cost) {
        this.floater(tower.x, tower.y - 20, "Not enough złoty", "primary");
        return false;
      }
      this.gold -= cost;
      tower.spent += cost;
      if (track === "dmg") tower.dmgRank += 1;
      else tower.rateRank += 1;
      this.audio.play("place");
      this.dirty = true;
      return true;
    }
    sell(id) {
      const index = this.towers.findIndex((t) => t.id === id);
      if (index < 0) return;
      const tower = this.towers[index];
      const refund = Math.floor(tower.spent * SELL_RATE);
      this.gold += refund;
      this.floater(tower.x, tower.y, `+${refund} zł`, "accent");
      this.towers.splice(index, 1);
      if (this.selectedId === id) this.selectedId = null;
      if (this.mannedId === id) this.unman();
      this.audio.play("ui");
      this.dirty = true;
    }
    canBuild(c, r) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
      const key = cellKey(c, r);
      if (PATH_SET.has(key) || BLOCK_SET.has(key)) return false;
      return !this.towers.some((t) => t.c === c && t.r === r);
    }
    tryPlace(kind, c, r) {
      if (this.phase === "briefing" || this.phase === "victory" || this.phase === "defeat") return false;
      if (!this.canBuild(c, r)) {
        this.floater((c + 0.5) * CELL, (r + 0.5) * CELL, "Can't build here", "primary");
        this.dirty = true;
        return false;
      }
      const cost = TOWERS[kind].cost;
      if (this.gold < cost) {
        this.floater((c + 0.5) * CELL, (r + 0.5) * CELL, "Not enough złoty", "primary");
        this.dirty = true;
        return false;
      }
      this.gold -= cost;
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      const face = nearestWaypoint(x, y);
      const tower = {
        id: this.nextId++,
        kind,
        c,
        r,
        x,
        y,
        dmgRank: 0,
        rateRank: 0,
        spent: cost,
        cd: 0.2,
        angle: Math.atan2(face.y - y, face.x - x),
        priority: kind === "at" ? "strong" : "first"
      };
      this.towers.push(tower);
      this.selectedId = tower.id;
      this.armed = null;
      this.audio.play("place");
      this.dirty = true;
      return true;
    }
    pointerDown(world, pointer, detail) {
      if (this.phase === "briefing" || this.phase === "victory" || this.phase === "defeat") return;
      if (this.mannedId !== null) {
        this.aim = world;
        if (pointer !== "touch") this.mouseFire = true;
        return;
      }
      const hit = this.towerAt(world);
      if (hit) {
        this.selectedId = hit.id;
        this.armed = null;
        if (detail >= 2) this.man(hit.id);
        this.audio.play("ui");
        this.dirty = true;
        return;
      }
      const cell = cellAt(world.x, world.y);
      if (this.armed && cell) {
        this.tryPlace(this.armed, cell.c, cell.r);
        return;
      }
      this.selectedId = null;
      this.dirty = true;
    }
    pointerMove(world) {
      this.hover = cellAt(world.x, world.y);
      if (this.mannedId !== null) this.aim = world;
    }
    pointerUp() {
      this.mouseFire = false;
    }
    blur() {
      this.mouseFire = false;
      this.keyFire = false;
      this.btnFire = false;
    }
    setBtnFire(on) {
      this.btnFire = on;
    }
    setKeyFire(on) {
      this.keyFire = on;
    }
    firing() {
      return this.mouseFire || this.keyFire || this.btnFire;
    }
    spawn(kind) {
      const def = ENEMIES[kind];
      const start = WAYPOINTS[0];
      const next = WAYPOINTS[1] ?? start;
      const creep = {
        id: this.nextId++,
        kind,
        x: start.x,
        y: start.y,
        vx: 0,
        vy: 0,
        hp: def.hp,
        maxHp: def.hp,
        dist: 0,
        wp: 1,
        alive: true,
        slow: 0,
        angle: Math.atan2(next.y - start.y, next.x - start.x),
        flash: 0,
        lane: (this.nextId % 5 - 2) * 6
      };
      this.creeps.push(creep);
    }
    moveCreep(e, dt) {
      if (!e.alive) return;
      if (e.slow > 0) e.slow -= dt;
      const target = WAYPOINTS[e.wp];
      if (!target) {
        this.leak(e);
        return;
      }
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = hypot(dx, dy);
      const speed = ENEMIES[e.kind].speed * (e.slow > 0 ? 0.52 : 1);
      const step = speed * dt;
      if (dist <= step || dist < 0.5) {
        e.dist += dist;
        e.x = target.x;
        e.y = target.y;
        e.wp += 1;
        if (e.wp >= WAYPOINTS.length) this.leak(e);
      } else {
        e.vx = dx / dist * speed;
        e.vy = dy / dist * speed;
        e.x += dx / dist * step;
        e.y += dy / dist * step;
        e.dist += step;
        e.angle = Math.atan2(e.vy, e.vx);
      }
    }
    leak(e) {
      if (!e.alive) return;
      e.alive = false;
      const loss = ENEMIES[e.kind].leak;
      this.lives -= loss;
      this.flash = 1;
      this.shake = Math.max(this.shake, this.reduce ? 0 : 7);
      this.floater(e.x, e.y, `−${loss}`, "primary");
      this.audio.play("leak");
      this.dirty = true;
      if (this.lives <= 0) {
        this.lives = 0;
        this.phase = "defeat";
        this.unman();
        this.audio.play("lose");
      }
    }
    runTower(tower, dt) {
      tower.cd = Math.max(0, tower.cd - dt);
      const def = TOWERS[tower.kind];
      const manned = tower.id === this.mannedId;
      let tx = tower.x;
      let ty = tower.y;
      let want = false;
      if (manned) {
        tx = this.aim.x;
        ty = this.aim.y;
        const dist = hypot(tx - tower.x, ty - tower.y);
        if (dist < 12) return;
        want = this.firing() && dist <= def.range && dist >= def.minRange;
      } else {
        const target = this.pickTarget(tower);
        if (!target) return;
        const p = aimOf(target);
        if (def.kind === "mortar") {
          const lead = predict(target, 0.8);
          tx = lead.x;
          ty = lead.y - (ENEMIES[target.kind].air ? AIR_LIFT : 0);
        } else {
          const lead = leadPoint(tower.x, tower.y, target, def.shotSpeed);
          tx = lead.x;
          ty = lead.y;
        }
        want = true;
      }
      const aligned = turnToward(tower, tx, ty, dt, manned ? 12 : 5);
      if (!want || tower.cd > 0) return;
      if (!aligned && def.kind !== "mortar") return;
      if (def.kind === "mortar" && !aligned && Math.abs(angDiff(Math.atan2(ty - tower.y, tx - tower.x), tower.angle)) > 0.45) {
        return;
      }
      this.fire(tower, tx, ty, manned);
    }
    pickTarget(tower) {
      const pool = this.creeps.filter((e) => e.alive && this.eligible(tower, e));
      if (pool.length === 0) return null;
      if (tower.kind === "aa") {
        const air = pool.filter((e) => ENEMIES[e.kind].air);
        if (air.length > 0) return this.bestOf(tower, air);
      }
      if (tower.kind === "at") {
        const hard = pool.filter((e) => ENEMIES[e.kind].armor >= 0.4);
        if (hard.length > 0 && tower.priority === "strong") return this.bestOf(tower, hard);
      }
      return this.bestOf(tower, pool);
    }
    eligible(tower, e) {
      if (ENEMIES[e.kind].air && tower.kind !== "aa") return false;
      const def = TOWERS[tower.kind];
      const p = aimOf(e);
      const d2 = (p.x - tower.x) ** 2 + (p.y - tower.y) ** 2;
      if (d2 > def.range * def.range) return false;
      if (def.minRange && d2 < def.minRange * def.minRange) return false;
      return true;
    }
    bestOf(tower, pool) {
      let best = null;
      for (const e of pool) {
        if (!best || preferred(tower, e, best)) best = e;
      }
      return best;
    }
    fire(tower, tx, ty, manual) {
      const def = TOWERS[tower.kind];
      const rate = towerRate(tower.kind, tower.rateRank);
      tower.cd = 1 / rate;
      const dmg = towerDamage(tower.kind, tower.dmgRank) * (manual ? MANUAL_BONUS : 1);
      const ang = Math.atan2(ty - tower.y, tx - tower.x);
      tower.angle = ang;
      if (def.kind === "mortar") {
        this.shots.push({
          id: this.nextId++,
          kind: tower.kind,
          x: tower.x,
          y: tower.y,
          vx: 0,
          vy: 0,
          dmg,
          vsArmor: def.vsArmor,
          splash: def.splash,
          ttl: 2,
          homing: null,
          mortar: true,
          age: 0,
          duration: 0.82,
          sx: tower.x,
          sy: tower.y,
          tx,
          ty,
          hitR: 10
        });
      } else {
        const spd = def.shotSpeed;
        let homing = null;
        if (!manual) {
          const target = this.pickTarget(tower);
          if (target) homing = target.id;
        }
        this.shots.push({
          id: this.nextId++,
          kind: tower.kind,
          x: tower.x + Math.cos(ang) * 22,
          y: tower.y + Math.sin(ang) * 22,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          dmg,
          vsArmor: def.vsArmor,
          splash: 0,
          ttl: 1.35,
          homing,
          mortar: false,
          age: 0,
          duration: 0,
          sx: tower.x,
          sy: tower.y,
          tx,
          ty,
          hitR: tower.kind === "at" ? 16 : 12
        });
      }
      this.muzzle(tower.x + Math.cos(ang) * 18, tower.y + Math.sin(ang) * 18);
      this.audio.play(tower.kind);
      if (!this.reduce) this.shake = Math.max(this.shake, tower.kind === "at" ? 2.2 : 0.6);
    }
    moveShot(shot, dt) {
      if (shot.mortar) {
        shot.age += dt;
        const t = Math.min(1, shot.age / shot.duration);
        shot.x = shot.sx + (shot.tx - shot.sx) * t;
        shot.y = shot.sy + (shot.ty - shot.sy) * t;
        if (t >= 1) {
          this.explode(shot.x, shot.y, shot.dmg, shot.vsArmor, shot.splash);
          shot.ttl = 0;
        }
        return;
      }
      if (shot.homing !== null) {
        const e = this.creeps.find((c) => c.id === shot.homing && c.alive);
        if (e) {
          const p = aimOf(e);
          const desired = Math.atan2(p.y - shot.y, p.x - shot.x);
          const current = Math.atan2(shot.vy, shot.vx);
          const turn = Math.max(-6 * dt, Math.min(6 * dt, angDiff(desired, current)));
          const ang = current + turn;
          const spd = hypot(shot.vx, shot.vy);
          shot.vx = Math.cos(ang) * spd;
          shot.vy = Math.sin(ang) * spd;
        }
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.ttl -= dt;
      for (const e of this.creeps) {
        if (!e.alive) continue;
        if (ENEMIES[e.kind].air && shot.kind !== "aa") continue;
        const p = aimOf(e);
        const r = shot.hitR + (ENEMIES[e.kind].air ? 16 : 14);
        if ((p.x - shot.x) ** 2 + (p.y - shot.y) ** 2 <= r * r) {
          this.hurt(e, shot.dmg * mitigate(e, shot.vsArmor, shot.kind));
          shot.ttl = 0;
          if (shot.kind !== "ckm") this.boom(p.x, p.y, 0.45);
          else this.spark(p.x, p.y);
          break;
        }
      }
    }
    explode(x, y, dmg, vsArmor, radius) {
      this.boom(x, y, 1);
      if (!this.reduce) this.shake = Math.max(this.shake, 4.5);
      this.audio.play("boom");
      for (const e of this.creeps) {
        if (!e.alive || ENEMIES[e.kind].air) continue;
        const d = hypot(e.x - x, e.y - y);
        if (d > radius) continue;
        const falloff = 1 - d / radius * 0.5;
        this.hurt(e, dmg * falloff * mitigate(e, vsArmor, "mortar"));
        e.slow = Math.max(e.slow, 1.25);
      }
    }
    hurt(e, amount) {
      if (!e.alive || amount <= 0) return;
      e.hp -= amount;
      e.flash = 0.1;
      this.floater(aimOf(e).x, aimOf(e).y - 16, String(Math.max(1, Math.round(amount))), "cream");
      if (e.hp <= 0) {
        e.alive = false;
        this.gold += ENEMIES[e.kind].gold;
        this.floater(e.x, e.y - 28, `+${ENEMIES[e.kind].gold}`, "accent");
        this.boom(aimOf(e).x, aimOf(e).y, ENEMIES[e.kind].armor > 0.4 || ENEMIES[e.kind].air ? 0.9 : 0.55);
        this.dirty = true;
      }
    }
    boom(x, y, scale) {
      this.booms.push({ x, y, age: 0, life: 0.42, scale });
      this.spark(x, y);
    }
    muzzle(x, y) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          age: 0,
          life: 0.18,
          size: 2 + Math.random() * 2,
          tone: "brass"
        });
      }
    }
    spark(x, y) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 30 + Math.random() * 80;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          age: 0,
          life: 0.28 + Math.random() * 0.2,
          size: 1.5 + Math.random() * 2.2,
          tone: i % 2 ? "cream" : "crimson"
        });
      }
    }
    floater(x, y, text, tone) {
      this.floaters.push({ x, y, text, age: 0, life: 0.7, tone });
    }
    towerAt(world) {
      let best = null;
      let bestD = CELL * 0.46;
      for (const t of this.towers) {
        const d = hypot(t.x - world.x, t.y - world.y);
        if (d < bestD) {
          best = t;
          bestD = d;
        }
      }
      return best;
    }
  };
  function cellAt(x, y) {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    return { c, r };
  }
  function nearestWaypoint(x, y) {
    let best = WAYPOINTS[0];
    let bestD = Infinity;
    for (const p of WAYPOINTS) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
  function preferred(tower, a, b) {
    if (tower.priority === "first") return a.dist > b.dist;
    if (tower.priority === "last") return a.dist < b.dist;
    if (tower.priority === "strong") return a.hp > b.hp;
    const da = (aimOf(a).x - tower.x) ** 2 + (aimOf(a).y - tower.y) ** 2;
    const db = (aimOf(b).x - tower.x) ** 2 + (aimOf(b).y - tower.y) ** 2;
    return da < db;
  }
  function mitigate(e, vsArmor, kind) {
    if (ENEMIES[e.kind].air) return kind === "aa" ? 1 : 0;
    const armor = ENEMIES[e.kind].armor;
    return 1 - armor + armor * vsArmor;
  }
  function turnToward(tower, tx, ty, dt, rate) {
    const desired = Math.atan2(ty - tower.y, tx - tower.x);
    const diff = angDiff(desired, tower.angle);
    const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
    tower.angle += step;
    return Math.abs(diff) < 0.22;
  }
  function predict(e, time) {
    return { x: e.x + e.vx * time, y: e.y + e.vy * time };
  }
  function leadPoint(x, y, e, shotSpeed) {
    const p0 = aimOf(e);
    let t = hypot(p0.x - x, p0.y - y) / Math.max(40, shotSpeed);
    for (let i = 0; i < 3; i++) {
      const px = e.x + e.vx * t;
      const py = e.y + e.vy * t - (ENEMIES[e.kind].air ? AIR_LIFT : 0);
      t = hypot(px - x, py - y) / Math.max(40, shotSpeed);
    }
    return {
      x: e.x + e.vx * t,
      y: e.y + e.vy * t - (ENEMIES[e.kind].air ? AIR_LIFT : 0)
    };
  }
  function screenToWorld(px, py, cssW, cssH, camX, camY, camZoom) {
    const viewW = WORLD_W / camZoom;
    const viewH = WORLD_H / camZoom;
    const scale = Math.min(cssW / viewW, cssH / viewH);
    const ox = (cssW - viewW * scale) / 2;
    const oy = (cssH - viewH * scale) / 2;
    return {
      x: camX - viewW / 2 + (px - ox) / scale,
      y: camY - viewH / 2 + (py - oy) / scale
    };
  }

  // blitzkrieg.tsx
  var { useEffect, useRef, useState } = window.React;
  var HISTORY_URL = "https://encyclopedia.ushmm.org/content/en/article/invasion-of-poland-fall-1939";
  var PRIORITIES = [
    { id: "first", label: "First" },
    { id: "last", label: "Last" },
    { id: "close", label: "Near" },
    { id: "strong", label: "Strong" }
  ];
  function Blitzkrieg() {
    const canvasRef = useRef(null);
    const stageRef = useRef(null);
    const gameRef = useRef(null);
    if (!gameRef.current) gameRef.current = new Game();
    const game = gameRef.current;
    const [hud, setHud] = useState(() => game.hud());
    useEffect(() => {
      game.hydrateSave();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      game.reduce = reduce;
      return game.subscribe(() => setHud(game.hud()));
    }, [game]);
    useEffect(() => {
      let left = Object.keys(ART_URLS).length;
      for (const [key, url] of Object.entries(ART_URLS)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          game.setImage(key, img);
          left -= 1;
          if (left === 0) game.markDirty();
        };
        img.onerror = () => {
          left -= 1;
        };
        img.src = url;
      }
    }, [game]);
    useEffect(() => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const fit = () => {
        const rect = stage.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        game.setView(rect.width, rect.height, dpr);
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      };
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(stage);
      let raf = 0;
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1e3);
        last = now;
        game.frame(dt);
        paint(game, ctx);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
      };
    }, [game]);
    useEffect(() => {
      const down = (event) => {
        const target = event.target;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        if (event.repeat) return;
        if (event.code === "Space") {
          if (target?.closest("button, a")) return;
          event.preventDefault();
          if (game.phase === "briefing") game.dismissBriefing();
          else if (game.mannedId) game.setKeyFire(true);
          else if (game.phase === "deploy") game.startWave();
        } else if (event.code === "Escape") {
          if (game.mannedId) game.unman();
          else game.arm(null);
        } else if (event.code === "KeyM" && game.selectedId) {
          if (game.mannedId === game.selectedId) game.unman();
          else game.man(game.selectedId);
        } else if (event.code === "KeyP") game.togglePause();
        else if (event.code === "Digit1") game.arm("ckm");
        else if (event.code === "Digit2") game.arm("at");
        else if (event.code === "Digit3") game.arm("mortar");
        else if (event.code === "Digit4") game.arm("aa");
      };
      const up = (event) => {
        if (event.code === "Space") game.setKeyFire(false);
      };
      const blur = () => game.blur();
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") game.blur();
        else game.audio.resume();
      };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", blur);
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
        window.removeEventListener("blur", blur);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }, [game]);
    const worldFromEvent = (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      return screenToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
        game.camX,
        game.camY,
        game.camZoom
      );
    };
    const wave = WAVES[hud.wave];
    const manned = hud.mannedId !== null;
    const playing = hud.phase === "deploy" || hud.phase === "combat";
    return /* @__PURE__ */ React.createElement("div", { className: "app-shell relative" }, /* @__PURE__ */ React.createElement("header", { className: "app-header flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-4 py-2" }, /* @__PURE__ */ React.createElement("div", { className: "mr-auto min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "font-display text-xl leading-none tracking-wide" }, "Blitzkrieg"), /* @__PURE__ */ React.createElement("p", { className: "text-sm uppercase tracking-widest text-muted" }, "1 September 1939")), /* @__PURE__ */ React.createElement(Stat, { icon: /* @__PURE__ */ React.createElement(Heart, { className: "size-4", "aria-hidden": true }), label: "Garrison", value: String(hud.lives), hot: hud.lives <= 6 }), /* @__PURE__ */ React.createElement(Stat, { icon: /* @__PURE__ */ React.createElement(Coins, { className: "size-4", "aria-hidden": true }), label: "Złoty", value: String(hud.gold), accent: true }), /* @__PURE__ */ React.createElement(
      Stat,
      {
        icon: /* @__PURE__ */ React.createElement(Crosshair, { className: "size-4", "aria-hidden": true }),
        label: "Wave",
        value: `${Math.min(hud.wave + 1, hud.waveCount)}/${hud.waveCount}`
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(IconButton, { label: hud.paused ? "Resume" : "Pause", onClick: () => game.togglePause(), disabled: hud.phase !== "combat" }, hud.paused ? /* @__PURE__ */ React.createElement(Play, { className: "size-4" }) : /* @__PURE__ */ React.createElement(Pause, { className: "size-4" })), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "min-h-11 min-w-11 rounded-md border border-border bg-surface-2 px-3 text-sm uppercase tracking-wider text-fg disabled:opacity-40",
        onClick: () => game.toggleSpeed(),
        disabled: !playing
      },
      hud.speed,
      "×"
    ), /* @__PURE__ */ React.createElement(IconButton, { label: hud.muted ? "Unmute" : "Mute", onClick: () => game.toggleMute() }, hud.muted ? /* @__PURE__ */ React.createElement(VolumeX, { className: "size-4" }) : /* @__PURE__ */ React.createElement(Volume2, { className: "size-4" })))), /* @__PURE__ */ React.createElement("div", { ref: stageRef, className: "relative min-h-0 bg-bg" }, /* @__PURE__ */ React.createElement(
      "canvas",
      {
        ref: canvasRef,
        className: "h-full w-full touch-none",
        "aria-label": "Polish road, 1 September 1939. Place guns off the road.",
        onContextMenu: (event) => {
          event.preventDefault();
          game.arm(null);
        },
        onPointerDown: (event) => {
          if (!event.isPrimary || event.button !== 0) return;
          game.audio.unlock();
          const world = worldFromEvent(event);
          game.pointerDown(world, event.pointerType === "touch" ? "touch" : "mouse", event.detail);
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: (event) => {
          if (event.isPrimary) game.pointerMove(worldFromEvent(event));
        },
        onPointerUp: (event) => {
          if (event.isPrimary) game.pointerUp();
        },
        onPointerCancel: (event) => {
          if (event.isPrimary) game.pointerUp();
        },
        onLostPointerCapture: (event) => {
          if (event.isPrimary) game.pointerUp();
        }
      }
    ), playing && hud.hint ? /* @__PURE__ */ React.createElement("div", { className: "callout pointer-events-none absolute top-4 right-4 left-4 mx-auto max-w-md rounded-md border border-border bg-surface/95 px-4 py-3 text-center" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs uppercase tracking-widest text-accent" }, "Wave ", hud.wave + 1, " · ", hud.waveName), /* @__PURE__ */ React.createElement("p", { className: "mt-1 text-base text-fg" }, hud.hint)) : null, manned ? /* @__PURE__ */ React.createElement("div", { className: "pointer-events-none absolute right-3 bottom-3 left-3 flex justify-center lg:bottom-4" }, /* @__PURE__ */ React.createElement("p", { className: "rounded-md border border-primary bg-surface px-3 py-2 text-center text-sm uppercase tracking-widest text-fg" }, "On the gun · aim and hold to fire · Esc releases · direct fire +", Math.round((MANUAL_BONUS - 1) * 100), "%")) : null, manned ? /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "fire-hold absolute right-4 bottom-20 z-10 h-20 w-20 place-items-center rounded-full bg-primary text-sm uppercase tracking-widest text-fg shadow-lg",
        onPointerDown: (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          game.setBtnFire(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerUp: () => game.setBtnFire(false),
        onPointerCancel: () => game.setBtnFire(false),
        onLostPointerCapture: () => game.setBtnFire(false)
      },
      "Fire"
    ) : null, hud.phase === "combat" ? /* @__PURE__ */ React.createElement("p", { className: "pointer-events-none absolute bottom-3 left-3 text-sm uppercase tracking-widest text-fg" }, hud.left, " still on the road", hud.paused ? " · paused" : "") : null), /* @__PURE__ */ React.createElement("aside", { className: "dock flex min-h-0 flex-col border-t border-border bg-surface" }, /* @__PURE__ */ React.createElement("div", { className: "min-h-0 flex-1 overflow-auto px-3 py-3" }, /* @__PURE__ */ React.createElement("p", { className: "mb-2 text-xs uppercase tracking-widest text-muted" }, "Guns · 1–4 to arm"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible" }, TOWER_ORDER.map((kind) => {
      const def = TOWERS[kind];
      const armed = hud.armed === kind;
      const poor = hud.gold < def.cost;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: kind,
          type: "button",
          "aria-pressed": armed,
          disabled: !playing || poor,
          onClick: () => game.arm(kind),
          className: `flex min-h-16 w-44 shrink-0 items-center gap-2 rounded-md border px-2 py-2 text-left lg:w-auto ${armed ? "border-primary bg-surface-2" : "border-border bg-bg"} disabled:opacity-40`
        },
        /* @__PURE__ */ React.createElement("img", { src: ART_URLS[`tower-${kind}`], alt: "", className: "h-12 w-12 object-contain" }),
        /* @__PURE__ */ React.createElement("span", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "block text-base leading-tight text-fg" }, def.name), /* @__PURE__ */ React.createElement("span", { className: "block text-sm text-muted" }, def.tone)),
        /* @__PURE__ */ React.createElement("span", { className: "ml-auto text-sm text-accent" }, def.cost)
      );
    })), /* @__PURE__ */ React.createElement(Inspector, { hud, game })), /* @__PURE__ */ React.createElement("div", { className: "border-t border-border p-3" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "min-h-11 w-full rounded-md bg-primary px-4 text-base uppercase tracking-widest text-fg disabled:opacity-40",
        disabled: hud.phase !== "deploy",
        onClick: () => {
          game.audio.unlock();
          game.startWave();
        }
      },
      hud.phase === "combat" ? "Column on the road" : `Send wave ${hud.wave + 1}`
    ), /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-center text-sm text-muted" }, wave ? wave.name : "", " · leaks cost the garrison"))), hud.phase === "briefing" ? /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-bg/80 p-4" }, /* @__PURE__ */ React.createElement("article", { className: "overlay-card w-full max-w-lg rounded-lg border border-border bg-surface px-6 py-6 shadow-xl" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs uppercase tracking-widest text-accent" }, "Poland · the frontier road"), /* @__PURE__ */ React.createElement("h1", { className: "mt-1 font-display text-5xl leading-none text-fg" }, "Blitzkrieg"), /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-sm uppercase tracking-widest text-muted" }, "1 September 1939"), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-lg leading-snug text-fg" }, "Columns are crossing the border at dawn. You have the guns on one road into the interior — nests, the 37mm, mortars, and a Bofors. Hold until night."), /* @__PURE__ */ React.createElement("ul", { className: "mt-4 space-y-2 text-base leading-snug text-muted" }, /* @__PURE__ */ React.createElement("li", null, "Set guns off the road. They crew themselves and fire on the first target in range."), /* @__PURE__ */ React.createElement("li", null, "Man a gun when a bend is failing. You aim. You fire. The others keep shooting."), /* @__PURE__ */ React.createElement("li", null, "Upgrade ordnance and drill. Every vehicle that slips through costs the garrison.")), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-sm leading-snug text-muted" }, "This is a fictional road set during Nazi Germany’s invasion of Poland.", " ", /* @__PURE__ */ React.createElement("a", { className: "text-accent underline", href: HISTORY_URL, target: "_blank", rel: "noreferrer" }, "Read the history at the U.S. Holocaust Memorial Museum.")), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-sm text-muted" }, hud.victories > 0 ? `This road has held ${hud.victories} ${hud.victories === 1 ? "time" : "times"}.` : hud.bestWave > 0 ? `Furthest hold: wave ${hud.bestWave} of ${hud.waveCount}.` : "No hold recorded on this road yet."), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "mt-5 min-h-11 w-full rounded-md bg-primary px-4 text-base uppercase tracking-widest text-fg",
        onClick: () => game.dismissBriefing()
      },
      "Take the road"
    ))) : null, hud.phase === "victory" || hud.phase === "defeat" ? /* @__PURE__ */ React.createElement(EndCard, { hud, onRestart: () => game.restart() }) : null);
  }
  function Stat({
    icon,
    label: label2,
    value,
    hot,
    accent
  }) {
    return /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: hot ? "text-primary" : accent ? "text-accent" : "text-muted" }, icon), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { className: "block text-xs uppercase tracking-widest text-muted" }, label2), /* @__PURE__ */ React.createElement("span", { className: `block text-lg leading-none tabular-nums ${hot ? "text-primary" : accent ? "text-accent" : "text-fg"}` }, value)));
  }
  function IconButton({
    label: label2,
    onClick,
    disabled,
    children
  }) {
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        "aria-label": label2,
        title: label2,
        disabled,
        onClick,
        className: "grid size-11 place-items-center rounded-md border border-border bg-surface-2 text-fg disabled:opacity-40"
      },
      children
    );
  }
  function Inspector({ hud, game }) {
    const selected = hud.selected;
    if (!selected) {
      return /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-md border border-border bg-bg px-3 py-3" }, /* @__PURE__ */ React.createElement("p", { className: "text-base text-fg" }, "Arm a gun, then tap open ground."), /* @__PURE__ */ React.createElement("p", { className: "mt-1 text-sm leading-snug text-muted" }, "Double-click a placed gun, or press M, to crew it. Direct fire hits harder. Sell returns ", Math.round(SELL_RATE * 100), "%."));
    }
    const def = TOWERS[selected.kind];
    const dmgCost = upgradeCost(selected.kind, "dmg", selected.dmgRank);
    const rateCost = upgradeCost(selected.kind, "rate", selected.rateRank);
    const crewed = hud.mannedId === selected.id;
    return /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-md border border-border bg-bg px-3 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ React.createElement("img", { src: ART_URLS[`tower-${selected.kind}`], alt: "", className: "h-14 w-14 object-contain" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-lg leading-tight text-fg" }, def.name), /* @__PURE__ */ React.createElement("p", { className: "text-sm leading-snug text-muted" }, def.blurb))), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-sm tabular-nums text-fg" }, Math.round(towerDamage(selected.kind, selected.dmgRank)), " damage · ", towerRate(selected.kind, selected.rateRank).toFixed(1), " /s", crewed ? " · crewed" : ""), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, PRIORITIES.map((item) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: item.id,
        type: "button",
        onClick: () => game.setPriority(item.id),
        className: `min-h-11 rounded-md border px-3 text-sm uppercase tracking-wider ${selected.priority === item.id ? "border-accent bg-surface-2 text-accent" : "border-border text-muted"}`
      },
      item.label
    ))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid gap-2" }, /* @__PURE__ */ React.createElement(
      Upgrade,
      {
        label: "Ordnance",
        rank: selected.dmgRank,
        cost: dmgCost,
        gold: hud.gold,
        onClick: () => game.upgrade(selected.id, "dmg")
      }
    ), /* @__PURE__ */ React.createElement(
      Upgrade,
      {
        label: "Drill",
        rank: selected.rateRank,
        cost: rateCost,
        gold: hud.gold,
        onClick: () => game.upgrade(selected.id, "rate")
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "min-h-11 rounded-md bg-primary px-3 text-sm uppercase tracking-widest text-fg",
        onClick: () => crewed ? game.unman() : game.man(selected.id)
      },
      crewed ? "Release gun" : "Man this gun"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "min-h-11 rounded-md border border-border px-3 text-sm uppercase tracking-widest text-muted",
        onClick: () => game.sell(selected.id)
      },
      "Sell ",
      Math.floor(selected.spent * SELL_RATE)
    )));
  }
  function Upgrade({
    label: label2,
    rank,
    cost,
    gold,
    onClick
  }) {
    const maxed = rank >= 3;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        disabled: maxed || gold < cost,
        onClick,
        className: "flex min-h-11 items-center justify-between rounded-md border border-border px-3 text-left text-sm disabled:opacity-40"
      },
      /* @__PURE__ */ React.createElement("span", { className: "text-fg" }, label2, /* @__PURE__ */ React.createElement("span", { className: "ml-2 inline-flex gap-1 align-middle" }, [0, 1, 2, 3].map((i) => /* @__PURE__ */ React.createElement("span", { key: i, className: `inline-block size-2 rounded-full ${i < rank ? "bg-accent" : "bg-border"}` })))),
      /* @__PURE__ */ React.createElement("span", { className: "text-accent" }, maxed ? "Max" : `${cost} zł`)
    );
  }
  function EndCard({ hud, onRestart }) {
    const won = hud.phase === "victory";
    const wave = WAVES[Math.min(hud.wave, WAVES.length - 1)];
    return /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-bg/80 p-4" }, /* @__PURE__ */ React.createElement("article", { className: "overlay-card w-full max-w-lg rounded-lg border border-border bg-surface px-6 py-6 text-center" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs uppercase tracking-widest text-accent" }, won ? "Night, 1 September" : "The road is open"), /* @__PURE__ */ React.createElement("h2", { className: "mt-2 font-display text-4xl text-fg" }, won ? "The line holds." : "The corridor breaks."), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-lg leading-snug text-muted" }, won ? "Twelve waves stopped on this road. It is one road. It held." : `The garrison failed on wave ${hud.wave + 1}${wave ? `, ${wave.name}` : ""}. Other roads are still fighting. This one is not.`), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-sm leading-snug text-muted" }, "In the September Campaign, the Soviet Union invaded eastern Poland on September 17. German forces took Warsaw later that month.", " ", /* @__PURE__ */ React.createElement("a", { className: "text-accent underline", href: HISTORY_URL, target: "_blank", rel: "noreferrer" }, "Read how the invasion unfolded.")), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-base uppercase tracking-widest text-fg",
        onClick: onRestart
      },
      /* @__PURE__ */ React.createElement(RotateCcw, { className: "size-4", "aria-hidden": true }),
      "Reform the line"
    )));
  }

  // main.tsx
  var root = document.getElementById("game-root");
  if (root) window.ReactDOM.createRoot(root).render(/* @__PURE__ */ React.createElement(Blitzkrieg, null));
})();
