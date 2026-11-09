# the atlas — image sources

## Course illustrations

These are AI-assisted woodcut and gouache interpretations of historical
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

The current review assets are small extracts of the user-approved illustrated
design. Dedicated high-resolution illustration masters are a later art pass.
Original/reference files and the source register remain outside this public
repository; only these optimized public derivatives are shipped here.

## Earth and clouds

- **earth-color.jpg:** NASA Earth Observatory, *Blue Marble: Next Generation*,
  July 2004 base map, produced by Reto Stöckli, NASA Goddard Space Flight
  Center. [NASA collection](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/).
  [Original image](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg).
  This local 4096 × 2048 copy is a downsampled delivery of the NASA image,
  obtained from the documented NASA-derived texture mirror in
  [physics-lab](https://github.com/MaxwellLee/physics-lab/blob/main/assets/textures/SOURCES.md).
- **cloud-mask.jpg:** NASA Goddard Space Flight Center, Reto Stöckli; enhancements
  by Robert Simmon. [NASA Blue Marble description and credits](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/).
  Brightness-to-alpha conversion from the NASA Blue Marble cloud composite,
  delivered as a grayscale JPEG alpha mask from that same documented mirror. This is an artistic
  cloud layer, not current weather.

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
navigation aid, not a verified event coordinate.
