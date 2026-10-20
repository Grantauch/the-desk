# Dry County prototype 0.3

The road centerlines in `public/hubs/dry-county/world.js` were manually digitized from the two Mt. Morris aerial/reference screenshots supplied by Grant on October 20, 2026. The view covers the Mt. Morris Road / Saginaw Street junction, Dort Highway, the surrounding residential street shapes, and the diagonal railway. This is a simplified game map derived from the modern reference, not a survey or a reconstruction of the 1926 town. No Google aerial tiles or screenshots are embedded in the published game.

The buildings, businesses, characters, events and criminal plots are fictional. The playable map contains 74 road polylines with a graph used by jobs, traffic and police. Buildings are generated only outside road clearance envelopes.

## Visuals

Buildings use projected 3D corner positions at different heights, solid wall faces and raised roofs. Cars have projected raised cabins. Explosion fragments have x/y/z positions, vertical velocity, gravity, bounce and ground shadows. This is a Canvas 2D renderer with 2.5D geometry, not a full 3D engine.

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
