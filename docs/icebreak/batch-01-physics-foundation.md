# ICEBREAK — Batch 01: Physics Foundation

Status: implemented on `icebreak/batch-01-physics-foundation`. A stacked PR targets the First Shift beta release branch until that beta reaches `main`.

## Verified defects before the repair

The added `tests/icebreak/foundation.cjs` reproduced six failing cases on the baseline:
1. A high-velocity shot passed through a goalie without triggering contact.
2. An angled puck scored when its endpoint was inside the mouth even though it crossed the goal line outside the posts.
3. A fast puck passed through an otherwise eligible skater.
4. Two players pinned against the boards remained 0.80 world units apart despite a 1.08-unit contact separation.
5. Fixed render-frame integration could not be independently tested.
6. Long stalls had no isolated, testable frame catch-up contract.

## Changes

- **Swept puck contact:** the puck segment from last to new position is tested against goalies and catch-eligible skaters. The earliest valid event wins; hard shots cannot tunnel past a player just because the endpoint has moved beyond them. The existing post-shot recatch lock and goalie deflection remain.
- **Accurate scoring:** compute the intersection with the actual goal plane and test its lateral coordinate inside the opening, for both scoring directions. Shots crossing outside the mouth are not awarded goals.
- **Contact resolution:** extend mass-weighted penetration correction to at most twelve sweeps, with early exit when no overlaps remain. Positions are still clamped to the rink at each sweep. The existing hit/energy model remains unchanged.
- **Stable clock:** isolate the 90 Hz fixed-step accumulator. A maximum nine physics steps and 100 ms of simulated catch-up per render frame avoid an unbounded spiral after tab stalls. Track the first animation-frame timestamp explicitly and reset any leftover accumulator on match restart.
- **Regression gate:** add `npm run icebreak:test` to the full protected release verification lane; expose `npm run icebreak:browser` for explicit browser acceptance. The shipped page does not contain the scenario fixture.

## Tests and evidence

- `npm run icebreak:test`: **26/26 passed** (17 original and nine new foundation/stress tests).
- `npm run icebreak:browser`: desktop 1440×900 and emulated phone 390×844 with WebGL and Canvas fallback, **4/4 passed** with no page exceptions. Checks include scoring, modes, rinks, eight unique local seats, checks, timeout, and camera/audio controls.
- `npm run build`: succeeded; `npm run site:validate`: **199 pages, 6,437 local references**, sealed StoryHub assets passed.
- Six deterministic 24-second matches, 12,960 simulation ticks across both modes and three rinks, had finite player/puck state, legal player bounds and identical seeded outcomes between arenas. One local VM run took about 1.5 seconds. This is a regression metric, not device FPS.
- Frame-cadence tests reproduced identical deterministic positions after 90 ticks at 30, 60 and 120 simulated display FPS.

## Still outside this batch

No new animation, skating tuning, online play or rules changes. Moving skaters/goalies are sampled at their post-update positions for the puck sweep; fully continuous moving-body collision detection and richer post interactions are future work. Real-phone touch/gamepad/hardware-GPU trials, long multiplayer balance and complete real-world performance profiling remain necessary before claiming a finished game.

## Release requirements

Do not bypass protected checks. Confirm PR merge, Netlify production deployment and live URLs separately before marking ICEBREAK live. Update Team Desk and preserve the later 9-batch roadmap.
