# Pond cohesion — linked Field Station, not another game system

Date: 2026-11-22
Branch: `feat/pond-cohesive-field-flow-20261122`
State: **Draft authoring batch. Not released until review and production verification.**

## Player problem

Pond already has five overlapping activities: (1) painting physical materials in the living dish, (2) mixing discovered identities, (3) populating an ecosystem with living specimens, (4) growing and navigating a 192–768 world and its Atlas, and (5) preserving a local world. Their controls are physically separated by different panels and, on phones, substantial scrolling. A discoverable, consistent player route is more important than adding another independent system.

Current production foundation:
- 18 material palette entries plus tools, camera/canvas simulation and undo.
- 83 curated recipes and a deterministic identity space (not 10,485,760 authored species).
- Searchable saved discovery ledger, living residents and ecology interactions.
- Six world sizes, Atlas exploration with fog and habitat landmarks.
- Browser-local autosaves, exported/imported V1/V2 compatible world files.
- Rich/Classic rendering and mobile quick-material dock.

## Batch C01: one connected interaction loop

The five optional stations are **Paint → Discover → Populate → Explore → Preserve**.

The route appears immediately beneath the living dish and uses existing functionality:
1. **Paint** focuses the existing Field Kit; painting still happens in the dish.
2. **Discover** focuses the current mixing workbench.
3. **Populate** focuses the latest creature's Place action, or the mixing workbench until a specimen is available. If already armed, it focuses the dish.
4. **Explore** focuses world-expansion controls in a starter world, and the already-existing Atlas in larger worlds.
5. **Preserve** focuses the archive's import/export controls.

The suggested next activity follows *observable* existing state. It is guidance, not a quest, achievement, unlock, grading mechanism, or a requirement to proceed. Every station remains available throughout play.

The saved-discovery gallery now defaults to a recent sample of 12 entries so a long ledger no longer buries the Atlas. Search still searches the entire saved discovery collection; an explicit button expands to the previous 72-most-recent gallery limit, without changing stored discoveries.

No crafting rules, physics, creatures, world limits, Atlas data, or save keys are changed. No login or new backend is introduced.

## Verification required before merge

1. Pond unit tests, including physics, discovery, ecology, camera, Atlas and V1/V2 save compatibility.
2. Strict TypeScript and Vite production build.
3. Regenerated `public/hubs/pond/` assets and matching `build.json` SHA fingerprints.
4. Pond Playwright acceptance on 390×844 phone and desktop: station navigation/focus, first mix, placement, undo, expansion, pan, Atlas, save/export/reload, no JS errors or horizontal overflow. Existing checks also run at 320px in focused mobile QA.
5. Keyboard navigation, focus visibility, reduced-motion scrolling, quick-tool dock reachability.
6. Complete protected site checks and independent release review.
7. Public `https://grant-desk.com/hubs/pond/` interactive verification after the exact released bundle is deployed through the current production path; never infer production from a successful PR build.

The temporary feature-branch author workflow should be removed before PR review/merge. It may only commit regenerated static Pond assets to its isolated branch; it does not deploy.

## Next focused batches (not in C01)

- **C02 — Workspace consolidation:** After testing C01, evaluate one compact contextual bottom sheet on phones, instead of repeated scrolling among Lab, Kit, Atlas and Archive. Preserve permanent observability of the dish and avoid duplicating controls.
- **C03 — Explain cause and effect:** Present real ecological observations as field notes tied to the actual resident and biome, not synthetic objectives or invented reactions.
- **C04 — Atlas as world knowledge:** Connect creatures and discovered locations to the same map record, with stronger navigation and habitat consistency at every size.
- **C05 — Save confidence:** Clarify autosave versus downloadable backups and test portable backups across devices; no classroom PIN sync without privacy review.
- **C06 — Low-power device polish:** Long-play profiling, 768-cell/80-resident performance, rendering fallback and accessibility refinement.

## Invariants

- World saves: `grantdesk-pond-world-v1` and V1/V2 decoding.
- Discovery storage: `pond-discoveries-v2` and original save limit.
- Existing original links to `/hubs/pond/`, source/export format and Undo.
- Simulation and teaching claims remain accurate. Millions of procedural identities are not millions of hand-written recipes.
- Product must be welcoming without mandatory prompts, quizzes or artificial progress gates.
