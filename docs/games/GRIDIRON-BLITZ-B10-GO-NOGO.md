# Gridiron Blitz — B10 Go/No-Go and rollback register
**Date:** 2026-11-20
**Decision: NO-GO for commercial 1.0 or production merge.**
**Candidate:** draft PR #447, `feat/gridiron-blitz-b09-staging-20261120`.
**Why:** outstanding legal/name clearance, physical-device/browser verification, real-player accessibility/comfort testing, public-staging save reload, full-site independent approval, and deployment/rollback proof.

## B10 completed
- Rebuilt the self-contained B09 candidate from modular TypeScript source; 80/80 game/portal tests pass after compiling.
- Added a JavaScript-disabled recovery screen to the staged HTML, keeping links to privacy and Games.
- Ensured all four gameplay action controls plus Pause fit inside tested desktop/mobile viewports, with the smallest Pause button brought to 44x44 CSS px (smallest total button height: 44 CSS px).
- Added a direct support/troubleshooting paragraph and reminder not to send school credentials.
- Added dedicated CI regression checks for recovery fallback and minimum Pause button CSS.
- Local Chromium software WebGL2 route smoke: 4/4 layouts (1440x900, 375x812, 320x568, 844x390), with game start, pause/resume, legacy save keys unchanged, no errors/network requests.
- Additional Chromium keyboard, reduced-motion and no-JavaScript browser smoke: 4 responsive layouts plus no-JS recovery. Modal activation/close, on-screen controls, overflow checks pass.
- Git blob hashes for updated game/notice match the locally tested source. Static/privacy/server route integration tests pass.
- Tried genuine browser navigation + same-origin reload on a local HTTP server. Chromium returned `ERR_BLOCKED_BY_ADMINISTRATOR`, so **NOT VERIFIED**. Serialized-save tests do not replace this gate.

## Major brand clearance blocker — external research
- An earlier US registration for `GRIDIRON BLITZ`, serial **86614124**, registration **5028064**, belonged to **Bay Tek Entertainment, Inc.**, for arcade redemption game machines (class 028). Several trademark databases list it cancelled March 10, 2023 after continued-use filings were not made; some mirrors remain stale and say registered.
- A commercially marketed Bay Tek arcade football product with the same name is still described by retailers. A separate `Gridiron Blitz '89` browser football game also uses a similar name.
- **Cancellation is not clearance.** An actual counsel-led federal/state/common-law and confusion search, including similar marks and game/software classifications, is mandatory before branding, monetization or production publication. Do not claim trademark ownership or final availability.
- Sources to verify: https://www.uspto.gov/trademarks/search ; https://www.trademarkelite.com/trademark/trademark-detail/86614124/GRIDIRON-BLITZ ; https://primetimeamusements.com/product/gridiron-blitz/ ; https://www.gridironblitz89.com/terms
- Consider `The Breakaway` as a **working title only**, subject to its own independent clearance.

## Mandatory outstanding gates
1. **Commercial legal:** trademark/title and asset rights, privacy/child audience, terms, host log/consent review, independent approval. If required, rebrand UI, catalog and routes with explicit migration plan; do not rename live routes blindly because saves are origin-scoped.
2. **Real devices:** physical iPhone iOS Safari, Android Chrome, entry-level Windows laptop, desktop Edge and Firefox; actual GPU FPS, memory, audio, battery/thermal profiles and >=30 minute wall-clock soak.
3. **Human acceptance:** first-time-player onboarding, defensive fairness, replay intent, color contrast, screen-reader NVDA/VoiceOver/TalkBack, large text, keyboard-only and nausea comfort.
4. **Staging:** provide an accessible HTTPS preview with a true navigation/reload, progression/uniform persistence and no third-party calls; the current environment blocks local navigation.
5. **Repo/build:** full comprehensive site-check CI success, independent approval, reconcile concurrent catalog PR #444, no high-severity regressions, record the exact approved commit SHA.
6. **Deploy:** after approvals, merge and run the **actual owner-managed GrantDesk deployment**; verify public `/games/`, game route and privacy link from external network and physical devices. No CI build alone proves the deployment.
7. **Rollback:** backup exact prelaunch main/ref and built static artifacts; after verified deployment, practice revert/deploy, confirm old catalog and pages, and verify existing localStorage remains intact. Restoring a branch without redeploying is not enough.

## B10 integration/rollback details
- Touched files in draft PR: `public/hubs/gridiron-blitz/index.html`, `public/hubs/gridiron-blitz/privacy.html`, `src/data/interactiveExperiences.ts`, `src/components/GamePreview.astro`, `scripts/test-gridiron-blitz-b09.mjs`, `.github/workflows/gridiron-blitz-b09.yml`, and this review document. No production deployment.
- Concurrent catalog PR #444 changes `src/pages/games.astro` and navigation, while B09 adds one entry to the shared catalog. Rebase/retest after that PR and independently review category membership.
- Rollback staged addition by reverting the game's route, catalog entry and subject preview plus related documentation/CI. Leave `gridiron_blitz_profile_v2`, `gridiron_blitz_highscore_v1`, `gridiron_blitz_progression_v1`, and all other local save keys untouched. Avoid calling a PR revert a production rollback without actually testing deployment.
- Leaderboards, analytics SDKs, ads, purchases and student PIN integration remain disabled; client-side scores are not authoritative.

## Release approval sign-off (blank until evidence)
- QA owner, real test devices and results: **OPEN**
- Accessibility/comfort user-study reviewer and results: **OPEN**
- Legal/title/privacy reviewer: **OPEN**
- Site/canonical catalog integrator: **OPEN**
- Full-site CI run/approved SHA: **OPEN**
- Hosting preview link and reload evidence: **OPEN**
- Production merge, deployed SHA and real public URLs: **NOT PERFORMED**
- Production rollback rehearsal: **NOT PERFORMED**

**No honest commercial-1.0 or live claim until all applicable gates are documented and passed.**