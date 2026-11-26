# Breakaway V4.8.8 — Grounded Athlete Motion

**November 26, 2026. Latest development candidate, not production.**

- [index.html](index.html) — self-contained playable HTML.
- [source/baseline-v4.8.7.html](source/baseline-v4.8.7.html) — unchanged rollback.
- [source/renderer.patch](source/renderer.patch) — exact renderer-only V4.8.7→4.8.8 unified diff.
- Run `python3 source/rebuild.py` to regenerate from baseline (requires `patch`) and validate the exact SHA-256.
- Run `node tests/verify-build.cjs`, `node tests/qa-endurance.cjs 1 100`, and `python3 tests/qa-motion-browser.py` for main regression checks.

**Changes:** airborne footstep-phase freeze; no surprise shoe catch-up on landing; small stance/heel adjustments and contact shadow; per-kind cached uniform/helmet gradients with resize cleanup. **Football physics unchanged.**

**QA:** 500/500 simulations, 1,895,815 frames, 113,284 checks, 12 poses, four viewports, 2,000 renderer draws; gradient allocations 29–55→7 per draw. Wall time results are mixed and device performance unverified. See [QA_REPORT.md](QA_REPORT.md).

**SHA-256** `1f9bcc89d94f96b1265ff0678272c9c33e354564f09c20e29b96bdf6cea2a9a9`.
