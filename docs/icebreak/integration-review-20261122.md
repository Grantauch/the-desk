# ICEBREAK — Cross-branch integration review (November 22, 2026)

**Status:** Isolated staging candidate only; **not merged to main or released**.

## Source branches

- Physics/body-language/QA lineage: `icebreak/batch-13-multiplayer-framing` at `b4b0e63c`, then updated through `d645022a` (Batches 01–08, release gates, local multiplayer, rink framing and median-ice contrast sampling).
- Offensive gameplay/difficulty/progression lineage: `icebreak/batch-10-ai-difficulty-and-release-audit` at `a1d0b75c` (give-and-go, Shift Book, Rookie/Standard/Veteran AI).
- Integration review: `icebreak/integration-review-20261122`. Built in a separate Git worktree on TheAtlas; no edits to either original branch.

## Conflicts resolved deliberately

Git detected **16 conflicts**: 14 in `public/hubs/icebreak.html`, one in `package.json`, and one in `tests/icebreak/fixture.cjs`.

- Preserve swept puck/goal physics and impulse-based collision recoil, direction, visual tiers, and reduced-motion protections from the physics/QA lineage.
- Add `AI_LEVELS`, tactical lookahead, possession timing and adaptive shot/pass behavior from the difficulty lineage. Rookie/Veteran AI never receives bonus physics.
- Combine impact/recoil and tactical state in each player record; clear both types on faceoffs. Initialize and maintain the match stat ledger and Shift Book in `fullReset`.
- Preserve the eight-player local seat grid and mobile touch-seat behavior while adding the solo AI difficulty dropdown (forced Standard in multiple-human games).
- Preserve body-pose animation and reduced-motion settings in both WebGL and Canvas, while also maintaining the daily-goal ticker and `carryTime` counters.
- Merge the two source and browser test inventories rather than dropping either branch's regressions.

## Additional defects discovered by merged tests

1. **No-eligible-receiver test:** the synthetic fixture intentionally stunned all players before testing a successful pass. The test now creates an eligible receiver and verifies that a real pass leaves the stick and resets the carrier clock.
2. **Missing benchmark:** the source-manifest gate detected `difficulty-benchmark.cjs` outside the standard regression command. It is included in `icebreak:test`.
3. **Blue-ice contrast:** a visual browser test incorrectly measured *only red* intensity for blue ice. The verified WebGL pixels were ice `[29,80,149]` and boards `[5,14,23]`; the test checks a >40-unit perceived-luminance separation, retaining a diagnostic screenshot on failure. The parallel QA branch added median sampling of three ice pixels; this integration sorts those pixels by luminance and uses the median.
4. **Multiplayer seat misassignment:** older browser scenarios used an unscoped fifth `select` element. The added difficulty dropdown shifted indices, silently selecting a goalie instead of the away center. Both browser tests now scope to `#seatGrid select` and the multiplayer suite asserts that Keyboard 2 owns the away center.
5. **Cross-feature contract:** new `tests/icebreak/integration.cjs` checks that Veteran opponent tactics, physical collision feedback, deterministic body pose, the solo stat ledger, and faceoff cleanup coexist in the same match.

## Test evidence

- Complete combined source suite: **118/118 PASS** on the final native Node run, including the 18-match difficulty benchmark, the cross-feature integration regression, and the source/browser manifest checks.
- Benchmark: **18 full 120-game-second synthetic matches**, six fixed seeds for each difficulty. Opponent shot average: Rookie 1.33, Standard 3.83, Veteran 4.67. Wins per six: 0, 3, 3. This is pressure evidence, **not** a defensible human win-rate or proof that Veteran is substantially harder than Standard.
- ICEBREAK browser acceptance: **41 targeted Chromium scenarios passed**, desktop 1440×900 and emulated phone 390×844, WebGL 2 and Canvas fallback, with scenario coverage for skating/shot/catching, goalies, give-and-go, contact/reduced motion, 2 keyboards/8 simulated pads, persistence, difficulty selector and disabled storage.
- Astro build: **57 static pages PASS**. Static validation: **199 HTML files and 6,437 local references PASS**; sealed StoryHub assets: **38 releases / 401 files PASS**; Astro check: **0 errors, 0 warnings, 269 hints**.

## Release and remaining constraints

This integration review intentionally does **not** change PR #473 auto-merge, the public beta, or any active source branches. The two source lineages have parallel staged PR dependencies; merging this candidate directly to `main` would bypass their review sequence. It should remain **draft / review-only** until the foundation PR is merged, every required protected check is green, and an integration plan reconciles the stacked PRs without double-landing changes.

Human hands-on skating/competitive difficulty, physical multi-controller hardware, real-phone touch, school-network behavior, and Netlify production deployment of the integrated candidate remain unverified.
