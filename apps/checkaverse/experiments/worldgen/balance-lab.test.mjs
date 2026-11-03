// Stand-alone, read-only real-engine balance lab tests.
// Run with Node 22+: node --test apps/checkaverse/experiments/worldgen/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as B from "../../battle.mjs";
import { loadCurrentContent, selectMove, playOne, auditRules, auditCareConditions, auditCrossPolicies } from "./balance-lab.mjs";

const { rules, care } = loadCurrentContent();

test("founder baseline loads real, schema-checked combat and care content", () => {
  assert.doesNotThrow(() => B.checkRules(rules));
  assert.equal(Object.keys(rules.species.species).length, 4);
  assert.equal(Object.keys(rules.types.types).length, 8);
  assert.equal(rules.settings.maxTurns, 40);
  assert.equal(care.conditions.obese.mods.stamina, 0.6);
});

test("all simulated policies choose only currently legal moves", () => {
  for (const species of Object.keys(rules.species.species)) {
    const b = B.createBattle(rules, [
      { name: "A", species, level: 10 }, { name: "B", species: "ember", level: 10 }
    ], 42);
    for (const policy of ["pressure", "conserve", "defend"]) {
      for (const stamina of [0, 1, 2, 3, 5, 9]) {
        b.sides[0].stamina = Math.min(stamina, b.sides[0].maxStamina);
        for (let turn = 0; turn < 6; turn++) {
          b.turn = turn;
          const choice = selectMove(rules, b, 0, policy);
          assert.equal(B.canUse(rules, b, 0, choice), true, species + "/" + policy + "/" + stamina);
        }
      }
    }
  }
});

test("repeated seeded battles yield the exact same outcome without side effects", () => {
  for (const a of ["mochi", "bolt", "zee", "ember"]) {
    for (const b of ["mochi", "bolt", "zee", "ember"]) {
      const one = playOne(rules, a, b, 10, 7231, "conserve");
      const two = playOne(rules, a, b, 10, 7231, "conserve");
      assert.deepEqual(one, two);
      assert.ok(one.turns >= 1 && one.turns <= rules.settings.maxTurns);
    }
  }
});

test("the founder matrix samples both trainer seats for every pair and strategy", () => {
  const report = auditRules(rules, { levels: [10], seeds: 3 });
  assert.equal(report.outcomes.length, 30); // 10 unordered pairs × 3 policies
  for (const row of report.outcomes) {
    assert.equal(row.samples, 6);
    assert.ok(row.a_win_share >= 0 && row.a_win_share <= 1);
    assert.ok(row.avg_turns >= 1 && row.avg_turns <= 40);
    assert.ok(row.time_limit_rate >= 0 && row.time_limit_rate <= 1);
  }
  const again = auditRules(rules, { levels: [10], seeds: 3 });
  assert.deepEqual(report, again);
});

test("condition tests use the actual authored modifiers and are repeatable", () => {
  const options = {
    roster: ["mochi", "ember"], levels: [10], seeds: 3,
    conditions: ["obese", "scrawny", "grimy"]
  };
  const a = auditCareConditions(rules, care, options);
  const b = auditCareConditions(rules, care, options);
  assert.deepEqual(a, b);
  assert.equal(a.outcomes.length, 6);
  for (const row of a.outcomes) {
    assert.equal(row.samples, 6);
    assert.ok(row.conditioned_win_share >= 0 && row.conditioned_win_share <= 1);
  }
});


test("self-species comparisons are always seat-neutral after mirroring", () => {
  const report = auditRules(rules, { levels: [10, 30], policies: ["pressure", "conserve", "defend"], seeds: 7 });
  const selfRows = report.outcomes.filter(x => x.species_a === x.species_b);
  assert.equal(selfRows.length, 24);
  for (const x of selfRows) assert.equal(x.a_win_share, 0.5, x.species_a + "/" + x.policy);
});

test("cross-policy lab mirrors seats and remains deterministic", () => {
  const options = { roster: ["mochi", "ember"], levels: [10], policies: ["pressure", "defend"], seeds: 5 };
  const a = auditCrossPolicies(rules, options);
  const b = auditCrossPolicies(rules, options);
  assert.deepEqual(a, b);
  assert.equal(a.outcomes.length, 12); // 3 unordered matchups x 2 x 2 policy pairs
  for (const row of a.outcomes) {
    assert.equal(row.samples, 10);
    assert.ok(row.a_win_share >= 0 && row.a_win_share <= 1);
    assert.ok(row.mean_turns >= 1 && row.mean_turns <= 40);
    assert.ok(row.limit_rate >= 0 && row.limit_rate <= 1);
  }
  assert.throws(() => auditCrossPolicies(rules, { seeds: 0 }), RangeError);
});

test("bad policy and impossible sampling arguments fail closed", () => {
  const battle = B.createBattle(rules, [
    { name: "A", species: "mochi", level: 10 },
    { name: "B", species: "bolt", level: 10 }
  ], 1);
  assert.throws(() => selectMove(rules, battle, 0, "cheat"), RangeError);
  assert.throws(() => auditRules(rules, { seeds: 501 }), RangeError);
});
