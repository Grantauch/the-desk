/** Stylized Somme sector, metres. +X east, −Z north, +Y up. */

export const X0 = -340;
export const X1 = 340;
export const Z0 = -270;
export const Z1 = 300;
export const RES = 2.5;
export const COLS = Math.round((X1 - X0) / RES) + 1;
export const ROWS = Math.round((Z1 - Z0) / RES) + 1;
export const RES_X = (X1 - X0) / (COLS - 1);
export const RES_Z = (Z1 - Z0) / (ROWS - 1);
export const WATER_Y = 0.22;

export const LINES = {
  britishFront: 52,
  britishSupport: 108,
  britishReserve: 156,
  germanFront: -68,
  germanSupport: -122,
  germanReserve: -172,
};

export const MARK = {
  albert: { x: 8, z: 258 },
  lochnagar: { x: 68, z: -62 },
  hawthorn: { x: -200, z: -58 },
  beaumont: { x: -214, z: -82 },
  newfoundland: { x: -198, z: 6 },
  laBoisselle: { x: 78, z: -96 },
  delville: { x: 250, z: -8 },
  highWood: { x: 162, z: -152 },
  thiepval: { x: -18, z: -208 },
  tankDitch: { x: -22, z: -4 },
  tankWood: { x: 128, z: -104 },
  balloon: { x: -52, z: 178 },
  sausage: { x: 132, z: 22 },
  mash: { x: -112, z: 14 },
  jacobs: { x: 24, z: 104 },
  somme: { x: -90, z: 214 },
  aid: { x: -42, z: 134 },
  nml: { x: 4, z: -8 },
  britishLine: { x: -70, z: 52 },
  germanLine: { x: 36, z: -68 },
};

export type Poi = {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  blurb: string;
  /** Short air label. Omit to keep the name on the instrument only. */
  sprite?: string;
};

export const POIS: Poi[] = [
  {
    id: "albert",
    name: "Albert",
    x: MARK.albert.x,
    z: MARK.albert.z,
    radius: 42,
    sprite: "Albert",
    blurb:
      "The gilded Virgin on the basilica was knocked horizontal in 1915. Soldiers passing through town said the war would end when she fell.",
  },
  {
    id: "somme",
    name: "The Somme",
    x: MARK.somme.x,
    z: MARK.somme.z,
    radius: 36,
    sprite: "The Somme",
    blurb:
      "A slow chalk river. The battle took its name from this valley, but the worst of the fighting was on the higher ground to the north.",
  },
  {
    id: "brit",
    name: "British front line",
    x: MARK.britishLine.x,
    z: MARK.britishLine.z,
    radius: 24,
    sprite: "British front",
    blurb:
      "Fire bays, duckboards and a chalk parapet. At 7:30 on the morning of 1 July the infantry climbed this step and walked into the open.",
  },
  {
    id: "nml",
    name: "No man's land",
    x: MARK.nml.x,
    z: MARK.nml.z,
    radius: 26,
    sprite: "No man's land",
    blurb:
      "Wire, spoil and shell holes between the fronts. On the first morning it had to be crossed in daylight, under machine-gun fire.",
  },
  {
    id: "german",
    name: "German front line",
    x: MARK.germanLine.x,
    z: MARK.germanLine.z,
    radius: 24,
    sprite: "German front",
    blurb:
      "Cut into deep chalk, with dugouts under the traverses. Many of those shelters were still intact when the barrage lifted.",
  },
  {
    id: "lochnagar",
    name: "Lochnagar Crater",
    x: MARK.lochnagar.x,
    z: MARK.lochnagar.z,
    radius: 34,
    sprite: "Lochnagar",
    blurb:
      "At 7:28 a.m. on 1 July a mine of about 60,000 pounds blew this crater under the German line, two minutes before zero hour.",
  },
  {
    id: "hawthorn",
    name: "Hawthorn Ridge",
    x: MARK.hawthorn.x,
    z: MARK.hawthorn.z,
    radius: 30,
    sprite: "Hawthorn Ridge",
    blurb:
      "The Hawthorn mine was fired at 7:20, ten minutes early. The blast warned the defenders, and the crater was fought over at once.",
  },
  {
    id: "beaumont",
    name: "Beaumont-Hamel",
    x: MARK.beaumont.x,
    z: MARK.beaumont.z,
    radius: 28,
    sprite: "Beaumont-Hamel",
    blurb: "A village held in the German front system. It was not taken on the first day.",
  },
  {
    id: "newfoundland",
    name: "Newfoundland advance",
    x: MARK.newfoundland.x,
    z: MARK.newfoundland.z,
    radius: 26,
    blurb:
      "The Newfoundland Regiment crossed this ground on the morning of 1 July and was cut down in the open. About 780 men went forward. The next morning only 68 answered the roll.",
  },
  {
    id: "laboisselle",
    name: "La Boisselle",
    x: MARK.laBoisselle.x,
    z: MARK.laBoisselle.z,
    radius: 24,
    sprite: "La Boisselle",
    blurb: "A ruined village in the German line, just north of the Lochnagar mine.",
  },
  {
    id: "delville",
    name: "Delville Wood",
    x: MARK.delville.x,
    z: MARK.delville.z,
    radius: 36,
    sprite: "Delville Wood",
    blurb:
      "From 15 July the South African Brigade held what was left of this wood. Shellfire took the trees. Of roughly 3,150 South Africans who went in, about 750 walked out.",
  },
  {
    id: "high",
    name: "High Wood",
    x: MARK.highWood.x,
    z: MARK.highWood.z,
    radius: 34,
    sprite: "High Wood",
    blurb:
      "Fought over from July into September. On 15 September, tanks went into action on this ground for the first time.",
  },
  {
    id: "thiepval",
    name: "Thiepval ridge",
    x: MARK.thiepval.x,
    z: MARK.thiepval.z,
    radius: 40,
    sprite: "Thiepval",
    blurb: "High chalk looking down the whole attack. German defenders held the ridge until 26 September.",
  },
  {
    id: "tank1",
    name: "Ditched Mark I",
    x: MARK.tankDitch.x,
    z: MARK.tankDitch.z,
    radius: 18,
    sprite: "Mark I",
    blurb:
      "A Mark I, the type first sent forward on 15 September 1916. Of 49 sent, only about 32 reached the start line. Many ditched in shell holes or broke down before the wire.",
  },
  {
    id: "tank2",
    name: "Mark I",
    x: MARK.tankWood.x,
    z: MARK.tankWood.z,
    radius: 18,
    blurb: "Another of the first tanks, nosing toward High Wood. The ground here was already a ruin of stumps and holes.",
  },
  {
    id: "balloon",
    name: "Observation balloon",
    x: MARK.balloon.x,
    z: MARK.balloon.z,
    radius: 28,
    sprite: "Balloon",
    blurb: "A kite balloon on its cable. Observers up here telephoned artillery targets along the German line.",
  },
  {
    id: "sausage",
    name: "Sausage Valley",
    x: MARK.sausage.x,
    z: MARK.sausage.z,
    radius: 30,
    blurb: "A shallow valley used to approach the front near La Boisselle. It was shelled so often the name stuck.",
  },
  {
    id: "mash",
    name: "Mash Valley",
    x: MARK.mash.x,
    z: MARK.mash.z,
    radius: 28,
    blurb: "Open ground north-west of Sausage Valley. Crossing it meant walking in full view of the German line.",
  },
  {
    id: "jacobs",
    name: "Jacob's Ladder",
    x: MARK.jacobs.x,
    z: MARK.jacobs.z,
    radius: 18,
    blurb: "A communication trench up to the front. Reliefs and carrying parties used routes like this after dark.",
  },
  {
    id: "aid",
    name: "Dressing station",
    x: MARK.aid.x,
    z: MARK.aid.z,
    radius: 18,
    blurb: "An advanced dressing station behind the support line. Stretcher-bearers brought the wounded back this far, if they could.",
  },
];

export type Side = "british" | "german";
export type TrenchRole = "front" | "support" | "reserve" | "comm" | "sap";

export type Polyline = {
  side: Side;
  role: TrenchRole;
  halfW: number;
  depth: number;
  points: { x: number; z: number }[];
};

export type WorldData = {
  cols: number;
  rows: number;
  heights: Float32Array;
  /** Linear RGB, one vertex per grid point. */
  colors: Float32Array;
  sample: (x: number, z: number) => number;
  polylines: Polyline[];
  pois: Poi[];
};

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hash2(ix: number, iz: number) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const v00 = hash2(x0, z0);
  const v10 = hash2(x0 + 1, z0);
  const v01 = hash2(x0, z0 + 1);
  const v11 = hash2(x0 + 1, z0 + 1);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sz;
}

function fbm(x: number, z: number) {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 5; i++) {
    sum += amp * valueNoise(x * f, z * f);
    norm += amp;
    amp *= 0.5;
    f *= 2.05;
  }
  return sum / norm;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function toLinear(u: number) {
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}

export function nmlMask(z: number) {
  return smoothstep(96, 38, z) * smoothstep(-118, -48, z);
}

function ellipseDip(x: number, z: number, cx: number, cz: number, rx: number, rz: number, depth: number) {
  const dx = (x - cx) / rx;
  const dz = (z - cz) / rz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= 1) return 0;
  const u = 1 - d2;
  return depth * u * u;
}

type Seg = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfW: number;
  depth: number;
};

type Crater = { x: number; z: number; r: number; depth: number; rim: number };

const CELL = 32;

function zigzag(z0: number, amp: number, step: number, x0: number, x1: number, seed: number) {
  const pts: { x: number; z: number }[] = [];
  let i = 0;
  for (let x = x0; x <= x1; x += step) {
    const jx = (hash2(seed, i) - 0.5) * step * 0.22;
    const jz = (i % 2 === 0 ? -1 : 1) * amp + (hash2(i, seed + 17) - 0.5) * amp * 0.3;
    pts.push({
      x: clamp(x + jx, X0 + 10, X1 - 10),
      z: z0 + jz,
    });
    i++;
  }
  return pts;
}

function northSouth(x: number, z0: number, z1: number, amp: number, step: number) {
  const pts: { x: number; z: number }[] = [];
  const dir = Math.sign(z1 - z0) || 1;
  let i = 0;
  for (let z = z0; dir > 0 ? z <= z1 + 0.01 : z >= z1 - 0.01; z += step * dir) {
    pts.push({ x: x + (i % 2 === 0 ? -amp : amp), z });
    i++;
    if (i > 40) break;
  }
  const last = pts[pts.length - 1];
  if (!last || Math.abs(last.z - z1) > 0.5) {
    pts.push({ x: x + (i % 2 === 0 ? -amp : amp), z: z1 });
  }
  return pts;
}

function buildLines(): Polyline[] {
  const x0 = -308;
  const x1 = 308;
  const lines: Polyline[] = [
    { side: "british", role: "front", halfW: 5, depth: 3.15, points: zigzag(LINES.britishFront, 9, 18, x0, x1, 3) },
    { side: "british", role: "support", halfW: 4.2, depth: 2.55, points: zigzag(LINES.britishSupport, 7, 22, x0, x1, 8) },
    { side: "british", role: "reserve", halfW: 3.4, depth: 1.7, points: zigzag(LINES.britishReserve, 6, 26, x0, x1, 13) },
    { side: "german", role: "front", halfW: 5.1, depth: 3.35, points: zigzag(LINES.germanFront, 10, 20, x0, x1, 21) },
    { side: "german", role: "support", halfW: 4.3, depth: 2.7, points: zigzag(LINES.germanSupport, 7.5, 22, x0, x1, 29) },
    { side: "german", role: "reserve", halfW: 3.5, depth: 1.85, points: zigzag(LINES.germanReserve, 6, 28, x0, x1, 34) },
  ];
  for (const x of [-250, -140, 24, 130, 240]) {
    lines.push({
      side: "british",
      role: "comm",
      halfW: 2.7,
      depth: 2.15,
      points: northSouth(x, LINES.britishReserve, LINES.britishFront, 5, 14),
    });
  }
  for (const x of [-230, -100, 8, 150, 255]) {
    lines.push({
      side: "german",
      role: "comm",
      halfW: 2.7,
      depth: 2.25,
      points: northSouth(x, LINES.germanReserve, LINES.germanFront, 5, 14),
    });
  }
  for (const x of [-240, -150, -40, 96, 210]) {
    lines.push({
      side: "british",
      role: "sap",
      halfW: 2.15,
      depth: 1.45,
      points: northSouth(x, LINES.britishFront, LINES.britishFront - 26, 3.5, 8),
    });
  }
  for (const x of [-220, -80, 40, 170, 250]) {
    lines.push({
      side: "german",
      role: "sap",
      halfW: 2.15,
      depth: 1.55,
      points: northSouth(x, LINES.germanFront, LINES.germanFront + 24, 3.5, 8),
    });
  }
  return lines;
}

function distToSeg(x: number, z: number, s: Seg) {
  const abx = s.bx - s.ax;
  const abz = s.bz - s.az;
  const len2 = abx * abx + abz * abz;
  let t = 0;
  if (len2 > 1e-6) {
    t = ((x - s.ax) * abx + (z - s.az) * abz) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const dx = x - (s.ax + abx * t);
  const dz = z - (s.az + abz * t);
  return Math.hypot(dx, dz);
}

function riverMask(x: number, z: number) {
  const cz = 208 + Math.sin(x * 0.012) * 16 + Math.sin(x * 0.005 + 1.2) * 8;
  const half = 15 + Math.sin(x * 0.021) * 3;
  const d = Math.abs(z - cz);
  const across = 1 - smoothstep(half * 0.4, half * 2.05, d);
  const alongW = smoothstep(X0, X0 + 40, x);
  const alongE = 1 - smoothstep(150, 280, x);
  return across * alongW * alongE;
}

function baseHeight(x: number, z: number) {
  const warp = fbm(x * 0.004 + 2, z * 0.004);
  let h = 3.15 + fbm(x * 0.0075 + warp, z * 0.0075) * 5.6;
  h += fbm(x * 0.02 + 9, z * 0.02) * 1.35;
  h += smoothstep(-50, -230, z) * (5.2 + fbm(x * 0.014, z * 0.01) * 2.4);
  h -= ellipseDip(x, z, MARK.sausage.x, MARK.sausage.z, 36, 78, 2.35);
  h -= ellipseDip(x, z, MARK.mash.x, MARK.mash.z, 32, 72, 1.85);
  const riv = riverMask(x, z);
  h = lerp(h, -1.25, riv);
  return h;
}

const F = { h: 0, spoil: 0, river: 0, trench: 0, rim: 0 };

export function generateWorld(): WorldData {
  const polylines = buildLines();
  const segs: Seg[] = [];
  for (const line of polylines) {
    const pts = line.points;
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push({
        ax: pts[i].x,
        az: pts[i].z,
        bx: pts[i + 1].x,
        bz: pts[i + 1].z,
        halfW: line.halfW,
        depth: line.depth,
      });
    }
  }

  const bcols = Math.ceil((X1 - X0) / CELL);
  const brows = Math.ceil((Z1 - Z0) / CELL);
  const segBuckets: Seg[][] = Array.from({ length: bcols * brows }, () => []);
  const craterBuckets: Crater[][] = Array.from({ length: bcols * brows }, () => []);

  const cellX = (x: number) => Math.floor((x - X0) / CELL);
  const cellZ = (z: number) => Math.floor((z - Z0) / CELL);

  function dropSeg(s: Seg) {
    const pad = s.halfW + 4;
    const ix0 = clamp(cellX(Math.min(s.ax, s.bx) - pad), 0, bcols - 1);
    const ix1 = clamp(cellX(Math.max(s.ax, s.bx) + pad), 0, bcols - 1);
    const iz0 = clamp(cellZ(Math.min(s.az, s.bz) - pad), 0, brows - 1);
    const iz1 = clamp(cellZ(Math.max(s.az, s.bz) + pad), 0, brows - 1);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) segBuckets[iz * bcols + ix].push(s);
    }
  }
  function dropCrater(c: Crater) {
    const pad = c.r * 1.45;
    const ix0 = clamp(cellX(c.x - pad), 0, bcols - 1);
    const ix1 = clamp(cellX(c.x + pad), 0, bcols - 1);
    const iz0 = clamp(cellZ(c.z - pad), 0, brows - 1);
    const iz1 = clamp(cellZ(c.z + pad), 0, brows - 1);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) craterBuckets[iz * bcols + ix].push(c);
    }
  }

  for (const s of segs) dropSeg(s);

  const craters: Crater[] = [];
  for (let i = 0; i < 86; i++) {
    const x = X0 + 24 + hash2(i, 21) * (X1 - X0 - 48);
    const z = -6 + (hash2(i, 22) - 0.5) * 150;
    if (z > 145) continue;
    const big = hash2(i, 24) > 0.86;
    const r = 2.6 + hash2(i, 23) * (big ? 10 : 5.5);
    craters.push({ x, z, r, depth: 0.9 + r * 0.26, rim: 0.22 + r * 0.055 });
  }
  for (let i = 0; i < 28; i++) {
    const x = X0 + 30 + hash2(i, 41) * (X1 - X0 - 60);
    const z = -55 - hash2(i, 42) * 130;
    const r = 2.8 + hash2(i, 43) * 6;
    craters.push({ x, z, r, depth: 0.8 + r * 0.22, rim: 0.2 + r * 0.05 });
  }
  craters.push({ x: MARK.lochnagar.x, z: MARK.lochnagar.z, r: 26, depth: 8.2, rim: 2.15 });
  craters.push({ x: MARK.hawthorn.x, z: MARK.hawthorn.z, r: 16, depth: 5.7, rim: 1.5 });
  for (const c of craters) dropCrater(c);

  function fieldAt(x: number, z: number) {
    let h = baseHeight(x, z);
    const river = riverMask(x, z);
    let bowl = 0;
    let rim = 0;
    const ix = cellX(x);
    const iz = cellZ(z);
    if (ix >= 0 && iz >= 0 && ix < bcols && iz < brows) {
      const list = craterBuckets[iz * bcols + ix];
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const d = Math.hypot(x - c.x, z - c.z);
        let delta = 0;
        if (d < c.r) {
          const u = d / c.r;
          delta = -c.depth * (Math.cos(u * Math.PI) * 0.5 + 0.5);
        } else if (d < c.r * 1.36) {
          const u = (d - c.r) / (c.r * 0.36);
          delta = Math.sin((1 - u) * Math.PI) * c.rim * 0.55;
        }
        if (delta < bowl) bowl = delta;
        if (delta > rim) rim = delta;
      }
    }
    h += bowl < -0.45 ? bowl : bowl + rim;

    let carve = 0;
    let spoil = 0;
    if (ix >= 0 && iz >= 0 && ix < bcols && iz < brows && bowl > -2.4) {
      const list = segBuckets[iz * bcols + ix];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const d = distToSeg(x, z, s);
        if (d < s.halfW) {
          const u = d / s.halfW;
          const c = s.depth * (1 - u * u);
          if (c > carve) carve = c;
        } else if (d < s.halfW + 3.5) {
          const sp = 1 - (d - s.halfW) / 3.5;
          const shaped = sp * sp;
          if (shaped > spoil) spoil = shaped;
        }
      }
      h -= carve;
      h += spoil * 0.8;
    }

    // The mine craters were dry chalk bowls, so keep their floors above the water plane.
    if (bowl < -2.4 && river < 0.05) h = Math.max(h, WATER_Y + 0.6);
    F.h = h;
    F.spoil = spoil;
    F.river = river;
    F.trench = carve > 0 ? clamp(carve / 3.2, 0, 1) : 0;
    F.rim = clamp(rim / 1.6, 0, 1);
    return F;
  }

  const count = COLS * ROWS;
  const heights = new Float32Array(count);
  const spoilA = new Uint8Array(count);
  const trenchA = new Uint8Array(count);
  const rimA = new Uint8Array(count);
  const riverA = new Uint8Array(count);

  for (let iz = 0; iz < ROWS; iz++) {
    const z = Z0 + iz * RES_Z;
    for (let ix = 0; ix < COLS; ix++) {
      const x = X0 + ix * RES_X;
      const f = fieldAt(x, z);
      const i = iz * COLS + ix;
      heights[i] = f.h;
      spoilA[i] = (f.spoil * 255) | 0;
      trenchA[i] = (f.trench * 255) | 0;
      rimA[i] = (f.rim * 255) | 0;
      riverA[i] = (f.river * 255) | 0;
    }
  }

  const colors = new Float32Array(count * 3);
  for (let iz = 0; iz < ROWS; iz++) {
    const z = Z0 + iz * RES_Z;
    for (let ix = 0; ix < COLS; ix++) {
      const x = X0 + ix * RES_X;
      const i = iz * COLS + ix;
      const h = heights[i];
      const hx0 = heights[iz * COLS + Math.max(0, ix - 1)];
      const hx1 = heights[iz * COLS + Math.min(COLS - 1, ix + 1)];
      const hz0 = heights[Math.max(0, iz - 1) * COLS + ix];
      const hz1 = heights[Math.min(ROWS - 1, iz + 1) * COLS + ix];
      const slope = (2 * RES) / Math.hypot(hx0 - hx1, hz0 - hz1, 2 * RES);
      const spoil = spoilA[i] / 255;
      const trench = trenchA[i] / 255;
      const rim = rimA[i] / 255;
      const river = riverA[i] / 255;

      let r: number;
      let g: number;
      let b: number;
      if (h < 0.32 || river > 0.62) {
        const t = clamp((h + 1.3) / 1.7, 0, 1);
        r = lerp(0.15, 0.4, t);
        g = lerp(0.29, 0.56, t);
        b = lerp(0.34, 0.58, t);
      } else {
        const n = fbm(x * 0.028 + 3, z * 0.028);
        const nml = nmlMask(z);
        // Summer farmland: long Picardy strip fields of wheat, barley, clover and fallow.
        const fx = x * 0.96 + z * 0.28;
        const fz = z * 0.96 - x * 0.28;
        const cellA = Math.floor(fx / 22);
        const cellB = Math.floor(fz / (64 + hash2(cellA, 3) * 40));
        const crop = hash2(cellA, cellB);
        let fr: number;
        let fg: number;
        let fb: number;
        if (crop < 0.34) {
          fr = 0.74; fg = 0.63; fb = 0.33; // ripening wheat
        } else if (crop < 0.58) {
          fr = 0.55; fg = 0.58; fb = 0.27; // green barley
        } else if (crop < 0.78) {
          fr = 0.4; fg = 0.5; fb = 0.24; // clover and pasture
        } else {
          fr = 0.6; fg = 0.52; fb = 0.36; // fallow
        }
        const tone = 0.9 + n * 0.2;
        fr *= tone; fg *= tone; fb *= tone;
        // Untouched country fades into ground already chewed by two years of war.
        const farmS = smoothstep(96, 150, z);
        const farmN = smoothstep(-150, -205, z) * 0.55;
        const farm = clamp(farmS + farmN, 0, 1);
        const worn = 1 - farm;
        let wr = lerp(0.42, 0.5, n);
        let wg = lerp(0.42, 0.47, n);
        let wb = lerp(0.24, 0.27, n);
        // No man's land: grey brown churned earth.
        wr = lerp(wr, lerp(0.42, 0.5, n), nml);
        wg = lerp(wg, lerp(0.36, 0.42, n), nml);
        wb = lerp(wb, lerp(0.27, 0.31, n), nml);
        r = lerp(wr, fr, farm);
        g = lerp(wg, fg, farm);
        b = lerp(wb, fb, farm);
        // Poppies and cornflowers along field edges behind the lines.
        const edge = Math.min(Math.abs(fx / 22 - Math.round(fx / 22)), 0.5);
        const fleck = hash2(ix * 7 + 1, iz * 13 + 5);
        if (farm > 0.5 && ((edge < 0.07 && fleck > 0.55) || fleck > 0.985)) {
          if (fleck > 0.93) {
            r = 0.78; g = 0.12; b = 0.08;
          } else if (fleck > 0.9) {
            r = 0.34; g = 0.42; b = 0.7;
          } else {
            r = lerp(r, 0.7, 0.5); g = lerp(g, 0.16, 0.5); b = lerp(b, 0.1, 0.5);
          }
        }
        const scorch = (nml * 0.9 + worn * 0.25) * smoothstep(0.52, 0.78, fbm(x * 0.017 + 5, z * 0.017));
        r = lerp(r, 0.4, scorch);
        g = lerp(g, 0.31, scorch);
        b = lerp(b, 0.21, scorch);
        if (trench > 0.12) {
          r = lerp(r, 0.36, trench);
          g = lerp(g, 0.32, trench);
          b = lerp(b, 0.26, trench);
        }
        if (h < 1.25 && river < 0.35) {
          const m = clamp((1.25 - h) / 1.25, 0, 1) * 0.65;
          r = lerp(r, 0.3, m);
          g = lerp(g, 0.25, m);
          b = lerp(b, 0.16, m);
        }
        // Chalk: dug spoil, crater lips and the bare ridge top show white from the air.
        const chalk = clamp(spoil * 1.25 + rim * 1.1 + smoothstep(8.2, 13.5, h) * 0.75 + (nml * smoothstep(0.7, 0.86, n)) * 0.5, 0, 1);
        r = lerp(r, 0.95, chalk);
        g = lerp(g, 0.92, chalk);
        b = lerp(b, 0.83, chalk);
        const roadX = 8 + Math.sin(z * 0.016) * 16;
        if (Math.abs(x - roadX) < 2.5 && z < 268 && z > -190 && trench < 0.25 && river < 0.25 && h > 0.4) {
          r = lerp(r, 0.78, 0.72);
          g = lerp(g, 0.72, 0.72);
          b = lerp(b, 0.6, 0.72);
        }
        const ao = 0.8 + 0.2 * slope;
        r *= ao;
        g *= ao;
        b *= ao;
        const sp = (hash2(ix, iz) - 0.5) * 0.03;
        r += sp;
        g += sp;
        b += sp;
      }
      const o = i * 3;
      colors[o] = toLinear(clamp(r, 0, 1));
      colors[o + 1] = toLinear(clamp(g, 0, 1));
      colors[o + 2] = toLinear(clamp(b, 0, 1));
    }
  }

  function sample(x: number, z: number) {
    let fx = (x - X0) / RES_X;
    let fz = (z - Z0) / RES_Z;
    fx = clamp(fx, 0, COLS - 1.001);
    fz = clamp(fz, 0, ROWS - 1.001);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const i = z0 * COLS + x0;
    const h00 = heights[i];
    const h10 = heights[i + 1];
    const h01 = heights[i + COLS];
    const h11 = heights[i + COLS + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  return { cols: COLS, rows: ROWS, heights, colors, sample, polylines, pois: POIS };
}

export function describeSpot(x: number, z: number, ground: number, agl: number, depression: number) {
  let best: Poi | null = null;
  let bestD = Infinity;
  for (const p of POIS) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= p.radius && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (best) return { title: best.name, blurb: best.blurb, id: best.id as string | undefined };
  if (ground < 0.45) {
    return {
      title: "The Somme",
      blurb: "Slow water on a chalk bed. The battle is named for the river. The killing ground was the ridge beyond it.",
    };
  }
  if (depression > 3.6) {
    return {
      title: "Shell hole",
      blurb: "Artillery turned the chalk into this. Rain sat in the deeper holes. Men used them as the only cover there was.",
    };
  }
  if (depression > 1.4 && nmlMask(z) < 0.45 && agl < 18) {
    return z > -8
      ? {
          title: "British trench",
          blurb: "A fire bay. The chalk lip is the parapet. At zero hour the infantry went up this step in lines.",
        }
      : {
          title: "German trench",
          blurb: "A traverse in the front system. Dugout mouths open in the rear wall, cut down into the chalk.",
        };
  }
  if (nmlMask(z) > 0.5) {
    return {
      title: "No man's land",
      blurb: "The belt between the wire. On 1 July it was crossed on foot, in daylight.",
    };
  }
  if (z > 230) {
    return {
      title: "Albert",
      blurb: "Brick and the broken basilica, on the south bank. Everything going up to the line passed through here.",
    };
  }
  if (z < -175) {
    return {
      title: "Thiepval ridge",
      blurb: "The high ground. From here the German line looked down every approach to the north of the river.",
    };
  }
  if (z > 0) {
    return {
      title: "Behind the British line",
      blurb: "Support trenches, batteries and the track up from Albert. Never quiet, and never out of range.",
    };
  }
  return {
    title: "Behind the German line",
    blurb: "Support trenches on the reverse slope, where companies waited out of direct view.",
  };
}
