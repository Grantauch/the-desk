# Breakaway V4.8.9 — QA report (in progress)

**Date:** 2026-11-27. **Candidate SHA-256:** `4ec136ffd0493c2efbfc0a28043b3e6fa1aa1876c5147369ddf425c888afa9df`.

## Completed
- Development source published on a dedicated review branch; immutable V4.8.8 preserved as base and rollback. A readable source recipe independently reconstructed the exact candidate bytes.
- GitHub source comparison confirmed the **exact same football engine bytes** across V4.8.7, V4.8.8, and V4.8.9. All V4.8.9 code changes are to camera, renderer, replay and user interface.
- **500/500 complete seeded games passed** using the identical V4.8.7 core materialized from the prior release artifact and run in Node. The original all-at-once run hit a time limit; four independent 125-seed batches then completed:
  - Seeds 1–125: 474,593 simulation frames; 18,853 state assertions.
  - Seeds 126–250: 475,259 simulation frames; 18,901 state assertions.
  - Seeds 251–375: 474,809 simulation frames; 18,889 state assertions.
  - Seeds 376–500: 477,566 simulation frames; 19,001 state assertions.
  - **Total: 1,902,227 simulation frames, 75,644 state assertions.**
- Assertions cover complete games, legal clock, finite ball-carrier positions, downed-defender permanence and scoring-ledger reconciliation.

## Required, not yet passed
- **The new V4.8.9 renderer has not yet been executed in a browser.** Local simulation evidence applies to the byte-identical football engine only.
- Run `node tests/verify-build.cjs` on the exact 4.8.9 checkout to verify Node parsing, SHA-256 manifest and build recipe.
- Run `python3 tests/qa-camera-browser.py` for all four Chromium layouts and 2,000 render draws. Replay skip, contact prompt, on-screen defender visibility, Reduced Effects and memory-bound checks remain pending.
- Real-speed visual footage, hands-on iPhone/Android, Safari/Firefox and physical controller remain pending.
- Independent review and source PR CI need confirmation before changing `LATEST.md`. Production release would require a **separate approved** rollout.

**Status: DRAFT CANDIDATE — NOT RELEASED.** Canonical `LATEST.md` remains V4.8.8 and no production files were touched.
