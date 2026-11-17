import { Soundboard } from "./audio";
import {
  BLOCK_SET,
  CELL,
  COLS,
  ENEMIES,
  MANUAL_BONUS,
  PATH_SET,
  ROWS,
  SELL_RATE,
  START_GOLD,
  START_LIVES,
  TOWERS,
  WAVES,
  WAYPOINTS,
  WORLD_H,
  WORLD_W,
  buildSchedule,
  cellKey,
  towerDamage,
  towerRate,
  upgradeCost,
  type EnemyKind,
  type Phase,
  type Priority,
  type TowerKind,
} from "./data";

export interface Tower {
  id: number;
  kind: TowerKind;
  c: number;
  r: number;
  x: number;
  y: number;
  dmgRank: number;
  rateRank: number;
  spent: number;
  cd: number;
  angle: number;
  priority: Priority;
}

export interface Creep {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  dist: number;
  wp: number;
  alive: boolean;
  slow: number;
  angle: number;
  flash: number;
  lane: number;
}

export interface Shot {
  id: number;
  kind: TowerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  vsArmor: number;
  splash: number;
  ttl: number;
  homing: number | null;
  mortar: boolean;
  age: number;
  duration: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  hitR: number;
}

export interface Boom {
  x: number;
  y: number;
  age: number;
  life: number;
  scale: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  age: number;
  life: number;
  tone: "cream" | "accent" | "primary";
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  tone: "brass" | "cream" | "crimson";
}

export interface Hud {
  phase: Phase;
  gold: number;
  lives: number;
  wave: number;
  waveCount: number;
  waveName: string;
  hint: string;
  armed: TowerKind | null;
  paused: boolean;
  speed: 1 | 2;
  muted: boolean;
  mannedId: number | null;
  selected: {
    id: number;
    kind: TowerKind;
    dmgRank: number;
    rateRank: number;
    priority: Priority;
    spent: number;
  } | null;
  bestWave: number;
  victories: number;
  left: number;
  flash: number;
}

interface Save {
  v: 1;
  bestWave: number;
  victories: number;
}

const SAVE_KEY = "blitzkrieg-save-v1";
const AIR_LIFT = 34;

function loadSave(): Save {
  if (typeof localStorage === "undefined") return { v: 1, bestWave: 0, victories: 0 };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { v: 1, bestWave: 0, victories: 0 };
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.v !== 1) return { v: 1, bestWave: 0, victories: 0 };
    return {
      v: 1,
      bestWave: typeof parsed.bestWave === "number" ? parsed.bestWave : 0,
      victories: typeof parsed.victories === "number" ? parsed.victories : 0,
    };
  } catch {
    return { v: 1, bestWave: 0, victories: 0 };
  }
}

export function aimOf(e: Creep): { x: number; y: number } {
  return { x: e.x, y: e.y - (ENEMIES[e.kind].air ? AIR_LIFT : 0) };
}

export function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function hypot(x: number, y: number): number {
  return Math.hypot(x, y);
}

export class Game {
  phase: Phase = "briefing";
  gold = START_GOLD;
  lives = START_LIVES;
  waveIndex = 0;
  paused = false;
  speed: 1 | 2 = 1;
  towers: Tower[] = [];
  creeps: Creep[] = [];
  shots: Shot[] = [];
  booms: Boom[] = [];
  floaters: Floater[] = [];
  particles: Particle[] = [];
  armed: TowerKind | null = null;
  selectedId: number | null = null;
  mannedId: number | null = null;
  aim = { x: WORLD_W / 2, y: WORLD_H / 2 };
  hover: { c: number; r: number } | null = null;
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
  images = new Map<string, HTMLImageElement>();
  clock = 0;
  spawnI = 0;
  schedule: { t: number; kind: EnemyKind }[] = [];
  save: Save = { v: 1, bestWave: 0, victories: 0 };
  audio: Soundboard;

  private nextId = 1;
  private acc = 0;
  private hudAcc = 0;
  private dirty = true;
  private listeners = new Set<() => void>();

  constructor(audio?: Soundboard) {
    this.audio = audio ?? new Soundboard();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  hydrateSave(): void {
    this.save = loadSave();
    this.dirty = true;
    this.emit();
  }

  markDirty(): void {
    this.dirty = true;
  }

  setImage(key: string, img: HTMLImageElement): void {
    this.images.set(key, img);
    this.dirty = true;
  }

  setView(w: number, h: number, dpr: number): void {
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    this.dpr = dpr;
  }

  hud(): Hud {
    const selected = this.towers.find((t) => t.id === this.selectedId) ?? null;
    const wave = WAVES[this.waveIndex];
    const left =
      this.phase === "combat"
        ? this.creeps.length + Math.max(0, this.schedule.length - this.spawnI)
        : 0;
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
      selected: selected
        ? {
            id: selected.id,
            kind: selected.kind,
            dmgRank: selected.dmgRank,
            rateRank: selected.rateRank,
            priority: selected.priority,
            spent: selected.spent,
          }
        : null,
      bestWave: this.save.bestWave,
      victories: this.save.victories,
      left,
      flash: this.flash,
    };
  }

  frame(dt: number): void {
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

  private tickView(dt: number): void {
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

  tick(dt: number): void {
    if (this.phase !== "combat") return;
    this.clock += dt;
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) {
        this.hint = "";
        this.dirty = true;
      }
    }
    while (this.spawnI < this.schedule.length && this.schedule[this.spawnI]!.t <= this.clock) {
      if (this.phase !== "combat") break;
      this.spawn(this.schedule[this.spawnI]!.kind);
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

  private ageJuice(dt: number): void {
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

  private clearWave(): void {
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

  private noteCleared(n: number): void {
    if (n > this.save.bestWave) {
      this.save.bestWave = n;
      this.persist();
    }
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* ignore quota */
    }
  }

  dismissBriefing(): void {
    if (this.phase !== "briefing") return;
    this.phase = "deploy";
    this.audio.unlock();
    this.audio.play("ui");
    this.dirty = true;
  }

  restart(): void {
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

  togglePause(): void {
    if (this.phase !== "combat") return;
    this.paused = !this.paused;
    this.dirty = true;
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.dirty = true;
  }

  toggleMute(): void {
    this.audio.toggle();
    this.dirty = true;
  }

  arm(kind: TowerKind | null): void {
    if (this.phase === "briefing" || this.phase === "victory" || this.phase === "defeat") return;
    this.armed = this.armed === kind ? null : kind;
    if (this.armed) this.audio.play("ui");
    this.dirty = true;
  }

  startWave(): void {
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

  man(id: number | null): void {
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

  unman(): void {
    if (this.mannedId === null && !this.mouseFire) return;
    this.mannedId = null;
    this.mouseFire = false;
    this.keyFire = false;
    this.btnFire = false;
    this.dirty = true;
  }

  setPriority(priority: Priority): void {
    const tower = this.towers.find((t) => t.id === this.selectedId);
    if (!tower) return;
    tower.priority = priority;
    this.dirty = true;
  }

  upgrade(id: number, track: "dmg" | "rate"): boolean {
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

  sell(id: number): void {
    const index = this.towers.findIndex((t) => t.id === id);
    if (index < 0) return;
    const tower = this.towers[index]!;
    const refund = Math.floor(tower.spent * SELL_RATE);
    this.gold += refund;
    this.floater(tower.x, tower.y, `+${refund} zł`, "accent");
    this.towers.splice(index, 1);
    if (this.selectedId === id) this.selectedId = null;
    if (this.mannedId === id) this.unman();
    this.audio.play("ui");
    this.dirty = true;
  }

  canBuild(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    const key = cellKey(c, r);
    if (PATH_SET.has(key) || BLOCK_SET.has(key)) return false;
    return !this.towers.some((t) => t.c === c && t.r === r);
  }

  tryPlace(kind: TowerKind, c: number, r: number): boolean {
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
    const tower: Tower = {
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
      priority: kind === "at" ? "strong" : "first",
    };
    this.towers.push(tower);
    this.selectedId = tower.id;
    this.armed = null;
    this.audio.play("place");
    this.dirty = true;
    return true;
  }

  pointerDown(world: { x: number; y: number }, pointer: "mouse" | "touch" | "pen", detail: number): void {
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

  pointerMove(world: { x: number; y: number }): void {
    this.hover = cellAt(world.x, world.y);
    if (this.mannedId !== null) this.aim = world;
  }

  pointerUp(): void {
    this.mouseFire = false;
  }

  blur(): void {
    this.mouseFire = false;
    this.keyFire = false;
    this.btnFire = false;
  }

  setBtnFire(on: boolean): void {
    this.btnFire = on;
  }

  setKeyFire(on: boolean): void {
    this.keyFire = on;
  }

  private firing(): boolean {
    return this.mouseFire || this.keyFire || this.btnFire;
  }

  private spawn(kind: EnemyKind): void {
    const def = ENEMIES[kind];
    const start = WAYPOINTS[0]!;
    const next = WAYPOINTS[1] ?? start;
    const creep: Creep = {
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
      lane: ((this.nextId % 5) - 2) * 6,
    };
    this.creeps.push(creep);
  }

  private moveCreep(e: Creep, dt: number): void {
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
      e.vx = (dx / dist) * speed;
      e.vy = (dy / dist) * speed;
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
      e.dist += step;
      e.angle = Math.atan2(e.vy, e.vx);
    }
  }

  private leak(e: Creep): void {
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

  private runTower(tower: Tower, dt: number): void {
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

  private pickTarget(tower: Tower): Creep | null {
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

  private eligible(tower: Tower, e: Creep): boolean {
    if (ENEMIES[e.kind].air && tower.kind !== "aa") return false;
    const def = TOWERS[tower.kind];
    const p = aimOf(e);
    const d2 = (p.x - tower.x) ** 2 + (p.y - tower.y) ** 2;
    if (d2 > def.range * def.range) return false;
    if (def.minRange && d2 < def.minRange * def.minRange) return false;
    return true;
  }

  private bestOf(tower: Tower, pool: Creep[]): Creep | null {
    let best: Creep | null = null;
    for (const e of pool) {
      if (!best || preferred(tower, e, best)) best = e;
    }
    return best;
  }

  private fire(tower: Tower, tx: number, ty: number, manual: boolean): void {
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
        hitR: 10,
      });
    } else {
      const spd = def.shotSpeed;
      let homing: number | null = null;
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
        hitR: tower.kind === "at" ? 16 : 12,
      });
    }
    this.muzzle(tower.x + Math.cos(ang) * 18, tower.y + Math.sin(ang) * 18);
    this.audio.play(tower.kind);
    if (!this.reduce) this.shake = Math.max(this.shake, tower.kind === "at" ? 2.2 : 0.6);
  }

  private moveShot(shot: Shot, dt: number): void {
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

  private explode(x: number, y: number, dmg: number, vsArmor: number, radius: number): void {
    this.boom(x, y, 1);
    if (!this.reduce) this.shake = Math.max(this.shake, 4.5);
    this.audio.play("boom");
    for (const e of this.creeps) {
      if (!e.alive || ENEMIES[e.kind].air) continue;
      const d = hypot(e.x - x, e.y - y);
      if (d > radius) continue;
      const falloff = 1 - (d / radius) * 0.5;
      this.hurt(e, dmg * falloff * mitigate(e, vsArmor, "mortar"));
      e.slow = Math.max(e.slow, 1.25);
    }
  }

  private hurt(e: Creep, amount: number): void {
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

  private boom(x: number, y: number, scale: number): void {
    this.booms.push({ x, y, age: 0, life: 0.42, scale });
    this.spark(x, y);
  }

  private muzzle(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        age: 0,
        life: 0.18,
        size: 2 + Math.random() * 2,
        tone: "brass",
      });
    }
  }

  private spark(x: number, y: number): void {
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
        tone: i % 2 ? "cream" : "crimson",
      });
    }
  }

  private floater(x: number, y: number, text: string, tone: Floater["tone"]): void {
    this.floaters.push({ x, y, text, age: 0, life: 0.7, tone });
  }

  private towerAt(world: { x: number; y: number }): Tower | null {
    let best: Tower | null = null;
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
}

function cellAt(x: number, y: number): { c: number; r: number } | null {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
  return { c, r };
}

function nearestWaypoint(x: number, y: number): { x: number; y: number } {
  let best = WAYPOINTS[0]!;
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

function preferred(tower: Tower, a: Creep, b: Creep): boolean {
  if (tower.priority === "first") return a.dist > b.dist;
  if (tower.priority === "last") return a.dist < b.dist;
  if (tower.priority === "strong") return a.hp > b.hp;
  const da = (aimOf(a).x - tower.x) ** 2 + (aimOf(a).y - tower.y) ** 2;
  const db = (aimOf(b).x - tower.x) ** 2 + (aimOf(b).y - tower.y) ** 2;
  return da < db;
}

function mitigate(e: Creep, vsArmor: number, kind: TowerKind): number {
  if (ENEMIES[e.kind].air) return kind === "aa" ? 1 : 0;
  const armor = ENEMIES[e.kind].armor;
  return 1 - armor + armor * vsArmor;
}

function turnToward(tower: Tower, tx: number, ty: number, dt: number, rate: number): boolean {
  const desired = Math.atan2(ty - tower.y, tx - tower.x);
  const diff = angDiff(desired, tower.angle);
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  tower.angle += step;
  return Math.abs(diff) < 0.22;
}

function predict(e: Creep, time: number): { x: number; y: number } {
  return { x: e.x + e.vx * time, y: e.y + e.vy * time };
}

function leadPoint(x: number, y: number, e: Creep, shotSpeed: number): { x: number; y: number } {
  const p0 = aimOf(e);
  let t = hypot(p0.x - x, p0.y - y) / Math.max(40, shotSpeed);
  for (let i = 0; i < 3; i++) {
    const px = e.x + e.vx * t;
    const py = e.y + e.vy * t - (ENEMIES[e.kind].air ? AIR_LIFT : 0);
    t = hypot(px - x, py - y) / Math.max(40, shotSpeed);
  }
  return {
    x: e.x + e.vx * t,
    y: e.y + e.vy * t - (ENEMIES[e.kind].air ? AIR_LIFT : 0),
  };
}

export function screenToWorld(
  px: number,
  py: number,
  cssW: number,
  cssH: number,
  camX: number,
  camY: number,
  camZoom: number,
): { x: number; y: number } {
  const viewW = WORLD_W / camZoom;
  const viewH = WORLD_H / camZoom;
  const scale = Math.min(cssW / viewW, cssH / viewH);
  const ox = (cssW - viewW * scale) / 2;
  const oy = (cssH - viewH * scale) / 2;
  return {
    x: camX - viewW / 2 + (px - ox) / scale,
    y: camY - viewH / 2 + (py - oy) / scale,
  };
}

function coverage(c: number, r: number, range: number): number {
  const x = (c + 0.5) * CELL;
  const y = (r + 0.5) * CELL;
  let n = 0;
  for (const w of WAYPOINTS) {
    if ((w.x - x) ** 2 + (w.y - y) ** 2 <= range * range) n++;
  }
  return n;
}

function bestCell(game: Game, kind: TowerKind): { c: number; r: number } | null {
  let best: { c: number; r: number; s: number } | null = null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!game.canBuild(c, r)) continue;
      const s = coverage(c, r, TOWERS[kind].range);
      if (!best || s > best.s) best = { c, r, s };
    }
  }
  return best ? { c: best.c, r: best.r } : null;
}

/** Headless balance probe: a greedy uncrewed defense. Not used by the UI. */
export function simulateAi(): {
  win: boolean;
  lives: number;
  wave: number;
  gold: number;
  towers: number;
  trace: { wave: number; lives: number; gold: number; towers: string }[];
} {
  const game = new Game(new Soundboard());
  game.audio.muted = true;
  game.dismissBriefing();
  const buy = (kind: TowerKind) => {
    const cell = bestCell(game, kind);
    if (!cell) return;
    game.tryPlace(kind, cell.c, cell.r);
  };
  const plan = () => {
    const have = (kind: TowerKind) => game.towers.filter((t) => t.kind === kind).length;
    const w = game.waveIndex;
    if (have("ckm") < 1) buy("ckm");
    if (w >= 1 && have("at") < 1) buy("at");
    if (w >= 2 && have("ckm") < 2) buy("ckm");
    if (w >= 5 && have("aa") < 1) buy("aa");
    if (w >= 3 && have("mortar") < 1) buy("mortar");
    if (w >= 6 && have("at") < 2) buy("at");
    if (w >= 7 && have("aa") < 2) buy("aa");
    if (w >= 8 && have("at") < 3) buy("at");
    for (const t of [...game.towers]) {
      if (t.kind !== "at") continue;
      for (let step = 0; step < 3; step++) {
        if (!game.upgrade(t.id, "dmg")) break;
      }
    }
    for (const t of [...game.towers]) {
      if (t.kind === "ckm" || t.kind === "aa") game.upgrade(t.id, "rate");
    }
  };
  const trace: { wave: number; lives: number; gold: number; towers: string }[] = [];
  plan();
  for (let w = 0; w < WAVES.length; w++) {
    game.startWave();
    let guard = 0;
    while (game.phase === "combat" && guard < 25000) {
      game.tick(1 / 30);
      guard++;
    }
    trace.push({
      wave: w + 1,
      lives: game.lives,
      gold: game.gold,
      towers: game.towers.map((t) => `${t.kind[0]}${t.dmgRank}${t.rateRank}`).join(","),
    });
    if (game.phase === "defeat") {
      return { win: false, lives: game.lives, wave: w + 1, gold: game.gold, towers: game.towers.length, trace };
    }
    if (game.phase === "victory") break;
    plan();
  }
  return {
    win: game.phase === "victory",
    lives: game.lives,
    wave: game.phase === "victory" ? WAVES.length : game.waveIndex + 1,
    gold: game.gold,
    towers: game.towers.length,
    trace,
  };
}
