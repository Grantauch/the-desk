# Checkaverse server

The live multiplayer town for Checklings. Read `docs/checklings/DESIGN.md` first.

This first release is a test plaza. Players get a random trainer name, walk a shared map, talk with preset phrases, set themselves to Busy, and send and answer challenges. Battles, tickets from Check-In, houses and the full town come in Phase 3.

## Where it runs

The live copy is on Grant's PC in `D:\Checklings\checkaverse`, reached at https://game.grant-desk.com through a Cloudflare Tunnel. No router ports are open.

| Folder | What is in it |
| --- | --- |
| `D:\Checklings\checkaverse` | This code, the copy that runs |
| `D:\Checklings\storage` | `checkaverse.db` and the `logs` folder |
| `D:\Checklings\recovery` | Nightly database copies, newest 30 kept |
| `D:\Checklings\tunnel` | `cloudflared.exe`, `config.yml`, `run-tunnel.cmd` |

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

Change code here, run `npm test`, merge, then copy the changed files into `D:\Checklings\checkaverse` and end the **Checkaverse Server** task's node process. The loop restarts it with the new code. Players see a restart notice and reconnect on their own.
