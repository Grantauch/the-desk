# Pond live release verification — November 20, 2026

Public experience: https://grant-desk.com/hubs/pond/  
Student discovery: https://grant-desk.com/games/  
Release sequence: [2.0 #417](https://github.com/Grantauch/the-desk/pull/417) → [Atlas 2.1 #423](https://github.com/Grantauch/the-desk/pull/423) → [Graphics 2.2 #425](https://github.com/Grantauch/the-desk/pull/425) → [Field Station 3.0 #427](https://github.com/Grantauch/the-desk/pull/427)

## Evidence legend

- **Merged**: GitHub PR merged into `main`.
- **Deployed**: Vercel successful commit status (not by itself proof of a working public game).
- **Visible**: the actual public Pond tab exposes specific release UI and navigation elements.
- **Functional**: the behavior has been exercised against the **production URL** in an interactive browser, across target devices. **Not yet signed off**. Do not call the release fully verified until this gate passes.

## Confirmed release inventory

| Release | Production merge (UTC) | Commit / status | Distinctive live UI evidence | Full functional sign-off |
| --- | --- | --- | --- | --- |
| 2.0 / #417 | 2026-11-20 06:32 | `40492a6608d130032e20cb0e2ecaa8d10b805ef9` / Vercel success | 10,485,760 outcome-space counter, specimen ledger, expansion control | Pending |
| 2.1 / #423 | 2026-11-20 07:26 | `f1ae184a9b51e67358b652b2acacfc43f95d2ea5` / Vercel success | World Atlas heading and map-opening control | Pending |
| 2.2 / #425 | 2026-11-20 10:44 | `b546a641c33a8927e5bd88f1b514a03f7f720a91` / Vercel success | Rich pixel graphics selector | Pending |
| 3.0 / #427 | 2026-11-20 12:15 | `af6113a4cae5d9d1627f1aafee5e6276476cd446` / Vercel success | Field Station sections, glass stage, mobile quick-tool markup, archive | Pending |

The production repository currently references `/hubs/pond/assets/index-De8TbtT_.js` and `index-CzAmdxN2.css`, matching the Field Station release manifest. The connected public browser tab renders a React-driven Field Station (rather than just a noscript fallback). Public Games catalog includes a direct Pond card. Direct standalone asset downloads were not available to the verification environment; do not use the repository asset reference alone as proof of the deployed asset bytes.

## Quality-gated batches

| Batch | Scope | Gate | Status |
| --- | --- | --- | --- |
| **P00** | Confirm four merges, deployment statuses, student route, public Field Station UI, baseline assets | Four merges + successful Vercel statuses + public page and student link | **Passed for static/UI discovery** |
| **P01** | Materials, recipe mixing, creature placement and ecology, simulation controls, paint/touch, undo | Desktop and 390px mobile: actions genuinely change the canvas; no JS errors; undo correct | **Needs live interaction** |
| **P02** | 192→256→320→448→576→768, camera dragging/zoom, distant paint, Atlas navigation, habitat reveals, fog, undo | Stage/camera/map agree at every size; no misplaced entities, invisible regions or broken labels | **Needs live interaction** |
| **P03** | Existing local saves, autosave, world export/import, V1/V2 compatibility, invalid imports and quota failures | Reload restores terrain/specimens/atlas/discoveries; invalid payload leaves current world intact; backup is usable | **Needs live interaction** |
| **P04** | 320/390px mobile, Chromebook/desktop, touch/keyboard, readable controls, accessibility, Rich/Classic, performance | No blocking overflow, inaccessible control, runtime exception or large-world freeze | **Needs live interaction** |
| **P05** | Small isolated fixes and regression tests for only reproducible defects, gated PRs, production checks | Unit, build, browser acceptance and full site checks pass; each fix rechecked on public URL | **Not started** |
| **P06** | Release sign-off and subsequent enhancement triage | Actual P01–P04 evidence attached and no critical failures remain | **Not started** |

### Interactive production test script

1. On a clean guest browser, open the Games page and use the **Pond** card. Verify the Field Station loads without login or access errors.
2. Mix starter elements into a discovery, place a specimen, switch paints, draw, undo, shake and resume/pause; check interaction and actual simulation pixels.
3. Grow the world through all six supported sizes; pan/zoom, paint beyond the original boundary, then use the Atlas to jump to revealed habitats/landmarks.
4. Toggle Rich/Classic graphics; reload and verify preference and saved world; export, import on another clean browser, and verify discoveries, residents and map progression.
5. Repeat essential actions on a 390px touch viewport and a desktop/Chromebook viewport. Record screenshots, console and network errors and any broken control.
6. For every failure, capture exact steps, device/viewport, public URL, expected vs actual, and a screenshot. Fix in an isolated PR; re-run affected tests and the full site gate.

### Safeguards

- Do not equate merged PRs, passing previews, production build success, or visible buttons with fully working gameplay.
- Preserve `grantdesk-pond-world-v1` local save compatibility and `pond-discoveries-v2` discovery storage.
- Avoid unrelated website edits and do not change recipes, balance or ecology as part of verification.
- The 10,485,760 figure is a deterministic outcome **identity space**, not 10 million authored recipes.
- Existing browser tests (not necessarily production executions): `scripts/test-pond-discovery-browser.mjs`, `scripts/test-checkling-pond-browser.mjs`. Run them and production-specific acceptance before signing off.
- Proposed enhancements belong in [UPGRADE-IDEAS.md](./UPGRADE-IDEAS.md); defer implementation until full live verification.
