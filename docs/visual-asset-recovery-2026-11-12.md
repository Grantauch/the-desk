# Visual asset recovery audit — 2026-11-12

Repository: `Grantauch/the-desk`. Baseline: `main`.
Scope: assets under `public/storyhub/`, `public/hubs/`, `public/atlas/`, Blender source files, exported GLBs and educational media.
Status: **partial source-level audit; no new student-facing release**.

## Priority branch recovery decisions

| Candidate | GitHub evidence | Decision |
| --- | --- | --- |
| WWI Arsenal + Over the Top | PRs #303, #305, #307, #308, #310, #313, #314 merged. Current `main` has 16 Arsenal-directory GLBs, 16 editable Blender source files, 10 Arsenal upgrade references and 6 Over the Top upgrade references. | Already integrated in source. Retain procedural fallbacks. |
| Over the Somme | Mark I tank GLB at `public/hubs/ush9-over-the-somme/models/mark1_male_1916_web.glb` has the same Git blob SHA as the Arsenal tank (`883aa1456a5362227c5b89c6effd4e98d3464f51`). The built Somme JavaScript references the flyover model. | Already integrated in source; confirm actual GPU loading separately. |
| Cinematic Atlas | PRs #346, #349 and #350 merged. The full `codex/cinematic-atlas-polish` priority subtree (at head `82a2e0426a7b5a45e85cf738a04f80329870d263`) matches current `main` by Git blob SHA. PR #348 remains open with six older/different priority files; its proposed changes overlap later merged work. | Do not copy older files over current artwork. Review #348 independently against `main`. |
| Robber Barons 3D Trust | `public/hubs/robber-barons-vfx/trust-formation-animation-v1.glb` is 8,964,156 bytes. PR #160 states 3D framing made the octopus tiny and deliberately switched the experience to an animated WebP, with the premium switch disabled. | Preserved prototype, not safe to enable unchanged; favor existing animated fallback. |
| Earlier art branches | Sampled `codex/wwi-museum-batch*`, `claude/over-the-somme-flyover`, `claude/somme-polish-2`, `claude/lusitania-3d`, `codex/jeopardy-theatrical-visuals`, `hubs/robber-barons-cutscenes`, `release/storyhubs-art-20260908`, `fix/l018-hires-images`, and several others; each compared as `ahead_by=0` against current `main`. | No commits exclusive to these branch heads; do not resurrect by wholesale merge. |

## Present-in-repository is not necessarily student-visible

- A committed file is only **available for HTTP delivery**, not evidence that a page loaded or rendered it.
- For the WWI models, page source references and fallbacks were inspected, but mobile GPU behavior, historical appearance and production console/network traces still require a browser run.
- The Arsenal has a custom, restricted GLB decoder; introducing a compressed/animated/textured model without updating and testing that loader can silently revert to procedural geometry.
- The separate Somme tank asset is identical by Git SHA, not a different visual upgrade.
- The Robber Barons 8.96 MB GLB is a concrete *deliberately inactive* asset; do not classify it as a missing-link bug.

## Provenance and preservation

- `assets/wwi-blender/README.md` documents models as interpretive Blender reconstructions with simplified geometry/markings. They should not be presented as primary historical artifacts.
- `public/atlas/SOURCES.md` documents NASA imagery, Natural Earth boundaries and a CC BY 4.0 relief texture. Preserve attribution and review license statements before reuse.
- Preserve currently working procedural/static fallback representations and reduced-motion behavior.
- Do not publish unfinished placeholder exports or downgrade existing lesson art.

## Regression gate added in PR #351

`scripts/test-wwi-visual-exports.mjs` audits source/export pairs, referenced page registries, the copied Somme tank, GLB header and binary layout, textures/animations/external data, mesh batches, download budget and fallback wiring.

`.github/workflows/wwi-visual-exports.yml` runs that test on changes to WWI assets or connected student pages.

**Review required:** CI green; independent code review; browser on low-power/mobile and WebGL-disabled devices; production URL and asset HTTP 200 checks. This audit does not assert those tests have passed.

## Follow-up inventory needed

Complete a branch-by-branch tree audit of *all* remaining refs and a full-site reference graph for illustrations, media, styles and animations, including JS-computed paths and redirects. Track each unused asset separately as: (1) intentionally archived, (2) experimental, (3) loaded only at runtime, or (4) recoverable with a specific lesson integration. Avoid interpreting textual nonreferences as proof of an orphan.
