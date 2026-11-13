// Read-only offline CPU microbenchmark; no school/browser/network/server behavior.
// Run: node apps/checkaverse/experiments/worldgen/benchmark.mjs
import { performance } from "node:perf_hooks";
import { createRegionSpec, generateChunk, CHUNK_SIZE } from "./prototype.mjs";

const suites = [
  ...["bramblefen_basin", "verdant_crown", "frostglass_reach", "hollowdeep"].map(region => ({region,size:256})),
  ...["verdant_crown", "frostglass_reach", "hollowdeep"].map(region => ({region,size:512}))
];
const results=[];
for (const {region,size} of suites) {
  const spec=createRegionSpec(region, "microbenchmark-only", size);
  const perSide=size/CHUNK_SIZE;
  let checksum=0;
  // Warm one chunk to avoid making the first JIT pass dominate the result.
  generateChunk(spec,0,0);
  const before=process.memoryUsage().heapUsed;
  const started=performance.now();
  for(let cy=0;cy<perSide;cy++) for(let cx=0;cx<perSide;cx++) {
    const chunk=generateChunk(spec,cx,cy);
    checksum=(checksum + Number.parseInt(chunk.hash,16)) >>> 0;
    // Do not retain chunks; the goal is generation cost, not caching policy.
  }
  const ms=performance.now()-started;
  const delta=process.memoryUsage().heapUsed-before;
  results.push({region,size,tiles:size*size,chunks:perSide*perSide,total_ms:Number(ms.toFixed(2)),
    mean_ms_per_chunk:Number((ms/(perSide*perSide)).toFixed(3)),heap_delta_bytes:delta,checksum});
}
process.stdout.write(JSON.stringify({
  caveat:"Single desktop CPU microbenchmark; not game rendering, networking, DB or school Chromebook acceptance",
  node:process.version,engine_version:"worldgen-prototype-v1",results
},null,2)+"\n");
