# Breakaway V4.8.6 — 2026-11-26 (LATEST)

**Status:** frozen latest **development** build, not production.

The canonical game is [index.html](index.html). Download and open locally to play offline. It includes all prior improvements: adaptive blockers (5→1 after TDs), grounded defenders, replay that freezes the football clock, in-field button mash, bounded screen shake, 2.5D field depth and action animation.

This revision fixes fast-flickering cleats by integrating stride phase from **actual world-space distance** and holding a foot planted briefly. The football rules and physics code are identical to V4.8.5.

### Source and rebuild

- [source/baseline-v4.8.5.html](source/baseline-v4.8.5.html) is the exact previous version.
- [source/apply_gait_fix.py](source/apply_gait_fix.py) applies the renderer-only patch.
- Run from this release directory:
  `python3 source/apply_gait_fix.py source/baseline-v4.8.5.html`
- That writes `source/BREAKAWAY_FOOTBALL_V4_8_6_WEIGHTED_FOOTFALLS_PLAYABLE.html`. Its bytes must match `index.html`.
- Run `node tests/verify-build.cjs` to check the pinned release.
- New edits should create a **new dated folder**, not modify this frozen snapshot.

### Checksums

`index.html`: SHA-256 `1487389dfbfbf13141541b032be7d8c0742de7ab58c76e12d0605afdca15fab1`, Git blob `6431a818be52258e8b2ba5e4e1853bd11ebd4a70`.

### Testing
See [QA_REPORT.md](QA_REPORT.md). Prior run: 100/100 full simulations, 12/12 action poses, 4 Chromium screen sizes, 2,000 renderer draws. Physical device testing remains outstanding.
