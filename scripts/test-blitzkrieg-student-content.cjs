const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const dir = path.resolve(__dirname, "../public/hubs/blitzkrieg/js");
const code = ["util", "data", "content", "guns2", "game", "game2", "game3", "game4", "game5"];
function load(withContent = true) {
  const scope = vm.createContext({ console });
  for (const f of [...code, ...(withContent ? ["student-content"] : []), "terrain", "scenery", "bot"]) {
    vm.runInContext(fs.readFileSync(path.join(dir, f + ".js"), "utf8"), scope, { filename: f + ".js" });
  }
  return [scope.BK, scope];
}
const [BK] = load();
const [oldBK] = load(false);
function game(opts) {
  return new BK.Game({ map: 0, hero: false, seed: 1337, weather: "clear", ...opts });
}
function build(g, kind, near) {
  g.money += 1000;
  let best, d = Infinity;
  for (let x = 28; x < g.WW - 28; x += 23) for (let y = 28; y < g.WH - 28; y += 23) {
    if (g.canPlace(x, y, kind)) continue;
    const score = near ? BK.dist2(x, y, near.x, near.y) : Math.abs(g.nearRoad(x, y) - 58) + Math.abs(x - g.WW / 2);
    if (score >= d) continue;
    best = [x, y]; d = score;
  }
  assert.ok(best, "there should be a legal site for " + kind);
  const t = g.build(kind, ...best);
  assert.ok(t, "should build " + kind);
  return t;
}
const upgrade = (g, t, id) => { g.gainXp(t, 60); assert.ok(g.upgrade(t, id), id); };
const wave = (g, n) => { g.wave = n - 1; assert.ok(g.startWave()); };

test("new optional support is buildable with distinct hotkeys and survives snapshots", () => {
  const g = game();
  const farm = build(g, "fieldpay"), post = build(g, "repairpost"), depot = build(g, "dispatch");
  assert.equal(new Set(BK.GUN_ORDER.map(k => BK.GUNS[k].key)).size, BK.GUN_ORDER.length);
  for (const t of [farm, post, depot]) assert.ok(!g.man(t));
  upgrade(g, farm, "fieldpay_market");
  upgrade(g, post, "repairpost_crew");
  upgrade(g, depot, "dispatch_air");
  const resumed = BK.Game.fromSnapshot(g.snapshot(), {});
  assert.equal(resumed.towers.length, 3);
  assert.equal(resumed.towerStats(resumed.towers[0]).farm, 32);
  assert.equal(resumed.towerStats(resumed.towers[1]).service, 9);
  assert.equal(resumed.towerStats(resumed.towers[2]).dispatchKind, "bomber");
});

test("farm income is bounded, excludes knocked-out and midwave farms, and is paid only once", () => {
  const g = game();
  const a = build(g, "fieldpay"), b = build(g, "fieldpay"), c = build(g, "fieldpay"), d = build(g, "fieldpay");
  upgrade(g, a, "fieldpay_market");
  upgrade(g, b, "fieldpay_market");
  d.ko = 10;
  wave(g, 1);
  const e = build(g, "fieldpay");
  assert.ok(c.builtWave < g.wave && e.builtWave === g.wave);
  g.waveCleared();
  assert.equal(g.stats.supply, 64);
  assert.equal(d.xp, 0);
  assert.equal(e.xp, 0);
  g.waveCleared();
  assert.equal(g.stats.supply, 64);
  const h = game();
  const down = build(h, "fieldpay"); down.ko = 5;
  wave(h, 2);
  build(h, "fieldpay");
  h.waveCleared();
  assert.equal(h.stats.supply || 0, 0);
});

test("repair heals during combat, takes strongest coverage once, and cannot heal itself", () => {
  const g = game();
  const gun = build(g, "mg");
  const post = build(g, "repairpost", gun);
  const other = build(g, "repairpost", gun);
  upgrade(g, other, "repairpost_crew");
  gun.hp -= 39;
  g.tickStudentRepair(1);
  assert.equal(gun.maxHp - gun.hp, 30);
  gun.ko = 12;
  g.tickStudentRepair(1);
  assert.equal(gun.ko, 5);
  other.ko = 9;
  post.hp -= 30;
  g.tickStudentRepair(12);
  assert.equal(post.maxHp - post.hp, 30);
  gun.ko = 0;
  g.tickStudentRepair(20);
  assert.equal(gun.hp, gun.maxHp);
});

test("scouts and foot patrols run the lane, credit damage, and cap six independent units", () => {
  const g = game(), d = build(g, "dispatch");
  upgrade(g, d, "dispatch_patrol");
  for (let i = 0; i < 6; i++) build(g, "dispatch");
  wave(g, 1);
  assert.equal(g.studentAllies.length, 6);
  assert.ok(g.studentAllies.some(x => x.kind === "scout"));
  assert.ok(g.studentAllies.some(x => x.kind === "patrol"));
  const u = g.studentAllies[0];
  const e = g.spawn({ kind: "ltank", path: u.path, lat: 0 });
  const [x,y] = g.paths[u.path].at(u.d - 105 * 0.65);
  Object.assign(e, { x, y });
  const start = u.d;
  g.tickStudentAllies(0.65);
  assert.ok(u.d < start);
  assert.ok(e.hp < e.maxHp && d.dmgDone > 0);
  g.waveCleared();
  assert.equal(g.studentAllies.length, 0);
});

test("bomber has a finite same-lane strike window and cannot hit the same enemy twice", () => {
  const g = game(), d = build(g, "dispatch");
  upgrade(g, d, "dispatch_air");
  wave(g, 1);
  assert.equal(g.studentAllies.length, 1);
  const u = g.studentAllies[0];
  assert.equal(u.kind, "bomber");
  const e = g.spawn({ kind: "ltank", path: u.path, lat: 0 });
  const air = g.spawn({ kind: "stuka", path: "air" });
  const [x,y] = g.paths[u.path].at(u.d - 210 * 0.6);
  Object.assign(e, { x, y });
  Object.assign(air, { x, y });
  g.tickStudentAllies(0.6);
  assert.ok(e.hp < e.maxHp);
  assert.equal(air.hp, air.maxHp);
  const damage = e.maxHp - e.hp;
  g.tickStudentAllies(0.25);
  assert.equal(e.maxHp - e.hp, damage);
  assert.equal(u.hits.size, 1);
  g.tickStudentAllies(23);
  assert.equal(g.studentAllies.length, 0);
});

test("mini-bosses only replace one enemy without inflating waves or overriding boss waves", () => {
  const set = new Map([[3, "class_vanguard"], [6, "class_bulwark"], [8, "class_skyguard"]]);
  for (const diff of BK.DIFF_ORDER) {
    for (const [n, kind] of set) {
      const a = game({ diff });
      const b = new oldBK.Game({ map: 0, hero: false, seed: 1337, weather: "clear", diff });
      wave(a, n); wave(b, n);
      assert.equal(a.queue.length, b.queue.length, diff + " wave length");
      assert.equal(a.queue.filter(e => e.kind === kind).length, 1);
      assert.equal(Object.keys(BK.STUDENT_BOSSES).filter(k => a.queue.some(e => e.kind === k)).length, 1);
      const mini = a.spawn(a.queue.find(e => e.kind === kind));
      assert.ok(mini.boss && Number.isFinite(mini.hp) && mini.hp > 0, kind);
    }
    for (const n of [1,5,10,15]) {
      const g = game({ diff }); wave(g, n);
      assert.ok(!g.queue.some(e => e.kind.startsWith("class_")));
    }
  }
  const daily = game({ daily: { mods: [] } }); wave(daily, 3);
  assert.ok(!daily.queue.some(e => e.kind.startsWith("class_")));
  const demo = game({ demo: true }); wave(demo, 3);
  assert.ok(!demo.queue.some(e => e.kind.startsWith("class_")));
});

test("native canvas art registers and draws support forms, minibosses and allied overlays", () => {
  const [sim, scope] = load();
  function createCanvas() {
    const noop = () => {};
    const c = new Proxy({
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
    }, { get: (o, k) => o[k] || noop });
    return { getContext: () => c, toDataURL: () => "data:image/png;fixture" };
  }
  scope.document = { createElement: createCanvas };
  for (const f of ["art", "art2", "art3", "render", "render2", "hero", "student-content-render"]) {
    vm.runInContext(fs.readFileSync(path.join(dir, f + ".js"), "utf8"), scope, { filename: f + ".js" });
  }
  for (const kind of ["fieldpay", "repairpost", "dispatch"]) {
    assert.match(sim.Art.gunIcon(kind, 48), /^data:image\/png/);
  }
  const g = new sim.Game({ map: 0, seed: 1337, weather: "clear", hero: false });
  const c = createCanvas().getContext();
  for (const kind of Object.keys(sim.STUDENT_BOSSES)) {
    assert.match(sim.Art.enemyIcon(kind, 48), /^data:image\/png/);
    const e = g.spawn({ kind, path: sim.ENEMIES[kind].air ? "air" : 0 });
    sim.Art.enemy(c, e);
    if (!e.air) {
      sim.Art.enemyFast(c, e, {});
      sim.Art.shadow(c, e, { x: 1, y: 1, a: 0.5 });
    }
    sim.Renderer.prototype.drawStatus.call({}, c, e);
  }
  g.studentAllies = ["scout", "patrol", "bomber"].map(kind => ({ kind, x: 40, y: 40, ang: 0, age: 1, flash: 0.1 }));
  sim.Renderer.prototype.drawOverlay.call({ g, viewRect: () => ({ x0: 0, x1: 80, y0: 0, y1: 80 }) }, c, {});
});
