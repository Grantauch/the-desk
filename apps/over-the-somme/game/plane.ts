import * as THREE from "three";
import { box, cyl, merge } from "./models";

/**
 * Morane-Saulnier Type L "Parasol", the two seat monoplane No. 3 Squadron RFC
 * flew over La Boisselle on 1 July 1916. The wing sits above the fuselage on
 * cabane struts. Built facing -Z with +Y up, span scaled to fit the sector.
 */
const LINEN = "#d9cba6";
const LINEN_DARK = "#b9a882";
const RIB = "#c7b791";
const ALU = "#9aa0a2";
const ALU_DARK = "#5f6466";
const WOOD = "#5a4128";
const TYRE = "#1d1b19";
const BLUE = "#26386b";
const WHITE = "#ece6d6";
const RED = "#a32a24";
const PILOT = "#4b3a29";

function roundel(x: number, y: number, z: number, r: number, under: boolean) {
  const s = under ? -1 : 1;
  return [
    cyl(r, r, 0.02, BLUE, x, y, z, 0, 0, 0, 14),
    cyl(r * 0.66, r * 0.66, 0.02, WHITE, x, y + 0.012 * s, z, 0, 0, 0, 14),
    cyl(r * 0.33, r * 0.33, 0.02, RED, x, y + 0.024 * s, z, 0, 0, 0, 12),
  ];
}

export function buildPlane() {
  const parts: THREE.BufferGeometry[] = [];
  // Fuselage: square section tapering to the tail.
  parts.push(box(0.62, 0.66, 1.4, LINEN, 0, 0, -0.9));
  parts.push(box(0.56, 0.6, 1.3, LINEN, 0, 0.0, 0.4));
  parts.push(box(0.44, 0.46, 1.2, LINEN_DARK, 0, 0.04, 1.6));
  parts.push(box(0.28, 0.3, 1.0, LINEN_DARK, 0, 0.08, 2.65));
  // Cockpit openings and crew.
  parts.push(box(0.5, 0.06, 0.46, "#2a231c", 0, 0.34, -0.28));
  parts.push(box(0.5, 0.06, 0.46, "#2a231c", 0, 0.34, 0.42));
  parts.push(box(0.3, 0.32, 0.3, PILOT, 0, 0.5, -0.28));
  parts.push(box(0.3, 0.3, 0.3, PILOT, 0, 0.48, 0.42));
  parts.push(box(0.26, 0.16, 0.26, "#2c2622", 0, 0.72, -0.28));
  parts.push(box(0.26, 0.16, 0.26, "#2c2622", 0, 0.7, 0.42));
  // Rotary engine cowling and nose.
  parts.push(cyl(0.48, 0.42, 0.5, ALU, 0, 0, -1.78, Math.PI / 2, 0, 0, 12));
  parts.push(cyl(0.34, 0.34, 0.08, ALU_DARK, 0, 0, -2.05, Math.PI / 2, 0, 0, 12));
  parts.push(cyl(0.1, 0.1, 0.22, ALU_DARK, 0, 0, -2.15, Math.PI / 2, 0, 0, 8));
  // Parasol wing, slight sweep at the tips, ribs painted on.
  const wingY = 1.18;
  parts.push(box(7.0, 0.09, 1.55, LINEN, 0, wingY, -0.35));
  for (let i = -6; i <= 6; i++) parts.push(box(0.04, 0.1, 1.5, RIB, i * 0.55, wingY + 0.005, -0.35));
  parts.push(box(7.02, 0.05, 0.08, LINEN_DARK, 0, wingY - 0.01, 0.42));
  parts.push(...roundel(-2.6, wingY + 0.05, -0.35, 0.5, false));
  parts.push(...roundel(2.6, wingY + 0.05, -0.35, 0.5, false));
  parts.push(...roundel(-2.6, wingY - 0.05, -0.35, 0.5, true));
  parts.push(...roundel(2.6, wingY - 0.05, -0.35, 0.5, true));
  // Cabane struts from fuselage to wing, and the bracing pylon above.
  for (const sx of [-0.28, 0.28]) {
    parts.push(box(0.05, 0.86, 0.05, WOOD, sx, 0.75, -0.75, 0, 0, sx * 0.5));
    parts.push(box(0.05, 0.86, 0.05, WOOD, sx, 0.75, -0.05, 0, 0, sx * 0.5));
  }
  parts.push(box(0.05, 0.55, 0.05, WOOD, 0, wingY + 0.3, -0.4));
  // Bracing wires as thin dark struts out to the wing.
  for (const s of [-1, 1]) {
    parts.push(box(2.7, 0.025, 0.025, "#3a3530", s * 1.45, 0.68, -0.6, 0, 0, s * -0.34));
    parts.push(box(2.7, 0.025, 0.025, "#3a3530", s * 1.45, 1.42, -0.4, 0, 0, s * 0.18));
  }
  // Tail: all moving tailplane and a balanced rudder.
  parts.push(box(2.2, 0.05, 0.8, LINEN, 0, 0.1, 3.05));
  parts.push(box(0.05, 0.85, 0.7, LINEN, 0, 0.42, 3.15));
  parts.push(box(0.06, 0.3, 0.5, BLUE, 0, 0.34, 3.32));
  parts.push(box(0.065, 0.3, 0.5, WHITE, 0, 0.6, 3.32));
  // Fuselage roundels.
  for (const s of [-1, 1]) {
    parts.push(cyl(0.2, 0.2, 0.02, BLUE, s * 0.235, 0.05, 1.6, 0, 0, Math.PI / 2, 12));
    parts.push(cyl(0.13, 0.13, 0.02, WHITE, s * 0.247, 0.05, 1.6, 0, 0, Math.PI / 2, 12));
    parts.push(cyl(0.065, 0.065, 0.02, RED, s * 0.259, 0.05, 1.6, 0, 0, Math.PI / 2, 10));
  }
  // Undercarriage.
  for (const s of [-1, 1]) {
    parts.push(box(0.05, 0.62, 0.05, WOOD, s * 0.42, -0.58, -0.95, 0.35, 0, s * 0.3));
    parts.push(box(0.05, 0.62, 0.05, WOOD, s * 0.42, -0.58, -0.45, -0.35, 0, s * 0.3));
    parts.push(cyl(0.3, 0.3, 0.1, TYRE, s * 0.62, -0.88, -0.7, 0, 0, Math.PI / 2, 12));
  }
  parts.push(box(1.3, 0.05, 0.05, WOOD, 0, -0.88, -0.7));
  const body = merge(parts);

  const blade = merge([
    box(0.12, 1.9, 0.05, WOOD, 0, 0, 0),
    box(0.16, 0.16, 0.08, ALU_DARK, 0, 0, 0),
  ]);
  const discGeo = new THREE.CircleGeometry(1.0, 20);
  return { body, blade, discGeo };
}

export type PlaneRig = {
  root: THREE.Group;
  prop: THREE.Mesh;
  disc: THREE.Mesh;
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
};

export function makePlane(mat: THREE.Material): PlaneRig {
  const { body, blade, discGeo } = buildPlane();
  const root = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body, mat);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);
  const prop = new THREE.Mesh(blade, mat);
  prop.position.set(0, 0, -2.2);
  root.add(prop);
  const discMat = new THREE.MeshBasicMaterial({ color: "#3b3127", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.set(0, 0, -2.22);
  root.add(disc);
  root.scale.setScalar(0.62);
  return { root, prop, disc, geos: [body, blade, discGeo], mats: [discMat] };
}
