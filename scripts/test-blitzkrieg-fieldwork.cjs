const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ctx = vm.createContext({console, Date, Math, UI: function () {}});
const dir = path.join(__dirname, "../public/hubs/blitzkrieg/js");
const load = (name) => vm.runInContext(fs.readFileSync(path.join(dir, name + ".js"), "utf8"), ctx, {filename: name});
for (const file of ["util", "data", "content", "guns2", "game", "game2", "game3", "game4", "game5", "terrain", "scenery"]) load(file);
ctx.BK.UI = ctx.UI;
const authoredStats = ctx.BK.Game.prototype.towerStats;
load("fieldwork");
const { BK } = ctx;
const fresh = () => new BK.Game({map: 0, seed: 220026, hero:false, weather:"clear", save:{unlocks:{}}});
const placement = (g, kind, fromX = 32, fromY = 32, ignore) => {
  for (let y = fromY; y < g.WH - 32; y += 11) for (let x = fromX; x < g.WW - 32; x += 11)
    if (!g.canPlace(x, y, kind, ignore)) return [x, y];
  throw new Error("no buildable ground");
};

{
  const g = fresh();
  assert.equal(g.refits, 0);
  g.freeUpgrade(); // a voucher survives even when there is no tower to target
  assert.equal(g.refits, 1);
  const t = g.build("mg", ...placement(g, "mg"));
  const [twin, pillbox] = g.upgradeOptions(t);
  assert.equal(twin.id, "twin");
  assert.equal(pillbox.id, "pillbox");
  assert.ok(BK.upgradeDeltas(g, t, twin).some((d) => d.good && d.label.endsWith("shots/s")));
  assert.ok(BK.upgradeDeltas(g, t, pillbox).some((d) => !d.good && d.label.endsWith("range")));
  assert.ok(BK.upgradeDeltas(g, t, pillbox).some((d) => d.good && d.label.endsWith("damage taken")));
  const before = g.towerStats(t).rate;
  assert.equal(before, authoredStats.call(g, t).rate, "stock guns keep their fire rate");
  g.money = 0;
  g.phase = "combat";
  assert.equal(g.upgrade(t, twin.id, true), false);
  assert.equal(g.refits, 1);
  g.phase = "deploy";
  assert.equal(g.upgrade(t, "not-a-branch", true), false);
  assert.equal(g.refits, 1);
  assert.equal(g.upgrade(t, twin.id, true), true);
  assert.equal(g.refits, 0);
  assert.equal(g.money, 0);
  assert.equal(t.rank, 1);
  assert.ok(g.towerStats(t).rate >= 2 * before);
  const upgraded = g.towerStats(t), authored = authoredStats.call(g, t);
  assert.ok(Math.abs(upgraded.dmg / authored.dmg - 1.06) < 1e-9);
  assert.ok(Math.abs(upgraded.rate / authored.rate - 1.03) < 1e-9);
  assert.equal(t.invest, BK.GUNS.mg.cost, "earned refit cannot be cashed out by selling");
  assert.equal(g.upgrade(t, g.upgradeOptions(t)[0].id, true), false);
  assert.equal(g.canPlace(t.x, t.y), "gun");
  assert.equal(g.canPlace(1, 1), "edge");
  assert.equal(g.relocationBlock(t, t.x + 50, t.y), "not mobile");
  assert.equal(BK.placementReason("water"), "Guns need dry ground.");
}

{
  const g = fresh();
  g.phase = "cards";
  g.takeCard(BK.CARD_BY_ID.fieldRefit);
  assert.equal(g.phase, "deploy");
  assert.equal(g.refits, 1);
  const snapshot = g.snapshot();
  assert.equal(snapshot.refits, 1);
  const oldSnapshot = {...snapshot};
  delete oldSnapshot.refits;
  assert.equal(BK.Game.fromSnapshot(oldSnapshot, {}).refits, 0);
  assert.equal(BK.Game.fromSnapshot(snapshot, {}).refits, 1);

  const charge = BK.ABILITIES.arty.charge;
  g.abil.arty.charge = charge * 2;
  assert.equal(BK.Game.fromSnapshot(g.snapshot(), {}).abil.arty.charge, charge * 2);
  g.phase = "combat";
  assert.equal(g.useAbility("arty", 40, 140), true);
  assert.equal(g.abil.arty.charge, charge);
  assert.equal(g.useAbility("arty", 40, 140), true);
  assert.equal(g.abil.arty.charge, 0);
  assert.equal(g.useAbility("arty", 40, 140), false);
  const start = BK.CRATE.find((x) => x.id === "charge");
  start.apply(g); start.apply(g); start.apply(g);
  assert.equal(g.abil.arty.charge, charge * BK.SUPPORT_RESERVE, "bank stays bounded");
  g.queue.push({t: 100, kind: "inf"});
  g.abil.arty.charge += 1000;
  g.update(1/60);
  assert.equal(g.abil.arty.charge, 2 * charge);
}

{
  const g = fresh();
  // Force the existing reel's free-upgrade prize; payoff must exist before the animation plays.
  const prize = BK.CRATE.find((x) => x.id === "upg");
  g.rng = () => (BK.CRATE.slice(0, BK.CRATE.indexOf(prize)).reduce((a, x) => a + x.w, 0) + 0.5) / BK.CRATE.reduce((a, x) => a + x.w, 0);
  const crate = {x: 100, y: 160};
  g.crates.push(crate);
  assert.equal(g.openCrate(crate), prize);
  assert.equal(g.refits, 1);
  assert.equal(g.openCrate(crate), null, "second click cannot credit the same prize");
  g.updatePending(2);
  assert.equal(g.refits, 1, "animation does not credit it a second time");
}
console.log("Blitzkrieg fieldwork checks passed");
