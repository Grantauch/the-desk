import { isPondSize, type PondSize, type PondRegion } from "./sim.ts";

/** Camera offsets are real world-cell coordinates, never CSS zoom values. */
export type PondCamera = Readonly<{ x: number; y: number; size: number }>;
export const VIEW_SIZES = [192, 256, 320] as const;

export function clampCamera(worldSize: number, input: PondCamera): PondCamera {
  if (!isPondSize(worldSize)) throw new RangeError("Unsupported world size");
  if (![...VIEW_SIZES].includes(input.size as 192 | 256 | 320) || input.size > worldSize) {
    throw new RangeError("Invalid camera size");
  }
  const clamp = (v: number) => Math.min(worldSize - input.size, Math.max(0, Math.round(Number.isFinite(v) ? v : 0)));
  return { x: clamp(input.x), y: clamp(input.y), size: input.size };
}

export function initialCamera(worldSize: PondSize): PondCamera {
  const size = worldSize <= 320 ? worldSize : 256;
  return clampCamera(worldSize, {
    x: Math.floor((worldSize - size) / 2),
    y: Math.floor((worldSize - size) / 2), size,
  });
}

export function expandCamera(before: PondCamera, oldSize: PondSize, newSize: PondSize): PondCamera {
  const offset = (newSize - oldSize) / 2;
  const size = newSize <= 320 ? newSize : oldSize <= 320 ? 256 : before.size;
  // Preserve the previous focal point while the simulation gets re-centered.
  const focusX = before.x + before.size / 2 + offset;
  const focusY = before.y + before.size / 2 + offset;
  return clampCamera(newSize, { x: focusX - size / 2, y: focusY - size / 2, size });
}

export function panCamera(worldSize: PondSize, before: PondCamera, dx: number, dy: number): PondCamera {
  return clampCamera(worldSize, { ...before, x: before.x + dx, y: before.y + dy });
}

export function zoomCamera(worldSize: PondSize, before: PondCamera, direction: "in" | "out"): PondCamera {
  const available = VIEW_SIZES.filter((s) => s <= worldSize);
  const current = available.indexOf(before.size as 192 | 256 | 320);
  const index = Math.min(available.length - 1, Math.max(0, current + (direction === "out" ? 1 : -1)));
  const size = available[index]!;
  return clampCamera(worldSize, {
    x: before.x + before.size / 2 - size / 2,
    y: before.y + before.size / 2 - size / 2,
    size,
  });
}

/** The current viewport is also the only active zone in very large worlds. */
export function activeCameraRegion(camera: PondCamera): PondRegion {
  return { x: camera.x, y: camera.y, width: camera.size, height: camera.size };
}
