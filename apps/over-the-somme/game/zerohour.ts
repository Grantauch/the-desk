import * as THREE from "three";
import { buildFigure } from "./models";
import type { Effects } from "./fx";
import type { FieldAudio } from "./audio";
import { LINES, MARK, X0, X1 } from "./world";

/**
 * 7:15 to 7:45 a.m., 1 July 1916, compressed into about two and a half minutes.
 * Time t is seconds since the sequence began. The clock reading is
 * interpolated from these keyframes: [t, minutes after midnight].
 */
const CLOCK: [number, number][] = [
  [0, 7 * 60 + 15],
  [14, 7 * 60 + 20],
  [40, 7 * 60 + 28],
  [52, 7 * 60 + 30],
  [120, 7 * 60 + 40],
  [152, 7 * 60 + 45],
];
export const ZERO = 52;
export const END = 150;

export type Caption = { t: number; time: string; text: string; quote?: string; who?: string };

export const CAPTIONS: Caption[] = [
  {
    t: 0,
    time: "7:15 a.m.",
    text: "The last hour of a bombardment that has gone on for seven days. About 1.5 million British shells have fallen on the German lines.",
  },
  {
    t: 13,
    time: "7:20 a.m.",
    text: "The Hawthorn Ridge mine goes up ten minutes early, about 40,000 pounds of explosive under the German line. The heavy guns on that part of the front lift at the same moment. The defenders now know the attack is coming.",
  },
  {
    t: 27,
    time: "7:25 a.m.",
    text: "Below, about 100,000 British soldiers wait in the trenches. Most carry around 66 pounds of equipment.",
  },
  {
    t: 40,
    time: "7:28 a.m.",
    text: "The Lochnagar and Y Sap mines blow at La Boisselle. Chalk is thrown nearly 4,000 feet into the air. Cecil Lewis of No. 3 Squadron was flying above it.",
    quote: "The whole earth heaved and flashed.",
    who: "Cecil Lewis, Sagittarius Rising, 1936",
  },
  {
    t: 52,
    time: "7:30 a.m.",
    text: "Zero hour. Whistles blow all along the line. The barrage lifts off the German front trench and moves on to the next line back.",
  },
  {
    t: 62,
    time: "7:31 a.m.",
    text: "Many battalions were ordered to walk across in lines at a steady pace. The planners believed the week of shelling had killed the defenders.",
  },
  {
    t: 76,
    time: "7:33 a.m.",
    text: "It had not. German soldiers climb out of dugouts cut 30 feet down into the chalk, drag their machine guns up to the parapet and open fire.",
  },
  {
    t: 94,
    time: "7:36 a.m.",
    text: "In the north, at Beaumont-Hamel and below Thiepval, whole battalions are cut down in no man's land. Many men never get past their own wire.",
  },
  {
    t: 110,
    time: "7:38 a.m.",
    text: "At the eastern end of the line, near Montauban and Mametz, the guns had cut the wire. The attack there takes its objectives.",
  },
  {
    t: 126,
    time: "7:40 a.m.",
    text: "By nightfall the British Army has 57,470 casualties. 19,240 of them are dead, the worst single day in its history. The battle goes on until 18 November.",
  },
];

export function clockAt(t: number) {
  let m = CLOCK[CLOCK.length - 1][1];
  for (let i = 0; i < CLOCK.length - 1; i++) {
    const [t0, m0] = CLOCK[i];
    const [t1, m1] = CLOCK[i + 1];
    if (t <= t1) {
      m = m0 + ((Math.max(t, t0) - t0) / (t1 - t0)) * (m1 - m0);
      break;
    }
  }
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return `${h}:${String(mm).padStart(2, "0")} a.m.`;
}

/** Where the camera sits during each part of the sequence. */
type Shot = { t0: number; t1: number; from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3 };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SHOTS: Shot[] = [
  { t0: 0, t1: 12, from: v(-70, 46, 60), to: v(10, 42, 44), lookFrom: v(-40, 0, -70), lookTo: v(30, 0, -75) },
  { t0: 12, t1: 25, from: v(-150, 46, 40), to: v(-130, 40, 10), lookFrom: v(-200, 2, -58), lookTo: v(-200, 6, -60) },
  { t0: 25, t1: 39, from: v(150, 78, 30), to: v(130, 70, -10), lookFrom: v(60, 0, -40), lookTo: v(68, 2, -62) },
  { t0: 39, t1: 51, from: v(140, 62, -8), to: v(175, 90, 40), lookFrom: v(68, 18, -62), lookTo: v(68, 34, -62) },
  { t0: 51, t1: 74, from: v(100, 22, 88), to: v(-10, 20, 84), lookFrom: v(60, 0, 20), lookTo: v(-50, 0, 10) },
  { t0: 74, t1: 92, from: v(20, 34, 40), to: v(-80, 28, 30), lookFrom: v(-40, 0, -20), lookTo: v(-140, 0, -30) },
  { t0: 92, t1: 108, from: v(-95, 14, 74), to: v(-160, 16, 72), lookFrom: v(-125, 0, 28), lookTo: v(-195, 0, 18) },
  { t0: 108, t1: 124, from: v(238, 20, 10), to: v(222, 24, -12), lookFrom: v(232, 0, -50), lookTo: v(224, 0, -64) },
  { t0: 124, t1: 152, from: v(200, 60, 90), to: v(20, 120, 210), lookFrom: v(80, 0, -20), lookTo: v(0, 0, -60) },
];

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

type Soldier = {
  x: number;
  z: number;
  start: number;
  speed: number;
  state: 0 | 1 | 2 | 3; // waiting, walking, down, arrived
  fall: number;
  fallDir: number;
  sway: number;
};

type Gun = { x: number; z: number; aim: number; cool: number; sector: number };

/** How dangerous each stretch of the front was on the morning of 1 July. */
function sectorRisk(x: number) {
  if (x < -150) return 0.5; // Beaumont-Hamel and the Hawthorn sector
  if (x < -40) return 0.35; // below Thiepval
  if (x < 140) return 0.22; // La Boisselle and Ovillers
  if (x < 200) return 0.05;
  return 0.008; // Montauban and Mametz
}

export class ZeroHour {
  t = 0;
  running = false;
  private fired = new Set<string>();
  private men: Soldier[] = [];
  private guns: Gun[] = [];
  private brits: THREE.InstancedMesh;
  private germans: THREE.InstancedMesh;
  private geoBrit: THREE.BufferGeometry;
  private geoGer: THREE.BufferGeometry;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1.6, 1.6, 1.6);
  private burstWait = 0;
  readonly look = new THREE.Vector3();
  readonly eye = new THREE.Vector3();
  onCaption: (c: Caption) => void = () => {};
  onEnd: () => void = () => {};

  constructor(
    private scene: THREE.Scene,
    private sample: (x: number, z: number) => number,
    mat: THREE.Material,
    private fx: Effects,
    private audio: FieldAudio,
  ) {
    this.geoBrit = buildFigure("british");
    this.geoGer = buildFigure("german");
    const waves = 4;
    for (let w = 0; w < waves; w++) {
      for (let x = X0 + 40; x < X1 - 40; x += 4.6) {
        const jx = (Math.random() - 0.5) * 2.2;
        this.men.push({
          x: x + jx + (w % 2) * 2.3,
          z: LINES.britishFront - 4 + w * 2.6 + Math.random() * 1.5,
          start: ZERO + 1.5 + w * 8 + Math.random() * 2.5,
          speed: 1.55 + Math.random() * 0.35,
          state: 0,
          fall: 0,
          fallDir: Math.random() < 0.75 ? 1 : -1,
          sway: Math.random() * 6,
        });
      }
    }
    this.brits = new THREE.InstancedMesh(this.geoBrit, mat, this.men.length);
    this.brits.castShadow = true;
    this.brits.frustumCulled = false;
    this.brits.visible = false;
    scene.add(this.brits);

    for (let x = X0 + 50; x < X1 - 50; x += 26) {
      this.guns.push({ x: x + (Math.random() - 0.5) * 8, z: LINES.germanFront + 6, aim: 0, cool: Math.random(), sector: sectorRisk(x) });
    }
    this.germans = new THREE.InstancedMesh(this.geoGer, mat, this.guns.length * 2);
    this.germans.castShadow = true;
    this.germans.frustumCulled = false;
    this.germans.visible = false;
    scene.add(this.germans);
  }

  start() {
    this.t = 0;
    this.running = true;
    this.fired.clear();
    for (const m of this.men) {
      m.state = 0;
      m.fall = 0;
    }
    this.brits.visible = false;
    this.germans.visible = false;
    this.fx.clear();
    this.onCaption(CAPTIONS[0]);
    this.fired.add("cap0");
  }

  stop() {
    this.running = false;
    this.brits.visible = false;
    this.germans.visible = false;
    this.audio.setBarrage(0.25);
  }

  private once(key: string, at: number, fn: () => void) {
    if (this.t >= at && !this.fired.has(key)) {
      this.fired.add(key);
      fn();
    }
  }

  /** Camera pose for the cinematic view at the current time. */
  shot() {
    const t = this.t;
    let s = SHOTS[SHOTS.length - 1];
    for (const sh of SHOTS) if (t >= sh.t0 && t < sh.t1) s = sh;
    const k = ease(Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0))));
    this.eye.lerpVectors(s.from, s.to, k);
    this.look.lerpVectors(s.lookFrom, s.lookTo, k);
    const g = this.sample(this.eye.x, this.eye.z);
    if (this.eye.y < g + 6) this.eye.y = g + 6;
  }

  update(dt: number) {
    if (!this.running) return;
    this.t += dt;
    const t = this.t;

    CAPTIONS.forEach((c, i) => this.once(`cap${i}`, c.t, () => this.onCaption(c)));
    this.once("hawthorn", 14, () => this.fx.mine(MARK.hawthorn.x, MARK.hawthorn.z, 0.72));
    this.once("lochnagar", 40, () => this.fx.mine(MARK.lochnagar.x, MARK.lochnagar.z, 1));
    this.once("ysap", 40.6, () => this.fx.mine(MARK.laBoisselle.x - 46, LINES.germanFront - 4, 0.7));
    this.once("whistle", ZERO, () => {
      this.audio.whistles();
      this.brits.visible = true;
    });
    this.once("germans", ZERO + 14, () => (this.germans.visible = true));

    // The guns: the final hour on the German front trench, then the lift.
    if (t < ZERO) {
      const ramp = t < 30 ? 4 : 5.5;
      this.fx.barrage(dt, ramp, LINES.germanFront, 18);
      this.fx.batteries(dt, ramp * 0.9);
      this.audio.setBarrage(0.6 + t / ZERO * 0.4);
    } else {
      this.fx.barrage(dt, 2.2, LINES.germanSupport - 10, 40);
      this.fx.batteries(dt, 2);
      this.audio.setBarrage(0.55);
    }
    this.fx.drift(dt, t > ZERO ? 1.6 : 1.1);

    this.updateMen(dt);
    this.updateGuns(dt);

    if (t >= END && this.running) {
      this.running = false;
      this.onEnd();
    }
  }

  private updateMen(dt: number) {
    const t = this.t;
    const gunsLive = t > ZERO + 14;
    let i = 0;
    for (const m of this.men) {
      if (m.state === 0 && t >= m.start) m.state = 1;
      if (m.state === 1) {
        m.z -= m.speed * dt;
        m.sway += dt * 6;
        if (gunsLive && m.z < LINES.britishFront - 2) {
          const risk = sectorRisk(m.x);
          const exposure = Math.min(1, (LINES.britishFront - m.z) / 30);
          if (Math.random() < risk * exposure * dt) m.state = 2;
        }
        if (m.z <= LINES.germanFront + 3) {
          m.z = LINES.germanFront + 3;
          m.state = 3;
        }
      }
      if (m.state === 2) m.fall = Math.min(1, m.fall + dt * 2.2);

      const y = this.sample(m.x, m.z);
      if (m.state === 0) {
        // Still below the parapet: keep them out of sight in the trench.
        this.p.set(m.x, y - 3, m.z);
        this.e.set(0, Math.PI, 0);
      } else if (m.state === 2) {
        this.p.set(m.x, y + 0.1, m.z);
        this.e.set(m.fallDir * m.fall * (Math.PI / 2) * 0.96, Math.PI, 0);
      } else {
        const bob = m.state === 1 ? Math.abs(Math.sin(m.sway)) * 0.08 : 0;
        this.p.set(m.x, y + bob, m.z);
        this.e.set(m.state === 1 ? 0.12 : 0, Math.PI + Math.sin(m.sway * 0.5) * 0.05, 0);
      }
      this.q.setFromEuler(this.e);
      this.m4.compose(this.p, this.q, this.s);
      this.brits.setMatrixAt(i++, this.m4);
    }
    this.brits.instanceMatrix.needsUpdate = true;
  }

  private updateGuns(dt: number) {
    const live = this.t > ZERO + 14;
    let i = 0;
    this.burstWait -= dt;
    const soundNow = this.burstWait <= 0;
    if (soundNow) this.burstWait = 0.35 + Math.random() * 0.5;
    let soundUsed = false;
    for (const g of this.guns) {
      const y = this.sample(g.x, g.z);
      for (let k = 0; k < 2; k++) {
        const gx = g.x + (k === 0 ? -0.9 : 0.9);
        this.p.set(gx, live ? y : y - 3, g.z);
        this.e.set(0, 0, 0);
        this.q.setFromEuler(this.e);
        this.m4.compose(this.p, this.q, this.s);
        this.germans.setMatrixAt(i++, this.m4);
      }
      if (!live) continue;
      g.cool -= dt;
      if (g.cool > 0) continue;
      g.cool = 0.09 + (1 - g.sector) * 0.25 + Math.random() * 0.1;
      g.aim += (Math.random() - 0.5) * 0.5;
      g.aim = Math.max(-0.7, Math.min(0.7, g.aim));
      const reach = 20 + Math.random() * 90;
      const tx = g.x + Math.sin(g.aim) * reach;
      const tz = g.z + Math.cos(g.aim) * reach;
      const play = soundNow && !soundUsed && Math.random() < 0.3;
      if (play) soundUsed = true;
      this.fx.gunfire(g.x, y + 1.2, g.z + 0.6, tx, tz, play);
    }
    this.germans.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.brits, this.germans);
    this.geoBrit.dispose();
    this.geoGer.dispose();
    this.brits.dispose();
    this.germans.dispose();
  }
}
