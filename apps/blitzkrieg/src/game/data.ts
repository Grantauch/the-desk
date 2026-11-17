export const COLS = 16;
export const ROWS = 10;
export const CELL = 78;
export const WORLD_W = COLS * CELL;
export const WORLD_H = ROWS * CELL;

export const START_GOLD = 220;
export const START_LIVES = 22;
export const SELL_RATE = 0.6;
export const MANUAL_BONUS = 1.25;
export const DMG_MULT = [1, 1.4, 1.85, 2.45] as const;
export const RATE_MULT = [1, 1.3, 1.65, 2.05] as const;

export type TowerKind = "ckm" | "at" | "mortar" | "aa";
export type EnemyKind =
  | "infantry"
  | "recon"
  | "truck"
  | "panzer"
  | "halftrack"
  | "armored"
  | "heavy"
  | "bomber";
export type Priority = "first" | "last" | "close" | "strong";
export type Phase = "briefing" | "deploy" | "combat" | "victory" | "defeat";
export type PropKind = "tree" | "pine" | "hay" | "sand";

export interface TowerDef {
  kind: TowerKind;
  name: string;
  short: string;
  blurb: string;
  cost: number;
  range: number;
  minRange: number;
  damage: number;
  rate: number;
  vsArmor: number;
  splash: number;
  shotSpeed: number;
  tone: string;
}

export const TOWERS: Record<TowerKind, TowerDef> = {
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
    tone: "Rapid � light",
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
    tone: "Slow � armor-piercing",
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
    tone: "Lobbed � splash",
  },
  aa: {
    kind: "aa",
    name: "Bofors 40mm",
    short: "Bofors",
    blurb: "Tracks aircraft first. Limited damage against ground targets.",
    cost: 190,
    range: 280,
    minRange: 0,
    damage: 22,
    rate: 2.6,
    vsArmor: 0.62,
    splash: 0,
    shotSpeed: 700,
    tone: "Long � anti-air",
  },
};

export const TOWER_ORDER: TowerKind[] = ["ckm", "at", "mortar", "aa"];

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  gold: number;
  leak: number;
  armor: number;
  air: boolean;
  art: string;
  draw: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
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
    draw: 74,
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
    draw: 68,
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
    draw: 82,
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
    draw: 80,
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
    draw: 84,
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
    draw: 74,
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
    draw: 102,
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
    draw: 92,
  },
};

export interface WaveGroup {
  kind: EnemyKind;
  n: number;
  every: number;
}

export interface WaveDef {
  name: string;
  hint: string;
  groups: WaveGroup[];
}

export const WAVES: WaveDef[] = [
  {
    name: "Dawn patrol",
    hint: "Infantry on the road. A machine-gun nest will hold.",
    groups: [{ kind: "infantry", n: 8, every: 0.85 }],
  },
  {
    name: "Outriders",
    hint: "Motorcycles slip past a gun that is looking the wrong way.",
    groups: [
      { kind: "infantry", n: 8, every: 0.7 },
      { kind: "recon", n: 5, every: 1.05 },
    ],
  },
  {
    name: "Supply column",
    hint: "Trucks. A mortar on the bend earns its iron.",
    groups: [
      { kind: "truck", n: 6, every: 1.25 },
      { kind: "infantry", n: 8, every: 0.5 },
    ],
  },
  {
    name: "First armor",
    hint: "Light tanks ignore rifle-caliber fire. Use the 37mm.",
    groups: [
      { kind: "panzer", n: 4, every: 1.7 },
      { kind: "infantry", n: 10, every: 0.48 },
      { kind: "recon", n: 3, every: 0.85 },
    ],
  },
  {
    name: "Combined column",
    hint: "Armor and carriers now. Aircraft next wave. Save 190 zl for a Bofors.",
    groups: [
      { kind: "truck", n: 4, every: 1.1 },
      { kind: "panzer", n: 5, every: 1.45 },
      { kind: "halftrack", n: 3, every: 1.3 },
      { kind: "infantry", n: 8, every: 0.42 },
    ],
  },
  {
    name: "Engines overhead",
    hint: "Dive bombers. Only the Bofors can touch them.",
    groups: [
      { kind: "bomber", n: 5, every: 1.55 },
      { kind: "infantry", n: 8, every: 0.48 },
      { kind: "recon", n: 4, every: 0.7 },
    ],
  },
  {
    name: "The corridor",
    hint: "They come thick. Man the gun that is about to leak.",
    groups: [
      { kind: "panzer", n: 5, every: 1.25 },
      { kind: "halftrack", n: 4, every: 1.0 },
      { kind: "truck", n: 4, every: 0.95 },
      { kind: "infantry", n: 10, every: 0.36 },
    ],
  },
  {
    name: "Armored spear",
    hint: "Faster hulls, and aircraft again. Keep a Bofors crewed.",
    groups: [
      { kind: "armored", n: 6, every: 0.95 },
      { kind: "panzer", n: 4, every: 1.2 },
      { kind: "bomber", n: 4, every: 1.7 },
      { kind: "recon", n: 5, every: 0.45 },
    ],
  },
  {
    name: "Stubble and steel",
    hint: "The first heavy tanks. Ordnance upgrades matter.",
    groups: [
      { kind: "heavy", n: 2, every: 2.6 },
      { kind: "panzer", n: 6, every: 0.85 },
      { kind: "bomber", n: 4, every: 1.2 },
      { kind: "halftrack", n: 5, every: 0.75 },
    ],
  },
  {
    name: "Noon",
    hint: "The longest column of the day.",
    groups: [
      { kind: "heavy", n: 3, every: 2.2 },
      { kind: "panzer", n: 7, every: 0.75 },
      { kind: "armored", n: 5, every: 0.7 },
      { kind: "bomber", n: 5, every: 1.05 },
      { kind: "infantry", n: 12, every: 0.28 },
    ],
  },
  {
    name: "The bend",
    hint: "Man a critical gun. Do not let the heavies through.",
    groups: [
      { kind: "heavy", n: 4, every: 1.8 },
      { kind: "panzer", n: 6, every: 0.8 },
      { kind: "halftrack", n: 6, every: 0.6 },
      { kind: "bomber", n: 5, every: 1.05 },
    ],
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
      { kind: "infantry", n: 14, every: 0.26 },
    ],
  },
];

export const PATH_CELLS: ReadonlyArray<readonly [number, number]> = [
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
  [15, 4],
];

export interface Prop {
  c: number;
  r: number;
  kind: PropKind;
}

export const PROPS: Prop[] = [
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
  { c: 11, r: 1, kind: "tree" },
];

export function cellKey(c: number, r: number): number {
  return c + r * COLS;
}

export const PATH_SET: ReadonlySet<number> = new Set(
  PATH_CELLS.map(([c, r]) => cellKey(c, r)),
);

export const BLOCK_SET: ReadonlySet<number> = new Set<number>([
  ...Array.from({ length: COLS }, (_, c) => cellKey(c, 8)),
  ...Array.from({ length: COLS }, (_, c) => cellKey(c, 9)),
  ...PROPS.map((p) => cellKey(p.c, p.r)),
]);

export const WAYPOINTS = PATH_CELLS.map(([c, r]) => ({
  x: (c + 0.5) * CELL,
  y: (r + 0.5) * CELL,
}));

type Cell = readonly [number, number];
type Point = { x: number; y: number };

function expandRoute(turns: readonly Cell[]): Cell[] {
  const route: Cell[] = [turns[0]!];
  for (const [endC, endR] of turns.slice(1)) {
    let [c, r] = route[route.length - 1]!;
    if (c !== endC && r !== endR) throw new Error("Road segments must follow the grid");
    while (c !== endC || r !== endR) {
      c += Math.sign(endC - c);
      r += Math.sign(endR - r);
      route.push([c, r]);
    }
  }
  return route;
}

function scenario(name: string, description: string, cells: readonly Cell[], tint: string) {
  const road = new Set(cells.map(([c, r]) => cellKey(c, r)));
  const props = PROPS.filter(({ c, r }) => !road.has(cellKey(c, r)));
  const blocked = new Set([...BLOCK_SET].filter((key) => !road.has(key)));
  const waypoints: Point[] = cells.map(([c, r]) => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }));
  return { name, description, road, props, blocked, waypoints, tint };
}

export const SCENARIOS = {
  frontier: scenario("Frontier Road", "Long switchbacks let one emplacement cover several stretches of road.", PATH_CELLS, "rgba(55, 43, 23, .12)"),
  orchard: scenario("Orchard Bend", "A compact opening approach gives way to a long, exposed exit.", expandRoute([[0, 3], [5, 3], [5, 1], [8, 1], [8, 4], [15, 4]]), "rgba(28, 54, 37, .20)"),
  river: scenario("River Road", "A short riverbank route leaves less time to catch a breakthrough.", expandRoute([[0, 5], [4, 5], [4, 7], [11, 7], [11, 5], [15, 5]]), "rgba(32, 50, 67, .23)"),
};
export type ScenarioId = keyof typeof SCENARIOS;

export const AIR_ROUTE: Point[] = [{ x: CELL / 2, y: 3.5 * CELL }, { x: WORLD_W - CELL / 2, y: 4.75 * CELL }];

export function upgradeCost(kind: TowerKind, track: "dmg" | "rate", rank: number): number {
  const base = track === "dmg" ? [55, 95, 150] : [45, 80, 130];
  const scale = kind === "ckm" ? 0.75 : kind === "at" ? 1 : kind === "mortar" ? 1.05 : 1.15;
  const row = base[rank];
  if (row === undefined) return 0;
  return Math.round(row * scale);
}

export function towerDamage(kind: TowerKind, dmgRank: number): number {
  return TOWERS[kind].damage * (DMG_MULT[dmgRank] ?? 1);
}

export function towerRate(kind: TowerKind, rateRank: number): number {
  return TOWERS[kind].rate * (RATE_MULT[rateRank] ?? 1);
}

function assertMap(): void {
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

export function buildSchedule(wave: WaveDef): { t: number; kind: EnemyKind }[] {
  const out: { t: number; kind: EnemyKind }[] = [];
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

export const ART_URLS: Record<string, string> = {
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
  "prop-sand": "./game/prop-sand.png",
};
