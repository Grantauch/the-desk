# Breakaway — AI Collaboration Handoff

**Current development version:** V4.8.6 (2026-11-26), [canonical pointer](LATEST.md). This directory is intentionally outside `public/` so updates do not silently change the running public game.

## Recent progress
- V4.1: turf and depth; V4.2: readable defensive intent; V4.3: running/input; V4.4: tackle counters.
- V4.5: defensive and blocker intelligence; V4.6: score ledger/possession flow; V4.7: five-to-one adaptive blockers and grounded defenders.
- V4.8: clock-frozen instant replay plus near-miss button mash.
- V4.8.1: replaced disorienting modal mash with in-field flashing E/A/TAP prompt above contact.
- V4.8.2: bounded impact shake, dust/particles, Reduced Effects.
- V4.8.3: 2.5D shadows and lighting.
- V4.8.4–V4.8.5: articulated running, action and contact poses.
- **V4.8.6:** fixed feet flickering using distance-integrated gait and brief grounded stance.

## Latest technical change
Previously, gait phase depended on `elapsedTime × currentSpeed` and jumped abruptly as speed changed. The renderer now maintains independent per-athlete gait tracks based on actual distance traveled. This is render-only; engine between `const CONFIG=Object.freeze(` and `class FieldRenderer{` is byte-identical to V4.8.5.

## Next best work
1. Visual review of footfall cadence at normal game speed. Inspect real phones and real controllers, especially 120 Hz devices.
2. Optimize athlete animation/shadow rendering for mid-range mobile devices without breaking the planted-foot feel.
3. Smooth action-state transitions (run→cut→spin/stiff→contact→fall) with short pose blends; keep collision mechanics unchanged unless explicitly authorized.
4. Add more expressive, grounded body language—not flickering tiny feet, jerky limb rotation or excessive screen shake.

## Required verification
Use `node tests/verify-build.cjs` for immutable-source checks. Open `index.html` in a real browser. QA snapshots previously passed four Chromium viewports (1440×900, 390×844, 320×568, 844×390); real devices and Safari/Firefox are not yet certified. Historical results are in the dated [QA report](releases/2026-11-26-v4.8.6/QA_REPORT.md).

## Publishing
Changes to this GitHub development folder are not the production game. Only publish to either website after a separate reviewed release and live verification. Keep prior version intact for immediate rollback.
