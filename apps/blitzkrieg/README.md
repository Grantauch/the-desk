# Blitzkrieg — September 1, 1939

Originally built in Grok App Builder. This edition has three fictional battlefields, twelve waves per battlefield, distinct flight paths, and a final specialization choice for each gun. The briefing and debrief link to the United States Holocaust Memorial Museum for background on the September Campaign.

From The Desk repository root, install the normal site dependencies and run `node apps/blitzkrieg/build.mjs` after editing the game. Commit the updated JavaScript and CSS alongside the source. Netlify serves the result from `public/hubs/blitzkrieg/`.

Run `node apps/blitzkrieg/test.mjs` to check the 60 Hz game simulation, each route, the Bofors-only regression, keyboard placement, specializations, and legacy saves. Progress is stored locally by battlefield. The game uses React and React DOM 18.3.1 from the cdnjs distribution and eight Lucide 0.510.0 icon shapes. The third-party notices live with the static release.
