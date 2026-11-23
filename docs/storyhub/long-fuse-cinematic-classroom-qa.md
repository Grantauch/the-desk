# The Long Fuse — Cinematic Map, Interludes and Classroom Theater QA

**Scope:** Draft PR #555 on `feat/long-fuse-storyhub-v2`; continuation after commit `5cfcaa8`. Site main and student data unchanged.

## What was built

1. **Part I:** Six-source decision geography map showing political connections from Sarajevo through August 4, with authored historical claims, limitations and source URLs. Paths are clearly labeled **schematic / NOT precise borders, literal military routes or automatic obligations**. On mobile the map has its own keyboard-focusable horizontal scroll region, accessible label and auto-centering of selected connections. With JavaScript off, all six dated records and the base diagram remain readable.
2. **All three episodes:** A documentary chapter break using genuine existing rights-reviewed artwork/photography. Illustrative depiction of Sarajevo is identified as an **illustration**, not a photograph. Aisne trenches and 1923 inflation are photographically sourced. Reduced-motion preference disables film drift. Chapter-only reading mode hides the interludes so they do not interrupt the selected chapter.
3. **Classroom Theater:** Full-viewport, large-text, touch-first modal for the 5/5/6 chapters; one dated source-linked scene and one actual teacher-led question per chapter (16 total), 44px+ control targets, previous/next, direct chapter select, arrow/Page/Home/End, Escape/Alt+P, focus restoration and browser-local interaction. No teacher/student accounts, PINs, submission, data collection or remote control service.

## Tested — TheAtlas isolated build

- `npm run storyhub:validate`: 48 manifests, no warnings; 38 sealed asset releases / 401 files verified.
- `npm run check`: 0 errors, 0 warnings; unrelated repository hints remain.
- Astro static build with `--outDir dist-long-fuse-release`: **61 pages**, success. An earlier normal `dist` build failed due a Windows EPERM lock on the shared `dist/hubs` output directory; no production processes were stopped. Three isolated build directories built successfully.
- Classroom theater test: 23 checks at 1920, 1440, 1280, 390 and 320 px, all three episodes, all 16 question prompts, modal open/close, previous/next, Home/End, focus restoration, no horizontal overflow, map selection/pan and no-JavaScript fallback: 0 failures.
- Reading-mode test: 6 checks across 1280/390 px and all three episodes (chapter-only mode hides interludes, returning to scroll mode restores them, Alt+P opens/closes Classroom Theater): 0 failures.
- Three interlude test: 6 desktop/mobile checks, three source links, nonempty alternative text, successful `HTMLImageElement.decode()`/nonzero natural widths, reduced motion and no page overflow: 0 failures.
- Existing evidence-stage and causal dossier regression tests: 12 + 12 focused checks passed (including incorrect/correct feedback and non-JS text fallback).
- Route, vote and verdict regression suite: 4 routes × 3 viewports, plus interactive vote and evidence verdict checks: no problems.
- Automated axe WCAG 2.0/2.1 A/AA: eight page/viewport scans (four routes at 390px and 1440px) **zero detected violations** after repairing the keyboard-inaccessible mobile map scroll region; six theater-open automated scans also zero detected violations. This does **not** constitute native screen-reader certification.
- Desktop, projector-sized and mobile screenshots inspected. Final map captions stay outside the panning viewport; photo interludes were rechecked after lazy-image decoding and overlay adjustments.

## Primary evidence reviewed
- GHDI July 5, 1914 German assurance (diplomatic report): https://germanhistorydocs.org/en/wilhelmine-germany-and-the-first-world-war-1890-1918/ghdi:document-800
- Open University July Crisis chronology (Russian general mobilization July 30): https://www.open.edu/openlearn/history-the-arts/history/world-history/the-july-crisis-chronology
- National Army Museum 4 August 1914 German invasion: https://ww1.nam.ac.uk/timeline/germany-invades-belgium/
- Other source links and image rights: `storyhub/stories/USH9/LONGFUSE/sources.md`.

## Still outstanding
- Manual on-device Promethean/teacher input acceptance and school network behavior; digital viewport tests are not physical-board tests.
- Real NVDA/Narrator speech/listening validation and independent accessibility certification.
- Commercial licensing review of all media and source text prior to paid redistribution.
- No GitHub merge, production deployment or actual student-data modification in this batch.

**Files:** `LongFuseDecisionMap.astro/.css`, `LongFuseInterlude.astro/.css`, `LongFuseClassroomTheater.astro/.css`, component wiring, Story Hub interaction manifest, dedicated Playwright tests and screenshot previews.
