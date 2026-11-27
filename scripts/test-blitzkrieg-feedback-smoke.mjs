import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/hubs/blitzkrieg/", import.meta.url));
const html = fs.readFileSync(dir + "index.html", "utf8");
const scriptPaths = Array.from(html.matchAll(/<script\b[^>]*\bsrc="(js\/[^"?]+)(?:\?[^"]*)?"/g), (match) => match[1]);
assert.equal(new Set(scriptPaths).size, scriptPaths.length, "duplicate game scripts");
const code = new Map(scriptPaths.map((p) => [p, new vm.Script(fs.readFileSync(dir + p, "utf8"), { filename: p })]));
for (const p of ["util", "data", "content", "guns2", "game", "game2", "game3", "game4", "game5", "bot", "main"]) {
  assert.ok(code.has("js/" + p + ".js"), "missing core script " + p);
}

const ctx = vm.createContext({ console });
for (const [p, script] of code) {
  if (/^js\/(?:util|data|content|guns2|game\d*|terrain|scenery|bot|student-content|rail-maps)\.js$/.test(p)) {
    script.runInContext(ctx);
  } else if (p === "js/fieldwork.js") {
    // This decorator installs DOM callbacks but does not call them during simulation.
    ctx.BK.UI = function TestUI() {};
    script.runInContext(ctx);
  }
}
const { BK } = ctx;
assert.ok(BK.MAPS.length >= 10);
for (const ext of ["rail-maps", "fieldwork", "student-content", "student-content-render"]) {
  assert.ok(code.has("js/" + ext + ".js"), "missing feedback script " + ext);
}
assert.ok(BK.MAPS.some((m) => m.id === "signal-junction"));
assert.ok(BK.MAPS.some((m) => m.id === "canal-loop"));
for (const kind of ["fieldpay", "repairpost", "dispatch"]) assert.ok(BK.GUNS[kind]);
assert.equal(Object.keys(BK.STUDENT_BOSSES).length, 3);
assert.equal(BK.SUPPORT_RESERVE, 2);
assert.equal(new Set(BK.MAPS.map((m) => m.id)).size, BK.MAPS.length, "duplicate map id");
function sanity(game) {
  finite(game.money, "money");
  finite(game.garrison, "garrison");
  assert.ok(game.enemies.length < 750, "enemy cap smoke invariant");
  assert.ok(game.projectiles.length < 1500, "projectile cap smoke invariant");
  for (const e of game.enemies) {
    finite(e.x, "enemy x");
    finite(e.y, "enemy y");
    finite(e.hp, "enemy HP");
  }
}
function finite(n, p) {
  assert.ok(Number.isFinite(n), p + " must be finite");
}

// Use the real HTML order so registration and prototype decorators are tested
// together, not only when each feature file is evaluated alone.
for (let i = 0; i < BK.MAPS.length; i++) {
  const game = new BK.Game({ map: i, diff: "regular", weather: "clear", seed: 5020 + i, save: { unlocks: {} } });
  game.refits = 1;
  assert.equal(game.map.id, BK.MAPS[i].id);
  game.money += 1000;
  const bot = new BK.Bot(game, { crew: true });
  let combats = 0;
  let checked = -1;
  for (let step = 0; step < 3000; step++) {
    if (game.result) break;
    if (game.phase === "deploy" && game.wave > checked) {
      checked = game.wave;
      const historic = JSON.parse(JSON.stringify(game.snapshot()));
      assert.equal(historic.mapId, game.map.id);
      const back = BK.Game.fromSnapshot(historic, {});
      assert.equal(back.map.id, game.map.id);
      assert.equal(back.wave, game.wave);
      assert.equal(back.money, Math.round(game.money));
      assert.equal(back.refits, game.refits);
      sanity(back);
    }
    bot.update(0.05);
    game.update(0.05);
    if (game.phase === "combat") combats++;
    if (step % 100 === 0) sanity(game);
  }
  assert.ok(combats > 30, game.map.id + ": expected a playable battle");
  assert.ok(game.wave >= 1, game.map.id + ": wave never started");
  console.log("PASS", game.map.id, "wave", game.wave);
}
