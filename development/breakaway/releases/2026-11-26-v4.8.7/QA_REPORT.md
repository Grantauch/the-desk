# Breakaway V4.8.7 — Motion Blends QA

**Build date:** November 26, 2026  | **Status:** development candidate, not website production.

## Summary
This batch smooths upper-body rotation and arm pose transitions when players cut, juke, spin, stiff-arm, block, grapple and recover. It keeps the V4.8.6 distance-based footfall phase unchanged. Visual channels are tracked by athlete and possession, update at most once per rendered frame, and freeze when the simulation clock is paused or during replay. A grapple immediately assumes the brace pose, since the underlying clock is frozen.

## Integrity and regression
- Exact football engine bytes, from `const CONFIG=Object.freeze(` through `class FieldRenderer`, **match V4.8.6**.
- Playable HTML SHA-256: `81ed2080bbe91473c8c003f4a178fa4297e8bd057fd8459a7905739cfd4571ce`.
- V4.8.6 baseline SHA-256: `1487389dfbfbf13141541b032be7d8c0742de7ab58c76e12d0605afdca15fab1`.
- Node JavaScript parse: **PASS**.
- Full simulation: **500/500 completed**, **113,284 state assertions**, and **score reconciliation, legal clock, persistent knockdowns, capped bonuses**.
- 12 action-pose scenes and independent pose contract: **PASS**.
- 120 Hz footfall stability and zero-dt stop tests at four screen sizes: **PASS**.
- New joint-transition test: monotonic approach without snapping, idempotent repeated render, freeze with zero time, immediate grapple pose, reset on new possession: **PASS at 4 sizes**.
- Browser replays, touch, keyboard, controller emulation, inline tackle prompt and Reduced Effects: **PASS**.
- Four screen layouts, including phone and landscape, and **2,000 renderer soak draws**: **PASS**.

## Performance sampled in headless Chromium
Single-run draw benchmarks; CPU/RAF scheduling makes small differences noisy. Individual sample times per draw:

| Viewport | V4.8.6 | V4.8.7 |
| --- | ---: | ---: |
| 1440×900 | 1.94 ms | 1.30 ms |
| 390×844 | 1.26 ms | 1.47 ms |
| 320×568 | 1.18 ms | 1.29 ms |
| 844×390 | 1.05 ms | 0.81 ms |

These are **not** device-level frame-rate guarantees; further mobile performance/interaction testing remains necessary.

## Important limits
Real iPhone/Android touch, Safari/Firefox and Bluetooth controllers have **not** been certified by this session. Human review is required to judge the animation transitions at natural full-game speed. Do not conflate source-in-GitHub with publicly deployed gameplay.

## Reproduce
- `python3 source/apply_motion_blends.py source/baseline-v4.8.6.html` rebuilds the standalone HTML (script writes beside itself).
- `python3 tests/qa_transition_blends.py`, `python3 tests/qa_weighted_footfalls.py`, and the other supplied browser tests run with Playwright and Chromium.
- `node tests/qa_endurance.cjs 1 100` runs full-match simulation; use additional non-overlapping seed cohorts to reach 500.
- `sha256sum index.html` verifies the pinned release.
