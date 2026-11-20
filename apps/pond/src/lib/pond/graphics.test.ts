import test from "node:test";
import assert from "node:assert/strict";
import { PondSim } from "./sim.ts";
import { E } from "./elements.ts";

function image(w: number, h: number): ImageData {
  return {
    width: w, height: h,
    data: new Uint8ClampedArray(w * h * 4),
  } as ImageData;
}

function pixel(img: ImageData, x: number, y: number): number[] {
  return Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
}

test("enhanced water has readable reflective surface and distinct submerged depth", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.tint.fill(8);
  for (let y = 80; y < 102; y++) for (let x = 80; x < 116; x++) {
    sim.grid[sim.idx(x, y)] = E.WATER;
  }
  const frame = image(sim.w, sim.h);
  sim.render(frame, 0, 0, true);
  const top = pixel(frame, 95, 80);
  const submerged = pixel(frame, 95, 81);
  assert.ok(top[1]! > submerged[1]!, "surface reflects more light than depth");
  assert.ok(top[2]! > submerged[2]!, "surface is brighter blue than submerged pixels");
  assert.equal(top[3], 255);
});

test("materials have distinct, stable textures with a working classic fallback", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.tint.fill(8);
  const materialLocations: Array<[number, number, number]> = [
    [74, 84, E.SAND], [80, 84, E.STONE], [86, 84, E.WOOD],
    [92, 84, E.PLANT], [98, 84, E.ICE], [104, 84, E.LAVA],
    [110, 84, E.FIRE], [116, 84, E.OIL],
  ];
  for (const [x, y, id] of materialLocations) sim.grid[sim.idx(x, y)] = id;
  const before = sim.snapshot();
  const rich = image(sim.w, sim.h);
  const classic = image(sim.w, sim.h);
  sim.render(rich, 0, 0, true);
  sim.render(classic, 0, 0, false);
  assert.notDeepEqual(rich.data, classic.data, "styles must visibly differ");
  for (const [x, y] of materialLocations) {
    const c = pixel(rich, x, y);
    assert.equal(c[3], 255);
    assert.ok(c.slice(0, 3).every((n) => n >= 0 && n <= 255));
  }
  assert.deepEqual(sim.snapshot(), before, "rendering never alters the physical world");
});

test("nearby fire illuminates adjacent empty cells without changing physics", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.tint.fill(8);
  const imageBefore = image(sim.w, sim.h);
  sim.render(imageBefore);
  sim.grid[sim.idx(96, 96)] = E.FIRE;
  const imageAfter = image(sim.w, sim.h);
  sim.render(imageAfter);
  assert.ok(pixel(imageAfter, 96, 95)[0]! > pixel(imageBefore, 96, 95)[0]! + 20);
  assert.equal(sim.grid[sim.idx(96, 95)], E.EMPTY, "firelight is purely visual");
});

test("camera pan preserves exact shading at the same world coordinate", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.tint.fill(8);
  for (let y = 82; y < 100; y++) for (let x = 90; x < 110; x++) {
    sim.grid[sim.idx(x, y)] = y < 90 ? E.WATER : E.SAND;
  }
  const full = image(sim.w, sim.h);
  const crop = image(32, 32);
  sim.render(full, 0, 0);
  sim.render(crop, 80, 80);
  for (const [x, y] of [[92, 84], [95, 94], [102, 89], [106, 96]]) {
    assert.deepEqual(pixel(crop, x - 80, y - 80), pixel(full, x, y));
  }
});

test("the original bowl mask stays transparent in rich and classic modes", () => {
  const sim = new PondSim();
  const rich = image(192, 192);
  const classic = image(192, 192);
  sim.render(rich);
  sim.render(classic, 0, 0, false);
  assert.equal(pixel(rich, 0, 0)[3], 0);
  assert.equal(pixel(classic, 0, 0)[3], 0);
  assert.equal(pixel(rich, 96, 96)[3], 255);
});
