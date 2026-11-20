import { PondSim, isPondSize, type PondSize } from "./sim.ts";
import { validateResidents, type ResidentSave } from "./ecosystem.ts";
import { decodeAtlas, encodeAtlas, type AtlasState } from "./atlas.ts";

export const WORLD_KEY = "grantdesk-pond-world-v1";
export const MAX_SAVE_BYTES = 3_000_000;

/**
 * V2 adds optional resident specimens alongside the unchanged V1 particle
 * snapshot. Both legacy exports and previously autosaved V1 worlds still load.
 */
export function encodeWorld(sim: PondSim, residents: readonly ResidentSave[] = [], atlas?: AtlasState) {
  const verified = validateResidents(residents, sim);
  if (atlas && atlas.worldSize !== sim.w) throw new Error("Pond map and world dimensions differ.");
  const bytes = sim.snapshot();
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const output = JSON.stringify({
    app: "pond", version: 2, width: sim.w, height: sim.h,
    data: btoa(binary), residents: verified,
    ...(atlas ? { atlas: encodeAtlas(atlas) } : {}),
  });
  if (output.length > MAX_SAVE_BYTES) throw new Error("Pond save is too large.");
  return output;
}

type SaveEnvelope = {
  app: "pond";
  version: 1 | 2;
  width: number;
  height: number;
  data: string;
  residents?: unknown;
  atlas?: unknown;
};

function envelope(text: string, sim: PondSim): SaveEnvelope {
  if (text.length > MAX_SAVE_BYTES) throw new Error("That save is too large.");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object") throw new Error("Invalid pond save.");
  const world = value as Record<string, unknown>;
  if (world.app !== "pond" || (world.version !== 1 && world.version !== 2) ||
    world.width !== sim.w || world.height !== sim.h || typeof world.data !== "string") {
    throw new Error("Choose a Pond save for this dish size.");
  }
  return world as SaveEnvelope;
}

/** Validate both layers before mutating either: imported worlds are atomic. */
export function decodePondFile(text: string, sim: PondSim): { particles: Uint8Array; residents: ResidentSave[]; atlas: AtlasState | null } {
  const value = envelope(text, sim);
  const binary = atob(value.data);
  const particles = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  validateSnapshot(particles, sim.w * sim.h);
  const residents = value.version === 2 ? validateResidents(value.residents, sim) : [];
  // Optional exploration metadata maintains compatibility with every V1 and
  // early V2 save. Invalid metadata rejects the entire import atomically.
  const atlas = value.atlas === undefined ? null : decodeAtlas(value.atlas, sim.w);
  return { particles, residents, atlas };
}

/**
 * Decode an import against its own approved stage size before changing the
 * current pond. Older 192px saves and expanded worlds through 768px both round-trip.
 */
export function decodePondAnySize(text: string): { size: PondSize; particles: Uint8Array; residents: ResidentSave[]; atlas: AtlasState | null } {
  if (text.length > MAX_SAVE_BYTES) throw new Error("That save is too large.");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid Pond save.");
  const value = parsed as Record<string, unknown>;
  if (typeof value.width !== "number" || !isPondSize(value.width) || value.height !== value.width) {
    throw new Error("That Pond size is not supported.");
  }
  const candidate = new PondSim(value.width, value.width);
  const decoded = decodePondFile(text, candidate);
  return { size: value.width, ...decoded };
}

/** Backwards compatible particle-only API for existing tools and tests. */
export function decodeWorld(text: string, sim: PondSim): Uint8Array {
  return decodePondFile(text, sim).particles;
}

export function validateSnapshot(bytes: Uint8Array, cells: number) {
  if (bytes.length !== cells * 3) throw new Error("That save is incomplete.");
  for (let i = 0; i < cells; i++) {
    if (bytes[i] > 20 || bytes[i + cells * 2] > 15) throw new Error("That save contains an unknown material.");
  }
}
