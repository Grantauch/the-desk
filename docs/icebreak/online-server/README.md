# ICEBREAK authoritative online server candidate

This is a server-side candidate, not an online release. It does not change the existing local/solo game, Shift Book, either site's frontend or any host configuration. The implementation was composed against the repository's pinned main baseline from preflight (`03785826b35431827d53c2b9b40a3cb58bff3562`); its paths are deliberately isolated. Recheck the base and path collision before opening a PR.

## Run and verify

From the repository root, Node >=22:

```sh
npm --prefix apps/icebreak-server ci --ignore-scripts
npm --prefix apps/icebreak-server test
npm --prefix apps/icebreak-server start
```

The server binds to `127.0.0.1`, port `4300` by default, with `GET /health` and WebSocket upgrade on `/icebreak`. Use `ICEBREAK_PORT`, `ICEBREAK_WS_PATH`, and `ICEBREAK_ALLOWED_ORIGINS` (comma-separated exact origins) to match the verified deployment router. The two canonical production origins and their www equivalents are the defaults. Only the reverse proxy should expose the service, over WSS. Do not use `/ws` or reroute other services. No database, accounts, student information, or external API is involved. Room state is in-process and intentionally lost on restart. One instance owns the room namespace; multiple replicas are not supported without a separate match-routing plan.

An optional Chromium smoke exercise (`node tests/icebreak-online/browser-smoke.mjs`) requires Playwright; use `ICEBREAK_PLAYWRIGHT_MODULE` and `ICEBREAK_CHROMIUM` to point to a provisioned Playwright and executable when not installed in the repo. It creates eight independent browser contexts on two localhost origins and uses real keyboard events to drive one room. It is a fixture, not the actual client pages. Native tests exercise eight real connections under the exact locked `ws` transport, and verify a ninth seat refusal, same match snapshots, AI fallback, reconnect and separate-room isolation. Core tests run complete seeded matches and verify goals, saves, five-second injury/goal holds, possession consistency and final clock.
Optional exact-source smoke: run `node tests/icebreak-online/pinned-source-smoke.mjs <exact #528 icebreak.html> <tests/icebreak/fixture.cjs>` to verify six integrated skater fields against the mature browser on 45 fixed ticks.

## Wire contract, version 1

All frames are JSON text. Server `hello` declares `version` and `maximumPlayers:8`. Team/role are fixed: slots 0–3 and 4–7, each Center/Wing/Defender/Goalie. Server sends `seated` privately with `code`, `seat`, `team`, `role`, `host`, `token`, `resumed`. Share only the room code; keep the token private to the original browser session. Tokens are fixed-duration reconnect authority for a vacant reserved seat, not URLs or logs.

- `create {seat,mode?,rink?}` or `join {code,seat}`; `resume {code,token}` restores the reserved seat within 30 seconds (reconnect sequence restarts at zero).
- `ready {ready:boolean}`, then host `start`. Vacancies use Standard AI; all claimed seats must be connected and ready. Host `settings {mode,rink}` before start clears guest readiness. Rinks: school/park/mars (visual rink label, same physics); modes: regular/powerups.
- `input {seq,axes:[worldX,worldZ],shoot?,pass?,check?,burst?}`; 0-based increasing sequence scoped to connection, finite axes [-1,1], booleans, refresh held keys at <=30 Hz and send timely changes. Browser screen up is positive world X. Server queues button transitions to preserve a quick press/release arriving before one tick. Neutral after 500 ms without a fresh sample; if disconnected, use AI immediately instead of stale input. No score/puck/player coordinate commands. Host `skip-injury` queues skip for the next 90 Hz tick.
- `snapshot` room-wide at ~20 Hz (also on seating/readiness/start); includes `tick`, `code`, `host`, `phase` (lobby/playing/goal/injury/finished), `timeLeft`, `dropTime`, `holdTime`, `score`, `goalTeam`, `injured`, `mode`, `rink`, `players`, `puck`, `events` (id/tick/type/detail), `powerItems`, `teamPasses`, `teamSaves`. Puck owner is a scalar slot or null. Match ticks strictly advance only when an active match is stepped; same-tick packets can update roster/connection flags without changing the world. Snapshot phase playing with positive `dropTime` means faceoff countdown. Interpolate presentation, never independently resolve scoring. Deduplicate events by id and preserve cursor on reconnect.
- `error {code}` is recoverable unless connection closes. `expired {code}` ends a stale/finished room but leaves the connection available for a new room. Socket liveness uses WebSocket ping/pong.

## Parity boundaries

Pinned integrated source: `b83e673bad60ee22f58703355077ef8ea53696f1` (review #528 head `98e64e91`). Geometry/skating from #557 `6ac88c53`, checking/contact #559 `f77b9513`, and match lifecycle #570 `f973ec25`; room semantics and browser QA informed by #545 `63516ff5` / #549 `6c7ee3cb` and use maintained, locked `ws` rather than the prototype framing. The match owns one 90 Hz world step and uses established skating, collision, puck possession/one-timers, saves/rebounds, AI give-and-go, clock, injury and powerup rules. RNG is room-local and does not consume discarded visual particle randomness. Audio/camera/replay presentation and Shift Book progress stay user-client/local concerns. The online server emits events and hold timers, not a historical replay clip. Do not claim byte-exact perceptual presentation or equivalence to the old browser's cosmetic RNG.

## Integration/release gates still open

- #160: wire start/lobby/renderer to the real ICEBREAK pages on both domains, verify keyboard/gamepad/touch, focus the rink on mobile, handle retry and close reason, preserve Solo/Local and local-only Shift Book. Test both deployed frontend origins against the **same** staging match namespace.
- #161: verify path and reverse-proxy origin pass-through, loopback health, exact source + lockfile install, sustained load and upstream service recovery. Confirm WSS with all eight actual browsers, synchronize goals/injury/clock, reject ninth seat, and reconnect. Verify both domains and physical desktop/phone/browser combinations and different networks. No production changes or public claims until those tests pass and release is authorized.
- Close any exact-base PR checks and an independent code review. Preserve all newer unrelated repo files; no prototype stack merge is necessary.
