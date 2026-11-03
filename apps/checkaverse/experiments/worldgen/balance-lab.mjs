// Read-only balance experiment: calls the actual Checkaverse battle engine and live
// content, but never mutates production files, rewards, accounts or databases.
// Run: node apps/checkaverse/experiments/worldgen/balance-lab.mjs
// JSON reports are diagnostics, not proof that the entire future roster is balanced.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as B from "../../battle.mjs";
import { hashText } from "./prototype.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.resolve(HERE, "../../content/battle");
const CARE_FILE = path.resolve(HERE, "../../content/care.json");

export function loadCurrentContent() {
  const rules = B.loadRules(RULES_DIR);
  const care = JSON.parse(fs.readFileSync(CARE_FILE, "utf8"));
  return { rules, care };
}

function getLegal(rules, battle, side) {
  return rules.species.species[battle.sides[side].species].moves.filter(move => B.canUse(rules, battle, side, move));
}

export function selectMove(rules, battle, side, policy) {
  const legal = getLegal(rules, battle, side);
  const sp = rules.species.species[battle.sides[side].species];
  const signature = sp.moves.find(id => id !== "strike" && id !== "recover" && id !== "guard");
  const can = move => !!move && legal.includes(move);
  const f = battle.sides[side];
  // Policies observe public HP/stamina/turn but do not know the opponent's
  // hidden choice. No new move or battle mechanic is injected.
  if (policy === "pressure") {
    if (can(signature)) return signature;
    if (can("strike")) return "strike";
    return can("recover") ? "recover" : legal[0];
  }
  if (policy === "conserve") {
    if (f.stamina <= 3 && can("recover")) return "recover";
    if ((battle.turn % 4) === 2 && can("guard")) return "guard";
    if (can(signature) && f.stamina > 6) return signature;
    if (can("strike")) return "strike";
    return can("recover") ? "recover" : legal[0];
  }
  if (policy === "defend") {
    if (f.stamina < 3 && can("recover")) return "recover";
    if ((battle.turn % 3) === 0 && can("guard")) return "guard";
    if (can(signature) && (battle.turn % 3) === 2) return signature;
    if (can("strike")) return "strike";
    return can("recover") ? "recover" : legal[0];
  }
  throw new RangeError("Unknown policy: " + policy);
}

export function playOne(rules, attackerId, defenderId, level, seed, policy, conditionMods = {}, defenderPolicy = policy) {
  const b = B.createBattle(rules, [
    { name: "A", species: attackerId, level, mods: conditionMods[attackerId] },
    { name: "B", species: defenderId, level, mods: conditionMods[defenderId] }
  ], seed);
  while (!b.over) {
    const picks = [selectMove(rules, b, 0, policy), selectMove(rules, b, 1, defenderPolicy)];
    B.resolveTurn(rules, b, picks);
    if (b.turn > rules.settings.maxTurns) throw new Error("Battle exceeded maxTurns");
  }
  return { winner: b.winner, reason: b.reason, turns: b.turn };
}

function mean(values) {
  return values.reduce((total, n) => total + n, 0) / Math.max(values.length, 1);
}

export function auditRules(rules, options = {}) {
  B.checkRules(rules);
  const roster = options.roster || Object.keys(rules.species.species);
  const levels = options.levels || [10, 30];
  const policies = options.policies || ["pressure", "conserve", "defend"];
  const seeds = options.seeds || 24;
  if (!Number.isInteger(seeds) || seeds < 1 || seeds > 500) throw new RangeError("1..500 seeds only");
  const results = [];
  for (const level of levels) for (const policy of policies) {
    for (let i = 0; i < roster.length; i++) for (let j = i; j < roster.length; j++) {
      const a = roster[i], b = roster[j];
      const outcomes = [], turns = [], reasons = [];
      for (let k = 0; k < seeds; k++) {
        const seed = hashText("baseline-v1|" + a + "|" + b + "|" + level + "|" + policy + "|" + k);
        for (const [aSeat, [left, right]] of [[a, b], [b, a]].entries()) {
          const game = playOne(rules, left, right, level, seed, policy);
          // For self-matches left===a on both mirrored trials; use the seat index,
          // not a species comparison, or side-0 preference looks like a win-rate edge.
          const aWins = game.winner === "draw" ? 0.5 : game.winner === aSeat ? 1 : 0;
          outcomes.push(aWins);
          turns.push(game.turns);
          reasons.push(game.reason);
        }
      }
      results.push({
        species_a: a, species_b: b, level, policy,
        samples: outcomes.length,
        a_win_share: Number(mean(outcomes).toFixed(4)),
        avg_turns: Number(mean(turns).toFixed(2)),
        time_limit_rate: Number((reasons.filter(r => r === "time").length / reasons.length).toFixed(4))
      });
    }
  }
  return Object.freeze({
    lab_version: "battle-baseline-v1",
    live_rules: { type_multiplier_strong: rules.types.strong, type_multiplier_weak: rules.types.weak,
      turn_limit: rules.settings.maxTurns, timer_seconds: rules.settings.turnSeconds },
    sample_seeds_per_seat: seeds, levels, policies,
    roster, outcomes: results
  });
}

export function auditCareConditions(rules, care, options = {}) {
  const roster = options.roster || Object.keys(rules.species.species);
  const levels = options.levels || [10, 30];
  const names = options.conditions || ["obese", "scrawny", "exhausted", "grimy", "lazy", "overtrained", "out_of_shape"];
  const seeds = options.seeds || 24;
  const results = [];
  for (const species of roster) for (const condition of names) {
    const mods = care.conditions[condition]?.mods;
    if (!mods) throw new Error("Unknown care condition " + condition);
    const shares = [];
    for (const level of levels) for (let k = 0; k < seeds; k++) {
      const seed = hashText("care-v1|" + species + "|" + condition + "|" + level + "|" + k);
      // Compare against the same species with healthy modifiers; mirror the
      // condition side so initiative cannot create a seat advantage.
      for (const side of [0, 1]) {
        const b = B.createBattle(rules, [
          { name: "A", species, level, mods: side === 0 ? mods : {} },
          { name: "B", species, level, mods: side === 1 ? mods : {} }
        ], seed);
        while (!b.over) B.resolveTurn(rules, b, [
          selectMove(rules, b, 0, "conserve"), selectMove(rules, b, 1, "conserve")
        ]);
        const conditionWins = b.winner === "draw" ? 0.5 : b.winner === side ? 1 : 0;
        shares.push(conditionWins);
      }
    }
    results.push({
      species, condition, samples: shares.length,
      conditioned_win_share: Number(mean(shares).toFixed(4))
    });
  }
  return Object.freeze({ lab_version: "care-baseline-v1", levels, roster, outcomes: results });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { rules, care } = loadCurrentContent();
  const baseline = auditRules(rules);
  const conditionImpact = auditCareConditions(rules, care);
  process.stdout.write(JSON.stringify({ baseline, conditionImpact }, null, 2) + "\n");
}
