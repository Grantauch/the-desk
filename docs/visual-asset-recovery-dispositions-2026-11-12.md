# Visual recovery decisions — November 12, 2026

Baseline: `Grantauch/the-desk` `main` commit `da332b0ea7f7ffe9e905a72f64e6b64336c281bc`. Read-only all-branch scan from [GitHub Actions run 43344317815](https://github.com/Grantauch/the-desk/actions/runs/43344317815), [complete inventory artifact](https://github.com/Grantauch/the-desk/actions/runs/43344317815/artifacts/14000812601).

This is a **disposition ledger**, not evidence that every published page has passed visual acceptance. Full path, Git blob SHA, raw content SHA-256 and branch sources are recorded for every candidate in `inventory.json`, with separate `visual-code-variants.json` for JavaScript/CSS/HTML/Astro visual code differences.

## Branch-only artwork: 52 unique contents across 58 paths accounted for

| Group | Count | Disposition | Evidence / next gate |
| --- | ---: | --- | --- |
| Old Hidden History Rabbit Hole deck art | 14 | **Superseded; do not restore by default.** The current `public/hubs/hh-down-the-rabbit-hole.html` references a newer `rh2-*` art sequence, more evidence-specific imagery and a captioned archival clip. The old `bugs.webp`, `card-a.webp` through `card-e.webp`, `cheshire.webp`, `eye.webp`, `floor.webp`, `goldwater.webp`, `keyhole.webp`, `queen.webp`, `triad.webp` and `walrus.webp` were preserved only in older branch heads. | Do not replace the newer page without side-by-side aesthetic and source verification. |
| Checklings Sprite Book art | 26 paths / 20 unique PNGs | **Owned by draft PR #284, not abandoned.** Fourteen files are under `apps/checkaverse/public/art/`; six are founder-facing camp exports under `public/hubs/checkling/camp/assets/`. | [PR #284](https://github.com/Grantauch/the-desk/pull/284) explicitly records incomplete Wave 2 source access, two rejected sprites, unavailable Wave 3/4 assets and missing Kettle Creek map acceptance. Do not merge or bypass the independent review gate. |
| USH9 L018 early images | 14 | **Superseded; do not restore.** Their previous versions are only ~2.5–3.7 KB each; current `main` has 14 substantially larger `public/storyhub/ush9/l018/assets/*.webp` images and `public/hubs/ush9-l018-the-debt-didnt-move.html` references all 14. | Retain current images; do not introduce older low-resolution placeholders. |
| Legacy touch/PWA icons | 4 | **Not recovered unchanged.** `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` live only on `polish/site-nightly-20260903`; current `main` uses `public/favicon.svg`. | Design new raster sizes from the current identity if a current PWA/touch icon is wanted. Do not reapply pre-redesign branding blindly. |

**Result:** All 58 branch-exclusive asset paths are classified and collapse to 52 unique file contents. Six new `checklings/sprite-book-battle-poses` paths are byte-for-byte duplicates of the six existing staged founder camp PNGs, not additional artwork. Zero were found in the WWI or Cinematic Atlas priority asset paths. This is not permission to delete their historical Git objects.

## Visual interface variants: 323 distinct nonmain source blobs

The full report records 323 JavaScript/CSS/Astro/HTML variants, including 44 whose *paths* match priority topic keywords. This is **not 323 missing features**: older or squash-merged branch heads contain prior versions of files that were subsequently improved on `main`.

Only four code paths in this scan are absent by path from `main`:

- `public/hubs/wwi-gallery-reader.html` — intentionally proposed as a new, accessible field guide in draft [PR #355](https://github.com/Grantauch/the-desk/pull/355). It is not a historical recovery.
- `src/pages/rabbit-holes.astro` — old standalone navigation route; main now directs Rabbit Holes through the Detour Shelf. Preserve the newer navigation instead of duplicating legacy routes.
- `public/hubs/blacktop-kings/ball-physics.js` — isolated ball simulation from an old branch 563 commits behind current `main`. **Explicitly excluded in merged PR #176**, which reconciled #174 and #175 but rejected its predetermined make/miss planner in favor of the skill-driven physical trajectory. Do not restore that unused module.
- `public/hubs/Robber barons.html` — old space/capitalization-named duplicate; the live game has its established canonical `robber-barons.html` route. Do not surface duplicate titles or route students to the old copy.

Atlas branch PR #348 had no missing art and six older/different priority files; merged PRs #349 and #350 include the later upgrades. [PR #348 was closed as superseded](https://github.com/Grantauch/the-desk/pull/348) rather than merged over newer artwork.

## Public assets with no obvious literal source reference: 164 possible false positives

The automatic reference scan checks literal URLs, same-directory basenames and global basenames. A computed path is not a literal string. The largest clusters are:

- **Blacktop Kings generated scenery (42):** `public/hubs/blacktop-kings/assets.js` builds names from scene IDs and generation suffixes. `scripts/test-blacktop-assets.cjs` explicitly tests the catalog and fallback behavior. Some older v2 mode/role art is overridden by newer v4 assets, by design.
- **Atlas responsive art (6):** `src/pages/index.astro` derives `-480.webp` and `-1440.avif` via `course.art.replace(...)`, so these are legitimate `srcset` resources.
- **WWI trench GLBs (5):** `public/hubs/ush9-over-the-top.html` dynamically constructs filenames from known stems; both existing Playwright trench suites and new model-contract tests cover this pattern.
- **Robber Barons scenes, characters and money art:** sprites are selected dynamically from game state. The large 8.96 MB premium trust GLB is deliberately deactivated after a documented bad camera/framing result in PR #160; the animated WebP remains the preferred current artwork.
- **Checklings camp and pet sprites:** dynamically selected by founder and gameplay state; do not assume these are unused based on text search.
- **Historical `x_*` StoryHub variants and other isolated files:** need per-lesson source and visual comparison before a keep/remove decision. Names alone do not prove obsolete or licensed.

**No blanket deletion or publishing is authorized from this heuristic report.** Browser asset-usage instrumentation is necessary to tell truly unused files from deferred or computed loads.

## Actual student-facing gap addressed

The Arsenal and Over the Top contained no independent reading path for devices without WebGL2. Draft [PR #355](https://github.com/Grantauch/the-desk/pull/355) adds a lightweight guide and automatic GPU-unavailable routing while leaving existing 3D art untouched. Its focused browser test passed; protected review and site release remain gates.

The existing museum source/export/URL contracts are safeguarded by draft [PR #351](https://github.com/Grantauch/the-desk/pull/351). Its focused workflow passed after accommodating Blender material-only GLTF extensions.

## Visual contact sheets and actual source inspection

The full branch-only asset contact sheets were rendered in [CI run 43345752225](https://github.com/Grantauch/the-desk/actions/runs/43345752225) and are available in its [comparison artifact](https://github.com/Grantauch/the-desk/actions/runs/43345752225/artifacts/14001551582). All **58** path variants decoded successfully.

- The early Rabbit Hole imagery consists mainly of flat card, eye, queen, chessboard and other illustrative UI motifs. The current `rh2` edition uses a more substantive, source-specific visual sequence; restoring the early set would be an aesthetic and pedagogical downgrade.
- The 14 L018 old images were inspected **side by side with current `main` versions**. The old 160 × 90 miniatures are visibly blurred and much less detailed than the 1672 × 941 polished images currently loaded. Definitive no-restore verdict.
- The Checklings draft images are pixel-art source and pose sheets, and the six newer alternate-path copies are exact Git blob/content-hash duplicates of the staged camp files. They are **not** six additional missing designs.

No legacy placeholders were restored based on these visual comparisons.

## Browser-based runtime validation

The first no-login, offline-controlled browser pass [run 43344743336](https://github.com/Grantauch/the-desk/actions/runs/43344743336) visited all **109 root-level HTML hubs** at desktop width plus **7 high-priority hubs at mobile width** (116 browser visits total). The browser requested **483 distinct local media paths** across those visits.

- All 116 routes returned HTTP 200.
- No local media request failures, JavaScript page errors or horizontal overflow were observed.
- Four pages displayed failed `i.ytimg.com` thumbnails because the audit intentionally blocked all third-party network calls; these are **not proven production defects** and were not counted as local asset failures.
- 315 public media files were not requested in this initial-load/scroll pass. This is **not an orphan count**: the test did not open every narrative branch, avatar choice or lazy scene and did not load the site's Astro homepage, so expected Atlas textures and responsive course artwork are absent from the request set.

An expanded runtime workflow now visits **all 109 hubs on both desktop and mobile**, plus priority pages at a narrow 320px viewport. Its final report will be reviewed separately before any asset removals or fixes.

## Remaining verification / release gates

1. Independent review of PRs #351, #354 and #355; final full site check and merge permission.
2. Real production HTTP/network + actual GPU rendering checks for the priority WWI pages and Atlas (a remote HTML response is not a graphics test).
3. Run the modern Blacktop gameplay/physics suite before comparing the old ball-physics prototype.
4. Complete Sprite Book missing-source and review gates on #284 rather than cherry-picking those 20 PNGs.
5. Address genuine unused art found through runtime tracing, not name-only heuristics.
