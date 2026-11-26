# Breakaway — AI editing handoff

**Current latest:** [V4.8.7 (2026-11-26)](LATEST.md).

**Next-phase authority:** [V4.8.8 through V5.0.0 roadmap](ROADMAP_TO_V5_0_0.md). Read it before selecting a new task or assigning scope. It defines per-version ship gates and what not to change.

V4.8.7 continues the previous improvements: 5→1 progressive blockers, permanent defender knockdowns, end-zone pursuit on stalling, defensive blocking intelligence, 2.5D art, action-specific animation, frozen-clock recorded-state replay, a tiny E/A/TAP prompt above near-miss tackles, optional reduced effects and bounded impact shake.

## Specific latest change

V4.8.6 fixed rapid flickering feet by integrating footfall phase from actual travel. **Do not revert to elapsed-time × speed gait.**

V4.8.7 keeps that gait untouched and eases upper-body lean, sway, crouch and torso twist plus arm/elbow/hand positions between run, juke, spin, stiff-arm, block, grapple and recovery poses. Visual transition state is renderer-owned and reset per possession. It never affects collision hitboxes, scoring, player velocity, physics or the football clock. A tackle struggle snaps into its brace pose immediately because the live clock is frozen.

## Work next

- Human game-speed visual acceptance (especially iPhone/Android 120Hz).
- Low-end mobile renderer profiling and performance optimization.
- Refine blocker/fall animations without flickering feet or distracting camera jumps.
- Future changes should be incremental, separately reviewed and reproducible.

## Tests and releases

[Latest QA report](releases/2026-11-26-v4.8.7/QA_REPORT.md) records 500/500 full simulated games, 113,284 state assertions, 12 poses, four viewports, 120Hz gait and transition checks, input/replay and 2,000 render draws. Real device and Firefox/Safari testing remains outstanding.

Never silently edit or deploy `public/hubs/breakaway/`. This source folder is solely for AI collaboration; public deployment is a distinct task.
