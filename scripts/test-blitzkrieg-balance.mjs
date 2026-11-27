// Fast deterministic simulation and draw-path checks for the classroom balance pass.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ctx = vm.createContext({});
for (const file of ["util", "data", "content", "guns2", "art", "art2", "art3", "game", "game2", "game3", "game4", "game5"]) {
  vm.runInContext(readFileSync(new URL(`../public/hubs/blitzkrieg/js/${file}.js`, import.meta.url), "utf8"), ctx, { filename: file + ".js" });
}
const { BK } = ctx;
const build = (diff = "regular") => new BK.Game({ seed: 641, diff, weather: "clear", hero: false });
const add = (g, id) => {
  const a = g.spawn({ kind: id, path: BK.ENEMIES[id].air ? "air" : 0 });
  Object.assign(a, { x: 400, y: 280, ang: Math.PI / 6 });
  return a;
};
const localToWorld = (e, lx, ly) => [e.x + lx * Math.cos(e.ang) - ly * Math.sin(e.ang), e.y + lx * Math.sin(e.ang) + ly * Math.cos(e.ang)];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("regular and aircraft HP drop while named ground bosses and difficulty scaling remain intact", () => {
  const g = build();
  assert.equal(g.startWave(), true);
  const originalMax = {
    inf: 32, officer: 70, moto: 48, truck: 150, armcar: 130, ltank: 270,
    smoke: 300, htrack: 210, mtank: 680, stuka: 120, recon: 95, leader: 950,
    pioneer: 75, sniper: 50,
  };
  for (const [id, oldHp] of Object.entries(originalMax)) {
    const enemy = add(g, id);
    assert.ok(enemy.hp < oldHp * g.hpScale() * (enemy.boss ? 0.75 : 1), id);
    assert.equal(enemy.hp, enemy.maxHp, id);
  }
  for (const [id, oldHp] of [["command", 1100], ["nbfz", 3600]]) {
    close(add(g, id).hp, oldHp * g.hpScale() * 0.75);
  }

  const recruit = build("recruit"), hard = build("iron");
  recruit.startWave(); hard.startWave();
  close(add(hard, "inf").hp / add(recruit, "inf").hp, 1.6 / 0.7);
  const wave1Inf = g.hpScale() * BK.ENEMIES.inf.hp;
  g.wave = 7;
  assert.ok(add(g, "inf").hp > wave1Inf);
});

test("snipers still temporarily suppress towers, but hit softer and pin less", () => {
  for (const [covered, pin] of [[false, 1.6], [true, 0.9]]) {
    const g = build();
    g.startWave();
    const a = add(g, "sniper");
    Object.assign(a, { mode: "snipe", hx: a.x, hy: a.y, stayT: 30, fireT: 0 });
    const tower = { id: 99, x: a.x + 15, y: a.y, ko: 0, supT: 0 };
    g.nearestTower = () => tower;
    g.coverOf = () => covered ? { sandbags: true } : {};
    const hits = [];
    g.damageTower = (t, amount, kind) => hits.push([t.id, amount, kind]);
    assert.equal(g.updateSpecialist(a, 0.05), true);
    assert.deepEqual(hits, [[99, 3, "mg"]]);
    close(tower.supT, pin);
    assert.ok(a.revealT > 0);
    assert.ok(a.fireT > 2);
    g.updateSpecialist(a, 0.05);
    assert.equal(hits.length, 1, "does not repeat immediately");
  }
});

test("bike and three aircraft have reachable synthetic weak zones at arbitrary orientations", () => {
  for (const [id, n] of [["moto", 1], ["stuka", 2], ["recon", 2], ["leader", 2]]) {
    const g = build();
    g.startWave();
    const a = add(g, id);
    const marks = a.def.weak.filter((w) => w.effect === "softspot");
    assert.equal(marks.length, n, id);
    for (const w of marks) {
      const point = localToWorld(a, (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2);
      const h = g.hitTest(a, ...point, 0);
      assert.equal(h?.part, "weak", id);
      assert.equal(h.w.id, w.id, id);
      const loss = g.damage(a, 4, { pen: 1, hit: h, manned: true });
      close(loss, 4 * w.mult);
      assert.equal(g.events.at(-1).label, "WEAK SPOT");
      if (id === "moto") close(a.slowT, 2);
    }
    assert.equal(g.hitTest(a, ...localToWorld(a, 0, 0), 0).part, "body");
  }
});

test("crewed point shot carries a target marker through enemy rotation while in flight", () => {
  const g = build();
  g.startWave();
  const a = add(g, "stuka");
  const w = a.def.weak.find((w) => w.effect === "softspot");
  const mark = localToWorld(a, (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2);
  const tower = { kind: "aa", x: a.x - 80, y: a.y, ang: 0, manned: true, waveDmg: 0, dmgDone: 0, rank: 0, xp: 0, waveKills: 0, kills: 0 };
  const stats = { shot: "flak", speed: 1000, pen: 1, air: 1, ground: 0, dmg: 10, shells: 1 };
  const before = a.hp;
  g.fire(tower, stats, null, ...mark);
  assert.equal(g.projectiles.length, 1);
  assert.equal(g.projectiles[0].lock, a.id);
  a.ang = Math.PI / 2;
  a.x += 20;
  g.updateProjectiles(0.25);
  close(before - a.hp, 10 * w.mult);
  assert.deepEqual(g.events.filter((e) => e.type === "hit").map((e) => e.crit).join(","), "true");
});

test("crew view draws one marker for each synthetic target at its authored hitbox center", () => {
  for (const id of ["moto", "stuka", "recon", "leader"]) {
    const expected = BK.ENEMIES[id].weak.filter((w) => w.effect === "softspot").map((w) => [
      (w.x0 + w.x1) / (2 * BK.US),
      (w.y0 + w.y1) / (2 * BK.US),
    ]);
    const fills = [];
    let outline = [];
    const c = new Proxy({
      beginPath() { outline = []; },
      moveTo(x, y) { outline.push([x, y]); },
      lineTo(x, y) { outline.push([x, y]); },
      fill() {
        if (c.fillStyle !== "#ffe38a") return;
        fills.push([outline.reduce((x, p) => x + p[0], 0) / 4, outline.reduce((y, p) => y + p[1], 0) / 4]);
      },
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
    }, { get: (target, prop) => prop in target ? target[prop] : () => {} });
    const e = { kind: id, alt: 0.5, t: 1, seed: 1, dist: 10 };
    BK.Art.enemy(c, e, {});
    assert.equal(fills.length, 0, id);
    BK.Art.enemy(c, e, { weak: true, pulse: 0.6 });
    assert.equal(fills.length, expected.length, id);
    fills.forEach(([x, y], i) => { close(x, expected[i][0]); close(y, expected[i][1]); });
  }
});
