# Source-first visual replacements — November 19, 2026

This batch replaces three Story Hub catalog illustrations, three in-lesson narrative SVG appearances, and one explicitly labeled portrait placeholder with documented primary-source media. **Existing local SVG files are retained for rollback and as fallbacks where noted.** No PIN gate, answers, saving, or Turn In code was modified.

## 1. Hidden History — The Hangman of Nuremberg

- Catalog: `hh-bytesize-nuremberg`; hero background and courtroom evidence figure on `/hubs/hh-bytesize-nuremberg.html`.
- Image: *The Case Against the Defendents* [sic], U.S. Army Signal Corps (WW II Signal Corps Photograph Collection). Robert H. Jackson presents evidence in the Nuremberg courtroom.
- Source and reuse: https://commons.wikimedia.org/wiki/File:US_Army_51610_The_Case_Against_the_Defendents.jpg
- Public-domain rationale: created by a U.S. Army employee in official duty; Commons labels it PD US Army.
- Historical limitation: source listing's 2009 date is a publication/digitization date, **not** the photograph's date. The photograph illustrates the trials in 1945–46, **not** the later October 1946 executions.
- The HTML figure and cover both label it as an actual trial photograph; do not label this as a photograph of the execution scene.

## 2. U.S. History — Who Showed Up

- Catalog: `ush9-l015-who-showed-up`; scene 1: actual 1894 crowd at the Pullman Strike, replacing `a01-rail-yard.svg` visual.
- Image: *Pullman strike, 1894 (NBY 1375)*, Newberry Library photograph.
- Source: https://commons.wikimedia.org/wiki/File:Pullman_strike,_1894_(NBY_1375).jpg
- Rights: public domain due to pre-1931 publication/age; Commons and Newberry public reuse statements.
- Scene 2: image of railroad blockade in Martinsburg, replacing `a02-martinsburg.svg` visual.
- Image: *Blockade of Engines at Martinsburg, West Virginia*, *Harper's Weekly*, August 11, 1877. It is a period **engraving** rather than a camera photograph.
- Source: https://commons.wikimedia.org/wiki/File:Harpers_8_11_1877_Blockade_of_Engines_at_Martinsburg_W_VA.jpg
- Rights: published in 1877; public domain.
- Preserve all remaining 12 authored vector scenes pending individual QA. An interactive or historically meaningful SVG is not automatically low quality.

## 3. Beyond the Scoreboard — Not in the Room

- Catalog: `bts-l03-not-in-the-room`. Replaces the catalog's ledger-illustration preview with the original 1876 *Chicago White Stockings* lithograph. This image depicts players and their manager, **not** the National League's club-owner meeting. That distinction is central to this lesson.
- Lithograph source: https://commons.wikimedia.org/wiki/File:1876_Chicago_White_Stockings.webp
- Rights: 1876 publication, public domain in the United States.
- Historical person anchor: the text-only William Hulbert placeholder in the meeting chapter now uses an authentic period portrait with a visible source link, plus a concise identification.
- Hulbert portrait source: https://commons.wikimedia.org/wiki/File:William_Hulbert_Baseball.jpg
- Rights: public domain; source attributed to the National Baseball Hall of Fame by Wikimedia Commons. The available derivative is low-resolution, so it must not be enlarged into a full-screen image.

## Delivery limitation and follow-up

- This pass links to Wikimedia 1280px JPG derivatives directly in HTML. It avoids embedding uncopyrighted binary images without known provenance, but **the photographs currently depend on an external media host**. For robust school-network performance, capture these known-good source files as optimized local assets through the approved asset pipeline in a follow-up. No claim of on-site/self-hosted copies is made.
- Where the student HTML `<img>` has an error handler, it reverts to its prior local SVG rather than breaking the scene. The Nuremberg CSS background gracefully falls back to a dark paper/ink presentation.
- Requested next: inspect the remaining L015 scenes and the other two SVG-cover Story Hubs in actual rendered pages, verify third-party host access on a classroom Chromebook, then make source-backed full replacements in small batches.

## Quality checks required before publication

- `npm run verify`; `storyhub:validate`; Astro build + site links.
- Visually compare hero cards and first two scenes at 390px, ~1366px Chromebook, and classroom display; verify body copy contrast against the real photographs.
- Check all source links, credits and alt text. Confirm photo URLs load on the school network.
- Check reduced motion, keyboard navigation, image failure states and no changes to student work persistence.
