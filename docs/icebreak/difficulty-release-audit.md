# ICEBREAK — Batch 10: Fair difficulty, offensive repair, release audit

## Why this batch matters

The Ebert-style review called out reactive AI, too little offensive imagination, weak satisfaction after a match, and shallow long-term difficulty. Batch 09 introduced local skill progression; Batch 10 makes the AI settings *play differently* while preserving a single sports simulation.

This is a **draft development revision**, stacked on Batch 09 PR #514. It is not a published game or a claim of four-star entertainment. Protected hosted checks, an integrated release, physical-device playtesting and human enjoyment assessments remain.

## Difficulty selection

- **Rookie — Learn the game.** Longer planning updates (0.24 s), less predictive goalie positioning, fewer shooting and passing decisions, fewer opportunistic checks, more imperfect aiming. A chance for new players to learn movement and possession.
- **Standard — Balanced.** Preserves the prior tactical baseline for defensive coverage, goalie anticipation and shared skating. Now also benefits from the verified AI offense deadlock repair.
- **Veteran — Sharp reads.** Greater puck-path anticipation, better goalie reading, quicker shot/pass choice, more goal-directed aiming, normal physical checks and more offense under pressure.

**Competitive fairness:** The levels change only decisions and goalie targets. They do not grant any team extra skating acceleration/top speed, stamina, mass, collision knockback, puck velocity, goalie save radius or shot power. The existing fixed 90 Hz simulation and three rink physics remain shared.

**Solo:** Only computer opponents change level. The human player's AI teammates remain Standard, avoiding a paradox where "harder" also makes the player's teammates substantially stronger. **Two or more local human players:** All AI seats use neutral Standard; the difficulty selector is disabled with an explanation while multiplayer is selected. **No human seats:** An all-AI exhibition uses the selected level on both teams.

## The important discovery: AI offense was nearly absent

The first deterministic benchmark inadvertently used a stationary human center. Tracing revealed the human center was *correctly picking up the puck*, then holding it for approximately 113 seconds; that benchmark was invalid as an AI pressure test. **No puck-pickup defect was confirmed**, so puck physics was not changed.

The corrected pre-repair benchmark used a stationary human goalie instead, with the other three friendly skaters on Standard and the three attacking opponents on the selected AI level. On six deterministic seeds per level (18 completed two-minute games), the opponents attempted **zero shots at all three levels**. The root cause was tactical: computer puck carriers required an unrealistically clear lane before taking any shot, and often carried the puck for most of a match.

Batch 10 repairs the **decision logic**, not the projectile physics:
- AI can shoot through traffic at believable attack-zone distances rather than requiring empty defensive lanes;
- a puck-control timer makes prolonged offensive possession increasingly urgent;
- carriers may pass out of pressure rather than keep circling;
- AI shooting direction favors the actual goal line with level-specific aiming, but the same puck velocity, shot release, goal-line and goalie-save collision rules still determine the outcome;
- human-controlled players never receive automatic shots or forced passes, regardless of difficulty;
- a faceoff or normal release clears the temporary carry/plan state.

### Corrected six-seed synthetic pressure study

Each sample contains six completed 120-game-second simulated matches. The human occupies the Glaciers goalie seat without input, other Glaciers are Standard AI, and Embers opponents use the selected difficulty. These results are **not** a prediction of actual human win rates.

| Opponent AI | Shot attempts per match | Completed passes per match | Clean checks per match | Opponent wins out of six |
| --- | ---: | ---: | ---: | ---: |
| Before fix — Rookie | 0.00 | 0.00 | 0.17 | 0 |
| Before fix — Standard | 0.00 | 0.50 | 1.00 | 0 |
| Before fix — Veteran | 0.00 | 0.00 | 1.00 | 0 |
| After fix — Rookie | **1.33** | 0.33 | 0.83 | 0 |
| After fix — Standard | **4.00** | 0.50 | 2.83 | 4 |
| After fix — Veteran | **4.67** | 0.33 | 3.50 | 3 |

**Interpretation:** Real shooting opportunity generation improved dramatically. The stronger level generated more attempts and more clean checks in this small synthetic study. **Win ordering is not monotonic** (Standard won 4/6 and Veteran 3/6), so the game must **not** be represented as fully balanced or harder in measured human win probability yet. Six seeds is a smoke-level sample; broad human testing is required.

The fully reproducible script is `node tests/icebreak/difficulty-benchmark.cjs`. It uses seeded simulations, no external data, no tracking, and runs separately from the required fast source suite. See script output for per-seed scores/attempts. Do not aggregate these data as live player statistics.

## Replayability integrity and saved records

Batch 09's `icebreak:shift-book:v1` storage format is **extended backwards-compatibly** with `byDifficulty.rookie/standard/veteran` record groups, each containing Regular and Powerups bests. Existing aggregate records stay intact. If old v1 storage has no difficulty grouping, the pre-difficulty history is copied to **Standard only**. Reading old records does not write or duplicate them.

Daily challenges and earned badges remain generic, device-local achievements; the game reports the current level on the final shift report. Different difficulties have **separate best-game records**, preventing a Rookie personal best from appearing as a Veteran personal best. Multiple local humans never earn solo records.

No player names, account IDs, student data, network activity, telemetry, or ranking system was added.

## Validation

- Dedicated difficulty physics tests check profile immutability, opponent-only solo selection, neutral multi-human AI, same human/AI movement constants at every level, goalie anticipation with normal acceleration, planning delay, relative clean-lane shot frequency, v1 record migration, per-level/mode records, safe faceoff reset, escape from stalled AI carrying, and no forced human shooting.
- Existing tests cover deterministic 90 Hz physics, skating, shots, checking, boards, puck/save/goal intersections, powerups/Regular modes, all three rinks, goalie reactions, give-and-go, replay integrity, contact animations, local Shift Book storage, and two-minute final-horn commits.
- TheAtlas on November 22, 2026: **88 of 88 source tests passed**, including the new difficulty/offense cases.
- The new Chromium difficulty acceptance checks the selector, solo opponent-vs-teammate AI mapping, separate saved records, page reload, accessible Play Again and Drop the Puck, and disabled/equal difficulty when a second human joins. It runs on WebGL and Canvas, desktop 1440×900 and mobile emulation 390×844. A mobile above-the-fold regression was found and repaired: the final 390×844 start button is at y=707–752, fully visible, with no inner setup scroll.
- Full combined browser acceptance (original, first-touch, goalie, offensive combinations, contact body language, Shift Book, difficulty) is required to pass before any promotion.

## Release readiness audit / blockers

1. **GitHub stack:** #473 (Batch 01) → #477 (02) → #478 (03) → #482 (04) → #486 (05) → #490 (06) → #494 (07) → #504 (08) → #514 (09) → this Batch 10 PR. In the most recent status lookup all earlier ICEBREAK PRs remain open, most draft. #473 is now based on main; #477 reported `mergeable=false` and needs conflict/status review before further promotion.
2. **Hosting:** Recent Vercel checks reported `failure` with a `build-rate-limit` account/upgrade URL, not a confirmed code compile failure. Full site build, protected checks and production deployment of these changes were **not verified**.
3. **Classroom / phone / controller:** No physical device, cross-browser school-network, Bluetooth gamepad, or real two-human local play acceptance has been conducted on this exact candidate.
4. **Fun/difficulty:** Synthetic six-seed AI pressure improved, but human-perceived skating responsiveness, scoring challenge, difficulty win probability, comeback satisfaction, multi-match retention and daily motivation require observed playtesting. The four-star goal is **not yet independently established**.
5. **Blender:** Skater rigging and GLB import are separately tracked in Team Desk #97. ICEBREAK's current WebGL primitive renderer and Canvas fallback do not yet support a production animated GLB pipeline, so this batch introduces no Blender runtime dependency.
6. **Data:** The local Shift Book is per browser profile/device; it is not a trusted leaderboard. Clearing browser site data erases bests, and device date changes affect the daily challenge. This is intentionally a privacy-first recreational feature.

## Practical post-integration acceptance plan

Integrate the stack in dependency order, resolve conflicts and run protected checks; verify hosted site HTML and deployed commit; test touch and two-gamepad controls on actual devices; conduct at least several short play sessions with novice, competent and expert users. Record shots, saves, possession changes, scoring, comeback attempts, rematches and subjective frustration *manually* without collecting student identity. Tune Veteran/Standard gap using more seeds and human win data, never granting the AI extra physical power.

The current public ICEBREAK beta is **unchanged** by this branch.
