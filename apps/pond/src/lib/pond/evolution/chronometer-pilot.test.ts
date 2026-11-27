import assert from "node:assert/strict";
import test from "node:test";
import { E } from "../elements.ts";
import { PondSim, POND_SIZES } from "../sim.ts";
import { PondEcosystem } from "../ecosystem.ts";
import { encodeWorld } from "../save.ts";
import { ChronometerPilot, observeHabitat } from "./chronometer-pilot.ts";

test("samples water, plants and heat without writing the grid", () => {
  const grid = new Uint8Array(24 * 24);
  grid[10] = E.WATER; grid[20] = E.PLANT; grid[30] = E.LAVA;
  const before = grid.slice();
  const world = { w: 24, h: 24, grid, inDish: (x: number) => x !== 23 };
  assert.deepEqual(observeHabitat(world, 3), { day: 3, samples: 552, water: 1, plants: 1, heat: 1 });
  assert.deepEqual(grid, before);
});

test("one fixed step per call and one second per 45 steps at every speed", () => {
  for (const speed of [1, 4, 16, 64] as const) {
    const pilot = new ChronometerPilot();
    pilot.controls.setSpeed(speed);
    pilot.controls.resume();
    const grid = new Uint8Array(24 * 24);
    const world = { w: 24, h: 24, grid, inDish: () => true };
    let physicalSteps = 0;
    const tick = () => pilot.step(world, () => { physicalSteps++; grid[10] = E.WATER; });
    for (let i = 0; i < 45; i++) tick();
    assert.equal(physicalSteps, 45);
    assert.equal(pilot.observation?.water, 1);
    assert.equal(pilot.observation?.day, speed);
    assert.equal(pilot.controls.snapshot().pendingMillis, 0);
    pilot.controls.pause();
    for (let i = 0; i < 45; i++) tick();
    assert.equal(physicalSteps, 90);
    assert.equal(pilot.observation?.day, speed);
    pilot.controls.resume();
    for (let i = 0; i < 45; i++) tick();
    assert.equal(physicalSteps, 135);
    assert.equal(pilot.observation?.day, 2 * speed);
  }
});

test("pilot preserves real particles, resident state and serialized world at all sizes", () => {
  const run = (size: number, speed: 1 | 4 | 16 | 64 | null) => {
    const original = Math.random;
    let seed = 177;
    Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    try {
      const sim = new PondSim(size, size);
      sim.clearInterior();
      const c = size / 2;
      sim.paint(c - 12, c - 20, E.SAND, 2);
      sim.paint(c + 12, c - 20, E.WATER, 3);
      sim.paint(c + 7, c + 8, E.PLANT, 2);
      const ecosystem = new PondEcosystem();
      assert.ok(ecosystem.add("Plant", c, c, sim));
      const pilot = new ChronometerPilot();
      if (speed !== null) {
        pilot.controls.setSpeed(speed);
        pilot.controls.resume();
      }
      const before = sim.grid.slice();
      for (let i = 0; i < 54; i++) {
        if (i === 15) pilot.controls.pause();
        if (i === 25 && speed !== null) pilot.controls.resume();
        sim.paused = i >= 40 && i < 44;
        const zone = size > 320 ? { x: c - 50 + (i >= 30 ? 4 : 0), y: c - 50, width: 100, height: 100 } : undefined;
        const step = () => { sim.step(zone); if (!sim.paused) ecosystem.step(sim, zone); };
        if (!sim.paused && !pilot.controls.paused) pilot.step(sim, step);
        else step();
      }
      assert.notDeepEqual(sim.grid, before, "the material scene must actually change");
      return { grid: sim.grid.slice(), residents: ecosystem.snapshot(), save: encodeWorld(sim, ecosystem.snapshot()), day: pilot.observation?.day ?? 0 };
    } finally { Math.random = original; }
  };
  for (const size of POND_SIZES) {
    const base = run(size, null);
    let prior = 0;
    for (const speed of [1, 4, 16, 64] as const) {
      const {day, ...world} = run(size, speed);
      const {day: _baseDay, ...expected} = base;
      assert.deepEqual(world, expected, `${size} at ${speed}× must match disabled baseline`);
      assert.ok(day >= prior && (speed === 1 || day > prior), "notebook time scales separately");
      prior = day;
    }
  }
});
