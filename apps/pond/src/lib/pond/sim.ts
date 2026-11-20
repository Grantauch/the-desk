import {
  COLS,
  DENSITY,
  E,
  IGNITE,
  KIND,
  KIND_OF,
  RGB,
  ROWS,
  SLIDE,
  type ElementId,
} from "./elements.ts";
import { validateSnapshot } from "./save.ts";

/** Fixed, tested simulation sizes. Each expansion grants usable new cells. */
export const POND_SIZES = [192, 256, 320, 448, 576, 768] as const;

/** For the large stages, only nearby cells run a physics tick. */
export type PondRegion = Readonly<{ x: number; y: number; width: number; height: number }>;
export type PondSize = (typeof POND_SIZES)[number];
export function isPondSize(size: number): size is PondSize {
  return POND_SIZES.some((allowed) => allowed === size);
}

const OX = [-1, 0, 1, -1, 1, -1, 0, 1];
const OY = [-1, -1, -1, 0, 0, 1, 1, 1];

export type ReactionId =
  | "steam"
  | "stone"
  | "sprout"
  | "grow"
  | "boom"
  | "freeze"
  | "melt"
  | "eat"
  | "birth"
  | "fungus"
  | "acid"
  | "oilfire";

export class PondSim {
  w: number;
  h: number;
  grid: Uint8Array;
  aux: Uint8Array;
  tint: Uint8Array;
  locked: Uint8Array;
  readonly counts = new Uint32Array(21);
  frame = 0;
  trauma = 0;
  paused = false;
  grainCount = 0;
  fireCount = 0;
  lastReaction: ReactionId | null = null;
  private moved: Uint8Array;
  private cx: number;
  private cy: number;
  private r2: number;

  constructor(w = COLS, h = ROWS) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.grid = new Uint8Array(n);
    this.aux = new Uint8Array(n);
    this.tint = new Uint8Array(n);
    this.locked = new Uint8Array(n);
    this.moved = new Uint8Array(n);
    this.cx = (w - 1) / 2;
    this.cy = (h - 1) / 2;
    const r = Math.min(this.cx, this.cy) - 0.35;
    this.r2 = r * r;
    this.buildBowl();
  }

  /**
   * Resize the actual cellular universe. Contents are centered, new territory
   * starts empty, and the old bowl's glass rim is not copied into the interior.
   * Returns the coordinate offset to apply to independent living residents.
   */
  resize(size: PondSize): number {
    if (!isPondSize(size)) throw new RangeError("Unsupported Pond size");
    if (this.w !== this.h || !isPondSize(this.w)) throw new Error("Only square Pond stages can be resized");
    if (size === this.w) return 0;
    const offset = (size - this.w) / 2;
    const next = new PondSim(size, size);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const oldIndex = this.idx(x, y);
        if (this.locked[oldIndex]) continue;
        const nx = x + offset, ny = y + offset;
        if (!next.inDish(nx, ny)) continue;
        const newIndex = next.idx(nx, ny);
        next.grid[newIndex] = this.grid[oldIndex]!;
        next.aux[newIndex] = this.aux[oldIndex]!;
        next.tint[newIndex] = this.tint[oldIndex]!;
      }
    }
    this.w = size;
    this.h = size;
    this.grid = next.grid;
    this.aux = next.aux;
    this.tint = next.tint;
    this.locked = next.locked;
    this.moved = next.moved;
    this.cx = next.cx;
    this.cy = next.cy;
    this.r2 = next.r2;
    this.counts.fill(0);
    this.trauma = 0;
    this.lastReaction = null;
    return offset;
  }

  inDish(x: number, y: number) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    return dx * dx + dy * dy <= this.r2;
  }

  private buildBowl() {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!this.inDish(x, y)) {
          this.grid[i] = E.WALL;
          this.locked[i] = 1;
        } else {
          this.grid[i] = E.EMPTY;
          this.locked[i] = 0;
        }
        this.aux[i] = 0;
        this.tint[i] = (Math.random() * 16) | 0;
      }
    }
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  setCell(i: number, type: number, aux = 0) {
    this.grid[i] = type;
    this.aux[i] = aux;
    this.tint[i] = (Math.random() * 16) | 0;
  }

  clearInterior() {
    const n = this.grid.length;
    for (let i = 0; i < n; i++) {
      if (this.locked[i]) continue;
      this.grid[i] = E.EMPTY;
      this.aux[i] = 0;
    }
    this.trauma = 0;
  }

  snapshot(): Uint8Array {
    const n = this.grid.length;
    const out = new Uint8Array(n * 3);
    out.set(this.grid, 0);
    out.set(this.aux, n);
    out.set(this.tint, n * 2);
    return out;
  }

  restore(data: Uint8Array) {
    const n = this.grid.length;
    validateSnapshot(data, n);
    this.grid.set(data.subarray(0, n));
    this.aux.set(data.subarray(n, n * 2));
    this.tint.set(data.subarray(n * 2, n * 3));
    this.trauma = 0;
    this.lastReaction = null;
    for (let i = 0; i < n; i++) {
      if (this.locked[i]) {
        this.grid[i] = E.WALL;
      }
    }
  }

  paint(cx: number, cy: number, el: number, radius: number) {
    const r = Math.max(0, radius);
    const r2 = r * r;
    const fill =
      el === E.WATER || el === E.LAVA || el === E.WALL || el === E.ICE || el === E.STONE
        ? 0.94
        : el === E.FIRE
          ? 0.55
          : 0.72;
    let painted = 0;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        if (this.locked[i]) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        if (r > 1 && Math.random() > fill) continue;
        if (el === E.EMPTY) {
          this.setCell(i, E.EMPTY);
          painted++;
          continue;
        }
        this.spawn(i, el);
        painted++;
      }
    }
    return painted;
  }

  spawn(i: number, el: number) {
    let aux = 0;
    if (el === E.FIRE) aux = 14 + ((Math.random() * 22) | 0);
    else if (el === E.CRITTER) aux = Math.random() < 0.5 ? 0 : 128;
    else if (el === E.STEAM || el === E.SMOKE) aux = 20 + ((Math.random() * 30) | 0);
    this.setCell(i, el, aux);
  }

  wind(cx: number, cy: number, dx: number, dy: number, radius: number) {
    const mag = Math.hypot(dx, dy);
    if (mag < 0.15) return;
    const ux = dx / mag;
    const uy = dy / mag;
    const r = Math.max(2, radius + 2);
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        if (this.locked[i]) continue;
        const t = this.grid[i];
        if (t === E.EMPTY || t === E.WALL || KIND_OF[t] === KIND.STATIC) continue;
        const ddx = x - cx;
        const ddy = y - cy;
        if (ddx * ddx + ddy * ddy > r2) continue;
        if (Math.random() > 0.45) continue;
        const nx = x + Math.round(ux);
        const ny = y + Math.round(uy);
        if (!this.inBounds(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (this.locked[j]) continue;
        if (this.grid[j] === E.EMPTY) this.swap(i, j);
      }
    }
  }

  shake() {
    const { w, h } = this;
    this.trauma = Math.min(1, this.trauma + 0.55);
    for (let k = 0; k < 1400; k++) {
      const x = 1 + ((Math.random() * (w - 2)) | 0);
      const y = 1 + ((Math.random() * (h - 2)) | 0);
      const i = this.idx(x, y);
      if (this.locked[i]) continue;
      const t = this.grid[i];
      if (t === E.EMPTY || t === E.WALL || KIND_OF[t] === KIND.STATIC) continue;
      const nx = x + (Math.random() < 0.5 ? -1 : 1);
      const ny = y + (Math.random() < 0.35 ? -1 : 0);
      if (!this.inBounds(nx, ny)) continue;
      const j = this.idx(nx, ny);
      if (this.locked[j]) continue;
      const d = this.grid[j];
      if (d === E.EMPTY || (KIND_OF[d] === KIND.LIQUID && DENSITY[t] > DENSITY[d])) {
        this.swap(i, j);
      }
    }
  }

  private swap(i: number, j: number) {
    const g = this.grid[i];
    this.grid[i] = this.grid[j];
    this.grid[j] = g;
    const a = this.aux[i];
    this.aux[i] = this.aux[j];
    this.aux[j] = a;
    const t = this.tint[i];
    this.tint[i] = this.tint[j];
    this.tint[j] = t;
  }

  private react(id: ReactionId) {
    this.lastReaction = id;
  }

  private explode(cx: number, cy: number, radius: number) {
    this.trauma = Math.min(1, this.trauma + 0.85);
    this.react("boom");
    const r2 = radius * radius;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        if (this.locked[i]) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const roll = Math.random();
        if (roll < 0.38) this.setCell(i, E.EMPTY);
        else if (roll < 0.78) this.spawn(i, E.FIRE);
        else this.spawn(i, E.SMOKE);
      }
    }
  }

  private neighborHas(x: number, y: number, type: number) {
    for (let k = 0; k < 8; k++) {
      const nx = x + OX[k]!;
      const ny = y + OY[k]!;
      if (!this.inBounds(nx, ny)) continue;
      if (this.grid[this.idx(nx, ny)] === type) return true;
    }
    return false;
  }

  private heatNear(x: number, y: number) {
    for (let k = 0; k < 8; k++) {
      const nx = x + OX[k]!;
      const ny = y + OY[k]!;
      if (!this.inBounds(nx, ny)) continue;
      const t = this.grid[this.idx(nx, ny)];
      if (t === E.FIRE || t === E.LAVA) return true;
    }
    return false;
  }

  private tryMove(x: number, y: number, i: number, dx: number, dy: number) {
    const nx = x + dx;
    const ny = y + dy;
    if (!this.inBounds(nx, ny)) return false;
    const j = this.idx(nx, ny);
    if (this.locked[j] || this.moved[j]) return false;
    const src = this.grid[i];
    const dst = this.grid[j];
    if (dst === E.EMPTY) {
      this.swap(i, j);
      this.moved[j] = 1;
      return true;
    }
    if (dst === E.WALL || KIND_OF[dst] === KIND.STATIC || dst === E.CRITTER) return false;
    if (DENSITY[src] > DENSITY[dst] && KIND_OF[dst] !== KIND.GAS) {
      this.swap(i, j);
      this.moved[j] = 1;
      return true;
    }
    return false;
  }

  private flowPowder(x: number, y: number, i: number) {
    if (this.tryMove(x, y, i, 0, 1)) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (this.tryMove(x, y, i, dir, 1)) return;
    this.tryMove(x, y, i, -dir, 1);
  }

  private flowLiquid(x: number, y: number, i: number, slide: number) {
    if (this.tryMove(x, y, i, 0, 1)) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (this.tryMove(x, y, i, dir, 1)) return;
    if (this.tryMove(x, y, i, -dir, 1)) return;
    if (this.tryMove(x, y, i, dir, 0)) return;
    if (this.tryMove(x, y, i, -dir, 0)) return;
    if (slide >= 2 && this.tryMove(x, y, i, dir * 2, 0)) return;
    if (slide >= 3 && this.tryMove(x, y, i, dir * 3, 0)) return;
  }

  private flowGas(x: number, y: number, i: number) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (this.tryMove(x, y, i, 0, -1)) return;
    if (this.tryMove(x, y, i, dir, -1)) return;
    if (this.tryMove(x, y, i, -dir, -1)) return;
    if (this.tryMove(x, y, i, dir, 0)) return;
    this.tryMove(x, y, i, -dir, 0);
  }

  step(region?: PondRegion) {
    if (this.paused) {
      // Recount only on an occasional paused tick; no cell is moving.
      if (this.frame === 0 || !region) this.recount();
      this.trauma *= 0.86;
      return;
    }
    this.lastReaction = null;
    this.frame++;
    this.moved.fill(0);
    if (!region) this.counts.fill(0);
    const { w, h } = this;
    let grains = 0;
    let fires = 0;
    // An offscreen region is dormant until its camera arrives. A 6-cell
    // simulation apron keeps materials moving naturally near the viewport rim.
    const apron = 6;
    const x0 = region ? Math.max(0, Math.floor(region.x) - apron) : 0;
    const y0 = region ? Math.max(0, Math.floor(region.y) - apron) : 0;
    const x1 = region ? Math.min(w, Math.ceil(region.x + region.width) + apron) : w;
    const y1 = region ? Math.min(h, Math.ceil(region.y + region.height) + apron) : h;
    for (let y = y1 - 1; y >= y0; y--) {
      const ltr = ((y + this.frame) & 1) === 0;
      for (let n = 0; n < x1 - x0; n++) {
        const x = ltr ? x0 + n : x1 - 1 - n;
        const i = y * w + x;
        const t = this.grid[i]!;
        if (!region && t !== E.EMPTY && t !== E.WALL) {
          grains++;
          this.counts[t]++;
          if (t === E.FIRE) fires++;
        }
        if (this.locked[i] || this.moved[i] || t === E.EMPTY || t === E.WALL) continue;
        this.stepCell(x, y, i, t);
      }
    }
    if (region) {
      // Aggregate world totals outside the hot loop at ~1.5 second intervals.
      // This never advances particles in distant inactive territory.
      if (this.frame % 72 === 1) this.recount();
    } else {
      this.grainCount = grains;
      this.fireCount = fires;
    }
    this.trauma *= 0.86;
  }

  recount() {
    this.counts.fill(0);
    this.grainCount = 0;
    this.fireCount = 0;
    for (const cell of this.grid) {
      if (cell === E.EMPTY || cell === E.WALL) continue;
      this.grainCount++;
      this.counts[cell]++;
      if (cell === E.FIRE) this.fireCount++;
    }
  }

  private stepCell(x: number, y: number, i: number, t: number) {
    switch (t) {
      case E.SAND:
      case E.SALT:
      case E.SEED:
      case E.POWDER:
      case E.SNOW:
        this.stepPowder(x, y, i, t);
        return;
      case E.WATER:
      case E.OIL:
      case E.ACID:
      case E.SLIME:
      case E.LAVA:
        this.stepLiquid(x, y, i, t);
        return;
      case E.FIRE:
        this.stepFire(x, y, i);
        return;
      case E.STEAM:
      case E.SMOKE:
        this.stepGas(x, y, i, t);
        return;
      case E.PLANT:
        this.stepPlant(x, y, i);
        return;
      case E.FUNGUS:
        this.stepFungus(x, y, i);
        return;
      case E.ICE:
        this.stepIce(x, y, i);
        return;
      case E.WOOD:
      case E.STONE:
        this.stepStatic(x, y, i, t);
        return;
      case E.CRITTER:
        this.stepCritter(x, y, i);
        return;
      default:
        return;
    }
  }

  private stepPowder(x: number, y: number, i: number, t: number) {
    if (t === E.SALT && this.neighborHas(x, y, E.WATER) && Math.random() < 0.08) {
      this.setCell(i, E.EMPTY);
      return;
    }
    if (t === E.SNOW && this.heatNear(x, y) && Math.random() < 0.2) {
      this.spawn(i, E.WATER);
      this.react("melt");
      return;
    }
    if (t === E.SEED) {
      const below = y + 1 < this.h ? this.grid[this.idx(x, y + 1)] : E.WALL;
      if (
        (below === E.SAND || below === E.PLANT) &&
        this.neighborHas(x, y, E.WATER) &&
        Math.random() < 0.04
      ) {
        this.spawn(i, E.PLANT);
        this.react("sprout");
        return;
      }
    }
    if (t === E.POWDER && this.neighborHas(x, y, E.FIRE)) {
      this.explode(x, y, 5 + ((Math.random() * 3) | 0));
      return;
    }
    this.flowPowder(x, y, i);
  }

  private stepLiquid(x: number, y: number, i: number, t: number) {
    if (t === E.WATER) {
      if (this.heatNear(x, y) && Math.random() < 0.25) {
        this.spawn(i, E.STEAM);
        this.react("steam");
        return;
      }
      if (this.neighborHas(x, y, E.ICE) && Math.random() < 0.03) {
        this.spawn(i, E.ICE);
        this.react("freeze");
        return;
      }
    }
    if (t === E.LAVA) {
      if (this.neighborHas(x, y, E.WATER) || this.neighborHas(x, y, E.ICE)) {
        this.spawn(i, Math.random() < 0.55 ? E.STONE : E.STEAM);
        this.react("stone");
        this.trauma = Math.min(1, this.trauma + 0.08);
        return;
      }
      if (Math.random() < 0.0018 && !this.neighborHas(x, y, E.LAVA)) {
        this.spawn(i, E.STONE);
        return;
      }
    }
    if (t === E.OIL && this.neighborHas(x, y, E.FIRE) && Math.random() < 0.5) {
      this.spawn(i, E.FIRE);
      this.react("oilfire");
      return;
    }
    if (t === E.ACID && Math.random() < 0.08) {
      for (let k = 0; k < 8; k++) {
        const nx = x + OX[k]!;
        const ny = y + OY[k]!;
        if (!this.inBounds(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (this.locked[j]) continue;
        const d = this.grid[j];
        if (d === E.STONE || d === E.WOOD || d === E.PLANT || d === E.FUNGUS || d === E.CRITTER) {
          this.setCell(j, E.EMPTY);
          if (Math.random() < 0.2) this.setCell(i, E.EMPTY);
          this.react("acid");
          break;
        }
      }
    }
    this.flowLiquid(x, y, i, SLIDE[t] ?? 2);
  }

  private stepFire(x: number, y: number, i: number) {
    const life = this.aux[i];
    if (life <= 1) {
      this.spawn(i, Math.random() < 0.45 ? E.SMOKE : E.EMPTY);
      return;
    }
    this.aux[i] = life - 1;
    if (this.neighborHas(x, y, E.WATER) || this.neighborHas(x, y, E.ICE)) {
      this.spawn(i, E.STEAM);
      this.react("steam");
      return;
    }
    for (let k = 0; k < 8; k++) {
      const nx = x + OX[k]!;
      const ny = y + OY[k]!;
      if (!this.inBounds(nx, ny)) continue;
      const j = this.idx(nx, ny);
      if (this.locked[j]) continue;
      const d = this.grid[j];
      const chance = IGNITE[d] ?? 0;
      if (chance && Math.random() * 100 < chance) {
        if (d === E.POWDER) {
          this.explode(nx, ny, 6);
          return;
        }
        if (d === E.OIL) this.react("oilfire");
        this.spawn(j, E.FIRE);
        this.moved[j] = 1;
      }
    }
    this.flowGas(x, y, i);
  }

  private stepGas(x: number, y: number, i: number, t: number) {
    const life = this.aux[i];
    if (life <= 1) {
      if (t === E.STEAM && Math.random() < 0.55) {
        this.spawn(i, E.WATER);
      } else {
        this.setCell(i, E.EMPTY);
      }
      return;
    }
    this.aux[i] = life - 1;
    if (t === E.STEAM && y < 4 && Math.random() < 0.08) {
      this.spawn(i, E.WATER);
      return;
    }
    this.flowGas(x, y, i);
  }

  private stepPlant(x: number, y: number, i: number) {
    if (this.heatNear(x, y) && Math.random() < 0.04) {
      this.spawn(i, E.FIRE);
      return;
    }
    if (Math.random() > 0.018) return;
    const wet = this.neighborHas(x, y, E.WATER) || this.neighborHas(x, y, E.SEED);
    if (!wet && Math.random() < 0.7) return;
    const dirs = [
      [0, -1],
      [-1, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
    ];
    const d = dirs[(Math.random() * dirs.length) | 0]!;
    const nx = x + d[0]!;
    const ny = y + d[1]!;
    if (!this.inBounds(nx, ny)) return;
    const j = this.idx(nx, ny);
    if (this.locked[j]) return;
    if (this.grid[j] === E.EMPTY || this.grid[j] === E.WATER) {
      this.spawn(j, E.PLANT);
      this.react("grow");
    }
  }

  private stepFungus(x: number, y: number, i: number) {
    if (this.heatNear(x, y) && Math.random() < 0.08) {
      this.spawn(i, E.FIRE);
      return;
    }
    if (Math.random() > 0.03) return;
    const k = (Math.random() * 8) | 0;
    const nx = x + OX[k]!;
    const ny = y + OY[k]!;
    if (!this.inBounds(nx, ny)) return;
    const j = this.idx(nx, ny);
    if (this.locked[j]) return;
    const d = this.grid[j];
    if (d === E.PLANT || d === E.WOOD || (d === E.EMPTY && Math.random() < 0.08)) {
      this.spawn(j, E.FUNGUS);
      this.react("fungus");
    }
  }

  private stepIce(x: number, y: number, i: number) {
    if (this.heatNear(x, y) && Math.random() < 0.12) {
      this.spawn(i, E.WATER);
      this.react("melt");
    }
  }

  private stepStatic(x: number, y: number, i: number, t: number) {
    if (t === E.STONE && this.neighborHas(x, y, E.LAVA) && Math.random() < 0.01) {
      this.spawn(i, E.LAVA);
    }
    if (t === E.WOOD && this.heatNear(x, y) && Math.random() < 0.03) {
      this.spawn(i, E.FIRE);
    }
  }

  private stepCritter(x: number, y: number, i: number) {
    if (this.heatNear(x, y) && Math.random() < 0.35) {
      this.spawn(i, E.SMOKE);
      return;
    }
    const belowY = y + 1;
    if (belowY < this.h) {
      const below = this.grid[this.idx(x, belowY)];
      if (below === E.EMPTY || KIND_OF[below] === KIND.GAS) {
        this.tryMove(x, y, i, 0, 1);
        return;
      }
      if (below === E.WATER || below === E.OIL || below === E.ACID || below === E.LAVA) {
        if (Math.random() < 0.04) {
          this.setCell(i, E.EMPTY);
          return;
        }
        if (this.tryMove(x, y, i, Math.random() < 0.5 ? -1 : 1, -1)) return;
      }
    }
    for (let k = 0; k < 8; k++) {
      const nx = x + OX[k]!;
      const ny = y + OY[k]!;
      if (!this.inBounds(nx, ny)) continue;
      const j = this.idx(nx, ny);
      const d = this.grid[j];
      if (d === E.PLANT && Math.random() < 0.08) {
        this.setCell(j, E.EMPTY);
        const food = (this.aux[i] & 127) + 1;
        const dir = this.aux[i] & 128;
        this.aux[i] = dir | Math.min(127, food);
        this.react("eat");
        if (food >= 6 && this.counts[E.CRITTER] < 280) {
          for (let q = 0; q < 8; q++) {
            const bx = x + OX[q]!;
            const by = y + OY[q]!;
            if (!this.inBounds(bx, by)) continue;
            const bi = this.idx(bx, by);
            if (this.locked[bi]) continue;
            if (this.grid[bi] === E.EMPTY) {
              this.spawn(bi, E.CRITTER);
              this.aux[i] = dir;
              this.react("birth");
              break;
            }
          }
        }
        return;
      }
    }
    let dir = (this.aux[i] & 128) === 0 ? -1 : 1;
    if (Math.random() < 0.04) dir = -dir;
    if (!this.tryMove(x, y, i, dir, 0)) {
      if (!this.tryMove(x, y, i, dir, -1)) {
        dir = -dir;
        this.tryMove(x, y, i, dir, 0);
      }
    }
    const food = this.aux[i] & 127;
    this.aux[i] = (dir < 0 ? 0 : 128) | food;
  }

  /**
   * Render only the camera crop at native pixel resolution. Image width and
   * height may be far smaller than the world, avoiding large canvas uploads.
   */
  /**
   * Pixel-art lighting is derived entirely from existing cells and the frame
   * number. No extra simulation state, textures, assets, or GPU passes.
   *
   * Enhanced is the default; classic exactly retains the older palette-based
   * appearance for reduced load or personal preference.
   */
  render(image: ImageData, originX = 0, originY = 0, enhanced = true) {
    const data = image.data;
    const width = image.width;
    const height = image.height;
    const worldWidth = this.w;
    const worldHeight = this.h;
    const frame = this.frame;
    const grid = this.grid;
    const tint = this.tint;
    const locked = this.locked;

    for (let y = 0; y < height; y++) {
      const wy = y + originY;
      const row = wy * worldWidth;
      for (let x = 0; x < width; x++) {
        const wx = x + originX;
        const i = row + wx;
        const pixel = (y * width + x) * 4;
        if (locked[i]) {
          data[pixel] = 10;
          data[pixel + 1] = 9;
          data[pixel + 2] = 8;
          data[pixel + 3] = 0;
          continue;
        }
        const material = grid[i] as ElementId;
        const color = RGB[material] ?? RGB[0]!;
        const shade = (tint[i]! - 8) * (enhanced ? 2.5 : 3);
        let r = color[0] + shade;
        let g = color[1] + shade;
        let b = color[2] + shade;

        if (!enhanced) {
          // Identical visual rules to the earlier engine.
          if (material === E.FIRE) {
            const flicker = ((frame + i) * 17) & 31;
            r = Math.min(255, r + flicker + 20);
            g = Math.min(255, g + (flicker >> 1));
            b -= 8;
          } else if (material === E.LAVA) {
            const flicker = ((frame * 3 + i) * 13) & 21;
            r += flicker;
            g += flicker >> 2;
          } else if (material === E.WATER) {
            b += ((frame + i) >> 2) & 7;
          } else if (material === E.EMPTY) {
            r = 14;
            g = 12;
            b = 11;
          }
        } else {
          // Integer-only texture noise: stable in world coordinates when the
          // player pans, while movement uses just the current frame counter.
          const noise = (wx * 37 ^ wy * 73 ^ tint[i]! * 31) >>> 0;
          const grain = (noise & 15) - 7;
          const above = wy > 0 ? grid[i - worldWidth] : E.WALL;
          const below = wy + 1 < worldHeight ? grid[i + worldWidth] : E.WALL;
          const left = wx > 0 ? grid[i - 1] : E.WALL;
          const right = wx + 1 < worldWidth ? grid[i + 1] : E.WALL;
          const exposed = above === E.EMPTY || above === E.STEAM || above === E.SMOKE;

          switch (material) {
            case E.EMPTY: {
              // An almost-black mineral bed with subtle stable texture.
              const speck = (noise & 63) === 0 ? 8 : 0;
              r = 14 + (grain >> 2) + speck;
              g = 18 + (grain >> 2) + speck;
              b = 21 + (grain >> 2) + speck;
              if (above === E.FIRE || below === E.FIRE || left === E.FIRE || right === E.FIRE ||
                  above === E.LAVA || below === E.LAVA) {
                r += 33;
                g += 11;
                b += 1;
              }
              break;
            }
            case E.WATER: {
              const surface = above !== E.WATER && above !== E.SLIME;
              // Deep water is teal blue; peaks reflect a mobile stripe of light.
              const depth = surface ? 0 : -18;
              const ripple = ((wx * 3 + wy + (frame >> 1)) & 31) < 5;
              r = 27 + grain + depth;
              g = 112 + (grain >> 1) + depth + (surface ? 30 : 0);
              b = 159 + grain + depth + (surface ? 38 : 0);
              if (surface && ripple) {
                r += 64;
                g += 67;
                b += 51;
              } else if ((noise & 63) === 2) {
                g += 13;
                b += 16;
              }
              break;
            }
            case E.SAND:
            case E.SALT:
            case E.POWDER: {
              const topLight = exposed ? 17 : -3;
              r += grain * 1.6 + topLight;
              g += grain + topLight * 0.75;
              b += (grain >> 1) + topLight * 0.45;
              if ((noise & 31) === 7) { r += 26; g += 20; b += 12; }
              break;
            }
            case E.STONE: {
              const crack = ((wx * 3 + wy * 11 + (noise & 7)) % 29) === 0;
              r += (grain >> 1) + (exposed ? 13 : -4) - (crack ? 25 : 0);
              g += (grain >> 1) + (exposed ? 14 : -3) - (crack ? 23 : 0);
              b += (grain >> 1) + (exposed ? 17 : -2) - (crack ? 21 : 0);
              break;
            }
            case E.WOOD: {
              const vein = ((wx + (wy >> 1) + (noise & 3)) & 7) < 2;
              r += vein ? -17 : 11;
              g += vein ? -12 : 4;
              b += vein ? -8 : -1;
              if (exposed) { r += 12; g += 9; b += 6; }
              break;
            }
            case E.ICE: {
              const facet = ((wx * 3 - wy * 5 + (noise & 15)) & 31) < 3;
              r += facet ? 48 : -10;
              g += facet ? 31 : 0;
              b += facet ? 24 : 9;
              if (exposed) { r += 12; g += 10; b += 9; }
              break;
            }
            case E.FIRE: {
              const flicker = ((frame * 9 + i * 17) & 31);
              r += 32 + flicker;
              g += 18 + (flicker << 1);
              b -= 23;
              if (exposed) { r += 8; g += 13; }
              break;
            }
            case E.LAVA: {
              const pulse = ((frame * 3 + wx * 11 + wy * 7) & 31);
              const rim = left !== E.LAVA || right !== E.LAVA || above !== E.LAVA;
              r += pulse + (rim ? 34 : 0);
              g += (pulse >> 1) + (rim ? 31 : -11);
              b -= rim ? 4 : 15;
              break;
            }
            case E.PLANT:
            case E.SEED:
            case E.FUNGUS: {
              const tip = exposed && (noise & 3) === 0;
              r += (grain >> 1) + (tip ? 17 : -4);
              g += grain + (tip ? 44 : 4);
              b += grain + (tip ? 9 : 2);
              break;
            }
            case E.STEAM:
            case E.SMOKE: {
              const wisps = ((wx * 7 + wy * 3 + (frame >> 2)) & 31) < 6;
              r += grain + (wisps ? 14 : -8);
              g += grain + (wisps ? 15 : -5);
              b += grain + (wisps ? 21 : 0);
              break;
            }
            case E.SNOW: {
              const glint = (noise & 31) === 0;
              r += glint ? 29 : -4;
              g += glint ? 24 : 0;
              b += glint ? 18 : 1;
              break;
            }
            case E.OIL: {
              const sheen = ((wx + (frame >> 2) + (wy >> 1)) & 31) < 3;
              if (sheen && exposed) { r += 29; g += 29; b += 37; }
              break;
            }
            case E.ACID:
            case E.SLIME: {
              const glow = (noise & 15) === 2;
              r += glow ? 8 : -5;
              g += glow ? 42 : 11;
              b += glow ? 18 : 8;
              break;
            }
            case E.CRITTER: {
              const eyes = (noise & 7) === 2;
              r += eyes ? 35 : 5;
              g += eyes ? 17 : 0;
              b += eyes ? 9 : 3;
              break;
            }
          }
        }

        data[pixel] = r < 0 ? 0 : r > 255 ? 255 : r;
        data[pixel + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        data[pixel + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        data[pixel + 3] = 255;
      }
    }
  }
}

export type SceneId = "blank" | "beach" | "volcano" | "garden" | "storm" | "freeze";

export const SCENES: { id: SceneId; name: string }[] = [
  { id: "blank", name: "Blank" },
  { id: "beach", name: "Beach" },
  { id: "volcano", name: "Peak" },
  { id: "garden", name: "Garden" },
  { id: "storm", name: "Storm" },
  { id: "freeze", name: "Frost" },
];

export function loadScene(sim: PondSim, id: SceneId) {
  sim.clearInterior();
  const { w, h } = sim;
  const cx = (w / 2) | 0;
  const cy = (h / 2) | 0;

  const disk = (x: number, y: number, r: number, el: number, fill = 0.85) => {
    for (let yy = y - r; yy <= y + r; yy++) {
      for (let xx = x - r; xx <= x + r; xx++) {
        if (!sim.inBounds(xx, yy)) continue;
        const i = sim.idx(xx, yy);
        if (sim.locked[i]) continue;
        const dx = xx - x;
        const dy = yy - y;
        if (dx * dx + dy * dy > r * r) continue;
        if (Math.random() > fill) continue;
        sim.spawn(i, el);
      }
    }
  };

  if (id === "blank") return;

  if (id === "beach") {
    for (let y = cy + 18; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = sim.idx(x, y);
        if (sim.locked[i]) continue;
        const shore = x > cx + 10 ? E.SAND : x > cx - 8 ? (y > cy + 28 ? E.SAND : E.WATER) : E.WATER;
        if (Math.random() < 0.92) sim.spawn(i, shore);
      }
    }
    disk(cx + 36, cy + 8, 6, E.SAND, 0.9);
    disk(cx + 40, cy + 2, 3, E.PLANT, 0.6);
    disk(cx + 28, cy + 12, 2, E.SEED, 0.5);
    return;
  }

  if (id === "volcano") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = sim.idx(x, y);
        if (sim.locked[i]) continue;
        const dx = x - cx;
        const slope = cy + 8 + Math.abs(dx) * 0.85 - (y - 20);
        if (y > cy + 36 && Math.abs(dx) > 18) {
          if (Math.random() < 0.9) sim.spawn(i, E.STONE);
        } else if (slope > 0 && y > 40 && Math.abs(dx) < 28 + (y - 40) * 0.35) {
          const inner = Math.abs(dx) < 6 && y < cy + 20;
          sim.spawn(i, inner ? E.LAVA : E.STONE);
        }
      }
    }
    disk(cx, cy - 8, 7, E.LAVA, 0.95);
    disk(cx - 40, cy + 40, 10, E.WATER, 0.9);
    disk(cx + 32, 36, 8, E.SNOW, 0.7);
    return;
  }

  if (id === "garden") {
    for (let y = cy + 22; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = sim.idx(x, y);
        if (sim.locked[i]) continue;
        if (Math.random() < 0.9) sim.spawn(i, E.SAND);
      }
    }
    disk(cx, cy + 18, 16, E.WATER, 0.85);
    for (let k = 0; k < 18; k++) {
      const x = 30 + ((Math.random() * (w - 60)) | 0);
      disk(x, cy + 16, 2, E.SEED, 0.8);
      disk(x, cy + 12, 2, E.PLANT, 0.7);
    }
    disk(cx - 24, cy + 8, 3, E.CRITTER, 0.5);
    disk(cx + 30, cy + 6, 2, E.FUNGUS, 0.4);
    return;
  }

  if (id === "storm") {
    for (let y = cy + 30; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = sim.idx(x, y);
        if (sim.locked[i]) continue;
        sim.spawn(i, Math.random() < 0.7 ? E.STONE : E.SAND);
      }
    }
    for (let k = 0; k < 900; k++) {
      const x = ((Math.random() * w) | 0);
      const y = 12 + ((Math.random() * 50) | 0);
      const i = sim.idx(x, y);
      if (sim.locked[i]) continue;
      sim.spawn(i, Math.random() < 0.7 ? E.WATER : E.STEAM);
    }
    disk(cx - 20, 28, 10, E.WATER, 0.5);
    disk(cx + 24, 22, 8, E.STEAM, 0.6);
    return;
  }

  if (id === "freeze") {
    for (let y = cy + 8; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = sim.idx(x, y);
        if (sim.locked[i]) continue;
        const el = y > cy + 34 ? E.ICE : Math.random() < 0.55 ? E.WATER : E.SNOW;
        if (Math.random() < 0.9) sim.spawn(i, el);
      }
    }
    disk(cx, cy - 10, 14, E.SNOW, 0.45);
    disk(cx - 28, cy + 4, 6, E.ICE, 0.9);
    disk(cx + 26, cy + 20, 5, E.WOOD, 0.85);
    return;
  }
}
