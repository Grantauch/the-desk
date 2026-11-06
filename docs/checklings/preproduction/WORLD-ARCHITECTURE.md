# Checklings World Expansion: streaming and persistence architecture

**Preproduction RFC; no runtime or deployment changes.** This document elaborates the Grant-approved 12-biome expansion in `docs/checklings/DESIGN.md`. Lead Claude owns integration decisions. Experiment code belongs outside `public/`, `content/` and the production server until all gates pass.

## Baseline and constraints

The live Checkaverse currently uses generated row-string maps for the 64×28 town, 56×44 Wilds and 40×26 private Kettle Creek; movement, battles and captures are server-owned; trainers connect through signed Check-In tickets to the Node/WebSocket/SQLite service on Grant's PC via a Cloudflare Tunnel. The current map generator `apps/checkaverse/tools/gen-town.mjs` emits whole JSON maps. Large-world work must be **additive** and must preserve the existing bus, home, 24 town plots, homes, headstones, live trainer data, teacher pause and class isolation. The map expansion is a system change; adding four enormous JSON files is not enough.

## World hierarchy

```
Shared Checkaverse town
  ↕ existing north gate
Shared Wilds crossroads
  ↔ twelve region gateways
    ↔ one persistent region ID each (no per-trainer seed)
      ↔ 32×32 terrain chunks (prototype chunk size)
      ↔ fixed authored landmark overlays and encounter zones
Private Kettle Creek
  ↔ bus to shared town, private seed/scope per trainer
```

Every region has a **stable slug, world seed, generator revision, content revision, world dimensions, entry/exit graph and overlay catalog**. Twelve 512×512 regions have 3,145,728 terrain tiles, **256 chunks each at 32×32** (3,072 chunks across regions); no process should need all those tiles loaded or simulated simultaneously. The first proof uses 256×256 (64 chunks).

Proposed persisted minimal metadata:

```json
{
  "schema": 1,
  "id": "verdant_crown",
  "instance": "shared",
  "worldSeed": "immutable-opaque-random-or-configured-identifier",
  "generatorVersion": "worldgen-v1",
  "contentVersion": "biomes-2026-11",
  "width": 256,
  "height": 256,
  "chunkSize": 32,
  "entry": {"from": "wilds", "at": [128, 255]},
  "exits": [{"to": "wilds", "at": [128, 255]}],
  "landmarkOverlay": "approved-author-file-id"
}
```

The seed is not an authentication secret, but server authority must never rely on hiding the seed to prevent cheating. A visitor's client may reconstruct/cached raw terrain, while the server independently verifies collision and dynamic state. Do not put school identities, PINs, roster data, grades or ticket signing keys in map metadata.

## Hybrid generation process

1. Establish world-space fields by sampling deterministic integer-seed noise **at absolute coordinates**, not per-chunk state. This guarantees no seams as chunks are requested in different orders. Inputs must include region ID, seed and generator version; the same inputs must yield byte-for-byte identical terrain on any server restart.
2. Produce macro shapes: coastlines, rivers, valleys, mountain barriers, vegetation density, clearings and other environmental regions. Use biome-specific distributions and approved art/terrain vocabulary.
3. Resolve an **authored route graph** connecting entries, major landmarks, settlements, creature habitats and safe escape routes. Carve accessible paths/bridges/tunnels after terrain generation. Critical routes, doors and quest paths must pass flood-fill reachability checks, including occupied landmarks and other dynamic obstructions.
4. Apply versioned authored overlays (Tiled-compatible maps or data): routes, hubs, boss locations, landmarks, gates, quest interactions and unique set dressing. Overlay collision must be validated and never silently hide an exit.
5. Resolve encounter tables separately from terrain. Dynamic encounters use server-issued deterministic/collision-safe IDs or recorded seeded draws; do not infer a "catch" by client-side collision with visual tall grass.
6. Serve chunks near subscribed players; use a bounded LRU cache or on-demand generation, rather than serializing complete regions on every join.

**Chunk contract:** region ID, generator revision, chunkX, chunkY, 32×32 tile IDs, content hash, optional approved static overlay references. Chunk coordinates must be nonnegative and bounded by world dimensions. For 512×512 regions, chunkX and chunkY run 0–15. No per-tile permanence is implied by the base chunk. Landmarks and authored objects should have globally stable IDs.

## Client/server replication

- Each player's server-side scope includes `instanceId`, `regionId`, coordinates and which chunk neighborhood they subscribe to. Enforce valid map-to-map transitions at authored gateways; never accept a client-supplied teleport to another region.
- Begin experiments with a **3×3 chunk interest radius** around the current chunk; tune it with movement and network testing. Include or prefetch adjacent chunks before a boundary is reached. Only changed chunks/entities should be re-sent; content hashes enable safe cache reuse.
- Nearby trainers, NPCs, battles and shared resource changes broadcast only to interested clients. A personal quest's progress and private Kettle Creek NPC memories stay per-student; public events remain world-owned.
- Player movement can be predicted visually but is validated on the server against its own generator and static overlays. Teleport, speed, impossible path and stale region/seed/version packets must be rejected. PvP watches and teacher pause remain server-controlled.
- Active regions/chunks can tick at bounded frequency. Distant inactive regions may be suspended or advanced through coarse deterministic state transitions when active again, but **pet care/body-clock rules are still anchored to school calendar and check-ins**; no biome can starve or kill a Checkling simply because it went offline.

### Reconnect and concurrent activity

- Persist last valid region and location. Reconnect resumes nearby the last location or its deterministic safe return point after a map migration; a student is never stranded inside a now-solid tile.
- Use transaction/unique-claim keys for exclusive catches, harvesting and quest claims. Record a stable event ID and replay protection; clients receiving an interrupted confirmation must be able to query committed result rather than duplicate the award.
- Separate immutable terrain reconstruction from mutable persisted overlays: harvested resource state, world-object changes, received quest items, encounter tickets, etc. Store sparse deltas keyed by world version, region, chunk and object ID, with compaction and bounded retention. **Do not store 3 million terrain rows** or write movement frames.
- Version maps explicitly: old character locations and discovered landmarks need a migration/redirect table before terrain-generator changes. Changing seed/version in-place for a released biome without migration is a data integrity bug.
- Back up region metadata and sparse world deltas with the existing authenticated trainer database. Test restore and replay without exposing student information.

## Quality, content and performance

**The number of tiles is not the main quality metric.** Each biome should have a recognizably different silhouette and navigation pattern, authored landmarks, safe and risky routes, distinct habitats, roughly two 12-line candidate release waves, meaningful objectives and recurring discoveries. Initial guideline: design **8–16 memorable authored destinations per biome**, plus generated minor clearings/resources; adjust after test walking reveals dead space. Distances must feel substantial without making a normal 3–5-minute check-in visit tedious. Add fast-return/entry mechanisms compatible with existing maps if needed; do not invent paid fast travel, breeding or other out-of-scope game features.

### Minimum acceptance matrix

| Gate | Pass evidence required |
| --- | --- |
| Determinism | Same seed + region + generator version yields identical hashes regardless of chunk order, reload and process restart |
| Seam continuity | A boundary sampled from adjacent chunks has consistent terrain/noise; rivers, paths and collision remain continuous |
| Reachability | Every authored entry/exit/major destination has a route from arrival; dynamic full/empty state cannot permanently block return |
| Shared consistency | Two players at same world coordinates see same static terrain and nearby authoritative actors |
| Server integrity | Tampered/unknown chunk, out-of-bounds movement, duplicate catch and stale packet rejected |
| Privacy | School tickets/teacher controls and per-student Kettle Creek data remain isolated |
| Reconnection | Disconnect/rejoin/restart restores same region, location, inventory and quest state without duplication |
| Failure handling | Network outage/teacher pause never causes pet death or lost attendance; client can safely return home |
| Low-end client | Tested frame pacing, heap growth and input responsiveness at real Chromebook resolutions |
| Classroom | Real school network and a full class of concurrent users, in addition to synthetic 2/35/70-player scaling probes |
| Rollback | Restore old server and data snapshot without irreversible world-state corruption |

Proposed *investigation targets*, **not yet promised service-level objectives**: stable 30 FPS or better on actual school Chromebooks when moving between chunks, no blocking multi-second generation hitch, bounded active memory per client, and no sustained movement backlog at class load. First record a baseline with today's small live maps, then make the numerical gate stricter or looser according to measured hardware and network. Do not disguise synthetic localhost performance as a classroom test.

## Build increments and integration ownership

1. **Read-only prototype:** isolated generator module returning deterministic 32×32 chunks inside one 256×256 biome; demonstrate seam continuity, stable seeds, fixed route connectivity, no global mutable RNG. No live game files touched.
2. **Routing and overlay contract:** document and test cross-map exits/landmarks; create a validator that proves authored exits are reachable.
3. **Static streaming client proof:** render a 3×3 chunk window in a standalone harness and benchmark Chrome at Chromebook widths. Record actual memory, FPS and chunk load timings.
4. **Server-owned instance prototype:** add a nonstudent synthetic WebSocket room with two clients. Validate interest subscriptions, movement/collision, shared persistent object claims and reconnects. No school ticket modification.
5. **Staged teacher pilot:** test the signed school flow on a separate rehearsal environment with synthetic accounts, then physical student devices under controlled classroom conditions.
6. **Incremental production rollout:** after Claude reviews integration and all tests, enable one bounded region behind normal release protections; keep old map exits and data recoverable.
7. **Expand:** scale region width only after the benchmark gate, then author biome-specific art, landmarks, quests and the 12-line roster waves.

**Coordinate with Claude before editing `server.mjs`, `gen-town.mjs`, `public/plaza.js`, production `content/`, school Apps Script, backups, or deployment.** This RFC and any stand-alone experimental code are proposals, not a live-world migration.
