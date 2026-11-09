# Dry County 0.5: midnight edition

This visual pass builds on the 0.4 map and existing gameplay. Collision footprints, map geography, business entrances, jobs, prices and saved progression are unchanged. The original baseline remains in Git history at `14dc098d44cfa9018329c3deaa06d93cef841b10`.

- A custom illustrated title scene establishes the rainy 1926 setting. The original editable HTML title and buttons remain above the image. The optimized WebP is 312,082 bytes.
- Cooler macadam and richer green parcels separate roads from terrain. Baked stone joints, drains, irregular surface wear and building shadows add depth without new collision objects.
- Roof materials are cached per building and projected onto the roof planes. Gables have individual staggered shingles; flat roofs have seams, aging, skylights and parapets. Windows now follow wall perspective. Small warm pools at business entrances add nighttime orientation.
- Fourteen business interiors have drawn furnishings, stocked shelves, period automobiles, a copper still, a piano/drums, mirrors, booths, beds and tabletop place settings. Cached wood/tile floors, rugs, windows and ambient light replace empty flat room backgrounds. Furniture labels remain and collision rectangles are unchanged.
- A closer camera, quieter grain, restrained dark HUD panels and responsive title layout improve legibility. Street instructions hide while indoors. Rendering and simulation skip hidden tabs and the opaque static title screen; the existing 1.5x pixel cap and adaptive effects quality remain.

## Verification

`node scripts/test-dry-county.cjs` exercises 77 gameplay, geography, economy, collision, save, feedback and AI checks after integration with the police/rival AI release in PR #203. All 77 pass locally. `node scripts/test-dry-county-browser.mjs` retains the three-size business journeys. The added `node scripts/test-dry-county-art-browser.mjs` renders all fourteen rooms with real Canvas images, checks title-button boundaries at 1440x900, 1280x720, 390x844 and 844x390, checks the indoor HUD, and captures daylight/reduced-motion views. Both browser scripts pass on the combined build. Protected CI runs both browser scripts. Screenshots are generated under `browser-results/`.

The initial visual-pass commit passed the full local verification chain and protected GitHub build, and its Netlify preview was checked. The combined release retains the newer `LAW` last-known-position search and `CREW` behavior. Its final protected check and production fingerprint must be recorded separately. A 1440x900 headless desktop sample under concurrent test load measured 28.8 fps for the original and 27.3 fps for this pass, with the same 33.3 ms median and 50 ms 95th-percentile frame intervals; this does not establish performance on player devices.

The canonical Windows wrapper can report `spawnSync npm.cmd EINVAL`; use its expanded `npm.cmd run verify:full` chain, retaining every release check. Local tests, protected CI, deployment and actual player/device validation are separate evidence.

## Title illustration provenance

`public/hubs/dry-county/assets/noir-title-v1.webp` is an original image generated with the built-in image-generation tool on October 20, 2026 and converted to WebP for delivery. It is fictional illustrative cover art, not an archival photograph, aerial reference or gameplay capture. No external source imagery is incorporated.

Generation prompt:

> Use case: historical-scene. Asset type: wide landscape title-screen background illustration for an original top-down Prohibition-era crime game called Dry County. Create premium cinematic painted game key art, 1926 small-town Michigan at night in autumn rain, not modern city: a dark burgundy 1920s sedan with round brass headlamps dominates the lower RIGHT foreground in a dramatic three-quarter view; a solitary man in a long tan coat and fedora stands next to it facing a street of two-story brick storefronts, a distant steam locomotive and telephone poles. Warm honey light glows from windows and reflects in wet dark teal pavement. Smoky blue haze, subdued copper foliage, black-green shadows, sharp beautifully observed vehicle and masonry details, sophisticated painterly realism with restrained vintage print texture. Composition for desktop game menu: LEFT 45 percent is mostly very dark softly textured quiet negative space for large title typography added in HTML, all detailed illustration and strong focal points on RIGHT 60 percent. Full bleed 16:9 landscape, extremely polished bespoke game cover. NO text, NO lettering, NO logos, NO UI, NO borders, no modern vehicles or neon skyscrapers. This is illustrative title art, not a gameplay screenshot.
