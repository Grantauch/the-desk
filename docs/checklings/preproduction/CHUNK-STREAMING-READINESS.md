# Checklings large-world streaming: prototype evidence and integration gates

**November 3, 2026. Proposal / isolated executable experiment only.** This document depends on the parent preproduction PR #302, which itself depends on the twelve-biome Design Bible update merged in PR #301. Do **not** connect the experiment to the live classroom server without Claude's review and school-device verification.

## What changed in the isolated test lab

The following isolated tools live in `apps/checkaverse/experiments/worldgen/`:

- **`chunk-stream.mjs`** provides a versioned **TerrainChunkCache** (shared, bounded LRU) and **TerrainInterestBroker** (per-player 3×3 nearby terrain subscriptions). It reuses the parent PR's immutable 32×32 tile generator and nine connected authored landmark paths.
- **`organic-routes.mjs`** builds deterministic meandering, connected authored footpaths (including bridges) instead of the initial rigid debug-cross layout. It draws on the same base ecosystem terrain without erasing landmarks. This remains a simplified route painter, not finished world art or obstacle-aware pathfinding.
- **`map-preview.mjs`** generates a standalone **offline HTML inspector** of all twelve biomes, with navigation, zoom, colored symbolic terrain, and nine labeled landmarks per biome; this was rendered and visually inspected with headless Chrome on TheAtlas, with no network or production page changes. It does not provide final creature/art assets.
- **`chunk-stream-benchmark.mjs`** sizes synthetic raw JSON payloads and times terrain preparation on TheAtlas, with 35-player and 70-player scenarios. It has no sockets, timers, SQLite, school users or browser rendering.
- Dedicated tests verify deterministic chunk identities, border clipping, single-row chunk deltas after moving, 35-player reuse, LRU eviction, independent regions, private scope isolation, stale generator revision rejection and unnecessary multiplayer broadcasts.

This is **only immutable terrain streaming**. NPCs, movement, school tickets, catching, quests, battle outcomes, shared resource persistence and living world schedules are *not* wired to it.

## Local CPU experiment on TheAtlas

Environment: **Node v24.15.0**, one process, synthetic positions, no actual network and no school Chromebooks. Generated terrain uses one text character per tile plus JSON metadata; art assets and sprite state are **not** included. Times are one-run local CPU measurements, not latency promises.

| Players / placement | Region size | Initial chunks sent | New chunks sent after 1-tile move | Initial uncompressed JSON bytes | Generated chunk preparations | Cache evictions |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 35 clustered at one gate | 256×256 | 315 | 105 | 418,040 | 12 | 0 |
| 35 clustered at one gate | 512×512 | 315 | 105 | 418,110 | 12 | 0 |
| 35 scattered across two biomes | 512×512 | 296 | 3 | 394,854 | 299 | 203 |
| 70 scattered across two biomes | 512×512 | 596 | 5 | 795,064 | 599 | 503 |

The cluster rows place trainers **one tile before a chunk boundary**; after the one-tile move, each sees exactly three new and three unloaded chunks, and six existing chunks remain subscribed. These rows intentionally represent a worst-case simultaneous boundary crossing; ordinary one-tile movement generally does not require new terrain data.

**Important interpretation:**

- **A huge region need not be loaded at once.** At a shared 512×512 landmark, the server generated just **12 unique 32×32 terrain chunks** for 35 clients' initial subscriptions and crossing updates, rather than eagerly producing all 256 chunks of that biome.
- Static chunk generation is shared across players, but **full chunk payloads are still sent separately to each receiving client**. The grouped 35-client first-visit payload was roughly 418 KB of uncompressed JSON, not a single 11 KB broadcast shared by all students. In a real implementation account for framing, protocol overhead, compression, updated art state, resends and actual connection speed.
- **A small global 96-chunk LRU thrashes when players are scattered.** In the 70-player synthetic case, 599 historical chunk generations occurred because older entries were evicted and later regenerated. Resident cache still stayed at 96. This is a **CPU-versus-memory tradeoff**, not a fatal barrier; measure realistic multi-region movement and use per-region warm-set budgets or on-demand compression only after observing live load.
- Cache snapshots and synthetic performance should not be mistaken for actual server TPS, client FPS, long-run memory health, or WebSocket throughput. No Chromebook, school firewall, or student device was involved.

## Visual QA and versioning findings

The offline inspector produced a self-contained ~811 KB HTML file and displayed Bramblefen's seeded terrain in headless Chrome at 1440×900. Its first rendering exposed a leftover perfectly straight north/south/east/west debug road. The organic-routes pass removed that old test grid while keeping the nine authored destinations connected. A second screenshot confirmed meandering paths and the elimination of the debug cross.

**Important:** A procedural preview with curved paths is still a planning diagram, not a professional game map. Rivers are simulated from simple seeded fields, scenery is a colored tile code rather than commissioned pixel art, paths may cross impassable-looking ground because this is not A* navigation, and there are no actual quests, buildings, resident routines, sprite collisions or captures in the inspector.

The final immutable terrain payload now carries an explicit **organic route revision**, separate from the parent generator revision. Real migration will need both revisions in its cache/region compatibility contract before a released map changes shape. All archived output here was generated with this evolving **nonproduction** revision.

### Standalone inspector instructions

Run `node apps/checkaverse/experiments/worldgen/map-preview.mjs <local-output.html>` to write a single offline HTML file at a deliberate scratch path. Use `--512` to inspect an aspirational 512×512 world; the default is 256×256. Open the resulting file in a normal browser; biome selection, pan, zoom, tile inspection and landmark labeling require no server connection. For a direct visual QA view, append `?region=verdant_crown` or `?region=frostglass_reach` to the local file URL; the inspector validates IDs against the embedded region catalog.

**No student game state or production content is read or saved.** The file is a static preproduction planning artifact, not a page on grant-desk.com.

**Additional visual check:** headless Chrome screenshots of `verdant_crown` and `frostglass_reach` confirmed that jungle and arctic palettes, surface patterns and landmark labels are genuinely distinguishable in this symbolic inspector. However, **both still use the same abstract nine-anchor route skeleton** with similar geographic proportions. They are not yet twelve truly unique exploration maps. Before any artistic or gameplay sign-off, region-specific macro grammars, unusual landmarks, path motifs and density must replace that shared geometry. The current screenshot demonstrates a *tool for reviewing* world design, not final world design.

## Proposed production protocol (not yet implemented)

Server-side actor state must be derived from a **signed, authenticated school session** and approved map gate, never from a user-supplied region, x/y, seed or scope. A client subscription request is only a desire for nearby visuals; the server computes and sends the authoritative subscribed chunk window.

A conceptual handshake after validated movement:

1. **Server derives location** from the stored trainer: `scope, regionId, generatorVersion, x, y`.
2. **Interest broker compares** the new 3×3 chunk set to the actor's previous subscribed set.
3. **Server sends an ordered terrain delta:** `unload` IDs, `add` immutable chunks with hashes, and unchanged chunk count. The server must bind the message to a region/revision/sequence; clients discard stale packets after travel or reconnect.
4. **Client renders nearby terrain** and asynchronously requests missing assets. Authoritative collision, encounter placement, capturing and rewards remain on the server, using the same generator revision and authored overlays.
5. **Nearby actor updates** are sent only when the actor's occupied chunk lies in an observer's interest window **and** both are in the same shared world instance. Merely having overlapping *windows* is insufficient; that mistake was explicitly caught and fixed in the prototype. Private Kettle Creek instances never broadcast their actor positions to the shared town or to other students.
6. **On scope/region/version change**, unsubscribe all old chunks (even if the new static coordinates have the same names) before delivering the new set. Handle reconnect and unavailable chunks with bounded retries and reliable fallback.

### Recommended production safeguards

- The sign-in/ticket and movement handler remains the sole authorizer for actor identity, location, map/instance and world version. This offline broker only accepts a **server-validated location object**; it has no authentication.
- Add rate limits for move, chunk and resync requests; deduplicate repeated sequence numbers; cap payload and total subscriptions per connection; reject invalid coordinates and stale revisions.
- Chunk data must be **versioned and immutable**, with a clear map migration path before modifying a released seed or authored landmark. Do not silently strand a student inside a newly solid cell.
- Shared rewards and encounter claims must be transactional with unique IDs. The demo's in-memory one-time claim logic is not a replacement for SQLite transactions or durable restart recovery.
- Keep **terrain, public nearby actors, private quest state and care/attendance state in separate channels**. Private player histories, school names/PINs and grading information should never leak into public region messages.
- Consider a **hash-based client terrain cache** once correctness is proven, so reconnecting students can request static chunks without redownloading them. Server checks canonical hashes and can resend on mismatch; hash reporting is a performance hint, never authority.
- Start with 32×32 tiles and one-chunk radius; tune interest radius, per-region cache and prefetch based on actual walking speed and viewport draw distance, not just on synthetic CPU.
- Teacher pause, absence protection and other binding care rules must apply across all biomes, including when nobody is online in a region.

## Gates before use with students

1. **Integration design review:** Claude signs off on the boundary with `server.mjs`, region metadata/seed migration, generator-revision contract and transport message schema. Do not import this module directly into production as-is.
2. **Two-player isolated network proof:** actual WS clients see the same landscape, while malformed or forged client commands cannot alter coordinates, claims or the private scope. Test fast reconnects and stale packets.
3. **Rendered client proof:** one read-only map explorer renders a 3×3 neighborhood with distinct jungle/arctic tiles and fixed landmarks, including chunk prefetch with no visible gaps; actual client memory and frame pacing measured.
4. **Full-class rehearsal:** physical school Chromebooks on school Wi-Fi with 35 concurrent users, clustered at a town gate and spread out across the world. Record P50/P95 movement latency, asset download, bytes, FPS, server CPU/heap and reconnect success.
5. **Long-duration failure check:** user departures, PC restarts, tunnel loss and database backups. No missing-day pet deaths, double captures, disappearance of saved progress or identity leaks.
6. **Incremental release:** one limited biome opened through the existing Wilds, reversible by a documented flag, then scale from 256×256 toward 512×512 only after measured acceptance.

**Scope:** The current work is an isolated, reviewable proof that chunk interest and a shared immutable cache are plausible for very large multiplayer maps. It does **not** establish production capacity, final player experience or map content quality. All 300 species slots and twelve biome concepts remain governed by the Design Bible and Claude's review.
