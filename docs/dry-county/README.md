# Dry County

The road centerlines in `dist/world.js` were manually digitized from the two Mt. Morris aerial/reference screenshots supplied by Grant on October 20, 2026. The view covers the Mt. Morris Road / Saginaw Street junction, Dort Highway, the surrounding residential street shapes, and the diagonal railway. This is a simplified game map derived from the modern reference, not a survey or a reconstruction of the 1926 town. No Google aerial tiles or screenshots are embedded in the published game.

The buildings, businesses, characters, events and criminal plots are fictional. The playable map contains 74 road polylines with a graph used by jobs, traffic and police. Buildings are generated only outside road clearance envelopes.

## Visuals

Buildings use projected 3D corner positions at different heights, solid wall faces and raised roofs. Cars have projected raised cabins. Explosion fragments have x/y/z positions, vertical velocity, gravity, bounce and ground shadows. This is a Canvas 2D renderer with 2.5D geometry, not a full 3D engine.

`dist/assets/portraits.webp` is an optimized four-character atlas generated with the built-in image generation tool. It contains four original fictional characters: Sal Bell (older Italian American mechanic), Nora Vale (Black American jazz singer), Ruth Mercer (woman bootlegger), and Eddie Pike (adult newspaper hawker). The prompt requested equal 2×2 head-and-shoulder portraits, 1926 clothing, cinematic ink/gouache realism, deep teal shadows, warm brass light, expressive faces, no text, no weapons, no logos, and no resemblance to named real people.

## Feedback

Each death (or voluntary end of a run from Pause) shows an optional feedback prompt. It submits only ratings, an optional note, build identifier, timestamp and the displayed game-run summary. No name, account, roster, PIN or email is requested. Nothing is submitted without the player choosing Send.

The public grant-desk.com build uses Netlify Forms with the static `feedback.html` skeleton. Form detection is enabled on the Netlify project. A failed or unconfirmed request preserves a browser-local copy and offers retry or download. The independent Sites mirror does not have Netlify processing; it uses that honest local fallback.

## Build 0.3: the fun pass

The goal of this build is fun first. The history rides along in small doses.

- **Cars hit each other.** Every car has mass. Crashes shove, spin and damage both cars, harder at higher speed. Rival trucks and police cars fold faster when the player rams them.
- **The law has teeth.** One to five stars. Squad cars ram at close range. At three stars roadblocks appear on the road ahead and officers shoot. At four, black federal dry agent sedans join with short bursts. Stopping beside a police car fills a ring around the player and ends in *Pinched*. Driving slowly into Bell & Sons while wanted buys a respray that clears the stars.
- **Six job types.** Bootlegging with breakable cargo, crew war, car theft, hijacking a fleeing rival truck, a still raid where the barrels set each other off, and a getaway. Timers come from the real road distance. Finishing early pays a time bonus. Every completed job spins in a fictional front page with one real history note.
- **Style cash.** Near misses, drifts, jumps off ten wooden ramps, hops at rail crossings, smashed crates and lamps knocked flat all pay, with a multiplier up to five. A big crash resets it.
- **Side activities.** Two hot runs with saved records, the rival rampage, and sixteen hidden moonshine jugs. Each jug holds a clipping with a real fact about Prohibition, Michigan and the Detroit River. Finding all sixteen unlocks the Blackbird Special. Found clippings are kept in the Clippings tab.
- **Death is quick.** The *Lights Out* and *Pinched* screens go straight back to the street with Enter. Feedback is still there, folded under a link.
- **Sound.** Gunshots, crashes, explosions, a police siren that follows the nearest squad car, and a quiet swing loop. Sound and music each toggle from the title screen and the pause menu, and the choice is remembered on the browser.
- **Performance.** The map draws only the visible region, lamp glow is a single stamped sprite, the canvas resolution is capped at 1.5x, and traffic caches its road lookups. In testing the update cost per frame dropped to about a third of the 0.2 build.

The history facts are in the `FACTS` list in `game.js`. They are standard, well documented points: Michigan's 1918 statewide ban, the 18th Amendment and Volstead Act, the Detroit River smuggling route (presented as an estimate), the Purple Gang, the Anti-Saloon League and the WCTU, Capone's 1931 tax conviction, the 21st Amendment, and Michigan as the first state to ratify repeal.
