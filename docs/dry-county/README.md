# Dry County 0.6 — A Town With a Pulse (review branch)

Phase 1 adds a browser-local civilian simulation in `town.js`. There are 72 stable fictional residents with assigned home doors, workplaces, shifts, errands and delivery work. Residents follow the traced streets, enter buildings, spend time there, then leave; workers head home after closing. Up to 24 resident-owned vehicles take destination trips, wait for pedestrians and trains, park, and let their driver finish the trip on foot. A blocked driver waits and can pass a stationary obstruction when the passing lane is clear. Crowded junctions can still queue.

The town begins at 07:50 for the morning commute, and retains its clock in the existing save. Five active seconds advance one town minute. Menus, dialogue and feedback freeze the town clock; walking indoors advances the outside simulation. Businesses display their hours. Closed storefronts reject ordinary entry; an active contract handover, pharmacy emergency access, garage service and discovered speakeasy fronts and concealed-door returns remain available. Interior customers come from the resident visits outside. The existing three-minute inventory restock remains separate from ambient delivery visits, which award no money or stock.

Residents who can see nearby gunfire, crashes or theft remember the incident. Some report it after a delay at its original position. Their F dialogue and short street reactions reflect what they saw. Completing a local errand can create a positive memory. Memory is saved locally, limited to six incidents per resident, and retained for up to three town days on load. Hidden residents do not witness street incidents. This is resident-level recognition, not a full rumor or faction system.

Errands, customer visits and delivery arrivals occur without player input. Short contextual street notices accompany actual activity. Population, event history, path creation and memory are bounded. Near residents update at 20 Hz; intermediate residents at 4 Hz; distant residents at 1 Hz. Vehicles use 20 Hz locally and 4 Hz farther away. Low quality narrows the detailed radius. Path travel is continuous across detail levels; perception and impact reactions stay local. These are simulation budgets, not a measured Chromebook performance guarantee.

## Scale pass

The previous sedan was about 50×25 world units, while many houses were only 26–38 units across. Passenger-car collisions also mostly shared one size. A single body table now supplies rendering, roofs, wall probes, car contact and car-to-car collision geometry:

| Body | Length × width (world units) |
| --- | --- |
| Coupe | 32 × 16 |
| Standard sedan | 36 × 18 |
| Police sedan | 38 × 18 |
| Blackbird | 41 × 18 |
| Federal sedan | 42 × 19 |
| Delivery truck | 47 × 20 |

Infill homes now range from 36 to 58 units across their plan dimensions, with several footprint/roof-height combinations. The 27 authored landmarks and road trace remain in their established locations. Adult sprites vary modestly in height/build; the player and story characters retain a readable common scale. These are game-art proportions, not a survey or exact historic dimensions.

## 0.6 verification and release boundary

`npm run dry-county:test` includes the existing gameplay suite plus a five-minute deterministic Main Street observation, stable identities, business activity and parking, local/distant simulation, active/paused clocks, hours, persistent witness memory, occluded incidents, delayed reporting, shift completion, parked-car foot routing and size checks.

`node scripts/test-dry-county-town-browser.mjs` is a separate **five real minute** Chromium observation of the built site, with no player input after parking on Mt. Morris Road. It retains start/midpoint/end screenshots and a five-second observation log. The script instruments only its test server; production exposes only the existing read-only diagnostic snapshot, now including town activity and scale. The protected workflow also runs the existing desktop/phone/landscape gameplay and four-size art checks.

Local verification passed: the canonical full gate (53 built routes, 128 HTML files and 4,542 references), 77 gameplay checks, 10 town checks, three-size gameplay browser journeys and the four-size/fourteen-room art check. A phone fallback-font title overflow found by that check was corrected. The final deterministic Main Street sample recorded 54 pedestrians, 10 drivers, 46 business visits, 4 deliveries and 6 parking arrivals. The separate real-time browser observation and final-head protected check remain distinct evidence.

Production stays on the existing release. Do not merge or promote this branch until the canonical full gate, browser journeys, five-minute observation and hosted visual check pass. Actual Chromebook/classroom use remains separate field evidence.

---

# Dry County prototype 0.4

The road centerlines in `public/hubs/dry-county/world.js` were manually digitized from the two Mt. Morris aerial/reference screenshots supplied by Grant on October 20, 2026. The view covers the Mt. Morris Road / Saginaw Street junction, Dort Highway, the surrounding residential street shapes, and the diagonal railway. This is a simplified game map derived from the modern reference, not a survey or a reconstruction of the 1926 town. No Google aerial tiles or screenshots are embedded in the published game.

The buildings, businesses, characters, events and criminal plots are fictional. The playable map contains 76 road polylines with a graph used by jobs, traffic and police. Buildings are generated only outside road clearance envelopes.

## Visuals

Buildings use projected 3D corner positions at different heights, solid wall faces and raised roofs. Cars have projected raised roofs over a glass cabin well. Explosion fragments have x/y/z positions, vertical velocity, gravity, bounce and ground shadows. This is a Canvas 2D renderer with 2.5D geometry, not a full 3D engine.

`public/hubs/dry-county/assets/portraits.webp` is an optimized four-character atlas generated with the built-in image generation tool. It contains four original fictional characters: Sal Bell (older Italian American mechanic), Nora Vale (Black American jazz singer), Ruth Mercer (woman bootlegger), and Eddie Pike (adult newspaper hawker). The prompt requested equal 2×2 head-and-shoulder portraits, 1926 clothing, cinematic ink/gouache realism, deep teal shadows, warm brass light, expressive faces, no text, no weapons, no logos, and no resemblance to named real people.

## Feedback

Each death (or voluntary end of a run from Pause) shows an optional feedback prompt. It submits only ratings, an optional note, build identifier, timestamp and the displayed game-run summary. No name, account, roster, PIN or email is requested. Nothing is submitted without the player choosing Send.

The public grant-desk.com build uses Netlify Forms with the static `feedback.html` skeleton. Form detection is enabled on the Netlify project. A failed or unconfirmed request preserves a browser-local copy and offers retry or download. The independent Sites mirror does not have Netlify processing; it uses that honest local fallback.


## Businesses, concealed rooms and a home

The 0.3 expansion adds 17 walkable interiors: the garage, still, three concealed clubs, freight depot, boardinghouse, grocer, diner, pharmacy, tailor, secondhand shop, barber, automobile showroom, hardware store, furniture store and home lot. Each room has collision furniture, a counter conversation, and a bottom exit. Park and exit your car before entering. F talks; E uses the entrance, bottom exit or concealed door.

The grocer's flour-rack door conceals the Velvet Room (2 completed jobs); the tailor's fitting-room panel conceals Lucky Seven (5); the barber's linen cupboard conceals the Blue Lantern (8). Players can investigate the right-hand panels after earning trust, ask the proprietors, or take the three clue jobs. Returning through a club exit brings the player back into its shop front. Owned clubs from earlier saves remain discovered.

Local delivery jobs require speaking at every counter. Parcels are provided separately from purchased goods and cannot be sold. Ordinary store proximity does not complete a job. The still sells moonshine crates for $4; discovered buyers pay $7, $8 or $9.50, with three crates of demand per buyer and police heat on delivery. Supply-run jobs unlock after finding two clubs and require handovers inside the still and both buyers. Discover all three, deliver 12 crates and finish the house to earn the one-time $100 County Supplier bonus.

The dealership sells and recalls owned cars outside its showroom; it never puts a car inside a room. The Empire garage continues to offer upgrades, while vehicle purchases take place at the showroom. Hardware supplies the three construction stages (foundation, frame, roof/finish). Furniture purchases can be placed in eight home slots after the roof is finished, become visible collision objects and can be packed back into the bag. A placed bed provides free rest.

Stock and buyer demand restock after three minutes of active play. Bag capacity is 30 items. Legal resale pays 55% of shelf price, rounded to cents, so a buy/sell loop loses money. Cash uses cents throughout. Purchases, stock, goods, discoveries, home stages, furniture and the endgame reward persist in the existing browser save. Existing cash and ownership are preserved; a new empire starts with $25. Active jobs and street positions still reset between sessions. Interiors suspend outside traffic/combat; wanted players must lose their wanted level before entering from the street.

### Economy references

These are fictional game prices and compressed game-time earnings, not a reconstruction of a particular Mt. Morris business. Food and car prices are informed by period scale; criminal payouts, construction recipes, healing and restock cadence are game design choices.

- [U.S. Bureau of Labor Statistics, Retail Prices, 1890 to 1926, Bulletin 445 (1927), via the Federal Reserve Bank of St. Louis](https://fraser.stlouisfed.org/title/retail-prices-161/retail-prices-1890-1926-5367/fulltext).
- [The Henry Ford: 1925 Model T advertisement and its $290 price](https://www.thehenryford.org/collections/explore/artifact/355535). The game's named vehicles are fictional, with different bodies and performance; their prices are not attributed to that advertisement.

### Verification

Run `npm run dry-county:test` for the synthetic movement, jobs, counters, room collisions, cents trading, stock limits, consumables, discoveries, moonshine, dealership, crafting, endgame and persistence checks. After the production build, `node scripts/test-dry-county-browser.mjs` exercises counter jobs, the trading UI, a concealed entrance, dealership, supplies and home book in Chromium at 1440×900, 390×844 and 844×390. Its test server alone instruments game hooks; public source exposes only the read-only diagnostic snapshot. Protected CI also retains the canonical release and existing site browser checks.

Automated review follow-up: the remote Garage catalog gives directions without advertising purchases or recalls it cannot perform. Garage repairs target the last vehicle the player actually exited and reject a missing, distant, destroyed or already repaired vehicle without charging. Club income accrues while walking indoors as well as on the street, and pauses in menus. Clue-job completion dialogue includes the location hint directly.

## Chases, stunts and side activities

This layer is about fun. The history rides along in small doses. All money uses the same cents economy as the businesses above.

- **Cars hit each other.** Every car has mass. Crashes shove, spin and damage both cars, scaling with the square of impact speed. Rival trucks and police cars fold faster when the player rams them. Jammed traffic backs out, old jams clear off screen, and traffic stays topped up to 30 cars.
- **The law has teeth.** One to five stars. Squad cars ram at close range. At three stars roadblocks appear on the road ahead and officers shoot. At four, black federal dry agent sedans join with short bursts. Stopping beside a police car fills a ring around the player and ends in a *Pinched* screen with a judge's fee of $5 or 15 percent of cash. Rolling slowly up to Bell & Sons while wanted buys a curbside respray for $2 plus $1.50 a star.
- **Three more action jobs.** Hijack a fleeing rival whiskey truck, raid a rival still whose red barrels set each other off, or drive a getaway. They pay $22 to $26 plus level, sit beside rival crews and car theft on the contract board, and take their timers from real road distance. Action jobs that finish early pay a time bonus of up to 35 percent. Every completed job spins in a fictional front page with one real history note.
- **Style cash.** Ten wooden ramps, hops at rail crossings, breakable crates, barrels and gas lamps. Near misses pay 50 cents, drifts about a dollar a second, jumps about three dollars a second of air, with a multiplier up to five. A big crash resets it.
- **Side activities.** Two hot runs with saved records ($10 for the first record, $5 for a new one), the rival rampage ($20 plus 50 cents a second left), and sixteen hidden moonshine jugs at $3 each. Each jug holds a clipping with a real fact about Prohibition, Michigan and the Detroit River, kept in the Clippings tab. Finding all sixteen unlocks the Blackbird Special.
- **Quick restarts.** The *Lights Out* and *Pinched* screens go straight back to the street with Enter. Feedback is still offered, folded under a link.
- **Sound.** Gunshots, crashes, explosions, a siren that follows the nearest squad car, and a quiet swing loop. Sound and music each toggle and the choice is remembered.
- **Performance.** The map draws only the visible region, lamp glow is one stamped sprite, the canvas is capped at 1.5x, and traffic caches its road lookups.

The history facts are in the `FACTS` list in `game.js`: Michigan's 1918 statewide ban, the 18th Amendment and Volstead Act, the Detroit River smuggling route (presented as an estimate), the Purple Gang, the Anti-Saloon League and the WCTU, Capone's 1931 tax conviction, the 21st Amendment, and Michigan as the first state to ratify repeal.

## October 20 map and atmosphere pass

Eight additional user-supplied aerial captures guide this pass: two regional overviews, a town overview, and close-ups of downtown/the rail crossing, the northern common and residential blocks, and the western fields/woodland. The existing trace frame is retained; its west margin expands by 800 game units to include the visible farmland. `world.js` removes a coarse street through the western woodlot, corrects the north cross street, opens the downtown blocks around Saginaw, and adds the curved woodland lane, short depot/side streets and western county boundary road. The railway and main junction remain the geographic anchors. These are hand-interpreted game coordinates, not survey measurements.

`scenery.js` defines 13 land-use polygons, 27 stable building footprints and park/yard details. Fourteen business exteriors now use authored lots rather than searching for an arbitrary small rectangle. Larger civic lots become fictional reading room, schoolhouse, chapel and meeting house; modern parking/campus uses become greens, gravel yards or freight space. Houses follow road frontages outside reserved fields, woods, park and the curated downtown blocks. Footprints clear both roads and the diagonal railway; infill also reserves the complete walking approach to every business door.

The Canvas renderer now uses muted autumn greens and ochres, gravel county lanes, macadam neighborhood streets, stone walks, parcel lawns, brick/siding courses, pitched shingle roofs, chimneys, parapets, skylights, striped shop awnings and painted signs. Modern rooftop machinery and highway striping are removed. Geographic materials and cached ground texture carry the atmosphere; no new particle or post-processing effects were added. Terrain is cached in one map canvas. Existing businesses, jobs, interiors, driving and saved progression remain in place.

Regression coverage adds reserved-land checks, independent street/rail clearance checks for every building, and complete entrance-approach checks. Chromium acceptance records the downtown view at all three supported screen sizes and additional district views on desktop, alongside the existing economy/interior journeys. Production deployment and player field use remain separate evidence.

## Physics and atmosphere

**Cars.** `drive()` is a single-track tire model. Each axle has a slip angle, a stiffness and a grip limit, load shifts forward under braking and back under power, and the rear loses grip under heavy throttle or the handbrake. Velocity is no longer snapped to the nose, so cars slide, drift and spin. Grass and dirt (`surfaceAt`) cut grip to 60 percent and add drag, and wet roads take 7 percent off. A four-gear curve shapes acceleration and the engine note, with a short torque dip at each shift. Walls bounce the car off the face it hit, keep it sliding along that face, line its nose up with the wall and spin it from the corner that struck. Damage comes from the speed into the wall, not total speed, so glancing blows hurt less. AI drivers get a little extra grip and yaw damping so traffic and police stay composed. Measured: the sedan tops out near 48 mph and reaches 30 mph in about 1.1 seconds. A handbrake turn at speed builds well over 100 px/s of sideways slide.

**On foot.** Walking accelerates and decelerates instead of snapping to speed. Shift sprints. Cars are solid to the player. A car hitting the player at speed knocks them flat for a moment. Pedestrians dive out of the way of cars aimed at them and get knocked down and back up when hit. Hitting one adds heat. Nobody is hurt on screen.

**Atmosphere.** The clock drives the light: full night until 5 a.m., dawn between 5 and 7, daylight, dusk from 7 to 9 p.m. Night is a darkness layer drawn at reduced resolution, with gas lamps, headlights, the train's lamp, fire, explosions and muzzle flashes cut out of it. Police lamps, fire and the player's brake lights add colored light. Rain intensity and wind drift over time, with ripples on the pavement, tire spray, lightning and delayed thunder. A freight train runs the diagonal tracks every minute or two. The crossings flash and ring, traffic waits at the gates, and anything left on the rails gets hit. Respawn points slide along the road until they are clear of the tracks. Sound adds a gear-shifting engine, tire squeal by slip, rain, train rumble, horn and crossing bells, scrape sparks, footsteps and thunder. Big crashes pause the world for a beat, and the camera pulls back as speed rises.

**Performance.** `perfWatch` tracks frame time during play. Sustained slow frames step quality down: full lighting, then cheaper lighting at a third resolution, then no lighting and lighter rain. It steps back up after 20 seconds of fast frames. The pause menu has a night lighting toggle for projectors or anyone who wants the brighter look.

## Graphics pass

**Cars.** `CAR_ART` draws each 1920s body once into a cached sprite at 2.5 times game scale: fenders, running boards, a louvered hood, a chrome radiator shell, headlamps, bumpers and a spare wheel. Police cars carry white roof stripes and a roof lamp that flashes red and blue. Federal agents get a gold pinstripe and a red dash lamp. Wrecks swap to a scorched sprite. Front wheels turn with the steering and every tire tread rolls with speed. Brake lights glow, damaged cars show scorch marks, and the hit flash replays the sprite in additive light. Drawing a sprite costs less than the old vector cars.

**People and trees.** Pedestrians are period figures seen from above, with a fedora, cloche, newsboy cap or bare head, a coat, swinging arms and walking legs. The player wears a tan trench coat and a dark fedora. Rival crews wear dark suits and fedoras with a red band. Knocked down figures lose their hat. Tree canopies are clustered sprites in two layers that sway with the wind.

**Effects.** Burning cars throw flame, and wrecks smolder for nine seconds after they blow. Explosions are fireballs with a shockwave and a scorch mark that fades after 45 seconds. Smoke is soft, layered puffs. Sparks and tracers glow, and every gun, the rival crews' included, shows a muzzle flash and lights up the night. In rain the wet street mirrors the gas lamps and headlights.

**Screen.** An art deco speedometer with a gear badge replaces the plain number. A light film grain and a warm print grade sit over the scene. The grain holds still for anyone who prefers reduced motion.

## Chases and gunfights

**What the police know.** Squad cars no longer home in on the player's exact position. The police know only where they last saw you or where a crime was reported (`LAW` in `game.js`). That spot becomes a red search circle on the minimap and the city map. Cars drive to it, then comb random streets inside it at patrol speed, and the circle widens by about 24 pixels a second while nobody has eyes on you. Out of sight and outside the circle, heat drains at 5 a second. Inside it, heat drains at 1.1 a second. The back room still drains it at 14. The stars blink while the police are searching. New squad cars spawn around the search area, never right beside the player.

**Squad car tactics.** One car in three takes the cut off role and drives to the road about two seconds ahead of a fast getaway car. A car tailing the player at close range goes for the rear corner to spin the car out (PIT). In testing it spun a fleeing car in 9 of 12 attempts. A suspect on foot gets a car that pulls up and stops, and one officer steps out (two at three stars or more). Officers run at 120 against the player's 108 walk and 158 sprint. A walking suspect gets tackled and the bust meter fills quickly while they are down. A sprinter gets away. Officers draw at three stars, federal agents always do. When the player drives off, officers run back and climb in, and the car rejoins the chase. Knocking an officer down adds 16 heat.

**Rival crews.** `CREW` defines the temperaments: gunmen, shotgun rushers, a Thompson boss, officers and agents. Crews stand guard unaware until one of them spots you, then the whole crew wakes. Every volley starts with a short aim shown as a dashed line, so a player can read it and move. Gunmen under fire duck into cover that the player cannot see, reachable in a straight line, with a peek spot that has a shot, and lean out to fire. When the player hides, gunmen circle around to flank. Rushers charge. Everyone reloads, and a hit interrupts the aim. A badly hurt gunman falls back. The boss throws dynamite at your last known spot when you hide for more than two seconds. It lands with a red ring and goes off after about a second on the ground, and it hurts the crew too. The boss drops more cash and ammo.

**Balance.** A simple bot that shoots from the street was simulated against the job crew with both the old and new AI. With a Thompson and moving, it won 5 of 10 fights against both versions. Standing still in the open loses more often against the new crews, which is the point of cover. A seven man firefight with a five star chase adds no measurable cost per frame.
