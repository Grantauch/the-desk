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

## StoryHub release fast lane

StoryHub-only releases now use a focused release lane instead of proving every unrelated GrantDesk subsystem again.

The fast lane is allowed only when the diff is limited to:

- catalogued standalone StoryHub HTML under `public/hubs/`
- lesson-specific public assets under `public/storyhub/`, excluding the shared runtime
- StoryHub manifests and public source notes under `storyhub/stories/`
- the StoryHub catalog in `src/data/storyhubs.ts`
- a course page change whose only semantic difference is its `storyhub: { ... }` block

Those releases still run StoryHub manifest/provenance/asset validation, Astro/TypeScript checks, a production build, static-site/link validation, and focused browser/accessibility checks at 320 px, 390 px, desktop, and reduced motion for the changed StoryHub routes.

Any shared runtime, workflow, dependency, component, Hall Pass, classroom-state, resource-publishing, configuration, or unrelated course-page change fails closed to the full `npm run verify` plus the full browser suite. If the classifier cannot establish a trustworthy comparison base, it also selects the full lane.

GitHub keeps the required protected-branch check named `build`; the lane changes what that check verifies, not whether the check is required. Netlify uses the same release-aware verification and falls back to the full gate when its previous-commit reference is unavailable.

## Storage split

- Google Drive is the master/archive layer: original references, high-resolution masters, alternates, rejected variants, private source registers, and anything not cleared for public redistribution.
- GitHub is the deployable layer: approved optimized public assets, public manifests, StoryHub runtime code, validation, and student-safe source notes.
- Never commit student records, credentials, private teacher inventories, restricted source files, or local filesystem paths.

## Production sequence

Research → narrative architecture → Story DNA → named-person/source audit → asset plan → batch asset generation → asset review → targeted regeneration → asset-to-interface translation → interaction/motion plan → responsive build → historical QA → visual QA → performance/accessibility QA → publish → archive learnings.

See [GOLD_STANDARD.md](GOLD_STANDARD.md) for the experience standard.
