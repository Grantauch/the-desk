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
  readonly w: number;
  readonly h: number;
  readonly grid: Uint8Array;
  readonly aux: Uint8Array;
  readonly tint: Uint8Array;
  readonly locked: Uint8Array;
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

  step() {
    if (this.paused) {
      this.recount();
      this.trauma *= 0.86;
      return;
    }
    this.lastReaction = null;
    this.frame++;
    this.moved.fill(0);
    this.counts.fill(0);
    const { w, h } = this;
    let grains = 0;
    let fires = 0;

    for (let y = h - 1; y >= 0; y--) {
      const ltr = ((y + this.frame) & 1) === 0;
      for (let n = 0; n < w; n++) {
        const x = ltr ? n : w - 1 - n;
        const i = y * w + x;
        const t = this.grid[i];
        if (t !== E.EMPTY && t !== E.WALL) {
          grains++;
          this.counts[t]++;
          if (t === E.FIRE) fires++;
        }
        if (this.locked[i] || this.moved[i] || t === E.EMPTY || t === E.WALL) continue;
        this.stepCell(x, y, i, t);
      }
    }

    this.grainCount = grains;
    this.fireCount = fires;
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

  render(image: ImageData) {
    const data = image.data;
    const n = this.grid.length;
    const flickerBase = this.frame;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (this.locked[i]) {
        data[p] = 10;
        data[p + 1] = 9;
        data[p + 2] = 8;
        data[p + 3] = 0;
        continue;
      }
      const t = this.grid[i] as ElementId;
      const base = RGB[t] ?? RGB[0]!;
      const v = (this.tint[i] - 8) * 3;
      let r = base[0] + v;
      let g = base[1] + v;
      let b = base[2] + v;
      if (t === E.FIRE) {
        const f = ((flickerBase + i) * 17) & 31;
        r = Math.min(255, r + f + 20);
        g = Math.min(255, g + (f >> 1));
        b = Math.max(0, b - 8);
      } else if (t === E.LAVA) {
        const f = ((flickerBase * 3 + i) * 13) & 21;
        r = Math.min(255, r + f);
        g = Math.min(255, g + (f >> 2));
      } else if (t === E.WATER) {
        const f = ((flickerBase + i) >> 2) & 7;
        b = Math.min(255, b + f);
      } else if (t === E.EMPTY) {
        r = 14;
        g = 12;
        b = 11;
      }
      data[p] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[p + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[p + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      data[p + 3] = 255;
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
