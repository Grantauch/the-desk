import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

function solid(geom: THREE.BufferGeometry, hex: string) {
  geom.deleteAttribute("uv");
  const c = new THREE.Color(hex);
  const n = geom.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geom;
}

function place(geom: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  geom.applyMatrix4(_m);
  return geom;
}

function box(w: number, h: number, d: number, hex: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  return place(solid(new THREE.BoxGeometry(w, h, d), hex), x, y, z, rx, ry, rz);
}

function cyl(
  rt: number,
  rb: number,
  h: number,
  hex: string,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  seg = 6,
) {
  return place(solid(new THREE.CylinderGeometry(rt, rb, h, seg), hex), x, y, z, rx, ry, rz);
}

function sph(r: number, hex: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  return place(solid(new THREE.SphereGeometry(r, 6, 5), hex), x, y, z, 0, 0, 0, sx, sy, sz);
}

function merge(parts: THREE.BufferGeometry[]) {
  // Mixed primitives arrive both indexed and non-indexed, with different extra
  // attributes. Flatten each to the same position, normal and color layout first.
  const flat = parts.map((p) => {
    const f = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(f.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "color") f.deleteAttribute(name);
    }
    if (!f.getAttribute("normal")) f.computeVertexNormals();
    return f;
  });
  const g = mergeGeometries(flat, false);
  for (const p of parts) p.dispose();
  for (const f of flat) f.dispose();
  if (!g) throw new Error("geometry merge failed");
  g.computeVertexNormals();
  return g;
}

export function buildFigure(kind: "british" | "german") {
  const cloth = kind === "british" ? "#8d7648" : "#5e685c";
  const dark = kind === "british" ? "#6a5434" : "#434c44";
  const helmet = kind === "british" ? "#6f654c" : "#3c443d";
  const skin = "#c6a27c";
  const boot = "#241e18";
  const wood = "#3a3228";
  return merge([
    box(0.26, 0.7, 0.26, dark, -0.15, 0.35, 0),
    box(0.26, 0.7, 0.26, dark, 0.15, 0.35, 0),
    box(0.28, 0.12, 0.38, boot, -0.15, 0.06, 0.04),
    box(0.28, 0.12, 0.38, boot, 0.15, 0.06, 0.04),
    box(0.58, 0.66, 0.32, cloth, 0, 1.02, 0),
    box(0.14, 0.52, 0.14, cloth, -0.4, 1.02, 0),
    box(0.14, 0.52, 0.14, cloth, 0.4, 1.0, 0.06),
    sph(0.18, skin, 0, 1.52, 0),
    sph(0.22, helmet, 0, 1.64, 0.02, 1.05, 0.55, 1.05),
    box(0.07, 0.07, 1.05, wood, 0.32, 1.12, 0.32),
  ]);
}

export function buildTree() {
  return merge([
    cyl(0.12, 0.26, 2.7, "#5b4534", 0, 1.35, 0, 0, 0, 0, 5),
    box(0.11, 1.25, 0.11, "#4a382c", 0.4, 2.15, 0.05, 0.15, 0, 0.95),
    box(0.1, 1.05, 0.1, "#433328", -0.28, 1.9, -0.08, -0.35, 0.2, -0.85),
    box(0.08, 0.75, 0.08, "#3c2e26", 0.08, 2.4, -0.22, 0.55, 0, 0.25),
  ]);
}

export function buildStump() {
  return merge([
    cyl(0.22, 0.38, 0.62, "#5a4636", 0, 0.31, 0, 0, 0, 0, 5),
    box(0.12, 0.45, 0.12, "#3f3228", 0.12, 0.55, 0.05, 0.3, 0, 0.4),
  ]);
}

export function buildWire() {
  return merge([
    box(1.7, 0.07, 0.07, "#2a2826", 0, 0.58, 0, 0, 0, 0.72),
    box(1.7, 0.07, 0.07, "#2a2826", 0, 0.58, 0, 0, 0, -0.72),
    box(0.09, 0.72, 0.09, "#3d342c", 0, 0.36, 0),
  ]);
}

export function buildGun() {
  return merge([
    box(0.28, 0.16, 2.1, "#3e4238", 0, 0.58, -0.35),
    cyl(0.11, 0.15, 1.7, "#2c2e28", 0, 1.02, 0.85, Math.PI / 2, 0, 0, 6),
    box(0.45, 0.35, 0.7, "#4a4e42", 0, 0.85, 0.15),
    cyl(0.52, 0.52, 0.1, "#241e18", 0.48, 0.52, -0.15, 0, 0, Math.PI / 2, 7),
    cyl(0.52, 0.52, 0.1, "#241e18", -0.48, 0.52, -0.15, 0, 0, Math.PI / 2, 7),
  ]);
}

export function buildTank() {
  const shape = new THREE.Shape();
  shape.moveTo(-5.5, 0.2);
  shape.lineTo(-3.6, 2.45);
  shape.lineTo(2.7, 2.25);
  shape.lineTo(5.7, 0.5);
  shape.lineTo(3.3, 0);
  shape.lineTo(-3.2, 0);
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: false });
  body.translate(0, 0.05, -1.6);
  solid(body, "#4e5846");
  return merge([
    body,
    box(2.2, 1.15, 0.85, "#454f3e", 0.4, 1.25, 2.05),
    box(2.2, 1.15, 0.85, "#454f3e", 0.4, 1.25, -2.05),
    cyl(0.12, 0.14, 1.35, "#2a2c28", 1.55, 1.28, 2.15, 0, 0, Math.PI / 2, 5),
    cyl(0.12, 0.14, 1.35, "#2a2c28", 1.55, 1.28, -2.15, 0, 0, Math.PI / 2, 5),
    box(8.6, 0.55, 0.28, "#2e332c", 0.2, 0.7, 1.72),
    box(8.6, 0.55, 0.28, "#2e332c", 0.2, 0.7, -1.72),
  ]);
}

export function buildStretcher() {
  return merge([
    box(0.55, 0.05, 1.7, "#8a7a58", 0, 0.42, 0),
    cyl(0.04, 0.04, 2.05, "#6b5340", 0.32, 0.42, 0, Math.PI / 2, 0, 0, 4),
    cyl(0.04, 0.04, 2.05, "#6b5340", -0.32, 0.42, 0, Math.PI / 2, 0, 0, 4),
  ]);
}

export function buildBasilica() {
  const stone = "#d9d0bc";
  const stoneDark = "#b7ad98";
  const roof = "#6e4538";
  const door = "#2a241c";
  const geo = merge([
    box(12, 8, 22, stone, 0, 4, 0),
    box(5.6, 18, 5.6, stoneDark, 0, 9, -13.2),
    cyl(0.2, 3.4, 6.5, roof, 0, 21.2, -13.2, 0, 0, 0, 4),
    box(13.2, 0.45, 12, roof, 0, 8.3, 2.2, -0.55, 0, 0),
    box(13.2, 0.45, 12, roof, 0, 8.3, -2.2, 0.55, 0, 0),
    box(2.2, 3.2, 0.4, door, 0, 1.6, 11.15),
  ]);

  const goldMat = new THREE.MeshStandardMaterial({
    color: "#e2b84a",
    metalness: 0.62,
    roughness: 0.34,
    emissive: "#8a6414",
    emissiveIntensity: 0.28,
    flatShading: true,
  });
  const virgin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.4, 0.32), goldMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), goldMat);
  head.position.y = 1.45;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.16), goldMat);
  arm.position.set(0.15, 0.45, 0);
  virgin.add(body, head, arm);
  virgin.position.set(0.15, 16.4, -16.3);
  virgin.rotation.x = -1.18;

  return { stone: geo, virgin, goldMat };
}

export function buildBalloon() {
  const env = sph(6.2, "#c2b48a", 0, 64, 0, 1, 0.78, 1.85);
  const band = cyl(2.4, 2.4, 0.35, "#8a7048", 0, 63.2, 0, 0, 0, 0, 8);
  const basket = box(1.5, 1.1, 1.5, "#6b5340", 0, 56.6, 0);
  const cable = cyl(0.06, 0.06, 55, "#2a261f", 0, 28, 0, 0, 0, 0, 4);
  return merge([env, band, basket, cable]);
}

export function buildTent() {
  const canvas = "#cbb892";
  const cross = "#f4ead8";
  return merge([
    cyl(0.2, 4.2, 3.4, canvas, 0, 1.7, 0, 0, 0, 0, 4),
    box(0.18, 1.4, 0.08, cross, 0, 1.5, 2.05),
    box(0.7, 0.18, 0.08, cross, 0, 1.55, 2.05),
  ]);
}
