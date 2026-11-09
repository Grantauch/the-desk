# Cinematic Atlas — homepage 2.0 first implementation

Owner: ChatGPT Work, following Grant’s approved Cinematic Atlas direction.
Branch: `feature/cinematic-atlas-v2`. Review work; production publication and
physical school-device acceptance are separate gates.

## Behavior

- The homepage opens with its existing check-in and hall-pass shortcuts,
  a bronze-and-blue real-time globe, a cumulative history-year control,
  illustrated course entrances and the existing classroom destinations.
- “Drag to explore”, or a pointer press on the globe, opens a native modal
  dialog. The existing atlas DOM moves into it; a second renderer is not
  created. The rest of the page becomes inert through native dialog behavior.
- Escape and “return to desk” move the same atlas back, restore scroll position
  and return focus to the initiating control. The classes control returns to
  the course section. Classroom shortcuts remain in the focus view.
- Drag, arrow keys, rotate buttons and bounded zoom controls all work. The
  mouse wheel zooms only in Explore mode, preserving ordinary page scrolling.
  Touch scrolling remains available on the homepage; Explore captures drags.
- History markers identify the setting of existing lessons. Present-day
  geography stays fixed; the slider says **history through** and filters the
  available stories cumulatively. It does not claim to reconstruct borders.
- Front-facing markers are projected from real latitude/longitude and clipped
  against the globe horizon. Nearby labels group into a selectable cluster.
  The story chooser exposes every result even when a marker is behind Earth.
- History/news/both filters are in Explore mode. News loads only on request
  from the existing `headlines` function, with a 15-second timeout. A small
  conservative headline-place matcher leaves unknown, multiple and known
  ambiguous locations unplaced. The panel labels the basis as a headline
  match; coordinates are not verified event positions. Articles without a
  valid recent date are omitted. Clicking the layer again retries outages;
  selections older than five minutes request a refresh.
- News retains the publisher, publication date and original HTTPS URL. No
  publisher photographs are loaded. Only the four configured publishers are
  accepted, with a hostname check and bounded result count.

## Rendering and delivery

The local MIT Three.js distribution already used by Over There is reused;
no new production package, CDN or runtime service is introduced. NASA Earth
imagery supplies the equirectangular surface. A credited CC BY 4.0 normal map
supplies exaggerated lighting relief. A separate sphere carries the NASA
cloud mask, with slow drift and an offset shadow sample on the surface.
Bronze material, relief strength, grid, cloud height and atmospheric rim are
art direction, not measurements or a live weather product.

Device pixel ratio is capped at 1.5 (1.25 on small screens). Texture and course
art delivery has a 2 MB test budget. Rendering stops offscreen and while the
document is hidden. Reduced motion starts with stationary clouds; deliberate
camera controls remain usable. A map image and complete story index remain
available when JavaScript, the renderer or a texture fails. Context loss
returns to that view and a restored context can resume without a reload.

Image credits and original records are public at `public/atlas/SOURCES.md`.
Original/reference files stay outside this repository. The initial course
art is an optimized crop from the approved illustrated design; dedicated
high-resolution card masters remain an art-quality follow-up. The original
image generation budget was exhausted during this implementation.

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

### November 9 local acceptance

The seven data/delivery checks and all 15 browser scenarios pass. Tests use
local Chromium with software WebGL and offline news fixtures. The 14
JavaScript-enabled scenarios report no WCAG A/AA violations or uncaught
JavaScript/shader errors. Four viewports include 1366×768 and 320×740.
Physical devices, school networks and live news are not established by these fixtures.
