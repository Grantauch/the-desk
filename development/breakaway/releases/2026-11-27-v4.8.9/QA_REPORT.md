# Breakaway V4.8.9 — QA report (in progress)

**Date:** 2026-11-27. **Candidate SHA-256:** `d8bcdbdc51b851af90f47388d5d815a846c7052f58fc38ae0cbd44163b287996`.

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

## Current candidate browser and package evidence
- Node source reconstruction, manifest checksum, syntax, offline packaging and exact football engine parity passed.
- The actual HTML passed Chromium emulation at 1440×900, 390×844, 320×568 and 844×390, including 2,000 draws, isolated and bounded replay buffers, clock freeze, early/middle/late skips, focus return, Reduced Effects and the contact prompt.
- Tackle and touchdown replay were exercised at synthetic 30, 60, 90 and 120 fps and with uneven frame intervals in Chromium. Playback interpolation matched captured time; the duration cap trims older poses rather than speeding up the remaining clip. An emulated controller also passed skip and focus tests.

- Nov 28 accessibility follow-up: on the unchanged earlier draft, Tab moved from the visible Skip button to the covered Pause control during a natural tackle replay. The new regression catches that failure.
- On the revised candidate, natural tackle replays at 1280×800, 844×390, and 390×844 keep forward and reverse Tab on visible Skip while the HUD is inert. Escape, natural completion and browser-emulated touch Skip each restore field focus and HUD controls. The Pause dialog still wraps in both directions.
- Short-landscape replay controls leave the center of the field clear; portrait and desktop retain the centered layout. The exact revised candidate also passed the complete four-layout renderer and cadence suites. This is Chromium evidence, not physical-device or screen-reader certification.

## Required, not yet passed
- Real-speed visual footage, hands-on iPhone/Android, Safari/Firefox and physical controller remain pending.
- Independent review and source PR CI need confirmation before changing `LATEST.md`. Production release would require a **separate approved** rollout.

**Status: DRAFT CANDIDATE — NOT RELEASED.** Canonical `LATEST.md` remains V4.8.8 and no production files were touched.
