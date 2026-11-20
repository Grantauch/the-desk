import assert from "node:assert/strict";
import test from "node:test";
import { PondSim } from "./sim.ts";
import { E } from "./elements.ts";
import { blankAtlas, revealAtlas, isVisited, expandAtlas, exploredCount, encodeAtlas, decodeAtlas, classifyAtlas, atlasLandmarks, ATLAS_SIDE } from "./atlas.ts";
import { initialCamera, panCamera } from "./camera.ts";
import { decodePondAnySize, encodeWorld } from "./save.ts";

test("fog of war uncovers only the viewed region and remains stable when revisited", () => {
  const blank = blankAtlas(768);
  assert.equal(exploredCount(blank), 0);
  const cam = initialCamera(768);
  const viewed = revealAtlas(blank, cam);
  assert.ok(exploredCount(viewed) > 0 && exploredCount(viewed) < 32 * 32);
  assert.equal(isVisited(viewed, 0, 0), false);
  assert.equal(isVisited(viewed, 16, 16), true);
  assert.equal(revealAtlas(viewed, cam), viewed, "revisiting must not recreate state");
  const east = revealAtlas(viewed, panCamera(768, cam, 256, 0));
  assert.ok(exploredCount(east) > exploredCount(viewed));
  assert.equal(isVisited(east, 30, 16), true);
});

test("prior visits stay located over their world materials after expansion", () => {
  let atlas = revealAtlas(blankAtlas(192), initialCamera(192));
  assert.equal(exploredCount(atlas), ATLAS_SIDE * ATLAS_SIDE);
  for (const stage of [256, 320, 448, 576, 768]) {
    atlas = expandAtlas(atlas, stage);
    assert.equal(atlas.worldSize, stage);
    assert.equal(isVisited(atlas, 16, 16), true, "the center stays explored");
    if (stage >= 448) assert.equal(isVisited(atlas, 0, 0), false, "new territory begins hidden");
  }
  const image = decodeAtlas(encodeAtlas(atlas), 768);
  assert.deepEqual(image.bits, atlas.bits);
  assert.notEqual(expandAtlas(atlas, 768).bits, undefined);
});

test("fog data validates exact dimensions and rejects malformed or mismatched imports", () => {
  const state = revealAtlas(blankAtlas(448), initialCamera(448));
  const encoded = encodeAtlas(state);
  assert.deepEqual(decodeAtlas(encoded, 448).bits, state.bits);
  assert.throws(() => decodeAtlas(encoded, 320));
  assert.throws(() => decodeAtlas({ ...encoded, explored: encoded.explored.slice(1) }, 448));
  assert.throws(() => decodeAtlas({ ...encoded, version: 100 }, 448));
  assert.throws(() => decodeAtlas({ ...encoded, explored: "AA==" }, 448));
  assert.equal(isVisited(state, 33, 0), false);
  assert.equal(isVisited(state, -1, 0), false);
});

test("habitat sampling reflects actual playable materials and yields navigable places", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.resize(320);
  const atlas = revealAtlas(blankAtlas(320), initialCamera(320));
  const fill = (tx: number, ty: number, material: number) => {
    const x = Math.floor((tx + 0.5) * sim.w / ATLAS_SIDE);
    const y = Math.floor((ty + 0.5) * sim.h / ATLAS_SIDE);
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (sim.inDish(x + dx, y + dy)) sim.setCell(sim.idx(x + dx, y + dy), material);
    }
  };
  fill(14, 16, E.WATER);
  fill(18, 16, E.PLANT);
  fill(16, 14, E.LAVA);
  const biomes = classifyAtlas(sim, atlas);
  assert.equal(biomes[16 * ATLAS_SIDE + 14], "water");
  assert.equal(biomes[16 * ATLAS_SIDE + 18], "grove");
  assert.equal(biomes[14 * ATLAS_SIDE + 16], "fire");
  const landmarks = atlasLandmarks(sim, atlas, biomes, [
    { id: "Fish", x: 145, y: 165, vx: 0, vy: 0, energy: 100, age: 0, phase: 0 },
  ]);
  assert.ok(landmarks.some((landmark) => landmark.biome === "water"));
  assert.ok(landmarks.some((landmark) => landmark.biome === "grove"));
  assert.ok(landmarks.some((landmark) => landmark.biome === "fire"));
  for (const place of landmarks) assert.ok(sim.inDish(place.x, place.y));
});

test("exploration survives the same save pipeline as inhabitants, including legacy saves", () => {
  const sim = new PondSim();
  sim.clearInterior();
  sim.resize(448);
  const atlas = revealAtlas(blankAtlas(448), initialCamera(448));
  const save = encodeWorld(sim, [], atlas);
  const restored = decodePondAnySize(save);
  assert.equal(restored.size, 448);
  assert.ok(restored.atlas);
  assert.deepEqual(restored.atlas.bits, atlas.bits);
  assert.equal(restored.residents.length, 0);
  // Every previously exported V2 world without atlas is still valid.
  const legacyV2 = encodeWorld(sim);
  assert.equal(decodePondAnySize(legacyV2).atlas, null);
  // An invalid atlas cannot partially change the existing simulation.
  const before = sim.snapshot();
  const broken = JSON.parse(save);
  broken.atlas.explored = "not_base64";
  assert.throws(() => decodePondAnySize(JSON.stringify(broken)));
  assert.deepEqual(sim.snapshot(), before);
});
