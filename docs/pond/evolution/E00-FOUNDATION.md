# Pond Evolution E00 — simulation contracts

**Status:** Draft foundation only. There are no changes to PondCanvas, PondSim,
PondEcosystem, brush tools, visuals, discoveries, or world/save formats.

## What is included

- `EvolutionRandom`: seeded xorshift32 and versioned checkpoint; deterministic
  only for evolutionary events. Existing material physics uses Math.random and
  is **not** promised to replay identically.
- `EvolutionClock`: separate logical biological day and supported target rates
  1×, 4×, 16×, 64×. The clock has a bounded pending-work queue and reports
  saturation when it cannot keep up. E01 must commit ecology callbacks before
  publishing completed days, and must bound biological work by frame budget.
- `validatePopulation`: bounded metadata for cohort keys, founder IDs,
  lineage IDs and habitat tiles. Does not produce offspring or consume food.
- `evolution-contract.test.ts`: root-level test entrypoint, ensuring E00's
  nested tests run in the existing `npm --prefix apps/pond test` and
  site `pond:test` workflows.

## Hard invariants for E01–E05

1. **Placed materials must continue to fall or flow normally.** The biology
   speed setting must never scale calls to `PondSim.step`; retain its normal
   45Hz physical scheduler and existing pause behavior.
2. A requested 64× biological rate is a target, not a throughput promise.
   Saturated work is reported, never falsely presented as completed days.
3. The environmental model must distinguish visible 80 residents from
   represented population cohorts; camera movement must not invent generations.
4. Maintain V1/V2 save compatibility and atomic import; use a separately
   reviewed evolution save extension before any new data is written.
5. Preserve the C01 → C02 → C03 → C04 release gates and protected review checks.

## Review and tests

- Isolated checks: 5 Node test cases and strict TypeScript passed in a local
  source-package sandbox before integration.
- In repository: `npm --prefix apps/pond test` and `npm --prefix apps/pond
  run build`, plus full protected site CI. The new file is auto-discovered by
  the existing test glob via the root-level entrypoint.
- Pending: browser tests, mobile/Chromebook profiling, E01 scheduler wiring,
  and actual 1×/4×/16×/64× physics interaction checks.

**Dependencies:** Pond C03 #517 and C04 #530 must be reviewed and released
before this stacked foundation reaches production. The gravity gate is
PR #569; broader evolution design is RFC #537.
