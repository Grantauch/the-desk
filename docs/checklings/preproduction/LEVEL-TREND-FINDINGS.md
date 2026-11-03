# Actual founder balance across all six progression milestones

**Status:** synthetic preproduction diagnostic, not a proposed patch to live combat, not an estimated human win rate, and not a completed balance certification. Uses the existing real Checkaverse battle engine and real four founder species, with `level-trends.mjs` and the frozen source report `level-trend-baseline.json`.

## Simulation scope

- All ten unordered founder matchups (including self matches) at **levels 1, 10, 15, 20, 30, and 50**.
- Nine behavior-policy combinations per match (pressure, conserve, defend independently selected for both players), **12 seeded trials in both trainer seats**.
- **60 groups × 9 tactics × 12 seeds × 2 seats = 12,960 synthetic battles**.
- Reported A win shares are the average of all nine policy combinations, counting draws as half; element type advantages are classified from the existing eight-type table.
- This experiment **does not implement evolution changes at levels 15, 20 or 30**. It tests the current founder species at those numerical levels only. The eventual evolution system may change these curves.

## Six-level overview

Rounded A win share by level, using the current unmodified battle rules:

| A versus B | Type relationship | Level 1 | 10 | 15 | 20 | 30 | 50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mochi vs Bolt | Meadow strong | 67% | 88% | 78% | 78% | 67% | 80% |
| Mochi vs Zee | Neutral | 65% | 56% | 44% | 31% | 25% | 11% |
| Mochi vs Ember | Meadow weak | 2% | 11% | 0% | 0% | 0% | 0% |
| Bolt vs Zee | Gear strong | 72% | 72% | 95% | 99% | 89% | 89% |
| Bolt vs Ember | Neutral | 12% | 7% | 11% | 7% | 1% | 6% |
| Zee vs Ember | Cosmic strong | 94% | 96% | 91% | 89% | 100% | 98% |

Self-match A win-share is approximately **50%** when averaged across opposing policies and mirrored seats, as expected from the lab's attribution guard. The same-species Mochi contests have the highest time-limit frequency: around **44%** at levels 1–30 and around 22% at level 50 under the sampled strategies. These are synthetic upper-tail pacing warnings, not classroom stopwatch evidence.

## What this implies for 300 creature lines

**1. Neutral relationships are not automatically fair.** Mochi versus Zee changes dramatically over the level curve even without an elemental edge. Bolt versus Ember is nearly one-sided across all six levels despite neutral typing. Move sequencing and stat growth are crucial to review.

**2. Strong type matchups can be very decisive.** The existing chart's 1.30 advantage and 0.75 disadvantage are meaningful. This result by itself is not a reason to soften the type system, because the game is intended to reward matching tactics. The design question is whether reasonable counterplay remains available to human trainers.

**3. Evolved forms need a separate contract.** The current simulator has no approved evolution stages to select, so a level 30 base founder is *not* evidence that its eventual level 30 evolution will be balanced. The roster needs form-by-form stats, signature decisions, art, move learnsets and care-morph effects before the lab can evaluate evolution.

**4. Match length matters in school.** A theoretical 40-turn × 30-second game could run long. A battle should be meaningful during short class visits without encouraging abandoning or forfeiting games; classroom acceptability is a real empirical gate.

**5. The lab should not automatically rebalance shipped starters.** Heuristic policies are not expert move selection, and there are no classroom PvP observations here. These extremes warrant adversarial simulations, human testing and design-lead review—not spontaneous stat nerfs.

## Proposed testing progression

1. Keep the frozen level/sampling output and compare against future code revisions.
2. Add player-strategy counterexamples and optimized move choices, rather than treating pressure/conserve/defend as complete.
3. Explicitly simulate the two-stage and morph forms once their content is approved; never substitute base-stat scaling for actual evolution.
4. Run care-state combinations, stamina exhaustion, damage/shield edge cases and catch/reward economy tests.
5. Evaluate raw matchup distributions and confidence **separately for neutral, advantageous and disadvantaged relationships**. Do not demand arbitrary universal 50% outcomes.
6. Validate early-joining versus veteran fairness via level gating, safe encounter design and class-specific weekly rankings, without undermining the school check-in XP economy.

**Decision:** Keep designing toward the 300-slot roster but **do not claim numerical balance for new concepts until actual approved stats and moves exist**.
