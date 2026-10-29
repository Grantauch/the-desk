import * as THREE from "three";
import { Particles } from "./particles";
import { smokePuff, softDot } from "./atmosphere";
import type { FieldAudio } from "./audio";
import { LINES, X0, X1 } from "./world";

const CHALK = new THREE.Color("#f3ecda");
const EARTH = new THREE.Color("#4a3a2a");
const SMOKE = new THREE.Color("#7d766a");
const SMOKE_DARK = new THREE.Color("#3e3a33");
const FIRE = new THREE.Color("#ffb45c");
const FLASH = new THREE.Color("#fff0c8");
/** British field battery positions, matching the guns placed in props.ts. */
const BATTERIES = [-230, -130, -20, 90, 190, 270];
const BATTERY_Z = 124;

/** Shell bursts, mines, smoke and muzzle flashes, with the light and sound that go with them. */
export class Effects {
  readonly smoke: Particles;
  readonly glow: Particles;
  readonly light: THREE.PointLight;
  private lightLife = 0;
  private lightPeak = 0;
  private ambientWait = 0;
  private gunWait = 0;
  private exhaustWait = 0;
  shake = 0;
  quality = 1;

  constructor(
    private scene: THREE.Scene,
    private sample: (x: number, z: number) => number,
    private audio: FieldAudio,
    fogColor: THREE.Color,
    private cam: THREE.Camera,
  ) {
    this.smoke = new Particles(4200, smokePuff(), false, fogColor);
    this.glow = new Particles(900, softDot(), true, fogColor);
    scene.add(this.smoke.mesh, this.glow.mesh);
    this.light = new THREE.PointLight("#ffbf73", 0, 160, 1.6);
    scene.add(this.light);
  }

  private dist(x: number, y: number, z: number) {
    const p = this.cam.position;
    return Math.hypot(p.x - x, p.y - y, p.z - z);
  }

  /** A field gun or howitzer shell landing. size 0.6 to 1.6. */
  shell(x: number, z: number, size = 1, sound = true) {
    const y = this.sample(x, z);
    const q = this.quality;
    this.glow.emit({ x, y: y + 1.5 * size, z, life: 0.25, size: 9 * size, grow: 40 * size, color: FLASH, alpha: 1, shape: 1 });
    this.glow.emit({ x, y: y + 2, z, life: 0.7, size: 6 * size, grow: 10, color: FIRE, alpha: 0.8, shape: 1 });
    // A fountain of earth and chalk.
    const n = Math.round(14 * size * q) + 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 10 + Math.random() * 16 * size;
      const out = 1.5 + Math.random() * 5 * size;
      this.smoke.emit({
        x, y: y + 0.5, z,
        vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out,
        life: 1.6 + Math.random() * 1, size: 2.2 * size, grow: 1.8,
        color: Math.random() < 0.55 ? EARTH : CHALK, alpha: 1, gravity: 18, drag: 0.5, shape: 1,
      });
    }
    // The cloud that rolls up and drifts.
    const puffs = Math.max(3, Math.round(6 * q * size));
    for (let i = 0; i < puffs; i++) {
      this.smoke.emit({
        x: x + (Math.random() - 0.5) * 3 * size, y: y + 2 + Math.random() * 4 * size, z: z + (Math.random() - 0.5) * 3 * size,
        vx: (Math.random() - 0.5) * 2, vy: 2.5 + Math.random() * 3.5, vz: (Math.random() - 0.5) * 2,
        life: 7 + Math.random() * 7, size: 6 * size, grow: 3.2 * size,
        color: Math.random() < 0.55 ? SMOKE : SMOKE_DARK, alpha: 0.78, drag: 0.4, shape: 1,
      });
    }
    if (sound) this.audio.boom(size, this.dist(x, y, z));
    if (size > 1.2) this.flashLight(x, y + 4, z, 3 * size, 0.18);
  }

  private mines: { x: number; y: number; z: number; scale: number; age: number }[] = [];

  /** A mine. scale 1 for Lochnagar. */
  mine(x: number, z: number, scale = 1) {
    const y = this.sample(x, z);
    const q = this.quality;
    this.mines.push({ x, y, z, scale, age: 0 });
    this.glow.emit({ x, y: y + 8 * scale, z, life: 0.9, size: 50 * scale, grow: 160 * scale, color: FLASH, alpha: 1, shape: 1 });
    this.glow.emit({ x, y: y + 14 * scale, z, life: 2.2, size: 30 * scale, grow: 40 * scale, color: FIRE, alpha: 0.85, shape: 1 });
    // The billowing cloud that hangs afterwards.
    const m = Math.round(90 * scale * q);
    for (let i = 0; i < m; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 18 * scale;
      this.smoke.emit({
        x: x + Math.cos(a) * r, y: y + 3 + Math.random() * 60 * scale, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * 3, vy: 2 + Math.random() * 5, vz: Math.sin(a) * 3,
        life: 18 + Math.random() * 12, size: 14 * scale, grow: 3.6 * scale,
        color: Math.random() < 0.6 ? CHALK : SMOKE, alpha: 0.7, drag: 0.25, shape: 1,
      });
    }
    // Ground shock ring.
    for (let i = 0; i < 40 * q; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.smoke.emit({
        x: x + Math.cos(a) * 8 * scale, y: y + 1, z: z + Math.sin(a) * 8 * scale,
        vx: Math.cos(a) * 34 * scale, vy: 2, vz: Math.sin(a) * 34 * scale,
        life: 3, size: 6 * scale, grow: 6 * scale, color: CHALK, alpha: 0.5, drag: 1.4, shape: 1,
      });
    }
    this.audio.boom(4.5 * scale, this.dist(x, y, z));
    this.flashLight(x, y + 20, z, 60 * scale, 1.6);
    const d = this.dist(x, y, z);
    this.shake = Math.max(this.shake, Math.min(1.6, 260 / (d + 40)));
  }

  /** Machine gun fire: a flash at the gun and dirt kicked up where the rounds land. */
  gunfire(gx: number, gy: number, gz: number, tx: number, tz: number, sound: boolean) {
    this.glow.emit({ x: gx, y: gy, z: gz, life: 0.08, size: 3.2, color: FIRE, alpha: 1, shape: 1 });
    if (Math.random() < 0.6 * this.quality) {
      const ty = this.sample(tx, tz);
      this.smoke.emit({
        x: tx, y: ty + 0.2, z: tz, vy: 2.5 + Math.random() * 2,
        life: 1.1, size: 1.1, grow: 2.2, color: Math.random() < 0.5 ? CHALK : EARTH, alpha: 0.85, gravity: 4, drag: 1, shape: 1,
      });
    }
    if (sound) this.audio.burst(this.dist(gx, gy, gz));
  }

  private flashLight(x: number, y: number, z: number, peak: number, life: number) {
    if (peak < this.light.intensity) return;
    this.light.position.set(x, y, z);
    this.lightPeak = peak;
    this.lightLife = life;
    this.light.intensity = peak;
    this.light.distance = 60 + peak * 6;
  }

  /** The background bombardment. rate is shells per second, row is the trench line under fire. */
  barrage(dt: number, rate: number, rowZ: number, spread: number) {
    this.ambientWait -= dt;
    let guard = 0;
    while (this.ambientWait <= 0 && guard++ < 6) {
      this.ambientWait += (0.4 + Math.random()) / Math.max(0.01, rate);
      const x = X0 + 30 + Math.random() * (X1 - X0 - 60);
      const z = rowZ + (Math.random() - 0.5) * spread;
      this.shell(x, z, 0.7 + Math.random() * 0.8, true);
    }
  }

  /** The British field batteries behind the support line, firing over the infantry. */
  batteries(dt: number, rate: number) {
    this.gunWait -= dt;
    let guard = 0;
    while (this.gunWait <= 0 && guard++ < 4) {
      this.gunWait += (0.3 + Math.random()) / Math.max(0.01, rate);
      const gx = BATTERIES[Math.floor(Math.random() * BATTERIES.length)] + (Math.random() - 0.5) * 10;
      const gz = BATTERY_Z + (Math.random() - 0.5) * 4;
      const gy = this.sample(gx, gz) + 1.4;
      this.glow.emit({ x: gx, y: gy, z: gz - 2.5, life: 0.12, size: 5, grow: 26, color: FLASH, alpha: 1, shape: 1 });
      this.glow.emit({ x: gx, y: gy, z: gz - 3.5, life: 0.25, size: 3, grow: 8, color: FIRE, alpha: 0.7, shape: 1 });
      for (let i = 0; i < Math.max(1, Math.round(3 * this.quality)); i++) {
        this.smoke.emit({
          x: gx + (Math.random() - 0.5) * 2, y: gy + 0.5, z: gz - 3 - Math.random() * 3,
          vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 1.5, vz: -2 - Math.random() * 2,
          life: 5 + Math.random() * 4, size: 2.5, grow: 2.4, color: SMOKE, alpha: 0.5, drag: 0.6, shape: 1,
        });
      }
      this.audio.boom(0.32, this.dist(gx, gy, gz));
    }
  }

  /** Castor oil smoke from the rotary engine, streaming back under the fuselage. */
  exhaust(dt: number, x: number, y: number, z: number) {
    if (this.quality < 0.5) return;
    this.exhaustWait -= dt;
    if (this.exhaustWait > 0) return;
    this.exhaustWait = 0.06;
    this.smoke.emit({
      x, y, z, vy: -0.2,
      life: 2.4, size: 0.5, grow: 1.6, color: SMOKE, alpha: 0.28, drag: 0.8, shape: 1,
    });
  }

  /** Low drifting smoke over no man's land and the lines. */
  drift(dt: number, density: number) {
    const want = dt * 14 * density * this.quality;
    let n = Math.floor(want) + (Math.random() < want % 1 ? 1 : 0);
    while (n-- > 0) {
      const x = X0 + Math.random() * (X1 - X0);
      const z = LINES.germanFront - 20 + Math.random() * (LINES.britishFront - LINES.germanFront + 40);
      const y = this.sample(x, z) + 1 + Math.random() * 3;
      this.smoke.emit({
        x, y, z, vx: 1.2, vy: 0.2, vz: 0.4,
        life: 18 + Math.random() * 10, size: 8 + Math.random() * 8, grow: 0.8,
        color: Math.random() < 0.5 ? SMOKE : CHALK, alpha: 0.16 + Math.random() * 0.1, drag: 0.1,
      });
    }
  }

  /** Each mine throws its column over a second and a half, densest at the start. */
  private stepMines(dt: number) {
    for (const m of this.mines) {
      m.age += dt;
      const k = Math.max(0, 1 - m.age / 1.6);
      const n = Math.round(900 * m.scale * this.quality * k * dt) + (k > 0 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() ** 0.7;
        const up = (70 + Math.random() * 90) * m.scale * (1 - r * 0.5) * (0.55 + k * 0.6);
        const out = r * 12 * m.scale;
        const chalk = Math.random() < 0.7;
        this.smoke.emit({
          x: m.x + Math.cos(a) * r * 9 * m.scale, y: m.y + 2, z: m.z + Math.sin(a) * r * 9 * m.scale,
          vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out,
          life: 5 + Math.random() * 4, size: (4 + Math.random() * 6) * m.scale, grow: 4 * m.scale,
          color: chalk ? CHALK : EARTH, alpha: 1, gravity: 26, drag: 0.3, shape: 1,
        });
      }
      if (k > 0 && Math.random() < 0.6) {
        this.glow.emit({ x: m.x, y: m.y + 10 + Math.random() * 30 * m.scale, z: m.z, life: 0.5, size: 22 * m.scale, grow: 20, color: FIRE, alpha: 0.5, shape: 1 });
      }
    }
    this.mines = this.mines.filter((m) => m.age < 2);
  }

  update(dt: number) {
    this.stepMines(dt);
    this.smoke.update(dt, 1.4, 0.5);
    this.glow.update(dt, 0, 0);
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      this.light.intensity = Math.max(0, this.lightLife > 0 ? this.light.intensity - (this.lightPeak / 0.9) * dt : 0);
    } else this.light.intensity = 0;
    this.shake = Math.max(0, this.shake - dt * 0.9);
  }

  clear() {
    this.mines = [];
    this.smoke.clear();
    this.glow.clear();
  }

  dispose() {
    this.smoke.dispose();
    this.glow.dispose();
  }
}
