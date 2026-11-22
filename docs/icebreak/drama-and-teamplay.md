# ICEBREAK Batch 04 — Drama, support play and goal replays

## Why this batch
The November 22 Ebert-inspired review gave ICEBREAK 2/4 stars. Its most serious issues were a puck-chasing AI, weak satisfaction from scoring, unexpressive collisions and three rinks with too little identity. Batch 01–03 are still pending in a stacked PR chain. This batch builds on the Batch 03 head rather than overwriting physics changes.

## Implemented
- **Team shape:** when a teammate has the puck, noncarriers take staggered, lateral positions and adjust to nearby defenders instead of simply stacking beside the carrier.
- **Defense:** closest forechecker intercepts a projected loose puck, secondary skater cuts the middle lane, final skater protects the slot. Defensive checks retain the same committed physics and stamina cost as human checks.
- **Pass decisions:** score potential recipients by direction, progress, defensive pressure and clear passing lane; compute lead position from receiver velocity.
- **Attack:** AI shoots when close enough and with an open lane; under pressure it can pass to an open teammate instead of always firing or skating straight in.
- **Goal feedback:** recent-shot attribution (not a verified scorer when the puck deflects), team celebration HUD, short render-only instant replay from recent position snapshots, raised sticks and goalie slump in WebGL, rink-specific scoring cues.
- **Integrity:** no physics mutation during replay; identical physics in School, Park and Mars; bounded replay buffer; same local seats and touch/keyboard/gamepad controls.

## Verification
- On November 22, TheAtlas ran `node --test tests/icebreak/checks.cjs tests/icebreak/physics.cjs tests/icebreak/foundation.cjs tests/icebreak/drama.cjs` from a fresh sparse checkout of the Batch 04 branch: **31 passed, 0 failed**, process exit 0.
- Four new tests cover replay isolation, recent-shot credit boundaries, better passing lanes and moving-puck anticipation.
- Existing seeded physics and rink-equality tests still pass.
- **Not yet verified:** Chromium WebGL/Canvas visual QA, human 2-player feel test, tactile gamepad test, actual goal replay smoothness and reduced-motion treatment.

## Release constraints
This PR must remain draft/stacked on `icebreak/batch-03-balance-and-check-timing` (#478), which is stacked on #477 and #473. No direct production merge or declaration of completion until the upstream branches are integrated and CI, browser smoke, build/check, and real gameplay QA pass.

## Next work to earn a four-star game
1. **Skating pleasure:** independent playtest of stops, burst feedback, passing reception, one-timers and breakaways; tune by observed failures rather than speed increases.
2. **Visible physics:** Canvas parity for celebrations, stronger collision body language, recovery timing and feedback without excessive injuries.
3. **Meaningful opponents:** test controlled breakaways, overloaded-side defense, cycling, interceptions, goalie reactions and legible AI difficulty.
4. **Moments and match rhythm:** cinematic but short replays, optional skip, shot clock / shot heat, memorable saves and final-match awards.
5. **One-more-game incentives:** local rivalries and stats that do not require accounts, deterministic challenge seeds, best-of-three option, daily challenge only after balance and playtests.
6. **Rink character:** distinct noncompetitive ambience and crowd/lighting packages; never alter core rink physics across School/Park/Mars.

## Honest quality status
This is a tested improvement to a **beta**, not a finished four-star product. Human entertainment and replayability ratings cannot be inferred from passing automated tests.
