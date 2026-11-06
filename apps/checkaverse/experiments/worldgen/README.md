# Checklings preproduction worldgen and balance lab

**Read-only experiments. Not integrated with the live game.**

These scripts are deliberately isolated from `server.mjs`, `public/`, school Check-In, student data, and the deployed map generator. They create **no database or local files** and require no network calls. Intended for independent review by Claude before any integration.

- `prototype.mjs`: twelve biome palettes, permanent region+seed+generator-version identity, deterministic tiles sampled from global coordinates, 32×32 chunk output and hash, and connected fixed-path/landmark validation for 256- and 512-square *prototype* worlds.
- `prototype.test.mjs`: seven route, determinism, chunk-boundary, region, and reject-invalid-input checks.
- `landmark-network.mjs` + `landmark-network.test.mjs`: a seeded **nine-destination route network** per region, including four biome-specific authored landmarks, alternate paths, bridge markers, per-chunk output, and reachability/seed migration checks. The authored names are working concepts, not content approved for the game.
- `shared-world.mjs` + `shared-world.test.mjs`: a two-region **in-memory multiplayer state proof**, including chunk-local visibility, cardinal movement validation, server-authored exclusive resource claims, idempotent retries, reconnect positions and trusted snapshot/restoration guards. No school tickets, real WebSockets or transactional persistence.
- `benchmark.mjs`: isolated CPU timing of chunk generation; desktop numbers and limitations are documented in `WORLDGEN-BENCHMARK.md`.
- `roster.test.mjs`: six checks against the CSV in `docs/checklings/preproduction/` ensuring 300 concepts, 25 waves, eight legal types, 100 per evolution class, locked first twelve and equal regional type opportunity.
- `balance-lab.mjs`: invokes the actual current `battle.mjs` and JSON content with no modifications; outputs synthetic founder-versus-founder and care-condition statistics.
- `balance-lab.test.mjs`: six checks covering legal move selection, actual content loading, deterministic replay, mirrored seats, care conditions and invalid inputs.

## Run

From the repository root with the supported Node version:

```sh
node --test apps/checkaverse/experiments/worldgen/*.test.mjs
node apps/checkaverse/experiments/worldgen/balance-lab.mjs
```

The second command prints a complete JSON report to stdout; redirect it into a scratch file for comparison. The checked-in `docs/checklings/preproduction/baseline-battles.json` is a synthetic frozen starting point. Its analysis is `BALANCE-BASELINE-FINDINGS.md`. The roster itself is **only working concept seeds** in `300-line-concept-register.csv`, not validated or implemented species.

## Explicit limits

- Current generated "landmarks" are five test route points on a simple cross. They are placeholders, **not a believable finished biome**. No authored overlays, rivers with true floodplain reachability, quest data, animal spawns, school tickets, WebSockets, cameras, map transitions, character movement or world-delta persistence are implemented in this experiment.
- The 32×32 tile API is an initial proof, **not streaming or an interest-managed multiplayer system**. It has no protocol or client integration.
- A deterministic hash does not replace collision validation, authoritative event claiming, schema migrations or backing up private game saves.
- The balance lab evaluates only four actual founders. Nothing in the concept CSV supplies approved moves, stats, sprites or a live species ID.
- These tests measure correctness and repeatability at Node level. **School Chromebook performance and physical classroom network behavior remain untested.**
- Shared-world snapshot and resource claims exist **only in an in-memory demonstration**; there are no database transactions, crash-consistent disk saves, network authentication, cross-process locking, map transitions or classroom privacy checks. The prototype uses fake player tokens and must never be exposed as a public server.
- The landmark route painter uses a small set of authored destination names, straight and bent routes, and bridge overlays. It is not the final generator for rivers, cliffs, canopy layers, realistic trails or Tiled landmark art.
- The `--cross` mode on `balance-lab.mjs` tests **different strategies on the two sides**; the original self-match mirror attribution was repaired. Frozen results and cautions are under `docs/checklings/preproduction/`.


Do not merge the experimental API into the live server without owner review and the phased test/rollback gates described in `docs/checklings/preproduction/WORLD-ARCHITECTURE.md`.
