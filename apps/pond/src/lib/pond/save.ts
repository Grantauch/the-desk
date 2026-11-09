import type { PondSim } from "./sim.ts";

export const WORLD_KEY = "grantdesk-pond-world-v1";
export const MAX_SAVE_BYTES = 200_000;

export function encodeWorld(sim: PondSim) {
  const bytes = sim.snapshot();
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return JSON.stringify({ app: "pond", version: 1, width: sim.w, height: sim.h, data: btoa(binary) });
}

export function decodeWorld(text: string, sim: PondSim): Uint8Array {
  if (text.length > MAX_SAVE_BYTES) throw new Error("That save is too large.");
  const value = JSON.parse(text);
  if (!value || value.app !== "pond" || value.version !== 1 || value.width !== sim.w || value.height !== sim.h || typeof value.data !== "string") {
    throw new Error("Choose a Pond save for this dish size.");
  }
  const binary = atob(value.data);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  validateSnapshot(bytes, sim.w * sim.h);
  return bytes;
}

export function validateSnapshot(bytes: Uint8Array, cells: number) {
  if (bytes.length !== cells * 3) throw new Error("That save is incomplete.");
  for (let i = 0; i < cells; i++) {
    if (bytes[i] > 20 || bytes[i + cells * 2] > 15) throw new Error("That save contains an unknown material.");
  }
}
