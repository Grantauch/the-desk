# Cross-policy battle balance: first simulation findings

**Synthetic, read-only benchmark; not player match data or evidence for shipping 300 species.** Generated from `apps/checkaverse/experiments/worldgen/balance-lab.mjs --cross` against the actual current four-starter battle rules and care system. The full 180-row report is `cross-policy-baseline.json`.

## Bug fixed before this report

The original same-species matchup attribution compared a fighter's species string with the named A species. When both fighters had the same species, this incorrectly credited the wrong trainer seat in the second mirrored battle. The simulation now tracks **which physical seat is the A sample**. It also has a regression test requiring the same-policy self-match share to be exactly 50% after complementary seat mirroring.

**Do not use the older pre-fix `baseline-battles.json` numbers.** That file was regenerated from the corrected code on this branch; its lab-source commit and synthetic-only label are included.

## What was simulated

- All **10 unordered pairs** of currently playable founder species, including same-species contests.
- Two levels: 10 and 30.
- **Nine policy combinations** per pair/level: each side separately uses one of pressure (signature-heavy), conserve (guard and stamina care) or defend (frequent guarding).
- **Eight repeatable random seeds** per policy pair; each seed is tested in both swapped player seats.
- **180 rows × 16 mirrored trials = 2,880 battles**. Draws count 0.5. The preexisting 60-row same-policy report adds 2,880 battles under a different seed scheme. Care-state tests add 1,344 same-species synthetic battles.

These policy controls are simple legal-move heuristics. They do **not** provide opponent-specific strategic optimization, PvP latency or actual human behavior.

## Aggregate directional results

A win share averaged equally across two levels and the nine behavior-pair combinations. Percentages are sample descriptions, **not expected classroom win probabilities**.

| A vs B | A win share | What to investigate |
| --- | ---: | --- |
| Mochi vs Bolt | 77.1% | Meadow beats Gear; type advantage seems significant |
| Mochi vs Zee | 41.0% | Neutral matchup swings sharply by level and opponent guard policy |
| Mochi vs Ember | 5.6% | Strong Ember type edge may overwhelm common simple policies |
| Bolt vs Zee | 81.3% | Gear beats Cosmic; type edge appears large |
| Bolt vs Ember | 4.9% | **Neutral typing**, but Bolt loses almost all tested policy matchups |
| Zee vs Ember | 98.6% | Cosmic beats Ember; near-total result suggests poor counterplay under tested strategies |

Average across policy combinations for each self-species pair is about 50%, but a particular asymmetric policy contest may have 0% or 100% win share; that is not a bug by itself. Playing defensively against an aggressive opponent can legitimately differ from mirror-policy results.

### Critical sensitivity examples

- **Bolt vs Ember (neutral).** At level 10, Bolt wins 75% under defend-vs-defend but 0% under most other tested policy pairs. At level 30, Bolt wins only 12.5% in defend-vs-pressure and otherwise 0%. This points to move timing, defensive pressure, stamina management or stat scaling—not type chart imbalance.
- **Mochi vs Zee (neutral).** At level 10, pressure-vs-pressure is a 100% Mochi win under these seeds, but pressure-vs-defend is 0%. At level 30 most combinations favor Zee; defend-vs-pressure and defend-vs-conserve swing to 100% Mochi, illustrating counterplay.
- **Zee vs Ember (Cosmic favorable).** Zee wins at least 87.5% of all 18 distinct level/policy combinations sampled. The advantage is consistent here but does not alone justify weakening the type matchup.
- **Mochi vs Mochi.** In the corrected same-policy baseline, many contests reach the 40-turn cap; assess battle pace, not just winner.

## Actionable rules before authoring 288 new species

1. **Check neutral pairs independently from type-advantaged pairs.** Neutral lopsidedness is more concerning because elemental rules don't explain it.
2. **Require at least three viable policies** in the simulated testing menu before declaring a line competitive; no creature should exist only as a raw stat target.
3. **Study level scaling**, because the same pairing can reverse between levels 10 and 30. Evolution milestones at 15/20/30 will add nonlinear changes.
4. **Track P95 turns and actual classroom clock time** in later tests. A 40-turn, 30-second-per-turn match could theoretically occupy much longer than a 3–5 minute daily visit.
5. **Expand to human adversarial playtesting** with mixed strategies and both seating positions before changing published stats. Do not rebalance live founders from this toy policy suite.
6. **Use the lab as a regression tool** against already-released species with each new wave of twelve, with hundreds of results inspected rather than treating the 300-line spreadsheet as already balanced.
7. **Never weaken health consequences** to solve matchups. Care-body outcomes are intentionally meaningful; analyze the long-term cost of repeated risk choices separately from a single duel.

This report is a **design warning and next-test roadmap**, not authorization to change any of the current game rules.
