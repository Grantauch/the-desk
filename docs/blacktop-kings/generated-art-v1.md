# Blacktop Kings generated artwork v1

Based on the cel-shaded broadcast interface in PR #169, source `e71840f771d167a9ebac021a8fc6b368200123e5`.

Thirteen original images were created with the built-in OpenAI image generator: eight scenery panoramas, three floor materials, a transparent impact burst and a transparent crown trophy. Murals, neighborhood props, rooftop equipment and dock details are incorporated in the scenery images. The optimized WebP derivatives total 2,934,224 bytes. Original PNGs and the complete generation prompts are retained in the private review package, outside the public website.

| Court | Scenery |
| --- | --- |
| Lincoln Lot | Brick neighborhood, trees, fire escapes and crown mural |
| The Boardwalk | Sunset ocean, amusement pier, palms and beach kiosks |
| The Cage | Dense brick downtown block and original basketball murals |
| Skyline Roof | Violet city lights, water tower and rooftop machinery |
| The Underpass | Freeway girders, amber lamps and painted concrete pillars |
| Harbor Yard | Cranes, shipping containers and harbor sunset |
| The Pit | Warm rec-center brick, bleachers and banners |
| Crown Court | Gold championship lighting, stands and crown display |

Images are decorative layers. Existing world coordinates, court markings, scoring boundaries, player poses, customization, career saves and audio logic remain authoritative. Court textures are projected onto the existing floor and blended under painted lines. Scenery is cached with the static court; the animated crowd and hoop retain their existing depth order. Scene paintings also feed court previews and menu tiles.

The image loader requests scenery and material when a court is drawn, reuses pending requests and repaints after an image is decoded. Pending or failed images retain the original canvas painting. The optional trophy is displayed only after decoding. The impact sprite augments dunk/block effects and is omitted in reduced-motion and attract modes.

Validation: all 13 WebP images decoded in the local browser; every court rendered with scenery and material; actual quick-game start/pause/resume/quit passed; the menu was inspected at 390 pixels with no horizontal overflow; circuit trophy decoded; reduced effects omitted the new impact sprite. Blocking every generated asset retained the original scene and four menu buttons without creating a career save. Existing geometry/audio checks, loader failure/deduplication tests and the full verification gate passed. These are local and automated results; production publication and ordinary player feedback remain separate.
