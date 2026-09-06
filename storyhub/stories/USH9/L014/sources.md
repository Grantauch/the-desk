# Sources — USH9-L014

This public file is a compact provenance/accuracy guide, not the complete private production register.

## Core factual/source families

- National Park Service materials on the Knights of Labor and Great Southwest Railroad Strike.
- Texas State Historical Association materials on the Great Southwest Railroad Strike and Marshall, Texas context.
- Library of Congress visual and historical collections, including period Knights/Powderly material.
- Encyclopedia of Greater Philadelphia material on the Knights' Philadelphia origins.

## Visual-source provenance

Sixteen public assets ship with this release. Each is registered in `assets.json` with a
deploy path, byte length, and sha256 sealed in `storyhub/releases/USH9-L014.json`.

**Verified archival photographs (unaltered content, tonal grade only)**

- **A14 Jay Gould** — Library of Congress [91482972](https://www.loc.gov/pictures/item/91482972/),
  "[Jay Gould, half-length portrait, facing left]", between 1865 and 1892, subject heading
  "Gould, Jay,--1836-1892.", rights "No known restrictions on publication."
- **A15 Samuel Gompers** — Library of Congress [2002717893](https://www.loc.gov/pictures/item/2002717893/),
  "Samuel Gompers, 1850-1924", c1902, rights "No known restrictions on publication."
  The portrait dates from his AFL presidency, not from the 1886 founding, and the page says so.

Both records were verified on the Library of Congress item API for subject identity and an
explicit rights statement, and both images were visually confirmed to be the right person
rather than trusted by filename. The grade is tonal only — crop, grayscale normalisation, a
duotone whose endpoints are sampled from approved asset A04, and light grain. Nothing is
added to, removed from, or repainted in either photograph, and each is credited on the page
as an archival photograph with its record URL. The reproducible recipe is
`storyhub/stories/USH9/L014/archival-portraits.json`.

**Source-derived stylization**

- **A04 Terence V. Powderly** — built from Library of Congress
  [2012648823](https://www.loc.gov/pictures/item/2012648823/), "Leaders of the Knights of Labor"
  (Kurz & Allison, 1886), rights "No known restrictions on publication." Record verified before
  publication. The deployed image is a stylization, not an archival photograph, and the page
  states that where it appears.

**Interpretive reconstructions and generated support assets**

- **A08 / A08B C. A. Hall** are interpretive reconstructions and must never be presented as an
  authentic likeness or archival photograph. A08B is the tighter alternate framing anticipated by
  A08's `responsiveCrop` note; it is the second half of the scroll crossfade and is hidden under
  reduced motion and at small widths.
- Generated railroad, factory, meeting-hall, cooperative-store, and Haymarket-public-perception
  scenes are editorial illustrations, not primary-source evidence.
- **A13** is a generated reference board summarising the factual spine. Every fact on it is also
  present as native HTML text in the Note Repair list, so the image is never the only carrier.

## Accuracy notes

- Founding group: use nine Philadelphia garment cutters in December 1869.
- Wabash victory: restore prior wage levels/protect strikers nuance should be preserved in surrounding text.
- Great Southwest strike: explain multiple defeat mechanisms rather than reducing them to a single actor.
- Haymarket: the Knights did not call or control the meeting; backlash was broader than responsibility.
- AFL: founded in 1886; standalone federation merged with CIO in 1955.
- Industrial-union vocabulary: use classroom shorthand carefully because the Knights' mixed assemblies do not map perfectly onto later CIO industrial unionism.
- Collective-power model (I01): the 10,000-worker state must keep saying that the 1886 Great
  Southwest strike reached that scale and still lost. Scale creates leverage; it does not by
  itself stop production. Removing that line would turn the model into a claim the history
  does not support.
