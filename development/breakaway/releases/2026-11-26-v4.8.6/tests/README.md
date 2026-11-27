# Breakaway V4.8.6 automated checks

From `development/breakaway/releases/2026-11-26-v4.8.6`:

```bash
node tests/verify-build.cjs
node tests/qa-endurance.cjs 1 100
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/qa_weighted_footfalls.py
```

- `verify-build.cjs` checks pinned SHA-256, JavaScript parse, distance-based gait markers, football engine unchanged from V4.8.5, no external script tag.
- `qa-endurance.cjs` runs simulated full games and asserts score reconciliation, legal clock, and permanent knockdowns. Use non-overlapping ranges (`1 100`, `101 200`) for larger cohorts.
- `qa_weighted_footfalls.py` renders on four Chromium viewport sizes and verifies 120Hz continuous phases, braking/idle freeze and no side effects on clock or score.

The recorded [QA report](../QA_REPORT.md) includes additional inherited contact, touch, controller, replay and 2,000-draw tests from the original development package. Those older tests are not all included in this GitHub folder; repeat them from the project test harness before production deployment.

These are development checks, not a substitute for hands-on playtesting on real devices.
