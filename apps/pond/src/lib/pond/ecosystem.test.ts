import assert from "node:assert/strict";
import test from "node:test";
import { PondSim } from "./sim.ts";
import { E } from "./elements.ts";
import { getOutcome, idFromFacets } from "./discovery.ts";
import {
  PondEcosystem, MAX_RESIDENTS, residentProfile, validateResidents,
} from "./ecosystem.ts";
import { decodePondFile, decodeWorld, encodeWorld } from "./save.ts";

function newPond() {
  const sim = new PondSim();
  sim.clearInterior();
  return sim;
}

test("procedural specimens derive reproducible locomotion and influences", () => {
  const aquatic = getOutcome("v:0");
  const classicPlant = getOutcome("Plant");
  const classicFish = getOutcome("Fish");
  const classicRobot = getOutcome("Robot");
  assert.ok(aquatic && classicPlant && classicFish && classicRobot);
  assert.deepEqual(residentProfile(aquatic), residentProfile(getOutcome("v:0")!));
  assert.equal(residentProfile(classicPlant).mode, "root");
  assert.equal(residentProfile(classicPlant).influence, "grow");
  assert.equal(residentProfile(classicFish).mode, "swim");
  assert.equal(residentProfile(classicRobot).mode, "mechanical");
  assert.ok(residentProfile(aquatic).size >= 2 && residentProfile(aquatic).size <= 4);
});

test("new inhabitants remain inside the bowl and are bounded", () => {
  const sim = newPond();
  const life = new PondEcosystem();
  assert.equal(life.add("Fish", 0, 0, sim), false);
  assert.equal(life.add("not real", 96, 96, sim), false);
  for (let n = 0; n < MAX_RESIDENTS; n++) {
    assert.equal(life.add("v:" + n.toString(36), 85 + (n % 16), 85 + Math.floor(n / 16), sim), true);
  }
  assert.equal(life.count, MAX_RESIDENTS);
  assert.equal(life.add("Plant", 96, 96, sim), false);
  for (let frame = 0; frame < 600; frame++) life.step(sim);
  assert.ok(life.count > 0 && life.count <= MAX_RESIDENTS);
  for (const item of life.snapshot()) {
    assert.ok(sim.inDish(Math.round(item.x), Math.round(item.y)));
    assert.ok(!sim.locked[sim.idx(Math.round(item.x), Math.round(item.y))]);
  }
  assert.equal(life.removeLast(), true);
  assert.equal(life.count <= MAX_RESIDENTS - 1, true);
  life.clear();
  assert.equal(life.count, 0);
});

test("crafted elements exert actual material effects rather than just changing appearance", () => {
  const sim = newPond();
  const hot = new PondEcosystem();
  for (let x = 80; x <= 112; x++)
    for (let y = 80; y <= 112; y++) sim.setCell(sim.idx(x, y), E.WATER);
  assert.ok(hot.add("Fire", 96, 96, sim));
  for (let i = 0; i < 250; i++) hot.step(sim);
  assert.ok([...sim.grid].some((cell) => cell === E.STEAM), "fire influence should turn nearby water to steam");

  sim.clearInterior();
  const cold = new PondEcosystem();
  for (let x = 80; x <= 112; x++)
    for (let y = 80; y <= 112; y++) sim.setCell(sim.idx(x, y), E.WATER);
  assert.ok(cold.add("Ice", 96, 96, sim));
  for (let i = 0; i < 250; i++) cold.step(sim);
  assert.ok([...sim.grid].some((cell) => cell === E.ICE), "frost influence should freeze nearby water");
});

test("existing V1 worlds load unchanged and V2 adds durable individual specimens", () => {
  const sim = newPond();
  const life = new PondEcosystem();
  sim.setCell(sim.idx(96, 96), E.PLANT);
  assert.ok(life.add("v:ab", 99, 96, sim));
  assert.ok(life.add("Plant", 93, 96, sim));
  for (let n = 0; n < 12; n++) life.step(sim);
  const before = sim.snapshot();
  const residents = life.snapshot();
  const file = encodeWorld(sim, residents);
  const anotherSim = newPond();
  const restored = decodePondFile(file, anotherSim);
  assert.deepEqual(restored.particles, before);
  assert.deepEqual(restored.residents, residents);
  const anotherLife = new PondEcosystem();
  anotherSim.restore(restored.particles);
  anotherLife.restore(restored.residents, anotherSim);
  assert.deepEqual(anotherLife.snapshot(), residents);

  // V1 did not carry residents, but still had the same particle encoding.
  const parsed = JSON.parse(file);
  const oldFile = JSON.stringify({
    app: "pond", version: 1, width: sim.w, height: sim.h, data: parsed.data,
  });
  const v1 = decodePondFile(oldFile, anotherSim);
  assert.deepEqual(v1.particles, before);
  assert.deepEqual(v1.residents, []);
  assert.deepEqual(decodeWorld(oldFile, anotherSim), before);
});

test("malformed V2 residents are rejected before the existing world is changed", () => {
  const sim = newPond();
  const untouched = sim.snapshot();
  const base = JSON.parse(encodeWorld(sim));
  const malformed = [
    [{ id: "fake", x: 96, y: 96, vx: 0, vy: 0, energy: 100, age: 0, phase: 0 }],
    [{ id: "Water", x: Number.NaN, y: 96, vx: 0, vy: 0, energy: 100, age: 0, phase: 0 }],
    Array.from({ length: MAX_RESIDENTS + 1 }, () => ({
      id: "Water", x: 96, y: 96, vx: 0, vy: 0, energy: 100, age: 0, phase: 0,
    })),
    "not an array",
  ];
  for (const residents of malformed) {
    assert.throws(() => decodePondFile(JSON.stringify({ ...base, residents }), sim));
    assert.deepEqual(sim.snapshot(), untouched);
  }
  assert.throws(() => validateResidents([{ id: "Water", x: 0, y: 0, vx: 0, vy: 0, energy: 100, age: 0, phase: 0 }], sim));
});

test("undo restores both physical pixels and living residents", () => {
  const sim = newPond();
  const life = new PondEcosystem();
  const world = sim.snapshot();
  const residents = life.snapshot();
  life.add("Fish", 96, 96, sim);
  sim.paint(98, 98, E.SAND, 3);
  assert.ok(life.count > 0);
  sim.restore(world);
  life.restore(residents, sim);
  assert.deepEqual(sim.snapshot(), world);
  assert.equal(life.count, 0);
});


test("living discoveries pollinate and create real seeds in nearby sand space", () => {
  const sim = newPond();
  const life = new PondEcosystem();
  assert.ok(life.add("Plant", 96, 96, sim));
  assert.ok(life.add("Butterfly", 98, 96, sim));
  for (let n = 0; n < 48; n++) life.step(sim);
  assert.ok(life.interactionCount > 0, "nearby species must interact");
  assert.match(life.lastInteraction ?? "", /pollinated/);
  assert.equal(sim.grid[sim.idx(99, 98)], E.SEED, "pollination leaves a seed in the pond");
  life.clear();
  assert.equal(life.interactionCount, 0);
  assert.equal(life.lastInteraction, null);
});

test("hunters and prey compete for energy, and swimmers school together", () => {
  const sim = newPond();
  const predator = idFromFacets({ form: 8, habitat: 0, force: 0, trait: 0 }); // Wolf
  const prey = idFromFacets({ form: 29, habitat: 0, force: 0, trait: 0 }); // Rabbit
  const life = new PondEcosystem();
  assert.ok(life.add(predator, 96, 96, sim));
  assert.ok(life.add(prey, 98, 96, sim));
  for (let n = 0; n < 24; n++) life.step(sim);
  assert.match(life.lastInteraction ?? "", /Wolf chased Rabbit/);
  assert.ok(life.snapshot().find((resident) => resident.id === prey)!.energy < 100);

  const swimmers = new PondEcosystem();
  assert.ok(swimmers.add("Fish", 96, 96, sim));
  assert.ok(swimmers.add("Fish", 98, 97, sim));
  for (let n = 0; n < 24; n++) swimmers.step(sim);
  assert.match(swimmers.lastInteraction ?? "", /schooled together/);
});

test("machines irrigate rooted neighbours without changing the particle schema", () => {
  const sim = newPond();
  const life = new PondEcosystem();
  assert.ok(life.add("Robot", 96, 96, sim));
  assert.ok(life.add("Plant", 98, 96, sim));
  for (let n = 0; n < 24; n++) life.step(sim);
  assert.match(life.lastInteraction ?? "", /irrigated/);
  assert.equal(sim.grid[sim.idx(96, 98)], E.WATER);
  assert.ok([...sim.grid].every((material) => material <= 20));
});


test("field silhouettes render all six locomotion modes without mutating residents", () => {
  const sim = newPond();
  const life = new PondEcosystem();
  // Classic and procedural identities cover all six existing locomotion modes.
  const modes = new Map<string, string>();
  for (const id of ["Fish", "Bird", "Plant", "Robot", "Animal", "Cloud", ...Array.from({ length: 40 }, (_, n) => idFromFacets({ form: n, habitat: 0, force: 0, trait: 0 }))]) {
    const outcome = getOutcome(id);
    if (!outcome) continue;
    const mode = residentProfile(outcome).mode;
    if (!modes.has(mode)) modes.set(mode, id);
  }
  assert.deepEqual([...modes.keys()].sort(), ["drift", "fly", "mechanical", "root", "swim", "walk"]);
  let x = 75;
  for (const id of modes.values()) assert.ok(life.add(id, x += 6, 96, sim));
  const before = life.snapshot();
  const rectangles: Array<[number, number, number, number]> = [];
  const context = {
    canvas: { width: 192, height: 192 },
    imageSmoothingEnabled: true,
    fillStyle: "",
    save() {},
    restore() {},
    fillRect(px: number, py: number, width: number, height: number) {
      assert.ok(width > 0 && height > 0, "silhouette strokes must be positive");
      rectangles.push([px, py, width, height]);
    },
  } as unknown as CanvasRenderingContext2D;
  life.render(context);
  assert.ok(rectangles.length > 30, "each mode should draw multiple details");
  assert.deepEqual(life.snapshot(), before, "drawing cannot advance or change ecology");
});

test("small floating silhouettes keep positive strokes through their flutter cycle", () => {
  const sim = newPond();
  // Find a real procedural drifting inhabitant with the smallest (2px) body.
  const id = Array.from({ length: 120 }, (_, n) => idFromFacets({
    form: Math.floor(n / 3), habitat: 0, force: 0, trait: n % 3,
  })).find((candidate) => {
    const outcome = getOutcome(candidate);
    if (!outcome) return false;
    const profile = residentProfile(outcome);
    return profile.mode === "drift" && profile.size === 2;
  });
  assert.ok(id, "procedural discoveries include a 2px drifter");

  const life = new PondEcosystem();
  assert.ok(life.add(id, 96, 96, sim));
  let strokes = 0;
  const context = {
    canvas: { width: 192, height: 192 },
    imageSmoothingEnabled: false,
    fillStyle: "",
    save() {},
    restore() {},
    fillRect(_x: number, _y: number, width: number, height: number) {
      assert.ok(width > 0 && height > 0, "every animated stroke has positive dimensions");
      strokes++;
    },
  } as unknown as CanvasRenderingContext2D;
  // Prove that the suite visits the exact -2 flutter that once made a 0px stroke.
  let sawMinimumFlutter = false;
  for (let frame = 0; frame < 72; frame++) {
    const resident = life.snapshot()[0]!;
    if (Math.round(Math.sin((resident.age + resident.phase) * .21) * 2) === -2) sawMinimumFlutter = true;
    strokes = 0;
    life.render(context);
    assert.ok(strokes >= 3, "the floating inhabitant remains visible");
    life.step(sim);
  }
  assert.ok(sawMinimumFlutter, "regression must exercise the zero-height flutter case");
});
