# the atlas — image sources

## Course illustrations

These are AI-assisted woodcut-style interpretations of historical
photographs, not unaltered primary-source photographs. The originals remain
available at their holding institutions. The illustrations are navigation art;
they should not be used to infer details absent from an original.

- **us-history.webp:** after *Mulberry Street, New York City*, circa 1900,
  Detroit Publishing Company. Library of Congress, Prints & Photographs
  Division. [Original record and rights advisory](https://www.loc.gov/item/2016794146/).
  The record states “No known restrictions on publication.”
- **hidden-history.webp:** after Alexander Gardner’s 1862 photograph of
  Allan Pinkerton, Abraham Lincoln and John A. McClernand, Antietam.
  [Library of Congress record and rights advisory](https://www.loc.gov/item/2018666255/).
  The record states “No known restrictions on publication.”
- **beyond-the-scoreboard.webp:** after *Hanton, Center Field, Detroit*,
  Goodwin & Company, 1887. The Metropolitan Museum of Art, The Jefferson R.
  Burdick Collection, Gift of Jefferson R. Burdick, 63.350.214.173.140.
  [Original and public-domain declaration](https://www.metmuseum.org/art/collection/search/397316).
  Tobacco advertising is excluded from the navigation artwork.

Each illustration was produced with its archival photograph as a visual
reference and uses a distinct palette of simulated block-print inks. The
840 × 560 and 480 × 320 WebPs are optimized copies of the illustration masters.
Large, high-density screens can use the 1440 × 960 AVIF versions.
The original photographs are available from the institutions linked above.

## Earth and clouds

- **earth-color.jpg:** NASA Earth Observatory, *Blue Marble: Next Generation*,
  July 2004 base map, produced by Reto Stöckli, NASA Goddard Space Flight
  Center. [NASA collection](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/).
  [Original image](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg).
  This local 4096 × 2048 copy is a downsampled delivery of the NASA image,
  obtained from the documented NASA-derived texture mirror in
  [physics-lab](https://github.com/MaxwellLee/physics-lab/blob/main/assets/textures/SOURCES.md).
  **earth-detail.webp** is the full 5400 × 2700 NASA image in WebP format.
  It loads when zoomed in on supported graphics hardware.
- **cloud-mask.jpg:** NASA Goddard Space Flight Center, Reto Stöckli; enhancements
  by Robert Simmon. [NASA Blue Marble description and credits](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/).
  Brightness-to-alpha conversion from the NASA Blue Marble cloud composite,
  delivered as a grayscale JPEG alpha mask from that same documented mirror.
  Two cloud decks use the same geographic mask at different heights and
  densities. Their drift and shadows are artistic.
- **earth-relief.bin:** vertex heights sampled from the Blender terrain
  model, derived from the [NASA Blue Marble global topography map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/).
  Heights are exaggerated for the carved globe look.
- **globe-portrait.webp:** still rendered in Blender from the same geography,
  with bronze terrain, blue oceans, two cloud decks and atmospheric light.
- **Satellite clouds:** Contains modified EUMETSAT data. The optional global
  JPEG mosaic comes from [Matt Easón's Live Cloud Maps](https://github.com/matteason/live-cloud-maps).
  The source generally updates every three hours. Coverage can have gaps,
  and the provider fills polar gaps with mirrored imagery. The atlas adds
  artistic lighting while keeping the mosaic fixed to its geographic position.

NASA permits educational/informational reuse under its
[media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/),
subject to the stated exceptions. No NASA logo, endorsement or third-party
news photograph is used here. The globe’s bronze material and grid are an
artistic treatment of modern geography, not historical borders or elevation
measurements.

## Renderer and news

**earth-normal.webp:** Earth Normal Map by Solar System Scope / INOVE,
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), based on NASA
elevation and imagery data. [Original collection and license](https://www.solarsystemscope.com/textures/).
The TIFF-to-WebP delivery was obtained from the credited
[Keng0nion mirror](https://keng0nion.github.io/credits/).
The shader exaggerates the normal-map relief for visibility; it is not an
elevation measurement. Credit: Solar System Scope / INOVE. The original
license is unchanged and no endorsement is implied.

The atlas reuses the local MIT-licensed Three.js distribution and its license
at `/hubs/ush9-over-there/lib/three.LICENSE`.

News uses the site’s existing headline endpoint. Pins contain our own glyphs,
publisher attribution, publication date and a link to the original reporting.
Publisher photographs are not requested or displayed by the atlas. Headlines
with missing dates, stale dates, unknown places, or conflicting place matches
are left off the globe. “Location matched from the headline” is an approximate
navigation aid. Broad region names use a labeled approximate reference point.
