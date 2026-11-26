import assert from "node:assert/strict";
import test from "node:test";
import {
  initialCamera, clampCamera, panCamera, zoomCamera, expandCamera, activeCameraRegion,
} from "./camera.ts";
import { PondSim, POND_SIZES } from "./sim.ts";
import { E } from "./elements.ts";
import { PondEcosystem } from "./ecosystem.ts";
import { encodeWorld, decodePondAnySize, MAX_SAVE_BYTES } from "./save.ts";

test("staged maps support 768-cell worlds and an accessible bounded camera", () => {
  assert.deepEqual(POND_SIZES, [192, 256, 320, 448, 576, 768]);
  assert.deepEqual(initialCamera(192), { x: 0, y: 0, size: 192 });
  assert.deepEqual(initialCamera(768), { x: 256, y: 256, size: 256 });
  const camera = initialCamera(768);
  assert.deepEqual(panCamera(768, camera, 10000, -10000), { x: 512, y: 0, size: 256 });
  assert.deepEqual(zoomCamera(768, camera, "in"), { x: 288, y: 288, size: 192 });
  assert.deepEqual(zoomCamera(768, camera, "out"), { x: 224, y: 224, size: 320 });
  assert.deepEqual(zoomCamera(768, zoomCamera(768, camera, "out"), "out"), { x: 224, y: 224, size: 320 });
  assert.deepEqual(clampCamera(448, { x: Number.POSITIVE_INFINITY, y: -90, size: 256 }), { x: 0, y: 0, size: 256 });
  assert.throws(() => clampCamera(320, { x: 0, y: 0, size: 448 }), RangeError);
});

test("expansion follows the old focal point rather than teleporting to an edge", () => {
  let camera = initialCamera(192);
  for (const [oldWorld, newWorld] of [[192, 256], [256, 320], [320, 448], [448, 576], [576, 768]] as const) {
    camera = expandCamera(camera, oldWorld, newWorld);
    assert.equal(camera.size <= newWorld, true);
    const focus = newWorld / 2;
    assert.equal(camera.x + camera.size / 2, focus);
    assert.equal(camera.y + camera.size / 2, focus);
  }
  assert.deepEqual(camera, { x: 256, y: 256, size: 256 });
  const right = panCamera(768, camera, 160, 0);
  const expandedFocus = expandCamera(right, 768, 768);
  assert.equal(expandedFocus.x, right.x);
  assert.deepEqual(activeCameraRegion(right), { x: right.x, y: right.y, width: 256, height: 256 });
});

test("distant sand is dormant until the player explores its region", () => {
  const sim = new PondSim();
  sim.clearInterior();
  for (const size of [256, 320, 448] as const) sim.resize(size);
  const far = sim.idx(350, 190);
  const near = sim.idx(145, 150);
  sim.setCell(far, E.SAND);
  sim.setCell(near, E.SAND);
  const active = { x: 90, y: 90, width: 192, height: 192 };
  for (let frame = 0; frame < 50; frame++) sim.step(active);
  assert.equal(sim.grid[far], E.SAND, "outside active camera must not advance");
  assert.equal(sim.grid[near], E.EMPTY, "nearby sand should move");
  const following = { x: 260, y: 90, width: 188, height: 192 };
  for (let frame = 0; frame < 50; frame++) sim.step(following);
  assert.equal(sim.grid[far], E.EMPTY, "previously dormant sand wakes when the player pans");
});

test("cropped images render the correct world coordinates instead of stretching a small pond", () => {
  const sim = new PondSim();
  sim.clearInterior();
  for (const size of [256, 320, 448] as const) sim.resize(size);
  sim.setCell(sim.idx(240, 240), E.FIRE);
  const image = {
    width: 192,
    height: 192,
    data: new Uint8ClampedArray(192 * 192 * 4),
  } as unknown as ImageData;
  sim.render(image, 144, 144);
  const p = (96 * 192 + 96) * 4;
  assert.ok(image.data[p] > image.data[p + 2], "camera crop sees the fire");
  assert.equal(image.data[p + 3], 255);
  assert.equal(image.data.length, 192 * 192 * 4);
});

test("largest expanded worlds preserve residents and remain exportable", () => {
  const sim = new PondSim();
  sim.clearInterior();
  const living = new PondEcosystem();
  living.add("Plant", 96, 96, sim);
  for (const size of [256, 320, 448, 576, 768] as const) {
    const offset = sim.resize(size);
    living.translate(offset, offset, sim);
  }
  sim.setCell(sim.idx(590, 400), E.STONE);
  const save = encodeWorld(sim, living.snapshot());
  assert.ok(save.length < MAX_SAVE_BYTES, "maximum stage must fit the supported save envelope");
  const decoded = decodePondAnySize(save);
  assert.equal(decoded.size, 768);
  assert.equal(decoded.particles.length, 768 * 768 * 3);
  assert.equal(decoded.particles[sim.idx(590, 400)], E.STONE);
  assert.deepEqual(decoded.residents, living.snapshot());
});
