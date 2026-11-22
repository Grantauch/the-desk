# ICEBREAK Batch 07 — give-and-go tactics

## Why
The critical review identified one-note attack patterns. Batch 07 makes the team combine intelligently instead of repeatedly skating at the puck or immediately trading passes, without increasing arena count or adding new graphics infrastructure.

## Gameplay behavior
- After a pass is **actually caught by the intended teammate**, the original passer gets a 2.3-second opportunity to cut into the attacking zone. Merely attempting a pass does not create a combo.
- AI passers steer toward a side that opens a lane for a return pass, preferring unmarked space; skating still obeys the common acceleration, speed, edge and collision physics.
- The AI receiver can return a pass when the cut has developed, the runner is meaningfully ahead, the lane is clear, and a cooldown permits it. A clear scoring shot remains higher priority.
- Return-pass evaluation improves the existing best-target scoring rather than bypassing defenders. User-controlled receivers can pass to the highlighted runner manually using their normal controls.
- A completed give-and-go is marked with the HUD, on-skater marker and gold ring in **both WebGL and Canvas**. The setup paragraph explains the action.
- Recatch timing, a cooldown, passing provenance and expiry rules prevent infinite AI ping-pong. Opponent interceptions and unintended catches do not create fake cuts.
- Preserve the 90 Hz fixed-step simulation, both modes, three identical-rink physics profiles, replay and existing one-timers/checking/goaltending.

## Tests (TheAtlas — Nov 22, 2026)
- Node suite `tests/icebreak/combinations.cjs`: **7 tests** — intended catch, opponent interception, unintended same-team catch, off-puck AI skating, open return, blocked return, and return cooldown.
- All source ICEBREAK gameplay, physics, injury, one-timer, goalie and arena-equivalence checks: **48/48 pass** on this batch before the final onboarding-copy update.
- Dedicated Playwright/Chromium WebGL and Canvas, desktop 1440×900 and touch-sized 390×844: **4/4 combinations acceptance scenarios pass**, including real browser HUD, visible runner marker, return target and no page errors.
- Combined release browser gate now includes original smoke, first-touch, goalie and combination scenarios; full final gate is required for the ultimate candidate.

## Dependencies and gaps
- Draft stacked on Batch 06 PR #490 (upstream chain #473 → #477 → #478 → #482 → #486 → #490).
- No independent protected CI, full-site build of this exact branch, physical mobile/gamepad test or true human multiplayer fun evaluation has been completed by this batch.
- Blender animated hockey rigging is separately tracked as Team Desk #97; ICEBREAK currently has custom WebGL geometry + Canvas fallback and no GLB animation pipeline. Gameplay AI takes priority and does not depend on assets.
- Do not merge this PR before its base or claim the public beta is updated. Test production after any authorized deploy.

## Next work worth doing
Expressive checking and standing recovery: readable bracing, directional hits, short stumbles and more believable getting up, with visual cues linked strictly to physics. Evaluate perceived difficulty and success/failure in 2-player sessions before designing long-term progression.
