import assert from "node:assert/strict";
import test from "node:test";
import { PondSim, POND_SIZES } from "./sim.ts";
import { PondEcosystem } from "./ecosystem.ts";
import { E } from "./elements.ts";
import { decodePondAnySize, encodeWorld, MAX_SAVE_BYTES } from "./save.ts";

test("expansion increases real playable cells without erasing central particles", () => {
  const sim = new PondSim();
  sim.clearInterior();
  const points = [
    [96, 96, E.WATER], [66, 107, E.PLANT],
    [120, 70, E.FIRE], [31, 95, E.STONE],
  ] as const;
  for (const [x, y, element] of points) sim.setCell(sim.idx(x, y), element, 8);
  assert.deepEqual(POND_SIZES, [192, 256, 320]);
  const oldInterior = [...sim.locked].filter((v) => v === 0).length;
  assert.equal(sim.resize(256), 32);
  assert.equal(sim.w, 256);
  assert.equal(sim.grid.length, 256 ** 2);
  for (const [x, y, element] of points) {
    assert.equal(sim.grid[sim.idx(x + 32, y + 32)], element);
    assert.equal(sim.aux[sim.idx(x + 32, y + 32)], 8);
  }
  const nextInterior = [...sim.locked].filter((v) => v === 0).length;
  assert.ok(nextInterior > oldInterior * 1.5);
  assert.equal(sim.grid[sim.idx(128, 17)], E.EMPTY, "newly opened ring starts empty");
  assert.equal(sim.grid[sim.idx(0, 0)], E.WALL, "new external glass remains a wall");
  assert.equal(sim.resize(320), 32);
  for (const [x, y, element] of points)
    assert.equal(sim.grid[sim.idx(x + 64, y + 64)], element);
  assert.ok([...sim.locked].filter((v) => v === 0).length > nextInterior);
  assert.equal(sim.resize(320), 0);
  assert.throws(() => sim.resize(384 as 320), RangeError);
  // Existing particle rules still execute after growth.
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok([...sim.grid].every((el) => el <= 20));
});

test("inhabitants stay aligned with old terrain as the pond grows", () => {
  const sim = new PondSim();
  sim.clearInterior();
  const inhabitants = new PondEcosystem();
  assert.ok(inhabitants.add("Fish", 96, 91, sim));
  assert.ok(inhabitants.add("Plant", 115, 112, sim));
  const before = inhabitants.snapshot();
  sim.resize(256);
  inhabitants.translate(32, 32, sim);
  assert.deepEqual(inhabitants.snapshot().map((r) => [r.id, r.x, r.y]),
    before.map((r) => [r.id, r.x + 32, r.y + 32]));
  const stage1 = sim.snapshot();
  const living1 = inhabitants.snapshot();
  sim.resize(320);
  inhabitants.translate(32, 32, sim);
  sim.resize(256);
  sim.restore(stage1);
  inhabitants.restore(living1, sim);
  assert.deepEqual(inhabitants.snapshot(), living1, "undo can restore an earlier stage");
});

test("expanded pond worlds export, validate, and restore their size", () => {
  const sim = new PondSim();
  const inhabitants = new PondEcosystem();
  sim.clearInterior();
  sim.resize(256);
  sim.setCell(sim.idx(150, 150), E.LAVA);
  assert.ok(inhabitants.add("v:55", 150, 147, sim));
  const text = encodeWorld(sim, inhabitants.snapshot());
  const restored = decodePondAnySize(text);
  assert.equal(restored.size, 256);
  assert.deepEqual(restored.particles, sim.snapshot());
  assert.deepEqual(restored.residents, inhabitants.snapshot());
  sim.resize(320);
  inhabitants.translate(32, 32, sim);
  const large = encodeWorld(sim, inhabitants.snapshot());
  assert.ok(large.length < MAX_SAVE_BYTES, "largest stage fits save limit");
  const grown = decodePondAnySize(large);
  assert.equal(grown.size, 320);
  assert.equal(grown.particles.length, 320 * 320 * 3);
  assert.deepEqual(grown.residents, inhabitants.snapshot());
  // V1 saves remain supported when loaded as their original 192 stage.
  const old = new PondSim();
  const v2 = JSON.parse(encodeWorld(old));
  const v1 = decodePondAnySize(JSON.stringify({
    app: "pond", version: 1, width: 192, height: 192, data: v2.data,
  }));
  assert.equal(v1.size, 192);
  assert.deepEqual(v1.residents, []);
});

test("unsupported sizes or malformed metadata never enter a session", () => {
  const sim = new PondSim();
  const serialized = JSON.parse(encodeWorld(sim));
  for (const [width, height] of [[384, 384], [256, 192], [200, 200], [-1, -1]]) {
    assert.throws(() => decodePondAnySize(JSON.stringify({ ...serialized, width, height })));
  }
  assert.throws(() => decodePondAnySize("not json"));
  assert.equal(sim.w, 192);
});
