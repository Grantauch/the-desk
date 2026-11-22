# ICEBREAK Batch 05 — first touch, better edges, and puck satisfaction

## Intent
Respond to the 2/4-star critical review by improving player agency and visible action, not by adding arenas or cosmetics. This batch builds directly on #482 (Batch 04) and preserves physics hardening from Batches 01–03.

## Changes
- Faster **low-speed facing response** using `SKATE.quickTurnBoost=.55` while speed is below 3.4 world units/sec. At higher speeds momentum and edge-carving limits are unchanged.
- **One-timers**: after a teammate passes toward an intended receiver, holding SHOOT shortly before arrival buffers a one-time attempt for 0.48 sec. A press within 0.30 sec after receiving a clean pass also shoots immediately. This works through the existing keyboard/touch/gamepad input abstraction.
- One-timer shot speed multiplier **1.14**, partial base charge **0.35**, distinct audio, particles and skater ring; a missed/early released input does not automatically fire later.
- **One-touch passes**: a quick pass after a clean reception travels faster (25 instead of 21 units/sec) and conveys a brief status prompt.
- **Passing clarity**: the chosen clear-lane recipient is highlighted in WebGL and Canvas; blocked-lane targets are not highlighted.
- **Better physical feedback**: additional ice particles on hard cuts, with no added impulse.
- **Safety of puck intent**: clean pass provenance is cleared on saves, boards, shot release, goalie clears and test resets; interceptions do not trigger an intended receiver's queued shot.
- Preserve all existing score logic, contact mass resolution, the 90 Hz fixed simulation, three physically identical rinks, two modes, eight seats, and the injury stoppage.

## Test evidence (TheAtlas, Nov 22, 2026)
- Source test runner `node --test tests/icebreak/checks.cjs tests/icebreak/physics.cjs tests/icebreak/foundation.cjs tests/icebreak/drama.cjs tests/icebreak/first-touch.cjs`: **37 pass / 0 fail** on current candidate.
- Existing Chromium smoke (`tests/icebreak/browser.cjs`) ran on the Batch 05 code before the final pass-provenance cleanup: **4/4 scenarios pass** across desktop/mobile WebGL and Canvas; no page errors; goal/faceoff/controls/physics matrix.
- Dedicated Chromium first-touch browser test on the final candidate (`tests/icebreak/first-touch-browser.cjs`): **4/4 scenarios pass** (desktop 1440×900 and mobile 390×844, WebGL and Canvas); one-timer release measured at **35.283 units/sec**, correct goal caption and shot number, no page errors.
- No actual multiplayer human-playtest, physical phone/controller test, full-site build or final protected CI pass is claimed yet.

## Why Blender isn't integrated in this batch
Current ICEBREAK draws athletes and rink objects using custom WebGL meshes and a Canvas fallback, not a glTF animation pipeline. Adding Blender assets now would require a mesh/animation loader, fallback parity, performance budgets and reliable rigging; it would not solve the main criticism that controlling the skater and making plays must be fun. Use Blender in a dedicated subsequent animation batch: rig a skater with skate strides, a planted stop, an off-balance stumble, an impact fall, a recover-to-feet pose and a one-timer windup, then validate actual exported GLB quality and WebGL/Canvas degradation before replacing primitives. Do not replace responsive physics with baked movement.

## Review and release gates
- Draft PR stacked on **#482** (which is stacked on #478 → #477 → #473); do not merge ahead of its base.
- Run the new combined `npm run icebreak:browser` and full release build/CI against the integrated candidate.
- Have two real players test breakaways, receiving a pass, one-timer timing, shift-to-shift pace and injury frequency; tune measured failure patterns.
- Keep production unchanged until the chain passes its release gate and deployment is independently verified.

## Next highest-value batch
Add puck receiving animations and collision body language, goalie save anticipation and rebound reads, and a short skill-graded shooting drill to support practical balance measurements. Add challenge progression only after real match feel is convincing.
