import * as THREE from "three";
import {
  buildBalloon,
  buildBasilica,
  buildFigure,
  buildGun,
  buildStretcher,
  buildStump,
  buildTank,
  buildTent,
  buildTree,
  buildWire,
} from "./models";
import { MARK, hash2, type Polyline, type Side, type WorldData } from "./world";

type Item = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
  tilt?: number;
};

const up = new THREE.Vector3(0, 1, 0);
const axisX = new THREE.Vector3(1, 0, 0);
const q = new THREE.Quaternion();
const qT = new THREE.Quaternion();
const pv = new THREE.Vector3();
const sv = new THREE.Vector3();
const m4 = new THREE.Matrix4();

function fill(mesh: THREE.InstancedMesh, items: Item[]) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    pv.set(it.x, it.y, it.z);
    q.setFromAxisAngle(up, it.yaw);
    if (it.tilt) {
      qT.setFromAxisAngle(axisX, it.tilt);
      q.multiply(qT);
    }
    sv.set(it.sx, it.sy, it.sz);
    m4.compose(pv, q, sv);
    mesh.setMatrixAt(i, m4);
  }
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
}

function inst(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[], geos: THREE.BufferGeometry[]) {
  if (items.length === 0) {
    geo.dispose();
    return null;
  }
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  fill(mesh, items);
  geos.push(geo);
  return mesh;
}

function matte(hex: string, mats: THREE.Material[]) {
  const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true });
  mats.push(m);
  return m;
}

function walk(line: Polyline, spacing: number, cb: (x: number, z: number, tx: number, tz: number, n: number) => void) {
  const pts = line.points;
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x;
    const az = pts[i].z;
    const bx = pts[i + 1].x;
    const bz = pts[i + 1].z;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) continue;
    const tx = dx / len;
    const tz = dz / len;
    const steps = Math.max(1, Math.round(len / spacing));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      cb(ax + dx * t, az + dz * t, tx, tz, n);
      n++;
    }
  }
}

function frontNormal(tx: number, tz: number, side: Side) {
  let nx = -tz;
  let nz = tx;
  const len = Math.hypot(nx, nz) || 1;
  nx /= len;
  nz /= len;
  const enemy = side === "british" ? -1 : 1;
  if (nz * enemy < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { nx, nz };
}

function scatterDisk(cx: number, cz: number, r: number, count: number, seed: number, cb: (x: number, z: number, i: number) => void) {
  for (let i = 0; i < count; i++) {
    const ang = hash2(seed, i) * Math.PI * 2;
    const rad = Math.sqrt(hash2(i, seed + 5)) * r;
    cb(cx + Math.cos(ang) * rad, cz + Math.sin(ang) * rad, i);
  }
}

export function buildProps(
  world: WorldData,
  vertexMat: THREE.Material,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const sample = world.sample;
  const group = new THREE.Group();
  const night: {
    lantern?: THREE.MeshLambertMaterial;
    windows?: THREE.MeshLambertMaterial;
    gold?: THREE.MeshStandardMaterial;
  } = {};

  const inBowl = (x: number, z: number) => {
    const h = sample(x, z);
    const around = Math.max(sample(x + 10, z), sample(x - 10, z), sample(x, z + 10), sample(x, z - 10));
    return around - h > 3.3;
  };

  const sandbags: Item[] = [];
  const boards: Item[] = [];
  const steps: Item[] = [];
  const brits: Item[] = [];
  const germans: Item[] = [];
  const dugouts: Item[] = [];
  const lanterns: Item[] = [];

  for (const line of world.polylines) {
    const bagStep = line.role === "front" || line.role === "support" ? 3.2 : 5.4;
    walk(line, bagStep, (x, z, tx, tz, n) => {
      if (sample(x, z) < 0.55 || inBowl(x, z)) return;
      const { nx, nz } = frontNormal(tx, tz, line.side);
      const yaw = Math.atan2(tx, tz);
      const floor = sample(x, z);
      if (boards.length < 700 && line.role !== "sap" && n % 2 === 0) {
        boards.push({ x, y: floor + 0.05, z, yaw, sx: 1, sy: 1, sz: 1 });
      }
      if (steps.length < 500 && (line.role === "front" || line.role === "support") && n % 2 === 0) {
        const sx = x + nx * (line.halfW * 0.55);
        const sz = z + nz * (line.halfW * 0.55);
        steps.push({ x: sx, y: sample(sx, sz) + 0.02, z: sz, yaw, sx: 1, sy: 1, sz: 1 });
      }
      if (sandbags.length < 1400) {
        const lip = line.halfW + 0.55;
        const fx = x + nx * lip;
        const fz = z + nz * lip;
        const sy = hash2(n, 3) > 0.45 ? 1.65 : 1;
        sandbags.push({
          x: fx,
          y: sample(fx, fz) + 0.21 * sy,
          z: fz,
          yaw,
          sx: 1,
          sy,
          sz: 1,
        });
        if (hash2(n, 4) > 0.35 && sandbags.length < 1400) {
          const bx = x - nx * (lip - 0.15);
          const bz = z - nz * (lip - 0.15);
          sandbags.push({
            x: bx,
            y: sample(bx, bz) + 0.18,
            z: bz,
            yaw,
            sx: 1,
            sy: 1,
            sz: 0.9,
          });
        }
      }
      const men = line.side === "british" ? brits : germans;
      const every = line.role === "front" ? 5 : line.role === "support" ? 8 : 14;
      if (men.length < 80 && n % every === 0 && line.role !== "sap") {
        const mx = x + nx * 1.2;
        const mz = z + nz * 1.2;
        men.push({
          x: mx,
          y: sample(mx, mz),
          z: mz,
          yaw: Math.atan2(nx, nz) + (hash2(n, 9) - 0.5) * 0.45,
          sx: 1,
          sy: 0.94 + hash2(n, 8) * 0.12,
          sz: 1,
        });
      }
      if (lanterns.length < 42 && (line.role === "front" || line.role === "support") && n % 9 === 0) {
        const lx = x - nx * 0.85;
        const lz = z - nz * 0.85;
        lanterns.push({ x: lx, y: sample(lx, lz), z: lz, yaw: 0, sx: 1, sy: 1, sz: 1 });
      }
      if (
        dugouts.length < 36 &&
        line.side === "german" &&
        (line.role === "front" || line.role === "support") &&
        n % 11 === 0
      ) {
        const dx = x - nx * (line.halfW * 0.15);
        const dz = z - nz * (line.halfW * 0.15);
        dugouts.push({
          x: dx,
          y: sample(dx, dz) + 0.15,
          z: dz,
          yaw,
          sx: 1.3,
          sy: 1,
          sz: 1.5,
        });
      }
    });
  }

  const sandGeo = new THREE.BoxGeometry(0.9, 0.42, 1.35);
  const boardGeo = new THREE.BoxGeometry(0.75, 0.08, 2.15);
  const stepGeo = new THREE.BoxGeometry(1.15, 0.36, 1.45);
  const dugGeo = new THREE.BoxGeometry(1.2, 1.05, 0.9);
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.15, 4);
  poleGeo.translate(0, 0.7, 0);
  const bulbGeo = new THREE.SphereGeometry(0.16, 5, 4);
  bulbGeo.translate(0, 1.28, 0);

  const sand = inst(sandGeo, matte("#9a8b6c", mats), sandbags, geos);
  const board = inst(boardGeo, matte("#6b5340", mats), boards, geos);
  const step = inst(stepGeo, matte("#7d6a4e", mats), steps, geos);
  const dug = inst(dugGeo, matte("#16130f", mats), dugouts, geos);
  const brit = inst(buildFigure("british"), vertexMat, brits, geos);
  const german = inst(buildFigure("german"), vertexMat, germans, geos);
  const poles = inst(poleGeo, matte("#5c4632", mats), lanterns, geos);
  const lanternMat = new THREE.MeshLambertMaterial({
    color: "#3a2a18",
    emissive: "#ffb15e",
    emissiveIntensity: 0.05,
    flatShading: true,
  });
  mats.push(lanternMat);
  night.lantern = lanternMat;
  const bulbs = inst(bulbGeo, lanternMat, lanterns, geos);
  for (const mesh of [sand, board, step, dug, brit, german, poles, bulbs]) {
    if (mesh) group.add(mesh);
  }

  const wires: Item[] = [];
  const belts = [
    LINES_BELT(52 - 16),
    LINES_BELT(52 - 24),
    LINES_BELT(-68 + 14),
    LINES_BELT(-68 + 22),
    LINES_BELT(-6),
  ];
  for (const z0 of belts) {
    for (let x = -300; x <= 300; x += 4.3) {
      if (wires.length > 720) break;
      const j = (hash2(Math.round(x * 2), Math.round(z0 * 3)) - 0.5) * 2.4;
      const zz = z0 + j;
      if (hash2(Math.round(x), Math.round(z0) + 9) < 0.16) continue;
      if (sample(x, zz) < 0.6 || inBowl(x, zz)) continue;
      wires.push({
        x,
        y: sample(x, zz),
        z: zz,
        yaw: hash2(Math.round(x + z0), 2) * Math.PI,
        sx: 0.85 + hash2(Math.round(x), 6) * 0.4,
        sy: 0.8 + hash2(Math.round(z0 + x), 7) * 0.45,
        sz: 1,
      });
    }
  }
  const wire = inst(buildWire(), matte("#2a2826", mats), wires, geos);
  if (wire) group.add(wire);

  const stumps: Item[] = [];
  const trees: Item[] = [];
  function woods(cx: number, cz: number, r: number, stumpN: number, treeN: number, seed: number) {
    scatterDisk(cx, cz, r, stumpN, seed, (x, z, i) => {
      if (stumps.length > 140) return;
      const h = sample(x, z);
      if (h < 0.7 || inBowl(x, z)) return;
      stumps.push({
        x,
        y: h,
        z,
        yaw: hash2(i, seed) * 6,
        sx: 0.7 + hash2(seed, i) * 0.8,
        sy: 0.6 + hash2(i, seed + 2) * 0.9,
        sz: 0.7 + hash2(seed + 1, i) * 0.7,
        tilt: (hash2(i, seed + 4) - 0.5) * 0.35,
      });
    });
    scatterDisk(cx, cz, r * 0.85, treeN, seed + 20, (x, z, i) => {
      if (trees.length > 70) return;
      const h = sample(x, z);
      if (h < 0.7 || inBowl(x, z)) return;
      const sc = 0.75 + hash2(i, seed) * 1.15;
      trees.push({
        x,
        y: h,
        z,
        yaw: hash2(seed, i + 3) * 6,
        sx: sc,
        sy: sc * (0.85 + hash2(i, 12) * 0.4),
        sz: sc,
        tilt: (hash2(i, seed + 8) - 0.5) * 0.55,
      });
    });
  }
  woods(MARK.delville.x, MARK.delville.z, 38, 48, 14, 70);
  woods(MARK.highWood.x, MARK.highWood.z, 32, 34, 10, 90);
  for (let i = 0; i < 30; i++) {
    const x = -250 + hash2(i, 61) * 500;
    const z = -30 + (hash2(i, 62) - 0.5) * 80;
    const h = sample(x, z);
    if (h < 0.8 || inBowl(x, z) || stumps.length > 150) continue;
    stumps.push({
      x,
      y: h,
      z,
      yaw: hash2(i, 63) * 4,
      sx: 0.55 + hash2(i, 64) * 0.5,
      sy: 0.45 + hash2(i, 65) * 0.5,
      sz: 0.55,
      tilt: (hash2(i, 66) - 0.5) * 0.5,
    });
  }
  const stump = inst(buildStump(), matte("#5c4636", mats), stumps, geos);
  const tree = inst(buildTree(), vertexMat, trees, geos);
  if (stump) group.add(stump);
  if (tree) group.add(tree);

  const ruins: Item[] = [];
  function ruinsAt(cx: number, cz: number, n: number, seed: number) {
    scatterDisk(cx, cz, 18, n, seed, (x, z, i) => {
      const h = sample(x, z);
      if (h < 0.3) return;
      ruins.push({
        x,
        y: h + 0.8,
        z,
        yaw: hash2(i, seed) * Math.PI,
        sx: 2.4 + hash2(seed, i) * 3.2,
        sy: 1.2 + hash2(i, seed + 2) * 2.4,
        sz: 0.55,
      });
    });
  }
  ruinsAt(MARK.beaumont.x, MARK.beaumont.z, 16, 120);
  ruinsAt(MARK.laBoisselle.x, MARK.laBoisselle.z, 14, 140);
  const ruin = inst(new THREE.BoxGeometry(1, 1, 1), matte("#b7ae9c", mats), ruins, geos);
  if (ruin) group.add(ruin);

  const chalk: Item[] = [];
  for (const crater of [MARK.lochnagar, MARK.hawthorn]) {
    const rad = crater === MARK.lochnagar ? 27 : 17;
    const n = crater === MARK.lochnagar ? 20 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash2(i, 77);
      const rr = rad + (hash2(i, 78) - 0.5) * 4;
      const x = crater.x + Math.cos(a) * rr;
      const z = crater.z + Math.sin(a) * rr;
      chalk.push({
        x,
        y: sample(x, z) + 0.3,
        z,
        yaw: a,
        sx: 1.2 + hash2(i, 79),
        sy: 0.6 + hash2(i, 80) * 0.8,
        sz: 0.8 + hash2(i, 81) * 0.6,
      });
    }
  }
  const chalkMesh = inst(new THREE.BoxGeometry(1, 1, 1), matte("#e4dcc8", mats), chalk, geos);
  if (chalkMesh) group.add(chalkMesh);

  const houses: Item[] = [];
  const roofs: Item[] = [];
  const windows: Item[] = [];
  for (let i = 0; i < 18; i++) {
    const x = MARK.albert.x + (hash2(i, 150) - 0.5) * 92;
    const z = MARK.albert.z + (hash2(i, 151) - 0.42) * 28;
    const h = sample(x, z);
    if (h < 1.2) continue;
    const sx = 4 + hash2(i, 152) * 3.5;
    const sy = 3.2 + hash2(i, 153) * 3.2;
    const sz = 4 + hash2(i, 154) * 4;
    const yaw = (hash2(i, 155) - 0.5) * 0.4;
    houses.push({ x, y: h + sy * 0.5, z, yaw, sx, sy, sz });
    if (hash2(i, 156) > 0.28) {
      roofs.push({ x, y: h + sy + 1.1, z, yaw, sx: sx * 0.72, sy: 2.2, sz: sz * 0.72 });
    }
    windows.push({ x: x + sx * 0.28, y: h + sy * 0.62, z: z + sz * 0.5, yaw, sx: 0.7, sy: 0.9, sz: 0.25 });
  }
  const houseMat = new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true });
  mats.push(houseMat);
  const house = inst(new THREE.BoxGeometry(1, 1, 1), houseMat, houses, geos);
  if (house) {
    const c = new THREE.Color();
    for (let i = 0; i < houses.length; i++) {
      const pick = hash2(i, 157);
      c.set(pick > 0.66 ? "#d9cbb3" : pick > 0.33 ? "#8d5a45" : "#c4b49a");
      house.setColorAt(i, c);
    }
    if (house.instanceColor) house.instanceColor.needsUpdate = true;
    group.add(house);
  }
  const roof = inst(new THREE.ConeGeometry(1, 1, 4), matte("#6e4036", mats), roofs, geos);
  if (roof) group.add(roof);
  const winMat = new THREE.MeshLambertMaterial({
    color: "#241c14",
    emissive: "#ffb15e",
    emissiveIntensity: 0,
    flatShading: true,
  });
  mats.push(winMat);
  night.windows = winMat;
  const wins = inst(new THREE.BoxGeometry(1, 1, 1), winMat, windows, geos);
  if (wins) group.add(wins);

  const { stone, virgin, goldMat } = buildBasilica();
  geos.push(stone);
  mats.push(goldMat);
  night.gold = goldMat;
  const church = new THREE.Group();
  const stoneMesh = new THREE.Mesh(stone, vertexMat);
  church.add(stoneMesh, virgin);
  const basilicaGround = sample(MARK.albert.x, MARK.albert.z);
  church.position.set(MARK.albert.x, basilicaGround, MARK.albert.z);
  church.scale.setScalar(1.45);
  church.traverse((obj) => {
    obj.frustumCulled = false;
  });
  group.add(church);

  const guns: Item[] = [];
  for (const x of [-230, -130, -20, 90, 190, 270]) {
    const z = 124;
    guns.push({ x, y: sample(x, z), z, yaw: Math.PI, sx: 1, sy: 1, sz: 1 });
  }
  for (const x of [-180, -40, 80, 200]) {
    const z = -138;
    guns.push({ x, y: sample(x, z), z, yaw: 0, sx: 1, sy: 1, sz: 1 });
  }
  const gun = inst(buildGun(), vertexMat, guns, geos);
  if (gun) group.add(gun);

  const crates: Item[] = [];
  for (let i = 0; i < 22; i++) {
    const x = -80 + hash2(i, 170) * 160;
    const z = 116 + hash2(i, 171) * 22;
    const h = sample(x, z);
    if (h < 0.8) continue;
    crates.push({
      x,
      y: h + 0.28,
      z,
      yaw: hash2(i, 172) * 3,
      sx: 0.8,
      sy: 0.7,
      sz: 1.1,
    });
  }
  const crate = inst(new THREE.BoxGeometry(1, 1, 1), matte("#7a5a34", mats), crates, geos);
  if (crate) group.add(crate);

  const stretchers: Item[] = [];
  for (let i = 0; i < 5; i++) {
    const x = MARK.aid.x + (i - 2) * 2.4;
    const z = MARK.aid.z + (i % 2) * 1.6;
    stretchers.push({ x, y: sample(x, z), z, yaw: 0.4 + i * 0.2, sx: 1, sy: 1, sz: 1 });
  }
  const stretcher = inst(buildStretcher(), vertexMat, stretchers, geos);
  if (stretcher) group.add(stretcher);
  const tent = new THREE.Mesh(buildTent(), vertexMat);
  geos.push(tent.geometry);
  tent.position.set(MARK.aid.x - 6, sample(MARK.aid.x - 6, MARK.aid.z), MARK.aid.z);
  tent.frustumCulled = false;
  group.add(tent);

  const tankGeo = buildTank();
  geos.push(tankGeo);
  const tanks = new THREE.InstancedMesh(tankGeo, vertexMat, 2);
  const tankItems: Item[] = [
    {
      x: MARK.tankDitch.x,
      y: sample(MARK.tankDitch.x, MARK.tankDitch.z) - 0.55,
      z: MARK.tankDitch.z,
      yaw: 2.4,
      sx: 1,
      sy: 1,
      sz: 1,
      tilt: 0.22,
    },
    {
      x: MARK.tankWood.x,
      y: sample(MARK.tankWood.x, MARK.tankWood.z) + 0.05,
      z: MARK.tankWood.z,
      yaw: 2.85,
      sx: 1,
      sy: 1,
      sz: 1,
      tilt: -0.08,
    },
  ];
  fill(tanks, tankItems);
  group.add(tanks);

  const balloonGeo = buildBalloon();
  geos.push(balloonGeo);
  const balloon = new THREE.Mesh(balloonGeo, vertexMat);
  balloon.position.set(MARK.balloon.x, sample(MARK.balloon.x, MARK.balloon.z), MARK.balloon.z);
  balloon.frustumCulled = false;
  group.add(balloon);

  return { group, night };
}

function LINES_BELT(z: number) {
  return z;
}
