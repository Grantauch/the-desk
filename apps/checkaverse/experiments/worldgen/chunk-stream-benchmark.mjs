// Synthetic CPU/network-payload sizing only. No sockets, classroom data,
// remote calls, browser rendering, or production integration.
// Run: node apps/checkaverse/experiments/worldgen/chunk-stream-benchmark.mjs
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRegionSpec } from "./prototype.mjs";
import { createTerrainPreview } from "./chunk-stream.mjs";

export function benchmarkScenario({trainers=35,size=512,placement="clustered",maxChunks=96}={}){
  if(!Number.isInteger(trainers)||trainers<1||trainers>140)throw new RangeError("Synthetic trainers must be 1..140");
  if(![256,512].includes(size))throw new RangeError("World preview size must be 256 or 512");
  if(!["clustered","distributed"].includes(placement))throw new RangeError("Invalid scenario placement");
  const biomeNames=["verdant_crown","frostglass_reach"];
  const specs=biomeNames.map(id=>createRegionSpec(id,"benchmark-seed-immutable-v1",size));
  const preview=createTerrainPreview(specs,{radius:1,maxChunks});
  const summary={scenario:placement,trainers,size,regions:2,
    initiallySentChunks:0,crossingSentChunks:0,unloadedChunks:0,
    initialJsonPayloadBytes:0,updateJsonPayloadBytes:0,
    initialElapsedMs:0,updatesElapsedMs:0};

  const positions=[];
  for(let i=0;i<trainers;i++){
    const spec=specs[placement==="clustered"?0:i%2];
    const x=placement==="clustered"?Math.floor(size/2)-1:
      16+((i*73)%(size-32));
    const y=placement==="clustered"?Math.floor(size/2):
      16+((i*131)%(size-32));
    const actor="synthetic-"+String(i).padStart(3,"0");
    positions.push({actor,spec,x,y});
  }
  const start=performance.now();
  for(const {actor,spec,x,y} of positions){
    const result=preview.subscribe(actor,{regionId:spec.regionId,version:spec.version,x,y,scope:"shared"});
    summary.initiallySentChunks+=result.added.length;
    summary.initialJsonPayloadBytes+=Buffer.byteLength(JSON.stringify(result),"utf8");
  }
  summary.initialElapsedMs=Number((performance.now()-start).toFixed(2));
  const moved=performance.now();
  for(const {actor,spec,x,y} of positions){
    const nextX=x+1;
    const result=preview.subscribe(actor,{regionId:spec.regionId,version:spec.version,x:nextX,y,scope:"shared"});
    summary.crossingSentChunks+=result.added.length;
    summary.unloadedChunks+=result.removed.length;
    summary.updateJsonPayloadBytes+=Buffer.byteLength(JSON.stringify(result),"utf8");
  }
  summary.updatesElapsedMs=Number((performance.now()-moved).toFixed(2));
  summary.cache=preview.cache.stats();
  summary.actorCount=preview.activeCount();
  return summary;
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const scenarios=[
    benchmarkScenario({trainers:35,size:256,placement:"clustered"}),
    benchmarkScenario({trainers:35,size:512,placement:"clustered"}),
    benchmarkScenario({trainers:35,size:512,placement:"distributed"}),
    benchmarkScenario({trainers:70,size:512,placement:"distributed"})
  ];
  process.stdout.write(JSON.stringify({
    caveat:"Not a browser/network/server benchmark. Payload estimate is uncompressed JSON; timings are this machine's Node CPU only.",
    node:process.version,scenarios
  },null,2)+"\n");
}
