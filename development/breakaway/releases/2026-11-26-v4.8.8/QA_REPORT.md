# Breakaway V4.8.8 Grounded Motion — QA (2026-11-26)

**Automated passing development candidate, not live.** SHA-256: `1f9bcc89d94f96b1265ff0678272c9c33e354564f09c20e29b96bdf6cea2a9a9`.

- 500/500 full games; **1,895,815 frames, 113,284 state assertions**. Football engine byte-identical to V4.8.7.
- Four layouts: 1440×900, 390×844, 320×568, 844×390. 120Hz gait/idle continuity, airborne freeze/landing phase and cache reuse/resize checks all pass.
- 12/12 action poses; joint blend invariant; replay clock/score freeze and skip; localized tackle E/A/TAP keyboard/touch/controller tests all pass.
- 2,000/2,000 renderer draws without browser JavaScript errors.
- Gradient creation per draw: **V4.8.7 37/55/47/29 → V4.8.8 7/7/7/7** across those screen sizes.

**Headless performance caveat:** Draw-timing samples are noisy and must not be represented as guaranteed FPS gains. In a longer multi-round subset, desktop 1.155→1.078ms (-6.6%), portrait 390px 1.380→1.291ms (-6.5%), narrow 320px 1.111→1.150ms (+3.6%); landscape long-run timed out. Hardware-accelerated real iPhone/Android, 120Hz game-speed motion, Safari/Firefox and physical Bluetooth controller remain untested acceptance gates.

No game rules, physics, score ledger, blocker count progression, defender permanence, replay simulation or external assets altered. Motion is a visual stance cue, not a fully simulated inverse-kinematics solution. This GitHub source upload is not permission to overwrite public game routes.
