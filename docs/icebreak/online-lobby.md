# ICEBREAK online beta client draft (Team Desk #218)

This is an endpoint-disabled client candidate, not a release. The original solo and
local eight-seat script stays byte-for-byte unchanged. The Online beta entry is
hidden when no endpoint has been built in. No new network connection is opened
until someone explicitly chooses Create room or Join room. The marked endpoint
is a deliberate release gate, not a query-string override.

The separate beta rink uses the server's snapshots for score, clock, player and
puck positions. The client interpolates presentation, not outcomes. Desktop
keyboard and phone touch controls use the same input commands. Lobby status keeps
up even when the match tick has not started. A short connection loss can restore
the same seat in the same tab; a rejoined lobby player needs to mark Ready again.
The reconnect credential stays in private JS memory, never in the URL, storage,
lobby view, or a log. Refreshing or intentionally leaving the room ends this
tab's session. Empty seats use AI. No accounts, student data, or shared saves.

## QA and activation gates

- Run `node --test tests/icebreak-online-browser/client-contract.test.mjs`.
- Private loopback rehearsal against the six exact server/core source blobs of
  #587 (3a20c1b97834dbe892b3d6b364abe0ac80adc21f) joined eight isolated Chromium
  sessions across two actual school and portal HTML variants. The ninth browser
  could not claim a seat. Captured desktop and phone-touch movement, readiness
  before puck drop, same-seat reconnect with readiness reset, local start and
  return, no endpoint/no connections until launch, and no page errors. The
  loopback runner had ws 8.22.0, **not** the candidate's release lock 8.23.0.
- Before enabling: independent exact review; retest the actual page candidates
  with the release lock and current required checks. Confirm operator-approved
  TLS/WSS endpoint and allowed storefront origins with #161, then perform basic
  real HTTPS create/join/authoritative handshake and local-mode regression.
- Prepare rollback to the previous static page; rolling back the client does not
  change GrantDesk, Team Desk, DNS, Caddy or the other apps. On an approved beta,
  perform the full real eight-device match and verify the site's discoverability.
  This candidate does not verify or enable public online play.
- Free Game Place needs its own separately reviewed change and production smoke.
  Unrelated stores, host configuration and access settings are out of scope.
