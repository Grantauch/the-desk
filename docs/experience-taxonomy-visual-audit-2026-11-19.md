# Games, simulations, Story Hubs: taxonomy and visual quality audit

Date: 2026-11-19
Scope: current `main` catalogs, without private student data. This is an initial source/asset audit, **not** a screenshot-by-screenshot visual approval.

## The navigation problem

- `src/pages/games.astro` previously mixed competitive games, quiz practice, source investigations, strategy simulations, 3D reconstructions, and guided map journeys.
- `src/pages/simulations.astro` previously presented five instructor-led activities (debates, seminars, research projects) before any interactive decision model.
- `src/data/storyhubs.ts` separately catalogs 77 published entries at the release checkpoint; some include working models and deserve cross-discovery rather than destructive relocation.
- Catalog entries are now centralized in `src/data/interactiveExperiences.ts`: 17 games, 9 simulations, 6 investigations and 5 practice activities. This classifies the 37 entries from the original Games source array only; it does **not** count unpublished branches or claim the whole site has only 37 experiences.

## Taxonomy contract

- **Game:** challenge, play loop, adversary, score, competition, or expressive sandbox; history can enrich the game without changing its primary mode.
- **Simulation:** manipulate a historical or modeled system, explore consequences, make scenario choices, or interact with a reconstruction. Explain model assumptions and distinguish historical events from hypothetical outcomes.
- **Story Hub:** original authored narrative grounded in sources, with interactions whose primary job is to reveal the story. Source/provenance and narrative ownership remain in the Story Hub catalog.
- **Investigation:** weigh documents, test assertions and construct an evidence-based verdict; not framed as a competitive game.
- **Practice:** quizzes, drills, flashcards and timeline builders. Surface in an honest subsection rather than calling everything a game.
- **Classroom fieldwork:** teacher-led debates, mock hearings, seminars and research projects. Preserve documents and their existing URLs, but distinguish these from computer simulations.

An experience can have a secondary discovery route (e.g. a Story Hub with a contagion model). One canonical URL and Turn In implementation must remain unchanged.

## Image problems: first concrete inventory

Catalog covers previously referenced **five SVG illustrations**. This branch replaces the cover of *The Line That Wouldn't Move* with a documented 1916 John Warwick Brooke / IWM Q 4135 photograph already present and credited in that exact lesson, leaving four SVG catalog covers to review:

1. `/storyhub/hh/nuremberg/cover.svg` — *The Hangman of Nuremberg*; needs sourced tribunal imagery or a carefully constructed documentary treatment.
2. `/storyhub/ush9/l015/assets/a01-rail-yard.svg` — *Who Showed Up*; inspect all fourteen bespoke scene SVGs together, not only the cover.
3. `/storyhub/bts/l03/assets/cover-ledger.svg` — *Not in the Room*; inspect whether the ledger/chair metaphor has enough craft and historical texture.
4. `/storyhub/hh/l06/assets/cover-signal.svg` — *Two Sources*; review against the rumor/Watergate visual evidence and interface.

Six covers explicitly describe generated or AI-authored reconstructions in `coverAlt`, requiring the first authenticity/art-direction pass:

- `ush9-l016-the-one-that-passed` — AI-authored railroad cut.
- `ush9-l016b-they-said-no` — AI-authored steamship.
- `ush9-s01-the-margin` — generated dam-road cyanotype reconstruction.
- `hh-s01-the-desk-it-stopped-at` — generated Cold War planning map.
- `bts-s01-the-death-harvest` — generated 1905 tally desk.
- `ush9-l018-the-debt-didnt-move` — generated farm/debt imagery.

These are **source-metadata flags, not claims that each file was visually inspected**. Also review the cinematic-illustration covers for `hh-living-history-01-before-the-web` and `hh-living-history-03-hallways-went-quiet`, and any unlabeled synthetic portraits or scenic artwork.

## Improvements already in this branch

- True games and practice are separately presented on Games; historical models and source investigations move to Simulations.
- Simulations provides cross-links to the documented interactive mechanics inside *They Couldn't Stop*, *Thirty Miles from Paris*, and *Why They Fought*, without moving the Story Hubs themselves.
- All existing hub `href` values and the five teacher-led activity packs stay available.
- `GamePreview.astro` now uses truthful subject-specific cues for Checklings, Pond, Dry County, Blitzkrieg and Robber Barons rather than showing irrelevant basketball, newspaper, or paycheck UI on those cards.
- *The Line That Wouldn't Move* uses a period photograph already present in the hub instead of its catalog SVG cover.

## Rendered release checkpoint

The first rendered check reproduced the legacy theme background overriding all five subject palettes. Blitzkrieg displayed pale title text over the old cream newspaper background. Subject selectors now take precedence over the legacy theme rules, including the title styling. A computed-style regression failed before this correction. Phone, Chromebook and classroom-display acceptance and production evidence are recorded separately from the initial source inventory; this checkpoint does not certify the remaining artwork or every story interaction.

## Required visual production sequence (not yet completed)

1. Capture **actual rendered** game/Story Hub/simulation screens at Chromebook, phone and classroom display widths, including inside interactions. Compare to the original assets, not only catalog covers.
2. Rank issues by student exposure and severity: fake or awkward people, weak SVG scene art, inaccurate maps/equipment, generic AI sheen, unconvincing architecture, mismatched era, unusable text, crop or performance.
3. For historical people and places, retrieve period photography, engravings, documentary artifacts and maps first; confirm provenance/redistribution rights and preserve named-person visual anchors.
4. Use stylization **from** documented source imagery when suitable. Clearly identify reconstructions instead of creating fake photographic evidence. A deliberate game-art style is appropriate for fictional games.
5. Reserve SVG for purposeful interactive maps, controls, charts and linework; redraw or replace SVGs that act as cheap narrative illustrations. Never remove a useful data visualization simply because its file format is SVG.
6. Derive palette, typography, texture, composition, motion and UI controls from each selected art direction. Avoid one reusable fake poster for every hub.
7. Test historical/source accuracy, responsive crops, keyboard/touch, reduced-motion, alt text, asset sizes, contrast, source credits, PIN gate, save/Turn In, and links. `npm run verify` is required before merge and deployment.

## Operational boundaries

- No URLs, PIN verification, private student records, progress-save routines, assignment submissions or classroom roster mechanisms may be changed as part of navigation and image work.
- No source-uncleared media, unverified licensing or imagined historical quotes should be inserted.
- A committed branch, a green GitHub check, a merged PR and a verified live page are four **different** statuses. Don't report live until the deployed site has been checked.
- Remaining visual replacements require actual image review and asset production; source-code analysis alone cannot certify them.
