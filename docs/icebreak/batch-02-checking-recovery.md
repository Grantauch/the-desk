# ICEBREAK — Batch 02: Physics-Driven Knockdowns and Recovery

This draft batch is stacked on PR #473 (the ICEBREAK physics foundation), which is itself based on the First Shift release PR #471. Its source is the validated checking and knockdown work in the older draft PR #455, selectively ported onto the new foundation so swept puck collision, accurate goal-line scoring, board collision stability, and fixed-timestep scheduling are not lost.

## Gameplay behavior

- Light check: puck wobbles at the visible stick, carrier retains control.
- Solid check: possession breaks and puck releases using the impact's transferred impulse.
- Heavy check: the defender falls and physically slides, rather than only receiving a stun flag. The equal-and-opposite normal collision impulse still owns the velocity change; animation does not add knockback.
- Impact severity relative to heavy/injury thresholds sets a **0.52–0.82 s** knockdown, plus **5–16 percentage points** of defender stamina loss. Pads have an exponential drag rate of **1.9/s** while down, against **0.55/s** when gliding normally. The fall direction is computed from the collision normal and defender facing.
- The skater can drive again only after stun expires. Both WebGL and Canvas show the topple/get-up, and on-ice status says DOWN.
- Maximum-severity contact still stops play and freezes the game clock for a **skippable five-second injury timeout** before resetting to a faceoff. Stamina and check cooldown are carried over; fall animation clears at the draw.
- Check attempts still cost **17–38%** stamina, including whiffs, and tired players lose acceleration and speed. Rink scenery never changes the collision physics.

## Review checks

- Executed the 27 source regression functions in an isolated JavaScript runner against the edited HTML script, with mocked DOM and Canvas: **27/27 PASS** (8 checking including new fall test, 10 skating/possession, 9 physics-foundation checks).
- The long stress case exercised six deterministic 24-second match simulations, all three rinks and both modes.
- Kept 90 Hz stepping, eight local seat assignments, School/Park/Mars and Regular/Powerups unchanged.

**Important limits:** This harness evaluates the exact updated JS and Node test functions but is not the repository's native Node test runner or real Chromium. The branch still needs `npm run icebreak:test`, `npm run icebreak:browser`, WebGL/Canvas screenshot inspection at desktop/mobile sizes, production build/check, real controller/multiplayer testing, and balancing based on real gameplay. Do not merge or publish from the isolated run alone.

## Relationship to earlier work

- PR #455 remains an older draft proof of the skating/checking pass and its initial fall version. Do not merge it over Batch 01.
- PR #473 is the immediately preceding foundation and should be reviewed first.
- This Batch 02 PR should target `icebreak/batch-01-physics-foundation`, not main.

## Follow-up: tab-visibility and input-safety polish (November 22)

- Browsers can stop displaying a tab without firing a window `blur`. Both events now use the same idempotent focus-suspension path: clear held keyboard/touch/gamepad input, cancel shot windups, remove stuck pressed styling, and pause an active game.
- Regaining visibility never automatically resumes the game. Users must select Resume. Releasing a previously held shoot key afterward cannot fire an unintentional shot.
- Regression coverage: `tests/icebreak/checks.cjs` simulates background, blur, foreground, controlled resume and released shoot; `tests/icebreak/browser.cjs` dispatches tab visibility in actual Chromium WebGL and Canvas rendering, desktop and emulated touch.
- Local native checks on the updated Batch 02 tree: **28/28** source tests and **4/4** Chromium matrix (0 page errors). Browser-run results are emulated mobile viewports, not physical-phone or controller trials.
- No changes to skating speeds, injury rules, scoring, roster, power-ups, or deployed production. Keep PR #473 physics foundation ahead of this Batch 02 branch in the release sequence.
