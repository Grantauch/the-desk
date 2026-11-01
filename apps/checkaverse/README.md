# Checkaverse server

The live multiplayer town for Checklings. Read `docs/checklings/DESIGN.md` first.

Players get a random trainer name and arrive at the bus stop (a class arriving at once spreads out onto free tiles) in a scrolling town with a plaza on the west side and the Neighborhood on the east. The Neighborhood has 24 plots, enough for a full class hour, nearest ones first. Each player's house drops into a free plot when they arrive and leaves when they log off. Other players can walk in through the front door unless the owner locks it. Players walk with the keys or by tapping where they want to go, and tapping a landmark (or facing it and pressing Space) reads its sign from `content/signs.json`. Each player can reroll their trainer name three times a visit. Trainer name words in `content/names.json` must hold up to a room of teenagers looking for something to mock: no food, no body or size words, nothing that is slang for an insult or innuendo in any pairing. `npm test` refuses a list of known bad words; read every new word with every partner before adding it. Movement is predicted on screen: your trainer steps the moment you press, at a steady 180 ms a tile, and the server checks every step behind it and corrects the rare disagreement. Other trainers glide through the tiles the server reports at the same pace. Players talk with the starter phrases (one every two seconds; in a crowd only nearby trainers and talkers show name tags) from the design bible, set themselves to Busy, and send and answer challenges. A turned down challenger waits three minutes before challenging that trainer again. Decorating comes later in Phase 3.

## Bus tickets and saved trainers

Students ride the bus from the **ride the bus to the Checkaverse** button on their Checkling card in Check-In. Check-In prints a ticket good for two hours and the student taps **board the bus**, which opens `https://game.grant-desk.com/#t=<ticket>`. The page moves the ticket into that tab's session storage, takes it out of the address bar, and sends it in its first message (`hello`). A page that never says hello joins as a visitor after 2.5 seconds.

The ticket is signed with HMAC SHA-256. It carries an anonymous player ID (a keyed hash of the class membership, so the same student in the same class always gets the same ID), the class hour, today's date and check-in, the count of official check-ins, the streak, and the hatched Checkling's species and nickname. It carries no name, PIN or email. `accounts.mjs` checks it: signature, at most three hours of life, not expired, a known species. Anything wrong and the student visits instead, with a line saying why.

**The key.** The server makes `ticket-key.txt` in the data folder on first start. The same value goes into Check-In once: put it in the private workbook's Settings tab under `CHECKAVERSE_TICKET_KEY`. The first ride moves it into Check-In's script properties and replaces the cell with `Stored privately`. To change the key, delete `ticket-key.txt`, restart, and paste the new value into Settings the same way. Saved trainers keep their saves, because player IDs do not depend on this key.

**What is saved** (tables `trainers` and `checklings` in `checkaverse.db`): trainer name, outfit, class hour, wins, losses and draws, the battle partner, every Checkling with its XP, and whether it is in the party or the Den. Nicknames are typed by students, so they only ever go to their owner's screen; other trainers see the species.

**Growth** is content in `content/growth.json`. Every official check-in pays 100 XP to the battle partner at the next ride, so a student who checks in but skips the game for a week loses nothing. The level curve reaches 15 near 28 check-ins, 30 near the end of first semester and 50 near the end of the year. Battles pay a little XP to the Checkling that fought, up to 150 a day. Charms (5) and new names (3) are counted per day on the server, so a reload does not refill them. The party holds 3, always keeps at least one, and resting the partner hands the job to the next one. The Den holds 60.

**Weekly rankings.** The notice board in the plaza (or This week's rankings in the menu) shows the battle ranking for the trainer's own class hour, counted from the `battles` table by `weeklyRanks` in `accounts.mjs`. Only battles between two saved trainers count: a win is 3 points and a tie 1, both walking away counts nothing, and only the first 3 results against the same classmate each day count, so friends cannot farm each other. Weeks start Monday in Michigan time. The board shows the top 10 plus your own place. Numbers are in the `ranks` block of `content/growth.json`. Player IDs never leave the server.

**The Checkling body (0.12.0).** Every saved Checkling has a body: Full, Clean, Mood, Health and Build. The **Care** button (bottom left) feeds, treats, grooms, plays, naps and gives medicine, with daily limits. All the rules are content in `content/care.json`, run by `care.mjs`, and checked at startup. Doing too much or too little of anything sets a condition (obese, scrawny, grimy, bored, wired, lazy, exhausted, primped, overtrained, out of shape). Each condition changes battle stats and builds risk of its disease. A disease left untreated costs Health every day and can kill. Medicine is one dose a day for a set number of days, and medicine with nothing to cure has side effects. A glowing mushroom sometimes turns up after a won wild battle, and eating one is a 2% gamble.

The body clock ticks once per school day (`content/calendar.json`, copied from the district calendar in Check-In), only on days the server was up (`up:<day>` rows in `meta`), and only for the party. The Den is paused. Nights are run when the trainer next rides the bus. Days the student checked in let the ladder climb. Absent days only decay down to floors, so absence never starts a condition, a disease or a death. The teacher page has **No school today** for snow days. Tested balance over 60 school days: steady or spotty good care never kills. Overfeeding or checking in and never caring kills near school day 20, with the first sickness near day 8, and starting care at the first sickness saves about nine in ten.

A death writes a headstone with an epitaph (`content/epitaphs.json`) to the class cemetery (menu, **Class cemetery**), shows the student a headstone card, and owes an egg at the next check-in. The egg hatches five check-ins later into the starter the student picks. There is no revive. Check-In's own card still shows the first hatched Checkling, and the town never brings a dead one back.

**One screen per trainer.** Opening the town in a second tab closes the first (close code 4002), so nothing is counted twice.

## Screen and tips

The map fills the whole screen, always 16 tiles tall and as wide as the screen. Everything else floats over it: where you are and the live count top left, your trainer name and record top right with a menu (Busy, new name, outfit, walk home, lock door, show tips again, bus home), your battle partner and Say bottom left, and a Challenge button bottom right that only appears when another trainer is next to you. Touch screens get a walking pad; keyboards do not. Instead of a wall of instructions, short tips pop up the first time each thing matters (walking, your partner, Say, challenging, signs, the gate, the wilds, battles, catching). Each shows once per browser tab, so the next student on a shared Chromebook sees them too. The tip text is the `TIPS` list in `public/plaza.js`.

## The wilds

The gate at the top of the plaza street leads north into the wilds (`content/wilds.json`, drawn by `tools/gen-town.mjs`). Maps link through exit tiles: stepping onto an `E` tile walks into the map and spot its `exits` entry names. The wilds have four terrain zones, each its own tile letter: tall grass `G`, starflower clearing `C`, rocky ridge `R` and scorched heath `A`, split by a creek with one bridge. `content/wild.json` sets each zone's encounter rate, wild levels and which species appear, plus charms per visit and the catch odds. Every step into a zone can start a wild battle, with a few free steps right after a battle. Wild battles use the same engine and screen. The wild Checkling picks its move instantly, and the trainer can also throw a catching charm (5 per visit until the shop opens; the weaker the wild one, the better the odds) or run, which always works. A trainer who rode the bus from Check-In keeps every catch (party first, then the Den) and gets 5 charms a day. A visitor keeps catches and gets 5 charms only for the visit. The server checks `wild.json` at startup and refuses a zone with no tiles or an unknown species. Tall grass and starflower art come from the Wave 2 Sprite Book; run `python3 tools/cut-wilds-art.py <downloaded folder> public/art`. Rocky ground and scorched heath tint the existing path and grass art.

## Battles

An accepted challenge opens a live battle on both screens, laid out like Red and Blue: the other Checkling's front at the top right, your partner's back at the bottom left. Each turn both trainers pick one of four moves (keys 1 to 4 or tap), then the server plays the turn and every screen shows the same events in order. Guard, Recover and shields act before any hit lands; attacks go in Speed order. A trainer who has not picked when the 30 second clock runs out Guards. Three missed turns in a row forfeits, and if both trainers walk away it is a draw. Giving up (two presses) or leaving the page forfeits. Nobody can walk off or be challenged mid battle, and the teacher pause stops every clock. Trainers within six tiles get a Watch battle button and see the same screen without the moves. Knockouts never hurt a Checkling.

A saved trainer battles with their own Checklings at their real levels. A visitor battles with one of the four starters at level 10, picked under Battle partner and remembered on that Chromebook. Every finished battle is saved in the `battles` table with its seed, every pick and the anonymous player IDs of saved trainers, so any match a student reports can be replayed exactly and weekly rankings can be counted later.

All the rules are content in `content/battle`: `types.json` (the eight types, each strong against two and weak against two; the founder loop is Ember over Meadow over Gear over Cosmic over Ember), `species.json` (stats and moves), `moves.json` and `settings.json` (turn clock, turn limit). `battle.mjs` is the engine and refuses broken content at startup. `battle.test.mjs` checks the content, replays, signature moves and that no starter matchup is one sided. Tune numbers in the content files, never in code. The battle art comes from the Wave 2 Sprite Book folder: run `python3 tools/cut-battle-art.py <downloaded Wave 2 folder> ../../public/hubs/checkling/pets public/art`. Fronts use the approved founder art because the Wave 2 Zee front has a magenta belly.

Maps, phrases and trainer name words are content in `content/`. Town props (the arena, market stalls, bus, Merge Stone, lanterns and the rest) are listed in `town.json` with their art and position, and their footprint tiles are solid.

## Art

The town is drawn with the Wave 1 Sprite Book art Gemini made (Checklings Sprite Book in Grant's Drive, PNGs in its Wave 1 Sprites folder). `public/art/` holds the cut out copies at 2x, 64 pixels a tile, and the server sends them at `/art/<name>.png`. The Kettle Creek buildings and headstones are cut too, ready for Kettle Creek. To redo the art after Gemini changes a picture, download the folder and run `python3 tools/cut-sprites.py <downloaded folder> public/art` (needs Pillow, NumPy and SciPy). It removes the magenta, trims, sizes each sprite to its tile size, splits the trainer sheets into 64 by 96 frames and makes the ground textures seamless. If a picture ever fails to load, the plaza draws the old placeholder shape in its place. Change the town layout in `tools/gen-town.mjs`, then run `node tools/gen-town.mjs` to rebuild `content/town.json` and `content/house.json`.

## Ground comfort

Grass uses a muted sage wash, path stones are smaller and warmer, and a low mossy curb runs along path edges. Connected paths have no internal curb. This is prepared in the cached ground canvas; original sprites, collision tiles, movement and camera behavior stay unchanged.

## Loading updates

Student and teacher pages include a content version in their script and stylesheet addresses. Returning players receive changed code or styles on an ordinary visit or reload, while unchanged files remain cacheable. Versions follow the current file bytes automatically, including client-only updates; no manual version bump or cache clearing is required.

## Teacher controls

Open https://game.grant-desk.com/teacher and enter the teacher key from `C:\Checklings\storage\teacher-key.txt` on the PC (made on first start, never in the repo; delete the file and restart to get a new one). The page lists every trainer here now and where they are, pauses and resumes the whole town (nobody can walk, talk or challenge while paused), sends a short message that pops up on every screen, and removes a trainer, which closes their connection until they reload. Every call is logged.

## Where it runs

The live copy is on Grant's PC in `C:\Checklings\checkaverse`, reached at https://game.grant-desk.com through a Cloudflare Tunnel. No router ports are open. It moved from the D drive to C on Oct 30, 2026, after the D drive (the 8 TB WD hard drive) started failing with disk errors and dropped off; the tunnel credentials stay in `C:\Users\Grant\.cloudflared`.

| Folder | What is in it |
| --- | --- |
| `C:\Checklings\checkaverse` | This code, the copy that runs |
| `C:\Checklings\storage` | `checkaverse.db`, `teacher-key.txt`, `ticket-key.txt` and the `logs` folder |
| `C:\Checklings\recovery` | Nightly database copies, newest 30 kept |
| `C:\Checklings\tunnel` | `cloudflared.exe`, `config.yml`, `run-tunnel.cmd` |

Two scheduled tasks in Windows Task Scheduler start everything when Grant signs in: **Checkaverse Server** runs `run-server.cmd`, **Checkaverse Tunnel** runs `run-tunnel.cmd`. Both loop, so a crash restarts in a few seconds. **Checkaverse Backup** runs `backup.mjs` nightly.

## Commands

Run inside this folder with Node 22.13 or newer.

| Command | What it does |
| --- | --- |
| `npm install` | Installs the one dependency, `ws` |
| `npm test` | Checks the battle rules, then starts a throwaway server and runs a multi player end to end check |
| `npm start` | Runs the server on http://127.0.0.1:8787 |
| `npm run backup` | Makes a database copy now |

Health check: http://127.0.0.1:8787/health locally, https://game.grant-desk.com/health from anywhere.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHECKAVERSE_PORT` | 8787 | Port to listen on |
| `CHECKAVERSE_HOST` | 127.0.0.1 | Only the tunnel on the same machine can reach it |
| `CHECKAVERSE_DATA` | `../storage` | Database and logs |
| `CHECKAVERSE_RECOVERY` | `../recovery` | Nightly copies |
| `CHECKAVERSE_BACKUP_DIRS` | none | Extra backup folders, separated by semicolons |
| `CHECKAVERSE_ORIGINS` | grant-desk.com hosts and localhost | Sites allowed to open a live connection |
| `CHECKAVERSE_MAX_PLAYERS` | 200 | Connection cap |
| `CHECKAVERSE_TICKET_KEY` | `ticket-key.txt` | Overrides the bus ticket key file |

## Moving to a rented server

1. Copy this folder and the newest file from `recovery` to the new machine as `storage/checkaverse.db`.
2. `npm install`, then run it under a process manager such as systemd.
3. Install cloudflared there and copy the tunnel credentials file and `config.yml`, changing only the credentials path.
4. Start the tunnel on the new machine, then stop the Checkaverse Tunnel task on the PC. The address does not change.

## Updating the live copy

Change code here, run `npm test`, then copy the changed files into `C:\Checklings\checkaverse` and run `restart-server.ps1` there. It stops only the Checkaverse node process, and the loop starts it again with the new code within five seconds. Players see a restart notice and reconnect on their own. Never stop node processes by name alone, since other programs on the PC run files called server.mjs too.
