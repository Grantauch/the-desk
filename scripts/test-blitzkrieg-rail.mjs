import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";

const files = [
  "util", "data", "content", "guns2", "game", "game2", "game3", "game4", "game5", "terrain", "scenery",
];
function load(withBonus) {
  const vm = createContext({});
  for (const name of withBonus ? [...files, "rail-maps"] : files) {
    runInContext(readFileSync(new URL(`../public/hubs/blitzkrieg/js/${name}.js`, import.meta.url), "utf8"), vm, { filename: `${name}.js` });
  }
  return vm.BK;
}
const baseline = load(false);
const BK = load(true);
const ids = Array.from(baseline.MAPS, (m) => m.id);
const index = (id) => BK.MAPS.findIndex((m) => m.id === id);
const make = (id, unlocks = {}) => new BK.Game({ map: index(id), seed: 42, weather: "clear", hero: false, save: { unlocks } });

test("new maps are appended without changing existing map IDs, indices or daily rotation", () => {
  assert.deepEqual(Array.from(BK.MAPS, (m) => m.id), [...ids, "signal-junction", "canal-loop"]);
  for (let day = 1; day <= 28; day++) {
    const date = new Date(2026, 10, day, 12);
    assert.equal(JSON.stringify(BK.dailyFor(date)), JSON.stringify(baseline.dailyFor(date)));
  }
  for (let i = 0; i < ids.length; i++) {
    const old = new baseline.Game({ map: i, seed: 42, weather: "clear", hero: false }).snapshot();
    assert.equal(BK.Game.fromSnapshot(old, {}).map.id, ids[i]);
  }
});

test("both bonus maps have traversable approaches and Canal Loop has two distinct bridges", () => {
  for (const id of ["signal-junction", "canal-loop"]) {
    const g = make(id);
    assert.equal(g.paths.length, 2);
    for (const lane of g.paths) {
      assert(lane.at(0)[0] < 0);
      assert(lane.at(lane.len)[0] > g.WW);
      assert(lane.len > g.WW);
    }
    assert(g.props.length > 0);
  }
  const canal = make("canal-loop");
  assert.equal(canal.bridges.length, 2);
  assert(Math.abs(canal.bridges[0].y - canal.bridges[1].y) > 100);
});

test("tracks block construction on Signal Junction without breaking legacy train gating", () => {
  const g = make("signal-junction");
  const p = g.layout.rail;
  const on = Array.from({ length: 30 }, (_, i) => p.at(p.len * (i + 1) / 31)).find(([x, y]) => g.canPlace(x, y, "mg") === "rail");
  assert(on);
  assert.equal(g.build("mg", ...on), null);
  assert.equal(g.buildFort("sandbag", ...on), null);
  assert.equal(g.abil.train.charge, BK.ABILITIES.train.charge);
  assert.equal(g.useAbility("train", 0, 0), false);
  assert.equal(make("wizna").abil.train, undefined);
  assert(make("wizna", { train: true }).abil.train);
  assert.equal(make("canal-loop", { train: true }).abil.train, undefined);
  assert.equal(g.save.unlocks.train, undefined);
});

test("charged rail patrol fires from its own cars, respects terrain/air, and snapshots its charge", () => {
  const g = make("signal-junction");
  assert(g.startWave());
  assert.equal(g.useAbility("train", 0, 0), true);
  assert.equal(g.abil.train.charge, 0);
  const train = g.trains[0];
  assert.equal(train.railTurrets.length, 3);
  const rail = g.layout.rail;
  train.d = rail.len * 0.56;
  const [x, y] = rail.at(train.d - 66);
  const e = g.spawn({ kind: "truck", path: 0 });
  const air = g.spawn({ kind: "stuka", path: "air" });
  Object.assign(e, { x, y: y + 24 });
  Object.assign(air, { x, y });
  const groundHP = e.hp, airHP = air.hp;
  g.updateExtra(0.4);
  assert(e.hp < groundHP);
  assert.equal(air.hp, airHP);
  assert(train.railTurrets.some((turret) => Number.isFinite(turret.angle)));
  assert(g.events.some((ev) => ev.type === "tracer"));
  assert.equal(g.strikes.length, 0);
  g.abil.train.charge = BK.ABILITIES.train.charge;
  assert.equal(g.useAbility("train", 0, 0), false);
  g.abil.train.charge = 19;
  g.waveCleared();
  assert.equal(g.trains.length, 0);
  const resumed = BK.Game.fromSnapshot(g.snapshot(), {});
  assert.equal(resumed.map.id, "signal-junction");
  assert.equal(resumed.abil.train.charge, 19);
  assert.equal(resumed.trains.length, 0);
});
