# ICEBREAK: eight real browser session acceptance

This standalone QA suite exercises the room prototype in [`../icebreak-online/`](../icebreak-online/) from eight separate Chromium browser contexts. It **does not modify either production game's page**, does not replace the ICEBREAK physics engine, and does not deploy a server.

## Why

The initial room server proof tested eight Node WebSocket connections; real browser clients introduce additional risks: browser Origin headers, asynchronous room states, DOM interactions, input focus, touch/keyboard mapping, reconnect behavior, and cross-tab session isolation.

## Checks

The `eight-browser.mjs` Playwright test starts a local ICEBREAK room server and opens eight separate contexts with alternating origins `http://127.0.0.1:<port>` and `http://localhost:<port>`. These are two distinct **local** browser origins, not genuine public TLS domains.

1. Browser 1 creates a room with a six-character join code and claims Glaciers Center.
2. Browsers 2–8 claim the remaining C/W/D/G seats, including both goalies, across alternating origins.
3. Browser 9 attempts to claim an occupied seat and receives `SEAT_TAKEN`.
4. Host cannot start until all other human seats have explicitly marked ready; after readiness all eight see the playing phase.
5. Every client receives a tick-identical snapshot with eight connected seats and exactly matching players, puck, score, and clock.
6. Two browsers on different origins hold different steering keys concurrently and the **server** moves only their respective skaters.
7. A goalie browser reloads, proves successful seat-token resume, and returns to its own position without opening a second slot.
8. No uncaught browser errors; representative screenshots and JSON results are saved.

## Run

Install the root repository's dependencies (including Playwright), and the browser:

```sh
npm ci
npx playwright install --with-deps chromium
node prototypes/icebreak-browser-qa/eight-browser.mjs
```

The dedicated GitHub Actions workflow `icebreak-browser-qa.yml` runs automatically for relevant PRs, with screenshots and a JSON report uploaded as downloadable artifacts.

## Important limits

- **No live server deployment**; tests use localhost.
- Two local browser origins are useful for testing Origin isolation but **do not prove** that real `https://grant-desk.com` and `https://freegameplace.com` browsers can connect over a deployed `wss://` endpoint. The prototype core's Node tests separately validate those origins in raw WebSocket upgrade requests.
- Eight isolated Chromium browser contexts run on one CI machine—not eight physical players or distinct internet links.
- The simplified server simulation is not the mature ICEBREAK skating, checking, reactive goalie, one-timer, or Powerups engine. Physics parity must be implemented under task #159.
- Production online UI for both sites remains assigned to #160; hosting and Caddy/TLS to #161.

A green result means **browser room transport and seat ownership are working in a controlled test**, not that full online ICEBREAK is ready to publish.
