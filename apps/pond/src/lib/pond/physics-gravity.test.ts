import assert from "node:assert/strict";
import test from "node:test";
import { E } from "./elements.ts";
import { POND_SIZES, PondSim, type PondRegion } from "./sim.ts";

/**
 * Evolution release gate: the physical world remains the authority for material
 * placement. This file deliberately imports the REAL PondSim, not a mock and
 * not the detached E00-E05 prototype's synthetic material grid.
 *
 * The Chronometer may accelerate BIOLOGICAL days only. After the clock is
 * wired into PondCanvas, add an end-to-end speed-mode test at the call site;
 * these material tests must continue to pass at every supported size.
 */

type Point = { x: number; y: number };

function cellsOf(sim: PondSim, kind: number): Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < sim.h; y++) {
    for (let x = 0; x < sim.w; x++) {
      if (sim.grid[sim.idx(x, y)] === kind) cells.push({ x, y });
    }
  }
  return cells;
}

function bottom(cells: readonly Point[]): number {
  assert.ok(cells.length > 0, "placed material must exist");
  return Math.max(...cells.map((cell) => cell.y));
}

function activeRegion(size: number): PondRegion {
  // Large Pond worlds run active-camera physics only; the placement is safely
  // within this camera-like region. Offscreen simulation is not implied.
  const center = size / 2;
  return { x: center - 60, y: center - 80, width: 120, height: 160 };
}

function advance(sim: PondSim, size: number, steps: number): void {
  const region = size > 320 ? activeRegion(size) : undefined;
  for (let frame = 0; frame < steps; frame++) sim.step(region);
}

for (const size of POND_SIZES) {
  test(`placed sand, salt, powder, snow and seeds fall in ${size}x${size} Pond`, () => {
    const center = size / 2;
    for (const material of [E.SAND, E.SALT, E.POWDER, E.SNOW, E.SEED]) {
      const sim = new PondSim(size, size);
      sim.clearInterior();
      // Use the same painting API as pointer/touch placement, not setCell.
      const painted = sim.paint(center, center - 29, material, 1);
      assert.ok(painted > 0, "brush must place material");
      const original = cellsOf(sim, material);
      const startingBottom = bottom(original);
      advance(sim, size, 32);
      const moved = cellsOf(sim, material);
      assert.equal(moved.length, original.length, "isolated falling material must be conserved");
      assert.ok(
        bottom(moved) >= startingBottom + 12,
        `placed material ${material} did not fall at world size ${size}`,
      );
      for (const { x, y } of moved) {
        assert.ok(sim.inDish(x, y), "falling grains must remain inside the glass");
      }
    }
  });

  test(`placed water flows and escapes a narrow shelf in ${size}x${size} Pond`, () => {
    const center = size / 2;
    const sim = new PondSim(size, size);
    sim.clearInterior();
    const shelfY = center + 2;
    for (let dx = -5; dx <= 5; dx++) {
      sim.setCell(sim.idx(center + dx, shelfY), E.STONE);
    }
    assert.ok(sim.paint(center, center - 22, E.WATER, 4) > 0);
    const starting = cellsOf(sim, E.WATER);
    assert.ok(starting.length > 0);
    advance(sim, size, 72);
    const after = cellsOf(sim, E.WATER);
    assert.equal(after.length, starting.length, "isolated water must not disappear");
    assert.ok(
      after.some(({ x }) => Math.abs(x - center) >= 6),
      "water must spread sideways around an obstacle",
    );
    assert.ok(
      after.some(({ y }) => y > shelfY),
      "water must pass around the shelf instead of floating above it",
    );
    for (let dx = -5; dx <= 5; dx++) {
      assert.equal(sim.grid[sim.idx(center + dx, shelfY)], E.STONE);
    }
  });
}

test("stone and wood stay in place while other materials fall", () => {
  const sim = new PondSim();
  sim.clearInterior();
  assert.ok(sim.paint(80, 60, E.STONE, 1));
  assert.ok(sim.paint(110, 60, E.WOOD, 1));
  const stoneBefore = cellsOf(sim, E.STONE);
  const woodBefore = cellsOf(sim, E.WOOD);
  advance(sim, 192, 90);
  assert.deepEqual(cellsOf(sim, E.STONE), stoneBefore);
  assert.deepEqual(cellsOf(sim, E.WOOD), woodBefore);
});

test("paused world accepts paint but does not animate until resumed", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.paused = true;
  assert.ok(sim.paint(96, 60, E.SAND, 1));
  const before = sim.snapshot();
  advance(sim, 192, 30);
  assert.deepEqual(sim.snapshot(), before, "paused physics should not advance");
  sim.paused = false;
  advance(sim, 192, 30);
  assert.notDeepEqual(sim.snapshot(), before, "resumed sand must move again");
  assert.ok(bottom(cellsOf(sim, E.SAND)) >= 72);
});

test("painting after a pause still falls when the simulation resumes", () => {
  const sim = new PondSim();
  sim.paused = true;
  sim.clearInterior();
  assert.ok(sim.paint(92, 66, E.SNOW, 1));
  assert.ok(sim.paint(100, 66, E.WATER, 1));
  const initialSnow = bottom(cellsOf(sim, E.SNOW));
  const initialWater = bottom(cellsOf(sim, E.WATER));
  advance(sim, 192, 12);
  assert.equal(bottom(cellsOf(sim, E.SNOW)), initialSnow);
  assert.equal(bottom(cellsOf(sim, E.WATER)), initialWater);
  sim.paused = false;
  advance(sim, 192, 28);
  assert.ok(bottom(cellsOf(sim, E.SNOW)) > initialSnow + 10);
  assert.ok(bottom(cellsOf(sim, E.WATER)) > initialWater + 10);
});
