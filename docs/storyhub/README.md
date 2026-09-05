# StoryHub production system

StoryHub is the bespoke interactive lesson format for grant-desk.com. The repeatable unit is the production discipline, not the visible design.

## Core principle

**StoryHub does not have a house look. StoryHub has a house level of craft.**

Every story defines its own tone, palette, typography, texture, shape language, motion grammar, interaction signature, density rhythm, archival behavior, and ending language before coding begins. USH9 L014 is Reference Implementation 001, not a template.

## Fast path

1. Create a story scaffold: `npm run storyhub:new -- USH9 L015 "Lesson title"`.
2. Fill `story-dna.json` before generating assets or writing the visible interface.
3. Fill `story.json` with the narrative argument, chapters, and named-person visual-anchor decisions.
4. Plan assets in `assets.json`; prefer source-first stylization when strong historical visual evidence exists.
5. Plan only meaningful interactions in `interactions.json`. Every interaction must state what it teaches and what feedback changes.
6. Record source/provenance notes in `sources.md`.
7. Run `npm run storyhub:validate` before build/release. The canonical `npm run verify` also includes StoryHub validation.

## Storage split

- Google Drive is the master/archive layer: original references, high-resolution masters, alternates, rejected variants, private source registers, and anything not cleared for public redistribution.
- GitHub is the deployable layer: approved optimized public assets, public manifests, StoryHub runtime code, validation, and student-safe source notes.
- Never commit student records, credentials, private teacher inventories, restricted source files, or local filesystem paths.

## Production sequence

Research → narrative architecture → Story DNA → named-person/source audit → asset plan → batch asset generation → asset review → targeted regeneration → asset-to-interface translation → interaction/motion plan → responsive build → historical QA → visual QA → performance/accessibility QA → publish → archive learnings.

See [GOLD_STANDARD.md](GOLD_STANDARD.md) for the experience standard.