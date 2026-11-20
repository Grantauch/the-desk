# Primary-source visual pass — three standalone Story Hubs

Date: November 20, 2026. Scope: student-facing story hero and one interior evidence visualization for each of three independent Story Hubs. The originals remain in Git history. The actual educational/response flows, save keys and grading/Turn In scripts are unchanged.

## US History — The Margin (Johnstown, 1889)

- **Opening:** Replaced a decorative CSS dam panorama with an original 1889 photograph of a tree lodged in the Schultz family's home after the Johnstown Flood. The photograph documents the aftermath; it **does not** claim to show the dam before or during its breach.
- Photograph provenance: [Wikimedia Commons — Johnstown Tree in House](https://commons.wikimedia.org/wiki/File:Johnstown_Tree_in_House.jpg). Original source attributed to the Pennsylvania Historical and Museum Commission. 1889 photograph, U.S. public domain (published before 1931).
- **Interior — Stone Bridge:** Replaced a generalized bridge illustration with an actual 1889 photograph of debris beside Johnstown's stone railway bridge. Source: [NPS Teaching with Historic Places](https://www.nps.gov/articles/000/run-for-your-lives-the-johnstown-flood-of-1889-teaching-with-historic-places.htm). The image depicts the bridge and wreckage after the disaster, not the crest failure upstream.
- Both images have descriptive alt text and visible source links. The original decorative dam/bridge drawing is rendered only as a *load-failure fallback*.

## Hidden History — The Desk It Stopped At (Northwoods, 1962)

- **Opening:** Replaced fake styled memorandum graphic with the original first page of the signed 13 March 1962 Joint Chiefs memorandum to the Secretary of Defense. Source: [National Security Archive](https://nsarchive.gwu.edu/CMC-60/joint-chiefs-pretexts-to-invade-Cuba-1962), with the scanned first page [on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:NorthwoodsMemorandum.png). A U.S. federal government work in the public domain.
- **Interior — What it proposed:** Replaced a fake pinboard scene with the actual page eight of the declassified proposal, which contains specific contemplated incidents (not proof of their execution). Scanned source: [Wikimedia Commons — NorthwoodsMemorandum8.png](https://commons.wikimedia.org/wiki/File:NorthwoodsMemorandum8.png), from the same primary source and public domain.
- Captions explicitly separate the existence and signing of the proposal from any assertion that it was executed. The original native HTML fallback memorandum remains readable without the image.

## Beyond the Scoreboard — The Death Harvest (1905 football)

- **Opening:** Replaced an invented old-style football program with a real panoramic 1905 photograph from the Yale–Harvard football game. Photograph: Pictorial News Co., Library of Congress Prints and Photographs Division, `pan.6a29130`. [Wikimedia Commons source](https://commons.wikimedia.org/wiki/File:Bulldogs_vs._Crimson_football_game_1905.JPG). Published 1905; U.S. public domain.
- The photograph shows the *game environment*, not an injury or evidence for a specific death in the tally.
- **Interior — The game they were playing:** Replaced an uninformative field drawing with a **true proportional scale** comparing 5 yards in 3 downs under 1905 rules against 10 yards in 3 downs under the 1906 rules. Bars use 50% vs 100% of the same 10-yard scale. Labeled a rule comparison rather than a period image.
- The original offline title treatment remains as a fallback.

## Performance, safety and follow-up

- Removed redundant identical `storyhub-context.css` imports in two files. There is still exactly one copy of each needed stylesheet.
- **External image hosts remain an accepted interim risk**: image URLs point to Wikimedia or the National Park Service and are not yet self-hosted or performance-tested on a school Chromebook. Locally cached and properly optimized derivatives are the desired final state once a binary-asset upload pipeline is available.
- HTML text remains live/searchable. New image frames are responsive, cited and have image-load fallbacks.
- **Visual approval pending**: check source host availability, responsiveness at 390px/1366px/presentation widths, Alt text, keyboard source links, reduced motion, low bandwidth, and actual screenshot comparisons.
- If the image host is unavailable, the existing scene/fallback is shown rather than a broken image icon. No live deployment claim until the PR is merged and production URL is independently checked.

## Related work

- PR #429 covers Nuremberg, 1877–1894 labor imagery, and baseball first-league historical illustrations.
- PR #430 covers the Chinese Exclusion document hero, Wong Kim Ark record, and actual Dry County/Blitzkrieg in-game terrain.
- Issue #422 remains the umbrella inventory for the remaining AI-looking and visually inconsistent content.
