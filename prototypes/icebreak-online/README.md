# ICEBREAK online multiplayer — isolated first implementation

This is a working **server-authoritative room and transport prototype**, not the finished ICEBREAK online mode. It intentionally lives outside production game clients and outside the files held by Team Desk tasks #159 (final game server) and #160 (both site's online clients).

## Built now

- Real WebSocket server accepts **eight distinct browser connections**, with exactly eight exclusive on-ice positions: CENTER/WING/DEFENDER/GOALIE on each team.
- Six-character lobby code, unique opaque reconnect ticket per seat, host-controlled start, ready checks, and a hard ninth-seat rejection.
- 90 Hz server-owned hockey *prototype* world with movement, puck possession/passing/shooting, goals, basic contact/knockdown, goalie crease limits, clock, faceoffs and injury timeout. AI controls unclaimed or disconnected seats. It emits one shared game snapshot every 50 ms.
- Input-only client messages: sequenced, bounded analog axes and boolean actions. Forged score/position/clock messages are refused. Input expires after 350 ms.
- Bounded frames, connection limits, rate limiting, explicit allowed origins, short reconnection grace, room expiry, and localhost-only application binding.
- Includes test cases with **eight actual WebSocket client connections**, synchronized snapshots, a rejected ninth client, reconnect ownership, invalid inputs and state-forgery rejection.

## NOT DONE

This **does not** yet port the mature ICEBREAK skating, checking, puck, one-timer, goalie, Shift Book, powerups, and visual behavior from `public/hubs/icebreak.html` into a headless shared game core. The prototype's simplified physics **must not be deployed as a replacement** for the current production game. The live sites are currently local-only. The real eight-person online mode requires task #159's production headless game core and task #160's client/lobby integration, followed by Claude-approved TLS/WSS proxy deployment and tests.

## Run locally

Requires Node 22 or newer. No npm dependencies.

```sh
cd prototypes/icebreak-online
npm test
NODE_ENV=development ICEBREAK_PORT=4401 npm start
```

Open `http://127.0.0.1:4401/demo` in separate browser tabs (up to eight), or connect programmatically to `ws://127.0.0.1:4401/ws`. The HTTP demo route and missing-Origin upgrade allowance are *disabled* when `NODE_ENV=production`.

The public server requires a reverse proxy (not included here): TLS, a dedicated WSS host, configured `ICEBREAK_ALLOWED_ORIGINS=https://grant-desk.com,https://freegameplace.com`, and routing to this process bound on loopback. Follow Grant Server's `/srv/README.md`, `/srv/PORTS.md`, `/srv/LOG.md` and Claude's operational approval. **Do not change the shared Caddy file or ports unilaterally.**

## Network message contract v1

Client → server: `{type:"create",seat:0}`, `{type:"join",code:"ABC234",seat:7}`, `{type:"ready",ready:true}`, `{type:"start"}` (host only), `{type:"input",seq:1,axes:[0.4,-0.2],shoot:false,pass:false,check:false,burst:true}`, or `{type:"resume",code,token}`. No player X/Z, puck, score, timer, or collision results are accepted.

Server → client: `hello`, `seated` (includes private reconnect token), `ready`, `started`, `snapshot` (identical authoritative tick/player/puck/clock/score for every peer), and `error`. Keep reconnect tokens private; do not log them or show in the shareable room code.

The current implementation uses a deliberately small dependency-free RFC 6455 text transport suitable for a controlled proof. Before production, replace it with a maintained, hardened WebSocket implementation, introduce structured operational logging, load/bandwidth tests, TLS proxy rules, server isolation and gameplay parity tests.

## Acceptance still required

Eight human browsers (including both websites as allowed origins), one shared puck and frozen injury clock, ninth player denied, return after temporary disconnect, and complete physical-device testing. Test real WebSocket latency and goal/faceoff consistency across all eight devices. Server-side game authority is mandatory.
