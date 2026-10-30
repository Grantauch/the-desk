# Checkaverse server

The live multiplayer town for Checklings. Read `docs/checklings/DESIGN.md` first.

Players get a random trainer name and arrive at the bus stop (a class arriving at once spreads out onto free tiles) in a scrolling town with a plaza on the west side and the Neighborhood on the east. The Neighborhood has 24 plots, enough for a full class hour, nearest ones first. Each player's house drops into a free plot when they arrive and leaves when they log off. Other players can walk in through the front door unless the owner locks it. Players walk with the keys or by tapping where they want to go, and tapping a landmark (or facing it and pressing Space) reads its sign from `content/signs.json`. Each player can reroll their trainer name three times a visit. Trainer name words in `content/names.json` must hold up to a room of teenagers looking for something to mock: no food, no body or size words, nothing that is slang for an insult or innuendo in any pairing. `npm test` refuses a list of known bad words; read every new word with every partner before adding it. Movement is predicted on screen: your trainer steps the moment you press, at a steady 180 ms a tile, and the server checks every step behind it and corrects the rare disagreement. Other trainers glide through the tiles the server reports at the same pace. Players talk with the starter phrases (one every two seconds; in a crowd only nearby trainers and talkers show name tags) from the design bible, set themselves to Busy, and send and answer challenges. A turned down challenger waits three minutes before challenging that trainer again. Battles, tickets from Check-In and decorating come in Phase 3.

Maps, phrases and trainer name words are content in `content/`. Town props (the arena, market stalls, bus, Merge Stone, lanterns and the rest) are listed in `town.json` with their art and position, and their footprint tiles are solid.

## Art

The town is drawn with the Wave 1 Sprite Book art Gemini made (Checklings Sprite Book in Grant's Drive, PNGs in its Wave 1 Sprites folder). `public/art/` holds the cut out copies at 2x, 64 pixels a tile, and the server sends them at `/art/<name>.png`. The Kettle Creek buildings and headstones are cut too, ready for Kettle Creek. To redo the art after Gemini changes a picture, download the folder and run `python3 tools/cut-sprites.py <downloaded folder> public/art` (needs Pillow, NumPy and SciPy). It removes the magenta, trims, sizes each sprite to its tile size, splits the trainer sheets into 64 by 96 frames and makes the ground textures seamless. If a picture ever fails to load, the plaza draws the old placeholder shape in its place. Change the town layout in `tools/gen-town.mjs`, then run `node tools/gen-town.mjs` to rebuild `content/town.json` and `content/house.json`.

## Where it runs

The live copy is on Grant's PC in `C:\Checklings\checkaverse`, reached at https://game.grant-desk.com through a Cloudflare Tunnel. No router ports are open. It moved from the D drive to C on Oct 30, 2026, after the D drive (the 8 TB WD hard drive) started failing with disk errors and dropped off; the tunnel credentials stay in `C:\Users\Grant\.cloudflared`.

| Folder | What is in it |
| --- | --- |
| `C:\Checklings\checkaverse` | This code, the copy that runs |
| `C:\Checklings\storage` | `checkaverse.db` and the `logs` folder |
| `C:\Checklings\recovery` | Nightly database copies, newest 30 kept |
| `C:\Checklings\tunnel` | `cloudflared.exe`, `config.yml`, `run-tunnel.cmd` |

Two scheduled tasks in Windows Task Scheduler start everything when Grant signs in: **Checkaverse Server** runs `run-server.cmd`, **Checkaverse Tunnel** runs `run-tunnel.cmd`. Both loop, so a crash restarts in a few seconds. **Checkaverse Backup** runs `backup.mjs` nightly.

## Commands

Run inside this folder with Node 22.13 or newer.

| Command | What it does |
| --- | --- |
| `npm install` | Installs the one dependency, `ws` |
| `npm test` | Starts a throwaway server and runs a two player end to end check |
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

## Moving to a rented server

1. Copy this folder and the newest file from `recovery` to the new machine as `storage/checkaverse.db`.
2. `npm install`, then run it under a process manager such as systemd.
3. Install cloudflared there and copy the tunnel credentials file and `config.yml`, changing only the credentials path.
4. Start the tunnel on the new machine, then stop the Checkaverse Tunnel task on the PC. The address does not change.

## Updating the live copy

Change code here, run `npm test`, then copy the changed files into `C:\Checklings\checkaverse` and run `restart-server.ps1` there. It stops only the Checkaverse node process, and the loop starts it again with the new code within five seconds. Players see a restart notice and reconnect on their own. Never stop node processes by name alone, since other programs on the PC run files called server.mjs too.
