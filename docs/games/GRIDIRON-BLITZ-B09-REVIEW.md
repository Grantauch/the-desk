# Gridiron Blitz B09 — Website & commercial review

**Review-only integration. Not production 1.0.** Created 2026-11-20.

## What is staged
- Self-contained B08 WebGL/Canvas2D game at `/hubs/gridiron-blitz/`, marked `noindex,nofollow` until approved.
- Gridiron entry in the shared `interactiveExperiences` games catalog (without touching the concurrent catalog PR's `src/pages/games.astro`).
- Subject-specific game preview, plus `/hubs/gridiron-blitz/privacy.html` linked from the title.
- `scripts/test-gridiron-blitz-b09.mjs` verifies canonical route, card, privacy, external scripts, and prerelease configuration. Run `node --test scripts/test-gridiron-blitz-b09.mjs` and after build `node --test scripts/test-gridiron-blitz-b09.mjs --dist`.

## Existing B01–B08 work
The game bundle is derived directly from the tested B08 standalone source; mechanics, forward progression, stationary field, broadcast camera, input, tactical defense, audio, progression and save schemas are unchanged. The staging wrapper adds only metadata, a privacy link, and review edition labeling.

## Local tests (software browser, not physical GPU)
- TypeScript check: PASS.
- 75 inherited unit/economy/input tests + 5 portal tests: **80/80 PASS**.
- 4 static route integration tests: **4/4 PASS**.
- Browser software WebGL2 Chromium, 1440×900, 375×812, 320×568, 844×390: **4/4 PASS** for startup, game, pause/resume, no horizontal scroll, and unchanged legacy keys.
- Zero observed network requests, zero page exceptions in browser tests.
- Actual B09 screenshot evidence and logs are in the downloadable B09 source archive, not yet attached to GitHub.

## Trust/privacy posture
- Leaderboards **OFF**. Client scores are not server verified; never advertise global rankings based on localStorage.
- Analytics, player tracking, advertising, student IDs/PINs and purchases **OFF**. The host may still create normal request logs; privacy disclosure distinguishes them.
- No game account needed. Original local career/high-score keys read but not modified; future online progression requires separate privacy review.
- No paid loot boxes or real-money currency.

## Commercial clearance required
- Trademark/title clearance (including `Gridiron Blitz`) and review of `ALL-PRO` and other football terminology.
- Confirm rights/attribution for all music, images, stadium elements and marketing assets. Current game geometry/synth audio were authored for the game.
- Audience definition, advertising policy, child-user privacy and legal review.
- Secure leaderboards only after server replay validation, rate limits, abusive-content controls, verified scoring, retention and privacy safeguards.
- Physical-device performance and iOS/Android/browser accessibility, real 30-min soak, reload-on-origin, human motion/audio testing.

## Release/rollback
This branch is the B09 review candidate, not an instruction to merge. Await the existing full site-check CI, independent review, and any hosting preview; B10 handles production launch and confirmation.
Rollback: revert the B09 route, catalog and preview changes without deleting historical local save keys. Do not say 'live' unless direct public route and catalog are both verified after deployment.