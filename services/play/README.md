# Play server

Room server for two player games on grant-desk.com. It pairs players with a quick match or a four letter room code, passes their messages back and forth, and calls the match when a player is overrun, surrenders or stays disconnected for 30 seconds. It stores nothing. Rooms are held in memory and disappear when a match ends.

Public address: `wss://play.grant-desk.com/ws`. Health check: `https://play.grant-desk.com/health`.

Until the `play` DNS record exists, the same server answers at `wss://margin.grant-desk.com/play/ws` (health at `https://margin.grant-desk.com/play/health`) through a `handle_path /play/*` block in `/etc/caddy/sites/margin.caddy`. The game tries play.grant-desk.com first and falls back to that address, so adding the DNS record needs no code change.

## Where it runs

grant-server (OVH VPS, Virginia). Owner Claude. Port 4200 on 127.0.0.1, range 4200 to 4299 claimed in `/srv/PORTS.md`. Caddy terminates TLS and proxies the WebSocket.

| Path on the server | What it is |
|---|---|
| `/srv/play/app` | server.mjs, package.json, package-lock.json and node_modules |
| `/etc/systemd/system/play.service` | the service, runs as the `play` system user |
| `/etc/caddy/sites/play.caddy` | the public site |

DNS: `play.grant-desk.com` A record to the server's IPv4, DNS only.

## Deploy

Copy `server.mjs`, `package.json` and `package-lock.json` to `/srv/play/app`, run `npm ci --omit=dev` there as `play`, then `sudo systemctl restart play`. Add a line to `/srv/LOG.md`.

## Test

`npm test` starts a private copy and checks codes, joining, relaying, a full room, a bad code, reconnecting, losing, quick match, a disconnect forfeit and the origin check. `PLAY_URL=wss://play.grant-desk.com/ws PLAY_ORIGIN=https://grant-desk.com npm test` runs the same checks against the live server.

Only pages served from `https://grant-desk.com` may connect. Set `ORIGINS` in the unit to allow another site.

## Games

Blitzkrieg 1 v 1 (`public/hubs/blitzkrieg/js/versus.js`). Add a game by naming it in `GAMES` in server.mjs.
