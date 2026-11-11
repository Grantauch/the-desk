# Cinematic Atlas — homepage 2.0

Owner: ChatGPT Work, following Grant’s approved Cinematic Atlas direction.
Branch: `feature/cinematic-atlas-v2`. Review work; production publication and
physical school-device acceptance are separate gates.

## Behavior

- The homepage opens with its existing check-in and hall-pass shortcuts,
  a bronze-and-blue real-time globe, a cumulative history-year control,
  illustrated course entrances and the existing classroom destinations.
- “Drag to explore”, a mouse press, a touch tap or a horizontal touch drag
  opens a native modal dialog. The globe stays with the gesture as the desk
  fades away and the camera centers on Earth. The same canvas moves into the
  dialog and the rest of the page becomes inert.
- Escape and “return to desk” move the same atlas back, restore scroll position
  and return focus to the initiating control. The classes control returns to
  the course section. Classroom shortcuts remain in the focus view.
- The focus view groups story layers, the timeline and the camera controls in
  one tray. A live coordinate readout tracks the camera as the globe turns.
- Drag, arrow keys, rotate buttons and bounded zoom controls all work.
  Explore supports smooth wheel zoom and two-finger pinch. The mouse wheel
  preserves ordinary page scrolling outside Explore.
  Vertical touch scrolling remains available on the homepage. Explore
  captures globe drags in both directions.
- History markers identify the setting of existing lessons. Present-day
  geography stays fixed; the slider says **history through** and filters the
  available stories cumulatively. It does not claim to reconstruct borders.
- Front-facing markers are projected from real latitude/longitude and clipped
  against the globe horizon. Nearby labels group into a selectable cluster.
  The story chooser exposes every result even when a marker is behind Earth.
- History/news/both filters are in Explore mode. News loads only on request
  from the existing `headlines` function, with a 15-second timeout. A small
  conservative headline-place matcher leaves unknown, multiple and known
  ambiguous locations unplaced. Broad state and country matches use
  approximate regional reference points and are labeled in the panel.
  The exact event coordinates are not inferred. Articles without a
  valid recent date are omitted. Clicking the layer again retries outages;
  selections older than five minutes request a refresh.
- News pins use publisher colors with a labeled key. Clusters that combine
  history and news have a two-color border.
- The satellite toggle requests a current EUMETSAT mosaic through a bounded,
  cached same-origin function. It stays aligned to Earth. Unavailable or
  invalid imagery leaves the illustrated cloud layer available for retry.
- News retains the publisher, publication date and original HTTPS URL. No
  publisher photographs are loaded. Only the four configured publishers are
  accepted, with a hostname check and bounded result count.

## Rendering and delivery

The local MIT Three.js distribution already used by Over There is reused;
no new production package, CDN or runtime service is introduced. NASA Earth
imagery supplies the equirectangular surface. The editable Blender master
combines NASA topography, two cloud shells, a blue-hour fill and an amber
solar key. Its terrain profile is exported as a 145 × 97 lattice of byte
heights for the live globe. A credited CC BY 4.0 normal map adds fine relief.
The browser shades wisps, banks and tall cores from a single drifting cloud mask, with one ground shadow. A soft atmosphere and ocean sunglint follow the
lighting direction. The globe floats gently while idle and settles when
someone points at it, moves focus to it, or drags. Pausing cloud motion
also stops the float. Deep zoom can load a sharper NASA texture.

Device pixel ratio is capped at 1.5 (1.25 on small screens). Texture and course
art delivery has a 2 MB test budget for the largest single-size selection.
Rendering stops offscreen and while the document is hidden. Reduced motion
uses an instant mode change and starts with stationary clouds. The Blender
portrait loads immediately and a complete story index remains
available when JavaScript, the renderer or a texture fails. Context loss
returns to that view and a restored context can resume without a reload.

Image credits and original records are public at `public/atlas/SOURCES.md`.
The three woodcut-style illustrations are composed directly from archival
references. Lazy responsive images supply 480-pixel or 840-pixel artwork,
with a 1440-pixel option for large high-density displays.
The website credits the holding institutions and links to each original.

## Verification

- `npm run atlas:test` checks lesson destinations, coordinate orientation,
  recent dated news, ambiguous places, source/URL validation, stale and future
  dates, duplicate feeds, caps and the delivery budget.
- `npm run atlas:browser` uses the built site at four viewport sizes, offline
  external services, synthetic news and real local WebGL rendering. It checks
  first-screen classroom shortcuts, native modal focus/return, year filtering,
  story selection, dated news, outages, renderer/texture failure and no-JS
  navigation, plus direct dragging, camera controls, clusters, live reduced-motion
  changes and real graphics-context loss/recovery. JavaScript-enabled cases
  receive WCAG A/AA checks. Axe itself
  requires JavaScript, so the no-JS case checks native markup navigation.
- Canonical `npm run verify` includes the atlas data tests; the full browser
  lane includes its focused browser suite. Required protected checks still
  apply. Software-rendered desktop tests do not establish real Chromebook FPS
  or school-network acceptance.

Inspect `browser-results/atlas/report.json` for actual current outcomes. Do not
interpret implementation, a passing local build or a draft PR as deployment.

### November 9 atmosphere pass acceptance

Nine data, satellite relay and delivery checks and 17 browser scenarios pass. The browser
checks include mouse capture across the modal transition, keyboard focus
return, vertical touch scrolling, and horizontal touch dragging with scroll
restoration. The suite also checks pinch zoom, optional detail textures,
satellite fallback and publisher colors. Chromium used software WebGL and
offline fixtures at four viewport sizes. The 16 JavaScript-enabled scenarios
reported no WCAG A/AA violations or uncaught JavaScript and shader errors.
Physical school devices and school networks are outside this acceptance run.
