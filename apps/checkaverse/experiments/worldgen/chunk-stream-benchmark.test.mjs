import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkScenario } from "./chunk-stream-benchmark.mjs";

test("35 clustered synthetic players generate twelve chunks, not 420",()=>{
 const x=benchmarkScenario({trainers:35,size:512,placement:"clustered"});
 assert.equal(x.initiallySentChunks,315);
 assert.equal(x.crossingSentChunks,105);
 assert.equal(x.unloadedChunks,105);
 assert.equal(x.cache.generated,12);
 assert.equal(x.cache.hits,408);
 assert.equal(x.actorCount,35);
 assert.ok(x.initialJsonPayloadBytes>300000&&x.initialJsonPayloadBytes<600000);
 assert.ok(x.updateJsonPayloadBytes>100000);
});

test("larger worlds do not require generating every chunk for 35 players",()=>{
 const a=benchmarkScenario({trainers:35,size:256,placement:"clustered"});
 const b=benchmarkScenario({trainers:35,size:512,placement:"clustered"});
 assert.equal(a.cache.generated,b.cache.generated);
 assert.equal(a.initiallySentChunks,b.initiallySentChunks);
 assert.equal(a.initialJsonPayloadBytes,b.initialJsonPayloadBytes);
});

test("70 widely dispersed players exercise bounded cache without loading entire biomes",()=>{
 const x=benchmarkScenario({trainers:70,size:512,placement:"distributed"});
 assert.equal(x.actorCount,70);
 assert.equal(x.cache.size,96);
 assert.ok(x.cache.evicted>0);
 assert.ok(x.cache.generated<512,"fewer chunks than both regions' total");
 assert.ok(x.initialJsonPayloadBytes<1200000);
 assert.ok(x.initiallySentChunks>500);
});

test("same simulated player positions produce same payload, independent of timing",()=>{
 const options={trainers:12,size:256,placement:"distributed"};
 const a=benchmarkScenario(options), b=benchmarkScenario(options);
 for(const key of ["initiallySentChunks","crossingSentChunks","unloadedChunks",
   "initialJsonPayloadBytes","updateJsonPayloadBytes"]){
   assert.equal(a[key],b[key],key);
 }
 assert.deepEqual(a.cache,b.cache);
});

test("invalid benchmark size, placement and player counts fail closed",()=>{
 for(const trainers of [0,141,5.5]){
   assert.throws(()=>benchmarkScenario({trainers}),RangeError);
 }
 assert.throws(()=>benchmarkScenario({size:64}),RangeError);
 assert.throws(()=>benchmarkScenario({placement:"other"}),RangeError);
});
