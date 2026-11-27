# Breakaway V4.8.9 — Camera & Replay Director (candidate)

**Dated:** 2026-11-27. **Source-only draft:** not the current LATEST; not merged; not published to either game site.

### Player-visible work
- A constrained, gradually eased camera lead follows the runner and nearby active contact without moving the HUD, zooming, or changing hitboxes.
- Replay poses blend between **copied** actor states. Bounded playback: at most 60 frames from a 92-snapshot rolling history. The live football simulation and clock never advance inside replay.
- Tackle and touchdown highlights use separate restrained timing and commentary. Reduced Effects stays on a non-shaking still frame.
- Skip clears buffers and returns keyboard focus to a live target. The small E/A/TAP grapple cue remains anchored to live contact.

### Rebuild / QA
- `node source/rebuild.cjs /tmp/v4.8.9.html` reconstructs the exact HTML from the frozen V4.8.8 source and readable `changes.json` patch.
- `node tests/verify-build.cjs` verifies reproducibility, both SHA-256 digests, inline JS syntax and exact core-engine identity.
- `node tests/qa-endurance.cjs 1 500` is the full required game simulation test (not yet completed on this candidate).
- `python3 tests/qa-camera-browser.py` exercises four Chromium viewports, replay clock, skip, camera, still-frame and render drawing (not yet completed).
- QA and physical phone gates are tracked honestly in [QA_REPORT.md](QA_REPORT.md).

**Rollback:** [frozen V4.8.8](../2026-11-26-v4.8.8/). No `public/` files are touched.
