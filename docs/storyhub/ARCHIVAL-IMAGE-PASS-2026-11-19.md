# Source-first visual replacements — November 19, 2026

This batch replaces three Story Hub catalog illustrations, six in-lesson narrative SVG appearances, and one explicitly labeled portrait placeholder with documented primary-source media. **Existing local SVG files are retained for rollback and as fallbacks where noted.** No PIN gate, answers, saving, or Turn In code was modified.

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

## Additional labor primary sources

- Scene 4 (*Pittsburgh*) now uses an August 11, 1877 *Harper's Weekly* engraving of the burning Union Depot during the Great Railroad Strike. Source: https://commons.wikimedia.org/wiki/File:Harpers_8_11_1877_Destruction_of_the_Union_Depot.jpg. This is a **period engraving**, not a photograph or literal snapshot of every destroyed locomotive.
- Scene 11 (*Monongahela*) now uses the 1892 Kurz & Allison *Great Battle of Homestead* lithograph, held by the Library of Congress. Source: https://www.loc.gov/item/2003656885/. It is clearly labeled an **artistic interpretation published at the time**, not a photograph or direct eyewitness transcript.
- In both scenes the former local authored SVG remains an image-load fallback; the displayed captions distinguish an original period print from direct photographic evidence.

### Original Pullman company-housing record (scene 12)

- The previous generic repeating-brick-house SVG in L015 scene 12 is now replaced by the 1894 *Frank Leslie's Illustrated Newspaper* page **The town of Pullman, Illinois—the homes and wages of the Pullman operatives**, a plate of ten historical halftone illustrations. It is not a single camera photograph of a street.
- Original/source and rights: [Library of Congress, LCCN 95511227](https://www.loc.gov/pictures/item/95511227/); digitized image `https://cdn.loc.gov/service/pnp/cph/3c10000/3c14000/3c14600/3c14674v.jpg`. The LOC describes no known publication restrictions; 1894 publication is US public domain.
- The plate is presented uncropped as an actual newspaper page, with a visible attribution/source link; the prior local SVG remains the load-failure fallback. On small displays, readable lesson copy remains HTML and does not depend on reading the original newspaper scan.

### Haymarket: two 1886 primary-source publications (scenes 7–8)

- **Scene 7:** `/hubs/ush9-l015-who-showed-up.html` uses a *Frank Leslie's Illustrated Newspaper* wood engraving published **15 May 1886**, attributed to C. Bunnell and Charles Upham. This is a **published sketch made for a newspaper, not a photograph**. Its source caption characterizes participants as “murderous rioters,” a loaded editorial label **not adopted by our lesson**. Image held at the [Library of Congress, LCCN 96506773](https://www.loc.gov/item/96506773/); digitization: `https://cdn.loc.gov/service/pnp/ds/04500/04514v.jpg`. Public domain: published 1886.
- **Scene 8:** uses an **1886 Inter Ocean Co. printed Haymarket trial broadside** that reproduces portraits of the defendants, lawyers, jurors and police. These are historical likenesses, not generated faces. It is a later published compilation, not a photograph of everyone together at a single moment. Source [Library of Congress, LCCN 2008680516](https://www.loc.gov/item/2008680516/); digitization: `https://cdn.loc.gov/service/pnp/ppmsca/19500/19510v.jpg`. Public domain: published 1886.
- Lesson captions distinguish the exact type and viewpoint of each publication, provide a route to the original record, and retain the existing SVGs as on-error fallbacks. No assertion about guilt is derived merely from contemporary editorial labeling.

### Haymarket defendants (scene 9) — actual dated jail portraits

- Scene 9 now shows the surviving **May 3, 1887 John Joergen Kanberg portrait composite** of August Spies, Albert Parsons, Louis Lingg, George Engel, and Adolph Fischer, made in the Chicago county jail before their deaths. It includes the defendant who died by suicide on November 10 rather than treating the group as exclusively the four men executed on November 11.
- Archival record: [Library of Congress 93513661 / Wikimedia Commons public-domain scan](https://commons.wikimedia.org/wiki/File:J._J._Kanberg_-_The_Five_Chicago_Anarchists-2.2R_V01-2.1_LoC.jpg); 1887 historic portrait, **not** a photograph of executions.
- The source is presented at restrained size with the list of actual events as live HTML. The former jail corridor SVG remains a load-failure fallback.

### Scene 10: fortified Homestead works in the period press

- Scene 10 replaces a generic imaginary Fort Frick fence with a real *Harper's Weekly* wood engraving published **July 23, 1892**, depicting the Eighteenth Regiment marching past the Carnegie company works on **July 12, 1892**. Original published work [Library of Congress LCCN 2004678727](https://www.loc.gov/item/2004678727/), [Commons source](https://commons.wikimedia.org/wiki/File:The_First_Troops_in_Homestead._The_Eighteenth_Regiment_passing_the_Office_and_Works_of_the_Carnegie_Company,_July_12,_1892_LCCN2004678727.jpg). **It is not a photograph of the initial June 28 lockout or literal fence construction**. Published wood engraving; U.S. public domain.
- Scene 3 (rail communication), scene 13 (federal injunction), and scene 14 (comparative use of power) now have substantive **native HTML explanatory diagrams**, rather than generic background pictures. All identify themselves as diagrams, comparisons or classroom summaries rather than historic maps, documents, or direct quotations.
- Scene 13's legal summary links to the [Federal Judicial Center primary-source compilation](https://www.fjc.gov/sites/default/files/trials/debs_psa.pdf). This explanatory panel does not claim to reproduce the original July 2 order verbatim.
- On small screens the supplemental diagram falls into a reduced panel beneath the lesson copy; test mobile readability and vertical overlap visually before release approval.

### Scene 5 and 6: the final authored visual placeholders now teach

- Scene 5 replaces the invented armory façade with an **architectural-purpose panel**: building / arsenal / institution. The entry links to the [Encyclopedia of Chicago's armories history](https://www.encyclopedia.chicagohistory.org/pages/1736.html). The panel is an editorial explanation, not a picture of a specific named armory and not evidence that all armories were constructed in 1877.
- Scene 6 replaces a generic factory clock with a **24-hour budget comparison** showing 12 work / 8 sleep / 4 personal against 8 work / 8 sleep / 8 personal. It explicitly says that 12 hours is an *illustrative* previous workday, not a nationwide 1886 average. Eight-hour movement source: [Smithsonian National Museum of American History](https://americanhistory.si.edu/explore/stories/may-day-americas-traditional-radical-complicated-holiday-part-2).
- These changes complete a **14/14 primary scene visual-substrate upgrade** for `USH9-L015`. Eight scenes use source-labeled period visuals; six use authored HTML explanatory graphics. None of the primary 14 scene images are the original generic illustration SVG. The old local SVG assets remain in the repository as load-error fallbacks for external period images, not as primary rendering assets.
- **Approval still requires actual mobile and classroom-browser screenshots**. Static code review alone does not establish that the multiple source panels are readable or non-overlapping on 360–450px phones and a 1366px Chromebook. Make corrections if any overlay is problematic before merge; do not bypass the site integrity gate.

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
