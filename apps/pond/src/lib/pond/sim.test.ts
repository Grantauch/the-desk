import assert from 'node:assert/strict';
import test from 'node:test';
import { PondSim, SCENES, loadScene } from './sim.ts';
import { E } from './elements.ts';
import { decodeWorld, encodeWorld, MAX_SAVE_BYTES } from './save.ts';

test('saved worlds preserve every material, lifetime and tint', () => {
  const sim = new PondSim();
  loadScene(sim, 'garden');
  sim.paint(96, 60, E.LAVA, 4);
  const saved = sim.snapshot();
  const next = new PondSim();
  next.restore(decodeWorld(encodeWorld(sim), next));
  assert.deepEqual(next.snapshot(), saved);
});

test('bad save files cannot change the current world', () => {
  const sim = new PondSim();
  loadScene(sim, 'garden');
  const before = sim.snapshot();
  for (const text of ['{}', '{oops', 'x'.repeat(MAX_SAVE_BYTES + 1), JSON.stringify({ app:'pond', version:2, width:192, height:192, data:'' })]) {
    assert.throws(() => sim.restore(decodeWorld(text, sim)));
    assert.deepEqual(sim.snapshot(), before);
  }
  const unknown = sim.snapshot();
  unknown[sim.idx(96, 96)] = 200;
  assert.throws(() => sim.restore(unknown));
  assert.deepEqual(sim.snapshot(), before);
  assert.throws(() => sim.restore(new Uint8Array(10)));
});

test('undo restores the whole world after drawing and clearing', () => {
  const sim = new PondSim();
  loadScene(sim, 'garden');
  const before = sim.snapshot();
  sim.paint(90, 45, E.STONE, 7);
  const drawn = sim.snapshot();
  sim.clearInterior();
  assert.notDeepEqual(sim.snapshot(), drawn);
  sim.restore(drawn);
  assert.deepEqual(sim.snapshot(), drawn);
  sim.restore(before);
  assert.deepEqual(sim.snapshot(), before);
});

test('all starter scenes simulate without invalid cells or escaping the bowl', () => {
  for (const scene of SCENES) {
    const sim = new PondSim();
    loadScene(sim, scene.id);
    for (let i = 0; i < 150; i++) sim.step();
    assert.ok([...sim.grid].every((cell) => cell >= 0 && cell <= 20), scene.id);
    for (let i = 0; i < sim.grid.length; i++) if (sim.locked[i]) assert.equal(sim.grid[i], E.WALL, scene.id);
  }
});

test('pause keeps physics still while counts reflect edits', () => {
  const sim = new PondSim();
  sim.paused = true;
  sim.paint(96, 60, E.STONE, 1);
  const before = sim.snapshot();
  for (let i = 0; i < 20; i++) sim.step();
  assert.deepEqual(sim.snapshot(), before);
  assert.ok(sim.grainCount > 0);
});

test('heavy sand falls to the bottom while stone remains fixed', () => {
  const sim = new PondSim();
  const rock = sim.idx(96, 30);
  sim.setCell(rock, E.STONE);
  sim.setCell(sim.idx(90, 30), E.SAND);
  for (let i = 0; i < 160; i++) sim.step();
  assert.equal(sim.grid[rock], E.STONE);
  const sand = [...sim.grid].findIndex((cell) => cell === E.SAND);
  assert.ok(Math.floor(sand / sim.w) > 100);
});
