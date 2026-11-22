# ICEBREAK — Batch 08: collision feel meets give-and-go hockey

## Branch relationship

This integration branch is based on `icebreak/batch-07-give-and-go` (PR #494), itself stacked on earlier ICEBREAK physics, goals, one-timer and goalkeeper work. It selectively ports the collision-presentation implementation from sibling draft PR #492. It does **not** merge, close, or alter either original PR. The final reviewer must choose a **single integration path** to avoid applying the same collision features twice; no direct release or independent merge from this draft is authorized.

## Unified changes

- Contact feedback uses the pre-existing reduced-mass, closing-speed, brace, alignment and balance calculations. Both attacker and recipient have bounded, impulse-aligned, visual-only recoil; glancing, solid, heavy and injury-level hits get tiered effects and audio in WebGL and Canvas. Rendering does not modify a single world position or velocity.
- Heavy injury victims remain visibly down during the frozen, skippable five-second injury timeout. Faceoffs reset visual-only impact fields.
- Reduce-motion preference suppresses the new expanding impact rings and lowers the recoil pose amplitude; game rules are unchanged.
- **Integration fix: an active give-and-go is canceled when a solid check strips its receiver**, including pending return-pass intent. A heavy hit to the cutter likewise cancels the cutter's run. A glancing bump that retains possession does not erase a valid play.
- Starting a checking attempt cancels the skater's own active cut. An incompatible player state must not continue displaying a give-and-go tactical opportunity.
- The pass selector no longer aims at skaters who are stunned, knocked down, currently checking or still in check recovery. It can choose an upright teammate instead, or retain possession if everyone is unavailable. A previous pass test was updated to explicitly unstun its eligible receivers, because the test fixture deliberately stuns other players to isolate scenarios.

## Regression evidence

- The inherited source checks include skating feel, collision energy, puck tunneling, rebound response, goal and replay logic, one-timers, goalie anticipation, passing-lane tactics and give-and-go flows.
- Ported five source tests from PR #492 for collision reaction tiers, counter-recoil, decay, injury downtime, and render-side physics purity.
- Added six integrated source tests covering possession interruption, runner knockdown, harmless glancing contact, tactical symmetry across School/Park/Mars and both modes, abandoning runs when checking, and excluding disabled receivers.
- **66 / 66 source test functions passed**, executed against the exact candidate game script in a controlled JavaScript harness with mocked DOM and Canvas interfaces (not a native Node or Chromium run). The seeded long-play foundation scenarios also passed.
- Browser screenshots and hardware timings have **not** been verified for this head.

## Remaining release gates

1. Review the stacked PR sequence and upstream head alignment. Resolve whether PR #492 should be superseded by the integration PR. Do not merge collision changes twice.
2. Run native `npm run icebreak:test`, applicable browser suites and full-site build/verification on the exact integration head with protected CI.
3. Review WebGL/Canvas desktop/mobile screenshots: all hit tiers, overlapping pass/impact rings, injured skater during frozen timeout, reduced-motion mode, and camera follow during goal replay.
4. Use two real players and physical controllers to test pass, check, one-timer and goal timing. Record frequency of loose-puck checks, knockdowns, and injury stoppages, and tune for fun without spam or overfrequent stoppages.
5. Keep the beta release gated; this work is **draft, unmerged, unpublished**.

The Blender skater-animation task is a distinct asset integration effort. It must map to these physical states instead of overwriting them.
