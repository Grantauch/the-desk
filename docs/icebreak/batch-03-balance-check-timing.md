# ICEBREAK — Batch 03: Balance, Check Timing, and Overcommit

**Stacked review:** Batch 03 is based on draft PR #477 (Batch 02 knockdowns), itself based on PR #473 (continuous puck/goal-line/clock corrections). It does not modify the release branch or main.

## What changes in play

A skater's **balance** is a dimensionless 0.35–1.00 state, distinct from stamina. Fast lateral edge slip during a cut takes balance away; straight skating, gliding, and a planted brake rebuild it. Balance is not a cosmetic meter: it changes the impulse effectiveness of the next active check and the defender's response to incoming impact.

- Checking leverage snapshots `clamp(energy / 0.78, 0, 1) × (0.70 + 0.30 × balance)` when a check begins. Speed, direction, relative mass and check alignment still govern impact.
- A target's vulnerability is `1 + 0.32 × (1 - balance)`. Braking and bracing still reduce impact by up to 42%. Light contact takes a small amount of balance; clean puck dislodges and hard knockdowns take more.
- A check is still a 0.29-second forward-contact commitment; there is **no teleport, tracking dash or fake impulse**. Human and AI checkers both coast immediately after committing.
- **Connected checks** enter about **0.11 seconds** of movement recovery. A **whiff** costs the ordinary 17–38% stamina, reduces balance by another 0.22, and enters about **0.27 seconds** of reduced drive and steering. This keeps a large, well-timed check worthwhile without turning Check into a free repeated dodge or dash.
- During recovery, drive capability is 77% and turning authority is 56% of normal. Movement is not frozen, and existing collision impulses are untouched.
- On-ice ring/marker and HUD distinguish committed checks, missed checks, off-balance skating, and falls. Lobby guidance now explains carving, bracing and missed-hit consequences.

## Measured calibration (simulation units)

Starting at 10 world units/s, then applying a hard lateral carve for 45 × 1/90-second physics steps, balance fell from 1.00 to approximately **0.83**; a clean 1.67-second glide returned it to 1.00. This is an intentional arcade stability scalar, not a biomechanical injury predictor.

## Tests and limits

- 27 original focused source tests from the prior two batches plus seven new checks for carving stability, leverage, whiff consequences, connected-hit recovery, vulnerable defenders, AI/human commitment parity and faceoff state.
- **34/34** focused test functions passed when executed against the exact candidate HTML script in a controlled JavaScript harness with mocked DOM and Canvas, including all inherited foundation and six seeded 24-second stress scenarios. Re-run after any code change.
- Important: the harness does **not** count as native `npm run icebreak:test`, Playwright, or a physical controller test. Real browsers must still be checked for WebGL and Canvas fall/recovery rings, HUD labels, keyboard/touch/gamepad behavior, and visual smoothness. Human-on-human timing, injury incidence and stamina balance remain for playtesting.

## Release gate

Keep Batch 03 a **draft**, stacked on #477. Do not merge or publish before the native Node test suite, browser screenshots, protected workflow checks, and real local multiplayer acceptance have been completed. Neither the three rink visuals nor Regular/Powerups alter base collision physics.
