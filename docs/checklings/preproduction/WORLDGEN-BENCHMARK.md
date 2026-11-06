# Worldgen CPU microbenchmark — TheAtlas (Nov 2, 2026)

**Scope:** isolated read-only `apps/checkaverse/experiments/worldgen/benchmark.mjs`; 32×32 terrain chunks; deterministic prototype generator; Node **v24.15.0** running on the user's connected Windows desktop, TheAtlas. No production server files, networking, school data or game saves were changed.

| Preview biome | Map size | Total tiles | Chunks | Desktop CPU generation for entire map | Mean per chunk |
| --- | --- | ---: | ---: | ---: | ---: |
| Bramblefen Basin | 256×256 | 65,536 | 64 | 34.60 ms | 0.541 ms |
| Verdant Crown | 256×256 | 65,536 | 64 | 33.25 ms | 0.519 ms |
| Frostglass Reach | 256×256 | 65,536 | 64 | 38.09 ms | 0.595 ms |
| Hollowdeep | 256×256 | 65,536 | 64 | 30.97 ms | 0.484 ms |
| Verdant Crown | 512×512 | 262,144 | 256 | 125.49 ms | 0.490 ms |
| Frostglass Reach | 512×512 | 262,144 | 256 | 126.69 ms | 0.495 ms |
| Hollowdeep | 512×512 | 262,144 | 256 | 118.65 ms | 0.463 ms |

Checksums were calculated for every generated chunk, and each output was discarded immediately to measure terrain generation rather than an application cache. Benchmarks were single-run, sequential, post-warmup, not median/p95, and heap deltas are unreliable as memory measurements because garbage collection ran during some cases.

## Interpretation

**Promising, very limited finding:** bare deterministic **tile generation** is fast on TheAtlas in this toy prototype—roughly half a millisecond per 32×32 chunk in these small samples. The raw number of terrain tiles alone does not appear to justify rejecting the 512×512 aspiration.

**What this does not prove:** low-end Chromebook frame rate, viewport drawing, sprite compositing, all twelve regions loaded together, WebSocket interest management, client-server reconciliation, server-authoritative encounters, save costs, asset download, procedural rivers that remain navigable, landmark density, 35 concurrent real students, or persistent 24/7 uptime. This prototype's five connected landmarks form a simplistic cross; a real biome requires more complex paths, authored features and living content that may change performance substantially.

## Next performance gates

- Same chunk generator on an actual school Chromebook, with camera/viewport drawing and biome artwork. Capture frame time, worst chunk boundary hitch and memory over several minutes.
- Server/client split: 2 players in one chunk, 35 players spread across multiple chunks, and 35 players concentrated at a landmark. Count transmitted bytes and entity updates, not just tile sampling time.
- Dynamic overlays: authored landmarks, NPC paths, captures, harvesting, private versus shared quests, teacher pause and reconnects.
- Long session: watch memory and CPU over one classroom period with frequent travel and reconnects.
- Benchmark against a release-grade 256×256 biome before claiming similar speed at 512×512.

**Decision:** Keep the **256×256 first playable proof**, and retain 512×512 as a goal—not a committed performance guarantee. The present benchmark validates only a narrowly defined pure CPU terrain-generation hypothesis.
