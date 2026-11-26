import { E } from "./elements.ts";
import type { PondSim } from "./sim.ts";
import type { PondCamera } from "./camera.ts";
import type { ResidentSave } from "./ecosystem.ts";

/**
 * A 32×32 exploration grid remembers visited territory independently of
 * particles, creatures, and camera. Stored as a validated 128-byte bitset.
 * This atlas survives V2 world exports without touching the particle schema.
 */
export const ATLAS_SIDE = 32;
export const ATLAS_BITS = ATLAS_SIDE * ATLAS_SIDE;
const ATLAS_BYTES = ATLAS_BITS / 8;
export type AtlasSave = { version: 1; worldSize: number; explored: string };
export type AtlasState = Readonly<{ worldSize: number; bits: Uint8Array }>;
export type Biome = "water" | "grove" | "fire" | "frost" | "sand" | "stone" | "mixed" | "empty";
export const BIOMES: Readonly<Record<Biome, { label: string; color: string; landmark: string }>> = {
  water: { label: "Waterways", color: "#397f9a", landmark: "Bluewater Basin" },
  grove: { label: "Wild Groves", color: "#65896a", landmark: "Verdant Grove" },
  fire: { label: "Cinder Fields", color: "#bd6651", landmark: "Cinder Reach" },
  frost: { label: "Frostlands", color: "#b6c8d0", landmark: "Frostfall" },
  sand: { label: "Dunes", color: "#b89e6d", landmark: "Copper Dunes" },
  stone: { label: "Highlands", color: "#817e87", landmark: "Slate Highlands" },
  mixed: { label: "Wildlands", color: "#756c63", landmark: "Patchwork Wilds" },
  empty: { label: "Open Terrain", color: "#2a3137", landmark: "Silent Expanse" },
};
export type AtlasLandmark = Readonly<{
  x: number;
  y: number;
  biome: Biome;
  title: string;
  residentCount: number;
}>;

function tileIndex(x: number, y: number): number {
  return y * ATLAS_SIDE + x;
}
function visible(bits: Uint8Array, cell: number): boolean {
  return !!(bits[cell >> 3]! & (1 << (cell & 7)));
}
function mark(bits: Uint8Array, cell: number): void {
  bits[cell >> 3] |= 1 << (cell & 7);
}
function normalizeSize(worldSize: number): number {
  if (![192, 256, 320, 448, 576, 768].includes(worldSize)) throw new RangeError("Invalid Pond atlas dimensions");
  return worldSize;
}

export function blankAtlas(worldSize: number): AtlasState {
  return { worldSize: normalizeSize(worldSize), bits: new Uint8Array(ATLAS_BYTES) };
}

export function isVisited(atlas: AtlasState, tx: number, ty: number): boolean {
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= ATLAS_SIDE || ty >= ATLAS_SIDE) return false;
  return visible(atlas.bits, tileIndex(tx, ty));
}

/**
 * Reveal all grid tiles whose centers fall inside the viewport. An already
 * explored camera window returns the original object (avoids React loops).
 */
export function revealAtlas(atlas: AtlasState, camera: PondCamera): AtlasState {
  const next = atlas.bits.slice();
  let changed = false;
  for (let ty = 0; ty < ATLAS_SIDE; ty++) {
    const y = (ty + 0.5) * atlas.worldSize / ATLAS_SIDE;
    if (y < camera.y || y >= camera.y + camera.size) continue;
    for (let tx = 0; tx < ATLAS_SIDE; tx++) {
      const x = (tx + 0.5) * atlas.worldSize / ATLAS_SIDE;
      if (x < camera.x || x >= camera.x + camera.size) continue;
      const i = tileIndex(tx, ty);
      if (!visible(next, i)) { mark(next, i); changed = true; }
    }
  }
  return changed ? { worldSize: atlas.worldSize, bits: next } : atlas;
}

/** Move existing map discoveries with their world coordinates when expanding. */
export function expandAtlas(atlas: AtlasState, newSize: number): AtlasState {
  const size = normalizeSize(newSize);
  if (size === atlas.worldSize) return atlas;
  const offset = (size - atlas.worldSize) / 2;
  const expanded = blankAtlas(size);
  for (let ty = 0; ty < ATLAS_SIDE; ty++) for (let tx = 0; tx < ATLAS_SIDE; tx++) {
    if (!isVisited(atlas, tx, ty)) continue;
    const worldX = (tx + 0.5) * atlas.worldSize / ATLAS_SIDE + offset;
    const worldY = (ty + 0.5) * atlas.worldSize / ATLAS_SIDE + offset;
    const px = Math.floor(worldX / size * ATLAS_SIDE);
    const py = Math.floor(worldY / size * ATLAS_SIDE);
    if (px >= 0 && py >= 0 && px < ATLAS_SIDE && py < ATLAS_SIDE) mark(expanded.bits, tileIndex(px, py));
  }
  return expanded;
}

export function exploredCount(atlas: AtlasState): number {
  let found = 0;
  for (const byte of atlas.bits) {
    let n = byte;
    while (n) { n &= n - 1; found++; }
  }
  return found;
}

export function encodeAtlas(atlas: AtlasState): AtlasSave {
  normalizeSize(atlas.worldSize);
  if (!(atlas.bits instanceof Uint8Array) || atlas.bits.length !== ATLAS_BYTES) throw new Error("Invalid explored map");
  let binary = "";
  for (const byte of atlas.bits) binary += String.fromCharCode(byte);
  return { version: 1, worldSize: atlas.worldSize, explored: btoa(binary) };
}

export function decodeAtlas(value: unknown, worldSize: number): AtlasState {
  normalizeSize(worldSize);
  if (!value || typeof value !== "object") throw new Error("Invalid exploration metadata");
  const atlas = value as Record<string, unknown>;
  if (atlas.version !== 1 || atlas.worldSize !== worldSize ||
    typeof atlas.explored !== "string" || atlas.explored.length > 176 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(atlas.explored)) {
    throw new Error("Invalid or mismatched exploration save");
  }
  const bytes = atob(atlas.explored);
  if (bytes.length !== ATLAS_BYTES) throw new Error("Incomplete exploration map");
  const result = blankAtlas(worldSize);
  for (let i = 0; i < ATLAS_BYTES; i++) result.bits[i] = bytes.charCodeAt(i);
  if (encodeAtlas(result).explored !== atlas.explored) throw new Error("Noncanonical exploration map");
  return result;
}

function classify(sim: PondSim, x: number, y: number): Biome {
  const counts = new Uint16Array(7);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const sx = x + dx * 2, sy = y + dy * 2;
    if (!sim.inBounds(sx, sy) || !sim.inDish(sx, sy)) continue;
    const cell = sim.grid[sim.idx(sx, sy)];
    if (cell === E.WATER || cell === E.OIL || cell === E.SLIME) counts[0]++;
    else if (cell === E.PLANT || cell === E.SEED || cell === E.FUNGUS || cell === E.WOOD) counts[1]++;
    else if (cell === E.LAVA || cell === E.FIRE || cell === E.SMOKE) counts[2]++;
    else if (cell === E.SNOW || cell === E.ICE) counts[3]++;
    else if (cell === E.SAND || cell === E.SALT || cell === E.POWDER) counts[4]++;
    else if (cell === E.STONE) counts[5]++;
    else if (cell && cell !== E.WALL) counts[6]++;
  }
  const top = Math.max(...counts);
  if (top < 2) return "empty";
  const options: Biome[] = ["water", "grove", "fire", "frost", "sand", "stone", "mixed"];
  return options[counts.indexOf(top)]!;
}

export function classifyAtlas(sim: PondSim, atlas: AtlasState): Biome[] {
  const biomes: Biome[] = Array.from({ length: ATLAS_BITS }, () => "empty");
  for (let ty = 0; ty < ATLAS_SIDE; ty++) for (let tx = 0; tx < ATLAS_SIDE; tx++) {
    if (!isVisited(atlas, tx, ty)) continue;
    const x = Math.floor((tx + 0.5) * sim.w / ATLAS_SIDE);
    const y = Math.floor((ty + 0.5) * sim.h / ATLAS_SIDE);
    if (sim.inDish(x, y)) biomes[tileIndex(tx, ty)] = classify(sim, x, y);
  }
  return biomes;
}

/**
 * A few representative, navigable landmarks for explored habitats only.
 * Names reflect the current terrain; we never claim undiscovered information.
 */
export function atlasLandmarks(
  sim: PondSim, atlas: AtlasState, biomes: readonly Biome[], residents: readonly ResidentSave[],
): AtlasLandmark[] {
  const preferred: Biome[] = ["water", "grove", "fire", "frost", "sand", "stone", "mixed", "empty"];
  const landmarks: AtlasLandmark[] = [];
  for (const biome of preferred) {
    let chosen: { tx: number; ty: number; density: number } | null = null;
    for (let ty = 2; ty < ATLAS_SIDE - 2; ty += 2) for (let tx = 2; tx < ATLAS_SIDE - 2; tx += 2) {
      const x = (tx + 0.5) * sim.w / ATLAS_SIDE;
      const y = (ty + 0.5) * sim.h / ATLAS_SIDE;
      if (!sim.inDish(Math.round(x), Math.round(y)) || !isVisited(atlas, tx, ty)) continue;
      if (biomes[tileIndex(tx, ty)] !== biome) continue;
      const density = residents.reduce((n, r) => n + (Math.hypot(r.x - x, r.y - y) < sim.w / 14 ? 1 : 0), 0);
      if (!chosen || density > chosen.density) chosen = { tx, ty, density };
    }
    if (!chosen) continue;
    const x = Math.round((chosen.tx + 0.5) * sim.w / ATLAS_SIDE);
    const y = Math.round((chosen.ty + 0.5) * sim.h / ATLAS_SIDE);
    const quadrant = y < sim.h * 0.38 ? "Northern" : y > sim.h * 0.62 ? "Southern" :
      x < sim.w * 0.45 ? "Western" : x > sim.w * 0.55 ? "Eastern" : "Central";
    landmarks.push({ x, y, biome, title: quadrant + " " + BIOMES[biome].landmark, residentCount: chosen.density });
    if (landmarks.length === 6) break;
  }
  return landmarks;
}
