import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = fileURLToPath(new URL("./src/", import.meta.url));
const require = createRequire(resolve(process.env.BLITZKRIEG_TOOL_ROOT || root, "package.json"));
const { build } = require("esbuild");
const { outputFiles: [engine] } = await build({
  stdin: {
    contents: 'export * from "./game/game"; export * from "./game/data";',
    resolveDir: source,
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { Game, SCENARIOS, TOWERS, WAVES, COLS, ROWS, CELL, simulateAi } =
  await import("data:text/javascript;base64," + Buffer.from(engine.contents).toString("base64"));

function deploy(id = "frontier") {
  const game = new Game();
  game.audio.muted = true;
  game.chooseScenario(id);
  game.dismissBriefing();
  return game;
}

function runWave(game) {
  game.startWave();
  for (let step = 0; game.phase === "combat" && step < 12000; step++) game.tick(1 / 60);
  assert.notEqual(game.phase, "combat", "wave must finish");
}

for (const id of Object.keys(SCENARIOS)) {
  const game = deploy(id);
  assert.equal(game.scenarioId, id);
  const road = game.scenario.waypoints;
  for (const point of road) {
    assert.equal(game.canBuild(Math.floor(point.x / CELL), Math.floor(point.y / CELL)), false);
  }
  for (let i = 1; i < road.length; i++) {
    assert.equal(Math.abs(road[i].x - road[i - 1].x) + Math.abs(road[i].y - road[i - 1].y), CELL);
  }
  const result = simulateAi(id);
  assert.equal(result.win, true, `${id} must be winnable with mixed towers without crew mode`);
  console.log(`${id}: wave ${result.wave}/${WAVES.length}, ${result.lives} garrison, ${result.gold} zl`);
}
assert.equal(new Set(Object.values(SCENARIOS).map((s) => s.road.size)).size, 3);

const oneTower = deploy();
for (let wave = 0; wave < WAVES.length && oneTower.phase === "deploy"; wave++) {
  while (oneTower.gold >= TOWERS.aa.cost) {
    let best = null;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!oneTower.canBuild(c, r)) continue;
        const coverage = oneTower.scenario.waypoints.filter(({ x, y }) =>
          Math.hypot(x - (c + 0.5) * CELL, y - (r + 0.5) * CELL) <= TOWERS.aa.range).length;
        if (!best || coverage > best.coverage) best = { c, r, coverage };
      }
    }
    assert.ok(best && oneTower.tryPlace("aa", best.c, best.r));
  }
  runWave(oneTower);
}
assert.equal(oneTower.phase, "defeat", "original all-Bofors strategy must no longer win");
console.log(`Bofors-only: defeated on wave ${oneTower.waveIndex + 1}`);

const controller = deploy();
controller.arm("ckm");
controller.moveKeyboard(0, 0);
controller.selectKeyboard();
assert.equal(controller.towers.length, 1);
const id = controller.towers[0].id;
controller.arm("aa");
assert.equal(controller.armed, null, "unaffordable keyboard selection stays unarmed");
controller.crewAt({ x: controller.towers[0].x, y: controller.towers[0].y });
assert.equal(controller.mannedId, id);
controller.arm("ckm");
assert.equal(controller.mannedId, null, "arming clears crew mode");
controller.gold = 1000;
for (let rank = 0; rank < 3; rank++) assert.equal(controller.upgrade(id, "dmg"), true);
for (let rank = 0; rank < 2; rank++) assert.equal(controller.upgrade(id, "rate"), true);
assert.equal(controller.upgrade(id, "rate"), false, "exclusive capstone");
controller.man(id);
controller.setKeyFire(true);
controller.startWave();
for (let step = 0; step < 30; step++) controller.tick(1 / 60);
assert.ok(controller.shots.some(({ remaining }) => remaining !== undefined));
for (const shot of controller.shots) {
  assert.ok(Math.hypot(shot.x - shot.sx, shot.y - shot.sy) <= TOWERS.ckm.range + 1e-6);
}
controller.unman();
for (let step = 0; controller.phase === "combat" && step < 12000; step++) controller.tick(1 / 60);
assert.equal(controller.phase, "deploy");
for (let frame = 0; frame < 220; frame++) controller.frame(1 / 60);
assert.equal(controller.hint, "", "deployment tip expires between waves");

const memory = new Map([["blitzkrieg-save-v1", JSON.stringify({ v: 1, bestWave: 4, victories: 1 })]]);
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) },
});
const saved = new Game();
saved.hydrateSave();
assert.equal(saved.hud().bestWave, 4);
assert.equal(saved.hud().victories, 1);
saved.chooseScenario("orchard");
assert.equal(saved.hud().bestWave, 0);
delete globalThis.localStorage;
console.log("Placement, crew transition, capstone, range, deployment timer, and legacy saves passed.");
