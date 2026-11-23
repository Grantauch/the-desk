# USH9 L015 · Who Showed Up — source-first visual replacement brief
20 November 2026 · issue #422 · source selection and production brief, **not released artwork**

## Problem and non-negotiables

The lesson currently embeds 14 small, flat `a01`–`a14` SVG scenes; they are editorial scene sketches, **not archival primary sources**. Replace images used to depict historical places/people with authentic period photographs, drawings, engravings, paper records and newspaper pages. Keep SVG only for functioning diagrams/maps with meaningful data, not as a scenic shortcut. Keep the existing narration, mathematics, interactive instruments, answer prompts, classroom PIN and Turn In exactly as-is. Do not replace one obviously AI-created scene with another. Do not imply that an 1877 print is an eyewitness camera photograph or that an undated image depicts a named battle.

## Scene-level replacement queue

| Scene | Purpose | Source-first replacement direction | Evidence / action |
|---|---|---|---|
| A01 rail yard | Opening: strike years and rail infrastructure | Period rail-yard photograph dated to the era **and place where possible**; if unavailable, build an honest archival typographic opening rather than a falsely specific scene | Find rights-cleared 1877–1894 railroad image; verify railroad, location/date; retain large quiet overlay area |
| A02 Martinsburg | 1877 blockade and local militia | Contemporary *The great strike—Blockade of engines at Martinsburg* print, clearly credited as a print derived from D. Bendann's photograph | [LOC, cph.3c25624](https://www.loc.gov/resource/cph.3c25624/); inspect original and label mixed composite carefully |
| A03 telegraph | How the national rail network spread news | Verified period telegraph key or dispatch page, paired with native HTML rail-network instrument | Museum image still to research; preserve the functioning fourteen-day network model |
| A04 Pittsburgh | Ruins after 1877 confrontation | Period print of burned roundhouse and railway shops; no fake overturned train | [LOC, 1877 principal strike points](https://www.loc.gov/pictures/item/2007675388/) and [Pittsburgh burning and aftermath](https://www.loc.gov/resource/cph.3b09311/) |
| A05 armory | How troops were prepared | Verified period armory / National Guard fortification photo from documented city and decade, labeled by place | Source pending; avoid invented signage, geometry, or a guessed building |
| A06 factory clock | Eight-hour-day demand | Museum-held factory clock, time card, or workers' schedule, captioned as a **representative object** if not this specific dispute | Source pending; keep native working workday dial usable |
| A07 Haymarket square | Labor protest and lethal force | Contemporary Haymarket newspaper engraving or historically documented image with date and clear medium | Research LOC/Chicago History Museum sources; do not claim any aftermath print is a photograph of the actual moment |
| A08 court record | Trial and evidence of Chicago defendants | Reproduction of authentic Haymarket trial newspaper or legal record; no simulated official seal or fake manuscript | Verify document caption, provenance and legible crop; retain evidence-sorting controls |
| A09 jail / pardons | Executions, reprieves and Altgeld | Source-derived portrait of Gov. John Peter Altgeld and contemporaneous pardon text, paired with typographic dated sequence | Find portrait + original pardon document; no fabricated jail corridor |
| A10 Fort Frick | Homestead fortification and Pinkerton escalation | Verified period Homestead mill / fortification photo or engraving, with scene-specific dimensions cited | [LOC, Homestead strike 1892](https://www.loc.gov/item/2005684354/) |
| A11 Monongahela | Barges arrive and fighting begins | Original newspaper illustration of landing and barges, visibly labeled a contemporary drawing | [Wikimedia Commons, 1892 Battle at the Landing](https://commons.wikimedia.org/wiki/File:The_Battle_at_the_Landing_Homestead_Strike_of_1892.jpg) or [LOC/Commons contemporary print](https://commons.wikimedia.org/wiki/File:Homestead_riot_harpers_3c26046v.jpg). Verify original |
| A12 Pullman houses | Company town and 1894 dispute | Contemporary Pullman factory or company housing image; can show workers' gate if date/location confidence documented | [LOC, Pullman workers' gate — strike attribution uncertain](https://www.loc.gov/resource/cph.3c30360/); label uncertainty rather than laundering question mark into certainty |
| A13 injunction paper | Federal courts and Debs | Actual 1894 injunction text or reproduced court order, with real source and accessible transcript | Research legal archive; do not fabricate language or judge signature |
| A14 ladder | Escalation from local to national coercion | **Native HTML explanatory ladder/scale**, with genuine historical citations as expansion panels; this is a functional data comparison rather than scenery | Replace decorative perspective SVG only after the interaction remains keyboard/touch accessible and conceptually equivalent |

## First four high-confidence archival research links

1. [LOC: Great Railroad Strike, scenes across states, 1877](https://www.loc.gov/pictures/item/2007675388/)
2. [LOC: Martinsburg blockade print](https://www.loc.gov/resource/cph.3c25624/)
3. [LOC: Pittsburgh roundhouse and ruins, 1877](https://www.loc.gov/resource/cph.3b09311/)
4. [LOC: Homestead Strike, 1892](https://www.loc.gov/item/2005684354/)

These are **source candidates**, not yet approved media. Historical-date accuracy, attribution, LOC rights/advisory record, digital reproduction quality and classroom redistribution must be checked individually. Reproductions of newspapers/prints must retain an image caption identifying the work's date, author if known, and **medium** (engraving/print vs photograph). A contemporary depiction is not necessarily a photograph or reliable eyewitness record.

## Visual direction

- Museum-grade documentary editorial art direction; dramatic framing may come from cropping, scale, strong typesetting, tonal treatment and purposeful motion, **not** invented soldiers or fake archival artifacts.
- Each historic image has a small visible source/date label. Provide a click/tap-to-inspect original that opens a safe external source page, not a made-up image-credit line.
- No text burned into images; all lesson text remains accessible native HTML. Protect foreground contrast with per-scene treatments; preserve usable safe zones at 390px, Chromebook and Promethean board widths.
- Keep functional interactive diagrams, variable sliders, event sequence and Turn In forms untouched until visual review. Avoid replacing authentic historical photographs with AI generations.
- Optimize locally into WebP/JPEG as justified; keep high-resolution public-domain source and private rights records in approved archive; do not link active classroom images to third-party hosts.

## Gate for each replacement batch

Record before-and-after rendered screenshots (title and interactive screen) at 390 / 1366 / 1920px, source rights and archival link, truthful alt text and caption, final bytes/dimensions, keyboard/touch/reduced-motion result, and any interactive state regression. Update `storyhub/stories/USH9/L015/assets.json` and `storyhub/releases/USH9-L015.json` in the same change. Run `npm run storyhub:validate`, `npm run verify`, CI and live deployed route verification. **Do not classify this research brief itself as an image replacement or live release.**
