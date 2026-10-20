# Dry County prototype 0.2

The road centerlines in `dist/world.js` were manually digitized from the two Mt. Morris aerial/reference screenshots supplied by Grant on October 20, 2026. The view covers the Mt. Morris Road / Saginaw Street junction, Dort Highway, the surrounding residential street shapes, and the diagonal railway. This is a simplified game map derived from the modern reference, not a survey or a reconstruction of the 1926 town. No Google aerial tiles or screenshots are embedded in the published game.

The buildings, businesses, characters, events and criminal plots are fictional. The playable map contains 74 road polylines with a graph used by jobs, traffic and police. Buildings are generated only outside road clearance envelopes.

## Visuals

Buildings use projected 3D corner positions at different heights, solid wall faces and raised roofs. Cars have projected raised cabins. Explosion fragments have x/y/z positions, vertical velocity, gravity, bounce and ground shadows. This is a Canvas 2D renderer with 2.5D geometry, not a full 3D engine.

`dist/assets/portraits.webp` is an optimized four-character atlas generated with the built-in image generation tool. It contains four original fictional characters: Sal Bell (older Italian American mechanic), Nora Vale (Black American jazz singer), Ruth Mercer (woman bootlegger), and Eddie Pike (adult newspaper hawker). The prompt requested equal 2×2 head-and-shoulder portraits, 1926 clothing, cinematic ink/gouache realism, deep teal shadows, warm brass light, expressive faces, no text, no weapons, no logos, and no resemblance to named real people.

## Feedback

Each death (or voluntary end of a run from Pause) shows an optional feedback prompt. It submits only ratings, an optional note, build identifier, timestamp and the displayed game-run summary. No name, account, roster, PIN or email is requested. Nothing is submitted without the player choosing Send.

The public grant-desk.com build uses Netlify Forms with the static `feedback.html` skeleton. Form detection is enabled on the Netlify project. A failed or unconfirmed request preserves a browser-local copy and offers retry or download. The independent Sites mirror does not have Netlify processing; it uses that honest local fallback.
