# Story Hub 2.0

Pearl Harbor is the first edition on the Astro Story Hub 2.0 foundation. Its route is /storyhubs/pearl-harbor/. The Story Hubs catalog links directly to the edition and supplies its sitemap entry. The edition includes its own historical briefing. A catalog that adds a generic introduction can send this entry straight to the edition.

## Author an edition

1. Start with the Story DNA, narrative claim and a plan for the evidence. Follow the [StoryHub production standard](GOLD_STANDARD.md). Pearl Harbor’s package lives in [USH9/PEARL](../../storyhub/stories/USH9/PEARL/).
2. Add your data as a typed StoryEdition. Give the historical work, edition, chapters, people, events, places, notes and evidence stable IDs. Use explicit references from chapters and records. The build rejects dangling references, invalid IDs and missing map or timeline records.
3. Add an Astro page that uses StoryShell, StoryIntro and the reference components. Use StoryChapter for a chapter layout or provide your own semantic sections with data-story-chapter, a heading and a chapter navigation region. The Pearl Harbor route shows how a subject-specific feature fits into a chapter.
4. Give the edition its own photographic direction, page layout and CSS. StoryShell takes a theme class and uses named CSS properties for color, type, reading width and interaction appearance. The companion consumes the same cast, map, chronology, glossary and source records that the opening briefing uses.
5. Add the entry to src/data/storyhubs.ts. Keep its href and the edition route aligned. Treat the edition ID and chapter anchors as permanent once students have bookmarks. Use a new edition identity when a new reading or assignment edition needs its own state.

## Reusable components

| Component | What it provides |
| --- | --- |
| StoryIntro | The five teaching sections and entry into the story. |
| HistoricalTimeline | A dated chronology, scale selection, timeline scrubbing, evidence and shareable event anchors. |
| HistoricalMap | Locally hosted map plates, pan and zoom, keyboard location list, historical layers and source captions. |
| MeetTheCast | Profiles, biography disclosures and connections to places and events. |
| HistoricalContext | Topic notes, glossary, source index and archival media. |
| ContextualCompanion | Responsive dock and panel, chapter awareness, related record selection and focus restoration. |
| StoryNavigation | Chapter index, reading settings, projector view and optional single-chapter view. |
| HistoricalMediaViewer and HistoricalAudio | Attributed images, magnification, transcripts, locally hosted audio and failure fallbacks. |

## Content rules

- Historical dates use the time shown to readers. The numeric timeline uses a UTC number line to preserve those labels across device time zones. Use ISO dates or ISO dates with hours and minutes, without an offset. Attach a time-zone explanation and label precision honestly.
- Give each map plate a source and a stated projection or image orientation. Positions are percentages of that plate. Add typed place IDs and historic layers to make timeline selections meaningful on the map. Include a readable location list and source caption.
- Cross references use a kind and stable ID. ReferenceLink adds a working anchor to the briefing or archive and enhances that link into the panel. Chapter metadata provides the initial references. A direct choice, such as a place in the map, provides related timeline and cast selections.
- Use local, rights-cleared derivatives for core media. Maintain item-level research links, credits, alt text and captions. Keep masters outside the public site. Seal optimized bytes using the established Story Hub asset tool. The Pearl Harbor release manifest seals the static assets. Its built-page test verifies the generated Astro route and canonical URL.
- Explain the purpose, feedback and fallback for every special interaction. Keep the essential historical argument in server-rendered HTML.

## Classroom use

The Pearl Harbor edition is open for exploration. Reading preferences and the last chapter are stored in the current tab’s session storage. The page connects to no account system.

For a story with assigned work, point the edition’s activity metadata to the approved GrantDesk classroom assignment and retain its save identity. Use the existing PIN, save, recovery, audit and Turn In implementation on that assignment route. Keep the introduction teaching-only.

The chapter index offers Text view, Larger type, Chapter view and Projector view. A teacher can link to a chapter with the path /storyhubs/pearl-harbor/?present=1&mode=chapter#warnings. A standard chapter or event link opens the scrolling edition.

## Verify and publish

- Run npm run verify for the canonical site gate. Shared Story Hub components use the full release lane under the current classifier.
- Run npm run storyhub:pearl:browser against built output. It covers catalog discovery, all five briefing sections, keyboard and touch, synchronized tools, reading position, media failures, projector view and responsive accessibility.
- Use the protected GitHub pull request. Netlify builds grant-desk.com from main. Check the published Netlify revision, then open the public route independently and verify its chapter index, reference panel, images and audio.
