# Checkaverse status and roadmap

Audit of the live multiplayer town on 17 November 2026, against `main` at `a996eaa`. This file is a plan. `docs/checklings/DESIGN.md` stays the design source of truth. If the two disagree, follow the Design Bible and update this file.

No game code was changed for this audit. The live town is still the copy on the home PC at `C:\Checklings\checkaverse`, reached at game.grant-desk.com. A merge to `main` does not update that PC, and it does not update Check-In. Apps Script changes reach students only after a new version of the existing Check-In deployment.

## How to read this

The game students can play today is Checkaverse 0.22.0 (`VERSION` in `apps/checkaverse/server.mjs`). `package.json` still says 0.1.0. That number is leftover. Trust `0.22.0`.

Pixel Camp (`public/hubs/checkling/camp/`) is still a separate browser game. Its menu link opens the Checkaverse with no bus ticket, so that ride arrives as a visitor and keeps nothing.

## 1. What is built and working

Checked by reading the server, the content files, and the tests in section 3. "Working" here means the code and the `npm test` suite agree. A full class on school Chromebooks is still a separate check, and the Design Bible says that check has not been done for Bramblefen.

### Getting in

Check-In prints a two-hour bus ticket (`apps-script/hall-pass/Code.gs`, `getCheckaverseTicket`). The page at game.grant-desk.com takes the ticket out of the address bar, keeps it in that tab, and sends it on hello (`apps/checkaverse/public/plaza.js`). The server checks the HMAC signature, the clock, and that the partner is one of the four starters (`accounts.mjs`, `verifyTicket`). A bad ticket still gets in, as a visitor, with a sentence saying why.

The ticket carries an anonymous player id, class hour, date, whether they checked in today, how many official check-ins they have, the streak, and the hatched Checkling's species and nickname. It has no student name, no PIN, and no email. `scripts/test-checkaverse-ticket.cjs` locks that shape to the server checker. Nicknames are shown to their owner. Other trainers see the species (`teamView` in `server.mjs`).

A saved trainer wakes in their own Kettle Creek. A visitor wakes in the shared town. A second tab with the same ticket closes the first (close code 4002).

### The towns

One shared town: plaza, 24 neighborhood plots, arena, market stalls, notice board, Merge Stone, bus stop. Houses appear when that student is online and leave when they disconnect. The owner can lock the door. Visitors can walk through an unlocked house and look at the one shared interior picture. They cannot change it.

Kettle Creek is a private room per connection (`kc:` plus the connection id in `server.mjs`). Other players cannot choose that room. Resident history for a saved trainer is stored under the anonymous player id, so it survives a reconnect. It has a house, general store, apothecary, clinic, day care, a fenced practice yard with three stumps, Route 1 tall grass, a cemetery hill, a bus stop, and four forage props. Doors open. Home and the clinic open the Care panel. The store, apothecary, and day care show a line of text (`content/places.json`).

The wilds sit north of the plaza gate: tall grass, starflower clearing, rocky ridge, scorched heath, one bridge. North of that is Bramblefen Basin, a 256 by 256 map built from a fixed seed (`content/fen.json`, `public/fen.js`). Server and browser build the same map and compare a hash. The ground is painted in chunks. Seven landmarks are reachable. Three encounter zones run levels 8 to 16, using species that already live in the wilds.

Walking is grid based. The browser steps immediately. The server checks each step and corrects a disagreement. Tap to walk, signs, and a short tip the first time each thing matters are in place.

### Checklings, care, and battles

64 forms, 24 lines, eight types (`content/battle/species.json`). Four starters (Mochi, Bolt, Zee, Ember) evolve at 15 and 30. Eight lines change once at level 20 into a kept, round, or scrappy form from the body that day. Eight lines never evolve. The other three starters can be caught in the grass.

A check-in pays 100 XP to the battle partner on the next ride, including check-ins from days the student skipped the game. Level 15 is about 28 check-ins. Level 30 is aimed at the end of first semester. Level 50 is aimed at the end of the year (`content/growth.json`). Battle XP is capped at 90 a day, under one check-in, on purpose. The party holds 3. The Den holds 60 and pauses the body clock. Caught Checklings can be named (14 letters). The first Checkling keeps its Check-In name.

The body has fullness, weight, hygiene, mood, and health (`content/care.json`, run by `care.mjs`). Students feed, treat, groom, play, nap, and give medicine, with daily limits. Conditions, diseases, and death chances are content. Absence decays stats down to a floor and does not start a condition, a disease, or a death. A missed server day does not tick. The teacher page can mark no school. A death writes a class-hour headstone, shows an epitaph, and owes an egg that hatches five check-ins later into a starter the student picks. There is no revive. A glowing mushroom after some wild wins is a 2 percent chance of instant death. The care tests say steady care does not kill over 60 school days, and overfeeding or never caring kills near school day 19 or 20.

Battles are the Red and Blue shape: four moves, both sides pick, the server plays the turn, nearby trainers can watch. The turn clock is 30 seconds. Busy blocks challenges. A turned-down challenger waits. Leaving forfeits. Knockouts do not injure the body. Weekly rankings are per class hour, Monday in Michigan time, top 10 plus your own place. Only battles between two saved trainers count, and only the first three results against the same classmate each day. Player ids stay on the server.

Moves are learned at levels 8, 16, and 24, plus Quick jab and Deep breath (`content/learnsets.json`). The arena is a gym: four mini-games, 12 rounds a day, then the move can be taught.

Ghosts return to the cemetery hill five school days after a death (`content/ghosts.json`). Classmates see the same stones. Spirit Sight is brewed at the apothecary from grave moss. A ghost is a see-through draw of the old sprite (`ghostSprite` in `plaza.js`). Only the trainer who raised a Checkling can catch its ghost. A caught ghost does not eat, get sick, die again, or evolve.

### The town around them

Twelve residents have homes, jobs, and conversations (`content/resident-lives.json`, `content/world.json`). The server runs their day. Saved trainers keep story progress. Visitors' stories last for the connection. Residents sometimes battle each other with the real battle engine. Those battles are not ranked.

The Gazette, mailbox, and overnight director are in (`town-news.mjs`, `director.mjs`). The paper opens on the first ride of a school day. Letters (at most two) talk about that trainer's own Checklings. The director runs at night on the PC, after a database copy, and its lines have to pass a filter and a second mock check. The teacher can pause it and pull a line down.

The sky follows Mt. Morris weather from Open-Meteo. No student location is sent. Rain, snow, fog, and storms draw over outdoor maps and shift wild types. The teacher can start a Festival, Double XP, or a Rare spawn. Those are rewards only.

The teacher page pauses the whole town, sends one message to every screen, removes a trainer, marks no school, and starts or stops those rewards. The key lives in the data folder on the PC, not in this repo.

### What a visit actually is today

A student can check in, ride the bus, read an overnight card of body changes (`showReport` in `plaza.js`), care for the partner, walk Kettle Creek, catch on Route 1, ride to the shared town, talk in six phrases, battle classmates, train at the gym, watch residents, and walk into Bramblefen. That is a real game. The Design Bible's shops, coins, potions, field guide, merge, and champion are not in that visit yet. Section 2 is the list.

## 2. Gap analysis

Sources: `docs/checklings/DESIGN.md`, the World Depth Pack v3 (Drive export), the Sprite Book waves, and `docs/checklings/wave-one.md`. Wave One outranks the Depth Pack's roster where they disagree. Pebble became Spindle. Creekcap and Stumpkin waited for a later wave and are now in the game. Flickit and Hushmoth were added so every type had a line.

Status words: **built**, **partial**, **missing**, **diverges**.

### The five-step visit

| Step | Status | Where it stands |
| --- | --- | --- |
| Check in pays XP | Built | 100 XP per official check-in, paid on the next ride to the current partner (`growth.json`, `accounts.mjs` `link`). |
| Check in pays coins | Missing | No coin field, wallet, or price anywhere under `apps/checkaverse`. |
| Overnight card | Partial | The card exists and lists body changes, deaths, and an egg (`plaza.js` `showReport`, `care.mjs` summaries). It does not mention a restocked shop, a forage find, or a featured wild species. Those systems are not there to report. |
| Care | Built | Six actions, ten conditions, nine diseases plus a cold. Death is usually a rising chance. Health at 0 while a disease is active is certain death. See the divergences below. |
| Choose a path | Partial | Both maps exist. Kettle Creek's jobs (shop, forage, brew, decorate) are signs. The shared town's jobs (battle, gym, wilds, basin) work. |
| Leave, and the clock keeps going | Built | School calendar in `content/calendar.json`. Party only. Den paused. Outage days and no-school days do not tick. |
| Kettle Creek works while the Checkaverse is down | Diverges | The bible says Kettle Creek always works, from grant-desk.com, even when the bus is not running. Both towns are the same process on the home PC. If that process is down, neither town loads. Pixel Camp still runs in the browser, as its own game, with its own save. |

### Care, compared with the bible's table

Built and matching: obese, scrawny, grimy, wired, lazy, exhausted, overtrained, the diseases they lead to, medicine once a day, overmedicating when nothing is wrong, glowing mushroom at 2 percent, absence never kills, knockout never kills, egg after five further check-ins.

Partial or different:

- The code fields are `fullness`, `hygiene`, and `weight`. The student-facing words in the README are Full, Clean, and Build. Same stats.
- Grimy leads to a cold, and a cold becomes mange after four present days (`care.json`). The bible table sends grimy straight to mange. The cold is an extra rung, written as content.
- Bored raises HP a little and lowers speed. The bible says Guard up a little, and mood falling faster. The extra mood drop is there. The Guard buff is not.
- Primped gives a small mood bonus and wears off. The bible says a primped Checkling refuses to battle in mud or rain. Weather exists. That refusal does not.
- Out of shape lowers battle stats slightly and leads to no disease. The bible's training row sends "too little" toward torn muscle. In the game, torn muscle comes from overtraining.
- Ghost temperament is only a partial match (`content/ghosts.json`). A glowing mushroom, or a life of 60 school days, leaves a calm ghost. Malnutrition, the Glooms, mange, collapse, and couch rot leave an angry one. Heart trouble, burnout, and torn muscle fall through to restless. The bible sorts "too much care" with restless and "a gamble or old age" with calm. Old age is not a cause yet.
- Untested potions are missing, so that instant-death row and its epitaphs are not in `content/epitaphs.json`. The board already held those lines back on purpose.
- A disease can also kill with no roll once health hits 0 (`care.mjs`: the death check is the day's chance, or health already at 0). Untreated illness cuts health by 8 a day, from 100. That hard stop is stronger than the bible's "chance drives every step." Leave it until the open question on care numbers is answered.
- Old age is not a cause of death.
- Day Care does not board a party. The door text says the teacher can send a party there (`places.json`). The teacher page has no such button. "No school today" pauses every body, which is a different tool.
- Contagion is missing. A cold does not spread to a neighbor.
- Condition and sick looks are missing on the sprite. Every form uses the healthy art. See section 4.
- Personalities, favorite foods, and care reactions from `docs/checklings/wave-one.md` are not in the game data. `species.json` has a battle line ("Mochi digs in its heels..."), which is not the field-guide personality.

The live numbers are what the care tests balance against. Changing Bored, Primped, or Out of shape changes who gets sick. That is a design edit, then a content edit, not a quiet fix.

### Collection, shops, and rank

| Feature | Status | Notes |
| --- | --- | --- |
| 300 lines, waves of 12 | Partial | 24 lines and 64 forms are live. Wave One and the Wave 7 set (Skimlet, Cobbit, Breezle, Duskit, Stumpkin, Creekcap, Rumblebee, Clank, Slabbit, Peerlet, Glint, Kindling, plus their forms). About 276 lines to go. |
| Catching charm from the shop | Partial | Five charms a day for a saved trainer, five per visit for a visitor (`growth.json`, `wild.json`). They are free. The store says it is still stocking shelves. |
| Catch lines by place | Missing | The Depth Pack's throw, success, and fail lines are not in the client. A catch is one shared flow. |
| Field guide | Missing | No dex, no silhouette for a seen species, no owned entry. The writing is already in `wave-one.md`. |
| Eggs from foraging, rankings, or the Champion | Missing | The only egg is the one after a death. |
| Streak milestones 3, 7, 14, 30 | Missing in this game | The ticket includes `s` and `b`. `verifyTicket` reads them. `join` in `server.mjs` never uses them. Check-In already pays those days as habitats and keepsakes (`GD_CHECKLING_STAGES` in `apps-script/hall-pass/Code.gs`): Sprout and a Lucky leaf at 3, Buddy and a Pocket pearl at 7, Ace and a Sky feather at 14, Legend and Your own star at 30. The game does not grant an egg, a phrase, or a decoration for the same streak. |
| Merge Stone | Missing as a machine | The prop, the sign, and the art are in the plaza. The sign says the spirals are quiet. No recipe, no merge action. Wave One says recipes stay out of this public repo. |
| Notice board | Partial | It opens weekly battle rankings. It does not post merge recipes, because none can be found. |
| Champion ladder and town-trainer fights | Missing | The arena is the gym. Residents battle each other for show and do not pay coins or items. There is no semester title and no rare egg. |
| Training stumps | Missing as fights | Three stumps and a sign in Kettle Creek. They do not start a battle or give a badge. |
| Nurture rankings | Missing | Longest life, best-kept home, and most species discovered are not counted. Battle rank is. |
| Potions and two items in a battle | Missing | Spirit Sight is the one brew, hardcoded in the ghost flow, not a potion inventory. Strength tonic, stamina draught, clear tea, and slim broth are not items. |
| Forage | Partial | Four spots are on the Kettle Creek map and have signs (`kettle.json` `forage`, `signs.json`). Nothing is picked up. `tools/gen-town.mjs` says forage is map data until the server grants items. The bible's seed gate, waterwheel, and star pond are not on this map. They still exist as daily curios in Pixel Camp (`public/hubs/checkling/camp/engine.js`). The spots in Kettle Creek are a berry bush, the creek bank, an herb garden, and an old stump. |
| Decorating, trophies, furniture | Missing | Home's sign says "rest, decorate and visit the Den." There is no decorate mode. Interiors are one picture, `house-interior.png`. |
| Unlockable phrases | Missing | `content/phrases.json` is the six starter lines. Nothing a student types is sent to another student. That part matches the bible. |
| Merchant economy | Missing | Stalls are scenery. Players cannot sell into a shared stock. |
| Feral runaways | Missing | A Checkling that would run away has no such action. |
| Multi-week mysteries, NPC building, Builders' Guild | Missing | Residents do jobs and short find-and-return stories. They do not propose buildings. The director writes up to three checked lines. It does not plant a mystery. |
| Twelve biomes | Partial | Wilds plus Bramblefen Basin. The other eleven names in the Design Bible are not maps. `apps/checkaverse/experiments/worldgen/` and `docs/checklings/preproduction/` are a lab. They are not what students load. |
| Kettle Creek offline | Missing | See the visit table. |
| Who is who, for the teacher | Missing | The teacher page lists generated trainer names, hour, and place (`public/teacher.js`). The real name never reaches the server, which is correct. The generated name is also never written back to Check-In, so the private roster cannot say which student is Swift Heron. The bible wants both: real names off the map, and the teacher able to tell students apart. |

### Small copy and number drift

- `apps/checkaverse/README.md` still says battle XP stops at 150 a day. `growth.json` says 90. The tests follow 90.
- The teacher page says a removed trainer can reload and come back with a new name (`teacher.html`). A saved trainer keeps the name in `checkaverse.db`. A visitor gets a new random name. A visitor may reroll three times per connection (`REROLLS` in `server.mjs`). A saved trainer gets three renames a day (`renamesPerDay` in `growth.json`), and a reload does not refill them. The word lists are `content/names.json`.
- The AI Team Board Projects tab (31 October 2026) still says battles are not built. That tab is stale. The message board through 12 November is closer, and this file is closer than either.
- `apps/checklings-tools/art-admission/admit.mjs` is a separate pilot (256 pixel sheets, five poses). The live cutter is `apps/checkaverse/tools/admit-checklings.py` (smooth 192 pixel frames, four poses). Use the live cutter for this game.

### Depth Pack flavor that is written and not wired

Place blurbs, item descriptions, catching lines, and the sample overnight sentences in the Depth Pack are not content files. Wave One kept the usable Field Guide lines and the roster table. Those Field Guide lines are the ones to load first. Do not load the Depth Pack's Pebble entry or the slim-broth joke Wave One threw out.

## 3. Bugs, risks, and debt

### Correctness

The battle engine, care clock, tickets, ranks, ghosts, gym, gazette, weather, kettle doors, and basin generator have direct tests, and those tests passed on this run (section below). A few behaviors are easy to misread:

- Ticket field `j` is a unique id from Check-In (`Code.gs`). `verifyTicket` does not read it. The same ticket works until it expires. Reload depends on that, because the tab stores the ticket and sends it again. Rejecting a second use would turn every reload into a visitor unless something else remembers the session.
- The server allows a ticket lifetime up to three hours (`MAX_LIFE_MS` in `accounts.mjs`). Check-In only prints two. A stolen signing key could mint a longer ticket. The key is not in this repo.
- Cross-hour battles still add points. `weeklyRanks` shows each hour's own list, and a trainer's points follow the hour stored on their row. Fighting someone from another hour still scores.
- Removing a saved trainer kicks the connection. The save, the Checklings, and the name remain.
- A turned-down challenge waits three minutes on the connection id (`declined` in `server.mjs`), not on the player id. Reload closes that connection and opens a new one, so the wait is gone. The same-socket test still passes.
- Wins, losses, and battle XP are written before the `battles` row (`finishBattle`). If that insert fails, the log says `battle save failed`, the trainer's record still moved, and the weekly board can miss the match. A catching charm is spent in its own write before the catch is stored. A crash in that gap can spend a charm without keeping the Checkling.
- The picture of a step takes 180 ms (`STEP_MS` in `plaza.js`). The server accepts a step every 110 ms (`MOVE_GAP_MS`). The README describes one pace. A modified page could walk faster than the animation students see, up to about nine steps a second.

### Shared computers and tickets

This is the sharpest classroom risk.

The ticket stays in `sessionStorage` for that tab (`plaza.js`). There is no Leave, no Not me, and no idle sign-out. Desk-save, on the lesson hubs, covers the page until a PIN is entered and signs out when idle. The Checkaverse does not. A student who rides the bus and leaves the tab open leaves their save on that Chromebook. The next person in that tab can feed, battle, catch, rename, and, if they neglect or overfeed across enough later rides, kill that student's Checklings. A new tab with no ticket is only a visitor. The danger is the tab that was left open, and any reload of it, for the rest of the ticket's two hours and then again as long as the stored ticket is still unexpired.

The ticket is removed from the address bar so it is harder to copy off the screen. It is still in the tab's storage.

### Privacy

What is in good shape:

- Tickets have no real name, PIN, or email. The player id is an HMAC of `email::class period` under Check-In's `PIN_SALT`, cut to 22 characters (`rosterKey_` and `checkaversePlayerId_` in `Code.gs`). It does not reverse to a name by itself. The same student in the same class keeps the same id if the ticket key changes. A new class period, a changed email, or a new `PIN_SALT` is a new id. The old Checklings stay on the old id. Nothing in the game moves them over.
- Nicknames go to the owner: the party menu, the overnight card, mail, and the owner's ghost. A classmate's ghost battle does not receive the nickname (`server.mjs` ghost payload).
- The Gazette names a trainer only for good news. Deaths are counts without names.
- The director is fed counts and resident names, not student names, and not deaths.
- Weather asks about Mt. Morris, not about a student.
- Cemetery stones show the generated trainer name, the species, and an epitaph about the Checkling. Player ids are not in the message the class sees.
- Teacher key and ticket key are created on the PC, mode `0600`, and are not in git.

What is unfinished:

- The teacher cannot see who is who. Building that by putting real names in the ticket, or in the game database, would break the privacy rule. The matching belongs in Check-In, which already knows both the student and how to compute the player id.
- The teacher key is kept in that browser tab's `sessionStorage` (`teacher.js`). A teacher who leaves `/teacher` open on a shared machine leaves pause, remove, rewards, and the director controls in that tab.
- All class hours share one plaza, one wilds, and one basin (`server.mjs` room `town`). Rankings and the cemetery are split by hour. The walkable world is not. A student who never closes the tab is standing in the next hour's town. Pause and class rewards hit everyone connected, every hour.
- Twenty-four plots are enough for one class hour. They are not enough if two hours overlap.
- Logs on the PC include the generated trainer name, the first characters of the player id, and the class hour (`join` in `server.mjs`). They do not include the real name. Those logs are still a class record and belong only on the teacher's machine.

### Multiplayer and the home PC

Movement and battle results are decided by the server. Clients predict steps and draw the basin from the shared seed. That split is the right one.

The process is one Node server and one SQLite file (`node:sqlite` `DatabaseSync`) on the home PC, behind a Cloudflare tunnel. Saves are written for catches, care, battles, and the body clock. Position is not a precious save: a reconnect starts at home in Kettle Creek. A crash mid-battle forfeits in the way the battle code already ends an abandoned match. Nightly copies go to the recovery folder the README describes. The Design Bible also asks for a copy on Google Drive and on a second drive. This repo does not show that second copy. Worth confirming on the PC.

Thirty students in one town is inside the 200 connection cap. This audit did not run a timed soak of 30 browsers in the basin. The Design Bible is explicit that an older synthetic test of the small town does not certify Bramblefen. Each saved trainer also has a private resident simulation while they are in Kettle Creek. That cost grows with how many students are home at once, on the same thread as walking and battles. It is a thing to measure before a second giant map, not a failure the tests showed.

The director needs Ollama on that PC. If the model is down, the template Gazette still prints. Students do not see an unchecked line. That part is tested with a fake model.

### Test gaps

`npm test` does not start a browser. `npm run test:browser` runs three files: `world-browser.test.mjs`, `resident-lives-browser.test.mjs`, `fen-browser.test.mjs`. These browser files exist and are not in that script: `news-browser`, `moves-browser`, `ghosts-browser`, `npc-battles-browser`, `battle-art-browser`, `housing-art-browser`, `landmark-art-browser`. On this run the gym browser file failed because a perfect Strike the mark round finished in under six seconds and paid nothing. See the test note at the end. The node gym tests still pass.

`experiments/worldgen/` has its own tests and is not part of `npm test`. `scripts/test-checkaverse-ticket.cjs` runs with the Check-In suite, not with `npm test` in this folder.

Nothing in the automated suite is a school Chromebook on the school network, with a full class, in the basin. The Design Bible's gate 3 is still open.

### Debt that will bite a later change

- Two art admission tools with different pose rules.
- Feature version in `server.mjs`, package version at 0.1.0, README cap of 150 XP.
- Live basin art is recolored town art (`washed` in `plaza.js`) until Wave 8 sheets exist.
- `hurt-*.png` files are on disk and referenced by nothing.
- Open pull requests from October and November still describe engines and art imports that `main` has passed or replaced. See the end of section 5. Merging them into `apps/checkaverse` would put a second game next to the live one, or would redo art that is already wired.

## 4. Art status

`apps/checkaverse/public/art/` has 469 PNGs. The game prefers the `-v2` building and landmark files listed in `LANDMARK_ART` in `plaza.js`, and keeps the original file as a fallback if the new one fails to load.

### Checkling sprites

Every one of the 64 species ids has all six battle files: `front-<id>.png`, `back-<id>.png`, `front-<id>-v2.png`, `back-<id>-v2.png`, `front-<id>-v2-idle.png`, `back-<id>-v2-idle.png`. No species is missing pose art. No pose file belongs to an unknown id.

Lines in the game, base form first:

- Mochi, Thicket, Elderbough
- Bolt, Rivet, Millwright
- Zee, Zenith, Quasar
- Ember, Cinderkit, Kettledrake
- Bramble, Thornbloom, Berryhold, Briarwisp
- Reedling, Marshreed, Lilyback, Riptail
- Lantern, Hearthglow, Kilnback, Sparkwick
- Mossbit, Mossgard, Boulderbud, Flintling
- Spindle, Cloudlet, Flickit, Hushmoth
- Skimlet, Skimmer, Longstride
- Cobbit, Splitstone, Geodome
- Breezle, Gustail, Stormsail
- Duskit, Gloamtail, Moonmantle
- Stumpkin, Oakrise, Burlwood, Twigsnap
- Creekcap, Dewcrown, Floodcap, Dripcap
- Rumblebee, Stormhum, Thunderdrum, Zipwing
- Clank, Brassbright, Ironhull, Rattlebit
- Slabbit, Peerlet, Glint, Kindling

Seventeen `hurt-<id>.png` files exist, for the forms whose source sheets were drawn as front, action, hurt, and back (the 16 November release note). Nothing in `public/` or the content JSON loads them. They are stored for a later hurt pose.

Sprite Book Waves 5, 6, and 7 name these same creatures. Those creature sheets are in the game. The Wave 5 Zee redo is in the set (Zee has the same six files as the others).

### World art that is here

Wave 1 and the Wave 2 remakes that the page actually uses:

- Tiles: `tile-grass`, `tile-path`, `tile-water`, `tile-tall-grass`, `tile-flowers`
- Props: tree, bush, rock, lantern, bench, bus stop, bus, notice board, fence, route sign, bridge, stump
- Neighborhood: empty plot, cottage, stump house, creekside house, locked door, mailbox, one house interior
- Landmarks: market stall, Merge Stone, arena
- Trainers A through D (`trainer-a.png` through `trainer-d.png`). Residents reuse these four looks.
- Kettle Creek: store, apothecary, clinic, day care, cemetery gate, four headstones, town sign
- Fence kit and gate leaf, made from the fence prop
- Eight type tokens (`type-meadow.png` and the other seven)
- Speech bubble: `ui-bubble.png`
- Knockout stars: `fx-knockout.png`
- One battle backdrop: `bg-battle-meadow.png`

Kettle Creek Map Tiles v1 asked for `tile-grass.png`, `tile-dirt-path.png`, `tile-creek.png`, and `tile-stone-path.png`. Grass is there under that name. The other three names are not. The game uses `tile-path.png` and `tile-water.png`, and it paints path edges in code (`paintPaths` in `world.js`) instead of a stone-path tile.

### World art that is missing

Wave 2: hatching egg, starter eggs, rare egg, condition emblems, grime, potion bottles, ingredient icons, trainer gear, glowing mushroom. The knockout stars, tall grass, flowers, fence, footbridge, and meadow battle scene are the pieces from this wave that did land.

Wave 3: trainers E through H, shopkeeper, apothecary keeper, nurse, day care keeper, bus driver, a distinct town trainer, the champion set. Seed gate, star pond, waterwheel. Separate creek-edge, path-edge, and ledge tile sheets. Store, apothecary, clinic, and day care interiors. Overnight-card, stat-bar, button, and battle-panel sprites. Those screens are HTML and CSS. Type tokens are the part of this wave that is present. The training stump and route sign use `prop-stump.png` and `prop-route-sign.png`.

Wave 4: pine, hollow log, mushroom ring, ruined arch, thorn bush, pond plants, fountain, banners, market goods, furniture, Checkling comforts, trophies, seasonal pieces, rare pieces, wall styles, floor styles. Battle backdrops for the creek, practice yard, arena, deep wilds, rocky hills, and windy ridge. Moment effects for hatch, evolution, hearts, merge, hit, and farewell. `battle-fx.js` draws move flashes in code instead. `fx-knockout.png` is the one moment sprite.

Wave 8, all 44 sheets, missing as their own files. The basin recolors town grass, water, trees, and the Merge Stone. The missing set is: meadow grass, packed dirt, cobblestone, creek water, marsh mud, shallow fen water, deep fen water, moss carpet, reed beds, boardwalk planks, round oak, tall pine, birch pair, flowering hedge, stone well, plaza fountain, lamp post, crates and barrel, flower planter, boulder pile, charred tree, windmill, weeping willow, swamp cypress, old snag, cattail clump, lily pads, mossy log, bramble thicket, glowcap ring, stepping stones, boardwalk bridge, stilt hut, fishing dock, marsh lantern, trail marker, campfire ring, supply cache, basin gate, Sunken Arch, Old Mill, Hollow Giant, Leaning Tower, Heron Stone.

The live landmarks in `content/fen.json` are the basin gate, the ranger's hut, the Sunken Arch, the Old Mill, the Hollow Giant, the Lantern Ring, and the Heron Stone. Until Wave 8 arrives, `fen.js` stands in town art: the cemetery gate for the basin gate, a cottage for the ranger's hut, the Merge Stone for the Sunken Arch, the creekside house for the Old Mill, the stump house for the Hollow Giant, a rock for the Heron Stone, and a lantern for the Lantern Ring. Willows and cypresses are recolored `prop-tree`. Wave 8 draws a Leaning Tower and does not name the ranger's hut or the Lantern Ring. Admit art against the live names, and decide the Leaning Tower before anyone draws it as a replacement. Every prop name in `town.json` and `kettle.json` already has a PNG.

Condition overlays for obese, scrawny, sick, and grimy are still an open art job on the AI Team Board (Gemini, not marked done). The bible wants those as overlays on the base sprite, not as a new sprite per species.

### Art direction drift

The Design Bible, 16 November 2026, says the smooth unpixelated look is the one to keep, at full size. The Sprite Book prompts still ask Gemini for chunky pixels. The files admitted into `public/art` followed the smooth decision (`content/checkling-art.json`, the 16 November release note). New sheets should follow the Design Bible. The pixel paragraph in the Sprite Book is the older instruction.

## 5. Roadmap

Order: keep the live class safe, finish the visit the bible already describes, then add the competitive machines, then another biome. Each item is one pull request. None of them replace `content/town.json`, `content/kettle.json`, the species already shipped, or the ticket fields a current Check-In already sends.

Ship path for every code item: `npm test` in `apps/checkaverse`, then the browser check that item names, then copy the changed files to `C:\Checklings\checkaverse` and run `restart-server.ps1` there. Check-In items also need a new Apps Script version on the existing deployment. Do not reset, force-push, or deploy from a draft stack.

### Phase A. Shared machines and the teacher

**A1. Leave this Chromebook.** A menu control clears the stored ticket, closes the socket, and leaves a visitor screen. Reload after Leave stays a visitor until a new ticket arrives. Reload before Leave still resumes the same trainer, so a refresh in class does not kick anyone out.

Done when: a test covers Leave, then reload, then a second ticket in the same tab. A student with no ticket still cannot write a save. Existing ticket tests still pass.

**A2. Idle return.** After a stretch with no walking, tapping, or battle input, do the same clear as Leave. Start at 20 minutes, matching the lesson hubs, unless the open question below picks another number. The turn clock and an open menu count as activity.

Done when: a test clock fires the clear, and a battle that is still being picked does not fire it.

**A3. Who is who, inside Check-In only.** On the teacher's private Check-In view, show the generated trainer name next to the student. Compute it by asking the game server for the name of a player id Check-In already knows, with the ticket key. Do not add the real name to the ticket, the plaza, the Gazette, or `checkaverse.db`.

Done when: `scripts/test-checkaverse-ticket.cjs` still proves the ticket has no real name, and a teacher-side check shows a trainer name for a synthetic student. Other players' messages stay free of that real name.

**A4. Teacher page copy.** Say that Remove disconnects the trainer, and that a saved trainer keeps their name and their Checklings.

Done when: the sentence in `teacher.html` matches `accounts.mjs`, and the teacher browser test, if one is added, reads that sentence.

### Phase B. The rest of a five-minute visit

**B1. Coins and the general store.** One content file for the daily coin allowance and the prices. Check-in pays coins once, the way it pays XP once. The store door opens a shop for food, charms, and a brush. The Care panel can keep using what the student already bought. Visitors can spend a visit purse and keep nothing.

Done when: a test buys a charm, refuses a purchase that costs more than the purse, and reloads without paying the day's coins twice. The store line in `places.json` no longer says the shelves are empty.

**B2. Forage.** The four existing Kettle Creek spots grant one ingredient a day. The day's find is chosen with the same seed for every trainer, as the bible asks. A second tap says it was already gathered.

Done when: two test trainers get the same item from a spot on the same school day, and a third tap does not grant another. Ingredients are data, not special cases in `server.mjs`.

**B3. Potions.** Add the four bible potions plus the untested potion as content. Spirit Sight stays two grave moss and ten minutes, and becomes a row in that same list instead of a one-off. A trainer may bring two items into a battle. Clear tea cures a cold. Slim broth moves weight over three days. An untested potion can kill, with the epitaphs that were written and held back.

Done when: content tests cover each potion's effect, a battle test applies a tonic for one match only, and the mushroom test still passes. The apothecary door opens the cauldron.

**B4. Field guide.** Load the Wave One personalities, routines, and valley notes into a content file. A seen species shows a silhouette. An owned species shows the entry. No new creatures in this PR.

Done when: a test student who has only Mochi sees Bramble as a silhouette after meeting one, and sees Mochi's real entry. The text matches `wave-one.md`.

**B5. Show the body on the sprite.** Wire overlay images for obese, scrawny, sick, and grimy, starting with the four starters. The Gemini job on the team board is this art. Missing art falls back to the healthy sprite, so the game never shows a broken image.

Done when: a battle and the care card for an obese Mochi request the overlay file, and a species with no overlay still draws `front-<id>.png`.

**B6. Streak rewards, once each.** Remember the highest milestone already paid (3, 7, 14, 30). The ticket's streak is already on the bus. Pay the reward Grant picks in the open questions. Do not pay it again on reload.

Done when: a test ticket with streak 7 pays once, and a later ticket with streak 7 pays nothing new.

**B7. Day Care for one party.** The teacher can park one saved trainer's party so its clock pauses, and can take it back. This is not "No school today," which stays global.

Done when: a parked party does not decay across a present day, and an unparked party in the same test does. The day care door tells the student whether their party is parked.

### Phase C. Rank, merge, and the champion

**C1. Training stumps.** The three stumps start a short computer battle and pay a little XP inside the existing daily cap. A badge is a content flag, shown in the field guide, with no item trade.

Done when: a stump battle ends, pays XP, and a second stump the same day still respects the cap.

**C2. Champion ladder.** Four scripted trainers in the arena, separate from the gym mini-games and from resident show battles. Once a semester, a clear pays a title and a rare egg. Losing costs nothing but the match.

Done when: a test clears the four, receives one egg, and a second clear in the same semester does not receive another. Rank points are unchanged by these matches.

**C3. Nurture boards.** Three more weekly lists for the class hour: longest living partner, best kept body, most species owned. Same privacy rule as battle rank. No player id leaves the server.

Done when: a unit test builds the lists from fixture rows, and the notice board can open them.

**C4. Earned phrases.** A content list, locked behind an evolution, a champion clear, a rare catch, or a streak. The say menu only shows phrases that trainer has earned. Students still cannot type to each other.

Done when: a test trainer without the flag cannot send the locked phrase, and a forged message index is ignored.

**C5. Merge Stone.** Recipes live in a file on the PC, next to the ticket key, not in git. Wave One already says the public repo does not hold them. A successful merge consumes both Checklings and posts the result, not the recipe's inputs, on that class hour's notice board.

Done when: a test fixture recipe merges, a wrong pair does not, the public content folder has no recipe list, and the notice board test sees the result name only.

### Phase D. One biome at a time

**D1. Class hour in Bramblefen, before any new map.** Grant, or a supervised class, walks a group into the basin on school Chromebooks: travel, a wild battle, a catch, teacher pause, a reconnect, and the bus home. Write the result in a short release note. This is the Design Bible's gate 3. It is not a feature PR.

Done when: that note exists and names what broke, or says nothing broke.

**D2. Wave 8 art for the basin.** Admit the 44 sheets through `tools/admit-checklings.py` or a sibling cutter with the same magenta rules. Point `fen.js` at the new files. Keep the recolor path as the fallback when a file is missing.

Done when: the fen browser test still matches the server hash, and a missing sheet still draws the recolor instead of an empty hole.

**D3. The next biome, only after D1.** Copy the Bramblefen pattern: one content file, one seed, one version, a hash, chunked drawing, encounter tables that use species already admitted. Do not paste `experiments/worldgen/` into `server.mjs` in the same PR. Do not turn on all eleven remaining regions.

Done when: two test clients share the hash, every landmark is reachable, and `npm test` still passes with the new file unloaded from the live path if its art is not ready. The town and Kettle Creek JSON stay byte for byte the same.

**D4. Further species waves.** Twelve lines at a time. Each line needs a personality, a care line, a field-guide entry, a place in a habitat table, stats, moves, and admitted front, back, and idle art. `battle.test.mjs` already refuses a same-stage matchup more lopsided than 9 in 10. Keep that gate.

Done when: that test passes with the new forms, and a student who has not reached the new habitat does not meet them on Route 1.

### Do not start these

- Free text chat, trading, a day and night cycle, shinies, abilities, natures, held items, real-money purchases. The bible lists them as out.
- A second care engine or a second living world beside `apps/checkaverse`. Open PR 370 (`apps/checklings-world`) and the October draft stack gathered in PR 369 (PRs 223 through 240) are that kind of duplicate. They are not the live server.
- PR 361 and PR 284 as an art redo. The v2 houses, stalls, arena, bus, and notice board are already what `plaza.js` draws. PR 358 and PR 359 merged on 13 November.
- PR 365 as a drop-in of the streaming lab. The lab's own note says it has no tickets, catches, or battles. Bramblefen's chunk painter is the one students use.
- Pixel Camp removal, until the open question below is answered. Deleting it now strands the camp's own saves.
- Any change that makes death, absence, or a knockout gentler without asking first. The bible forbids that.

Issue 360 is a tracker of unpublished branches. Several of its Checklings rows still say "review" for pull requests that have since merged. Do not treat that checklist as the list of missing game features.

## 6. Open questions

Only Grant can answer these. The roadmap does not guess.

1. One shared town for every class hour, or a separate town per hour during the school day? Rankings are already per hour. The map is not. A split would stop hours from mixing, and it would also stop friends in different hours from meeting.
2. How many minutes of no input should sign a Chromebook out of the Checkaverse? Twenty matches the lesson hubs. A class period is longer than that if the student is only reading.
3. For "who is who," is the Check-In teacher view the right place, with real names staying out of the game server?
4. Is Pixel Camp still part of class, or has Checkaverse replaced it? The camp is still linked from the site, and its bus link drops students in as visitors.
5. What should streaks of 3, 7, 14, and 30 days pay in this game? Check-In already gives a habitat and a keepsake at each of those days (Lucky leaf, Pocket pearl, Sky feather, Your own star). Should the town add an egg, a phrase, or a decoration on top of that, or is the Check-In reward enough?
6. Should a cold spread to Checklings standing nearby? The bible includes contagion. It also creates a way for one student to sicken another.
7. Is Day Care for a single absent student worth building, given "No school today" already pauses everybody?
8. Who writes merge recipes, and do they stay only on the PC, out of GitHub, as Wave One says?
9. Future Sprite Book pages: follow the smooth art decision in the Design Bible, or keep asking Gemini for chunky pixels?
10. After the basin has been played by a real class, which biome is next? The bible's list starts the remaining set with Cindergear Expanse, Tempest Crown, and the others. The visit in section 2 is still missing its shops, so a new map can wait.
11. Is the home PC the host through this school year? The bible's move to a small rented server is a copy and a tunnel change, and it is the backup plan if the PC's uptime becomes the problem.
12. Should a mean Checkling be harder to raise? The bible calls that an idea, and says the table has to be filled before anyone builds it.
13. Leave the live Bored, Primped, and Out of shape numbers as they are? They are what the 60-day care test balances. Matching the bible's Guard buff and rain refusal would be a balance change.
14. May a visitor (no ticket) walk around during class and battle with a level 10 starter? They keep nothing. They do take a plot if one is free, and they can challenge saved trainers.

## Tests run for this audit

On 17 November 2026, Node 22.23.4, in `apps/checkaverse`:

`npm test` exited 0. Every suite it runs passed: living world, resident lives, resident lives on a real server, care, battle rules (including the 1664 same-stage pairs), accounts, the multi-player end to end check, Kettle Creek, ghosts, resident battles, moves and gym, news, weather and events, and Bramblefen (generator hash `554b5ea5`, built in 166 ms in that run).

`npm run test:browser` exited 0 against a throwaway server and synthetic tickets, in headless Chromium. Living world browser passed, including 390px and 320px touch and reduced motion. Resident lives browser passed, including a real delivery and a reconnect. Bramblefen browser passed: the page built the basin in 115 ms, the hash matched the server (`554b5ea5`), the 171 step walk to the Sunken Arch held about 57 frames a second (95th percentile frame 17 ms, worst frame 50 ms, 32 chunks painted, 12 kept), a signpost read, and the map opened. Playwright was not installed in the checkout. It was installed outside the repo so this command could run. That install is not part of the pull request.

The other browser files were run in the same checkout, one at a time, against their own throwaway servers. These passed: news, ghosts, resident battles, battle art (Bolt, Ember, Zee), housing art, and plaza landmarks. `moves-browser.test.mjs` failed on the first mini-game. The server log for that run is `gym round ... vine_lash 100 0`: a perfect score and zero points. A round shorter than `minRoundMs` (6000) earns nothing (`learnsets.json`, `gymMessage` in `server.mjs`). The test's player finishes Strike the mark faster than six seconds, so the score line it looks for never arrives and the assertion sees `NaN`. That is the anti-script rule doing what it says. It also means a very fast perfect round pays nothing, and this browser test is sensitive to how fast the player is. It was not re-run with a slower player. `moves.test.mjs` inside `npm test` passed, including "too quick or made up rounds earn nothing."

The Check-In ticket script and the worldgen lab were not run. They are separate suites. Nothing here was played on a school Chromebook. The frame numbers above are this machine, not a school Chromebook.
