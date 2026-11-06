// Run: node --test apps/checkaverse/experiments/worldgen/prototype.test.mjs
// Zero network, school data, production imports or side effects.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHUNK_SIZE, GENERATOR_VERSION, REGION_THEMES,
  createRegionSpec, tileAt, generateChunk, verifyLandmarkSpine
} from "./prototype.mjs";

test("twelve unique regional themes and exact existing eight-type membership", () => {
  const regions = Object.entries(REGION_THEMES);
  assert.equal(regions.length, 12);
  const typeCounts = {};
  for (const [region, values] of regions) {
    assert.match(region, /^[a-z]+(?:_[a-z]+)*$/);
    assert.equal(values.length, 3);
    assert.notEqual(values[1], values[2]);
    typeCounts[values[1]] = (typeCounts[values[1]] ?? 0) + 1;
    typeCounts[values[2]] = (typeCounts[values[2]] ?? 0) + 1;
  }
  assert.deepEqual(Object.keys(typeCounts).sort(), [
    "cosmic", "ember", "gear", "meadow", "shade", "stone", "storm", "tide"
  ]);
  for (const count of Object.values(typeCounts)) assert.equal(count, 3);
});

test("seed, generator revision and coordinates produce repeatable chunks", () => {
  const specA = createRegionSpec("verdant_crown", "permanent-class-seed", 256);
  const specB = createRegionSpec("verdant_crown", "permanent-class-seed", 256);
  assert.equal(specA.version, GENERATOR_VERSION);
  const first = generateChunk(specA, 3, 4);
  generateChunk(specA, 1, 2);
  generateChunk(specA, 7, 6);
  const last = generateChunk(specB, 3, 4);
  assert.deepEqual(first, last);
  assert.equal(first.rows.length, CHUNK_SIZE);
  for (const row of first.rows) assert.equal(row.length, CHUNK_SIZE);
  assert.match(first.hash, /^[a-f0-9]{8}$/);
});

test("changing permanent seed changes wilderness beyond the fixed crossroads", () => {
  const one = createRegionSpec("bramblefen_basin", "original", 256);
  const two = createRegionSpec("bramblefen_basin", "different", 256);
  let differences = 0;
  for (let y = 17; y < 200; y += 11) {
    for (let x = 15; x < 220; x += 13) {
      if (tileAt(one, x, y) !== tileAt(two, x, y)) differences++;
    }
  }
  assert.ok(differences > 20, "Different seeds must change meaningful terrain");
});

test("chunk samples use global coordinates at all seams", () => {
  const spec = createRegionSpec("frostglass_reach", "ice-seed", 256);
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const chunk = generateChunk(spec, cx, cy);
      for (const dy of [0, 5, 16, 31]) {
        for (const dx of [0, 7, 23, 31]) {
          assert.equal(chunk.rows[dy][dx], tileAt(spec, cx * 32 + dx, cy * 32 + dy));
        }
      }
    }
  }
});

test("all twelve 256-square biomes retain a traversable fixed landmark network", () => {
  for (const regionId of Object.keys(REGION_THEMES)) {
    const spec = createRegionSpec(regionId, "school-pilot", 256);
    const checked = verifyLandmarkSpine(spec);
    assert.equal(checked.passed, true, regionId);
    assert.equal(checked.expected, 5);
    assert.equal(checked.reached.length, 5);
    for (const landmark of spec.landmarks) assert.equal(tileAt(spec, landmark.x, landmark.y), "L");
  }
});

test("512-square target generates stable edge chunks and traversable routes", () => {
  for (const regionId of ["verdant_crown", "frostglass_reach", "hollowdeep"]) {
    const spec = createRegionSpec(regionId, "larger-preview", 512);
    assert.equal(spec.size / CHUNK_SIZE, 16);
    assert.deepEqual(generateChunk(spec, 15, 15), generateChunk(spec, 15, 15));
    assert.equal(verifyLandmarkSpine(spec).passed, true);
  }
});

test("coordinates, dimensions and unknown regions fail closed", () => {
  assert.throws(() => createRegionSpec("unknown", "seed", 256), RangeError);
  assert.throws(() => createRegionSpec("verdant_crown", "", 256), TypeError);
  assert.throws(() => createRegionSpec("verdant_crown", "seed", 250), RangeError);
  const spec = createRegionSpec("verdant_crown", "seed", 256);
  for (const xy of [[-1, 0], [0, -1], [256, 0], [0, 256], [1.2, 3]]) {
    assert.throws(() => tileAt(spec, xy[0], xy[1]), RangeError);
  }
  for (const xy of [[-1, 0], [0, -1], [8, 0], [0, 8], [1.5, 2]]) {
    assert.throws(() => generateChunk(spec, xy[0], xy[1]), RangeError);
  }
});
