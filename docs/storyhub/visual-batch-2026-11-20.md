# Story Hub visual cleanup — archival cover batch (20 November 2026)

Related: issue #422, initial taxonomy release PR #421. This is a **source-code change in a follow-up branch**, not evidence of a live release.

## Concrete changes in this batch

- **The Hangman of Nuremberg**: replace the generic vector courtroom hero and Story Hub catalog thumbnail with a documented photograph of the 1945–46 trial. The image is from the Harry S. Truman Presidential Library and Museum, photo **72-873**, and its record identifies public-domain rights. Use a restrained grayscale treatment and label the photograph near the hero and in the source register.
- In the same lesson, replace the fake vector John C. Woods personnel portrait with an **actual 1946 photograph of Woods**. The surviving Wikimedia Commons reproduction is only 123 × 175 pixels: display at native size with a visible source credit, **not** upscaled as a cinematic portrait. The Commons file page marks it public domain.
- **Two Sources**: point the standalone hub's Open Graph image at the same locally hosted and already credited 1973 Watergate photograph used by its Story Hub catalog, rather than the residual signal SVG.
- No student answer fields, PIN, Turn In, direct assignment route, or shared runtime were changed.

## Source and rights references

1. Nuremberg courtroom: [Harry S. Truman Library, photo 72-873](https://www.trumanlibrary.gov/photograph-records/72-873). Current source address: `https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/truman/photographs/72/72-873.jpg`. Source record states public domain.
2. Woods period portrait: [Wikimedia Commons, John C. Woods.jpg](https://commons.wikimedia.org/wiki/File:John_C._Woods.jpg), 1946, 123 × 175 pixels. Wikimedia Commons identifies the work as public domain in the United States. Current original image address: `https://upload.wikimedia.org/wikipedia/commons/1/15/John_C._Woods.jpg`.
3. Two Sources: `/storyhub/hh/who-took-the-files/assets/a06-watergate.jpg`; the existing catalog identifies a Yoichi Okamoto / National Archives photograph of the Watergate complex (May 1973). No new binary was introduced.

## Release blocker: external image dependencies

The Nuremberg source images are currently referenced from authoritative remote hosts, because this branch does **not** include new optimized, locally hosted binary assets. Before production merge: obtain copies directly from the credited sources, optimize without removing relevant content, put them in `public/storyhub/hh/nuremberg/`, update the references, check file provenance, and test that both images work without third-party image-host access. Do not treat the remote-host implementation as final classroom acceptance. If the source images are blocked by district filtering, keep the release unmerged until local copies are ready.

## Remaining catalog SVG covers

After these branch changes, exactly two Story Hub entries in `src/data/storyhubs.ts` still point directly to SVG cover scenes:

- `ush9-l015-who-showed-up` — `/storyhub/ush9/l015/assets/a01-rail-yard.svg`
- `bts-l03-not-in-the-room` — `/storyhub/bts/l03/assets/cover-ledger.svg`

The SVG signal illustration for `hh-l06-two-sources` remains inside the standalone lesson; its catalog cover and social card use a period photograph. The 14 small SVG narrative scenes inside `ush9-l015-who-showed-up.html` remain and need a **whole-lesson** visual redesign from specific documented 1877–1894 strike material. Functional data diagrams and interactive maps should not be removed merely for being SVG.

Six synthetic-reconstruction descriptors still occur in the Story Hub catalog: `ush9-l016-the-one-that-passed`, `ush9-l016b-they-said-no`, `ush9-s01-the-margin`, `hh-s01-the-desk-it-stopped-at`, `bts-s01-the-death-harvest` and `ush9-l018-the-debt-didnt-move`. Audit each against documentary references; do not replace one generic AI rendering with another.

## Required acceptance before calling this done

- Replace remotely referenced photographs with locally hosted, credited, appropriately sized derivatives.
- Inspect the actual Nuremberg cover, Woods image and Two Sources sharing card on phone, Chromebook and projector widths, including their alt text and source links.
- Run `npm run verify`, focused Story Hub browser checks, keyboard/reduced-motion/contrast checks and CI.
- Confirm final merged commit is included in Netlify production; check live URLs and no student PIN / Save / Turn In regression.
- Continue issue #422 batches for rail strike, baseball and game interior artwork, rather than accepting only catalog cards.
