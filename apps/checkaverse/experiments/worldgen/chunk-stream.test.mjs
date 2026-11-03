// Test-only, entirely offline. No live server, school tokens, student data or WebSockets.
import test from "node:test";
import assert from "node:assert/strict";
import { createRegionSpec } from "./prototype.mjs";
import { TerrainChunkCache, TerrainInterestBroker, createTerrainPreview } from "./chunk-stream.mjs";

const spec=(region="verdant_crown",seed="shared-class-terrain",size=256)=>
  createRegionSpec(region,seed,size);
const location=(s,x,y,scope="shared")=>({regionId:s.regionId,x,y,version:s.version,scope});

test("first subscription streams 3x3 chunks; repeated location sends no redundant chunks",()=>{
  const s=spec(),server=createTerrainPreview([s]);
  const initial=server.subscribe("alpha",location(s,128,128));
  assert.equal(initial.added.length,9);
  assert.equal(initial.removed.length,0);
  assert.equal(initial.retainedCount,0);
  assert.equal(initial.subscribedKeys.length,9);
  assert.equal(server.cache.stats().generated,9);
  assert.ok(initial.added.every(c=>c.rows.length===32&&c.rows.every(row=>row.length===32)));
  assert.ok(initial.added.every(c=>c.regionId===s.regionId&&c.version===s.version));
  assert.ok(Object.isFrozen(initial.added[0].rows));
  const again=server.subscribe("alpha",location(s,128,128));
  assert.equal(again.added.length,0);
  assert.equal(again.removed.length,0);
  assert.equal(again.retainedCount,9);
  assert.equal(server.cache.stats().generated,9);
});

test("crossing one chunk boundary sends three new and removes three old chunks",()=>{
  const s=spec(),server=createTerrainPreview([s]);
  server.subscribe("alpha",location(s,127,128)); // current chunk X=3
  const next=server.subscribe("alpha",location(s,128,128)); // X=4
  assert.equal(next.added.length,3);
  assert.equal(next.removed.length,3);
  assert.equal(next.retainedCount,6);
  assert.equal(new Set(next.subscribedKeys).size,9);
  assert.ok(next.added.every(c=>c.cx===5));
  assert.equal(server.cache.stats().generated,12);
  const back=server.subscribe("alpha",location(s,127,128));
  assert.equal(back.added.length,3);
  assert.equal(back.removed.length,3);
  assert.equal(back.retainedCount,6);
  assert.equal(server.cache.stats().generated,12); // previous chunks cached
  assert.equal(server.cache.stats().hits,3);
});

test("world boundaries clamp subscriptions and never request nonexistent chunks",()=>{
  const s=spec("frostglass_reach"),server=createTerrainPreview([s]);
  const topLeft=server.subscribe("alpha",location(s,0,0));
  assert.equal(topLeft.added.length,4);
  assert.deepEqual([...topLeft.subscribedKeys].sort(),[
    "frostglass_reach:0:0","frostglass_reach:0:1",
    "frostglass_reach:1:0","frostglass_reach:1:1"
  ]);
  const bottomRight=server.subscribe("alpha",location(s,255,255));
  assert.equal(bottomRight.added.length,4);
  assert.equal(bottomRight.removed.length,4);
  assert.ok(bottomRight.subscribedKeys.every(k=>/:(6|7):(6|7)$/.test(k)));
});

test("thirty-five synthetic trainers share generated terrain but get distinct subscriptions",()=>{
  const s=spec("verdant_crown","classroom-rehearsal",512);
  const server=createTerrainPreview([s],{maxChunks:64});
  for(let i=0;i<35;i++){
    const actor="student-"+String(i).padStart(2,"0");
    const delta=server.subscribe(actor,location(s,256,256));
    assert.equal(delta.added.length,9);
    assert.equal(delta.retainedCount,0);
  }
  const stats=server.cache.stats();
  assert.equal(server.activeCount(),35);
  assert.equal(stats.generated,9,"only nine shared chunks should be generated");
  assert.equal(stats.hits,34*9,"remaining clients should reuse cached terrain");
  assert.equal(server.peers("student-00").length,34);
});

test("two-region terrain is deterministic and player subscriptions never leak between regions",()=>{
  const a=spec("verdant_crown","seed",512),b=spec("frostglass_reach","seed",512);
  const one=createTerrainPreview([a,b]);
  const two=createTerrainPreview([a,b]);
  const first=one.subscribe("alpha",location(a,128,128));
  const second=one.subscribe("beta",location(b,128,128));
  const third=two.subscribe("gamma",location(a,128,128));
  assert.deepEqual(first.added.map(c=>c.hash),third.added.map(c=>c.hash));
  assert.equal(first.added.length,9);
  assert.equal(second.added.length,9);
  assert.deepEqual(one.peers("alpha"),[]);
  assert.deepEqual(one.peers("beta"),[]);
  assert.ok(first.added.every(c=>c.regionId==="verdant_crown"));
  assert.ok(second.added.every(c=>c.regionId==="frostglass_reach"));
});

test("private instances exclude strangers and flush old subscriptions on scope change",()=>{
  const s=spec(),broker=createTerrainPreview([s]);
  broker.subscribe("alpha",location(s,128,128,"private:alpha"));
  broker.subscribe("beta",location(s,128,128,"private:beta"));
  assert.equal(broker.peers("alpha").length,0);
  assert.throws(()=>broker.subscribe("alpha",location(s,128,128,"private:beta")),/not owned/);
  assert.throws(()=>broker.subscribe("alpha",location(s,128,128,"private:bogus")),/not owned/);
  const publicDelta=broker.subscribe("alpha",location(s,128,128,"shared"));
  assert.equal(publicDelta.added.length,9);
  assert.equal(publicDelta.removed.length,9,"private chunks must be unsubscribed on scope change");
  assert.equal(broker.peers("alpha").length,0);
  broker.subscribe("beta",location(s,128,128,"shared"));
  assert.equal(broker.peers("alpha").length,1);
  assert.ok(broker.disconnect("alpha"));
  assert.equal(broker.activeCount(),1);
  assert.throws(()=>broker.peers("alpha"),/Unknown actor/);
});

test("stale region revision, foreign map IDs and forged coordinates are rejected",()=>{
  const s=spec(),broker=createTerrainPreview([s]);
  assert.throws(()=>broker.subscribe("alpha",location(s,128,128,"private:beta")),/not owned/);
  assert.throws(()=>broker.subscribe("alpha",{...location(s,128,128),version:"old"}),/Stale/);
  assert.throws(()=>broker.subscribe("alpha",{...location(s,128,128),regionId:"unknown"}),RangeError);
  for(const pos of [[-1,0],[0,-1],[256,0],[0,256],[0.5,0]]){
    assert.throws(()=>broker.subscribe("alpha",location(s,pos[0],pos[1])),RangeError);
  }
  assert.throws(()=>broker.subscribe("bad@token",location(s,128,128)),TypeError);
  assert.throws(()=>broker.subscribe("alpha",location(s,128,128,"private:someone-else")),/not owned/);
  assert.throws(()=>createTerrainPreview([s],{radius:3}),RangeError);
});

test("bounded LRU evicts cold chunks and regenerates byte-identical content",()=>{
  const s=spec("verdant_crown","eviction-demo",512);
  const cache=new TerrainChunkCache([s],{maxChunks:9});
  const first=cache.chunk(s.regionId,0,0);
  for(let y=1;y<16;y++){
    for(let x=0;x<16;x++)cache.chunk(s.regionId,x,y);
  }
  assert.equal(cache.stats().size,9);
  assert.ok(cache.stats().evicted>10);
  const rebuilt=cache.chunk(s.regionId,0,0);
  assert.equal(rebuilt.hash,first.hash);
  assert.deepEqual(rebuilt.rows,first.rows);
  assert.equal(cache.stats().size,9);
});

test("nearby interest is defined by overlapping chunk windows, not a global broadcast",()=>{
  const s=spec("verdant_crown","interest",512);
  const b=createTerrainPreview([s],{radius:0});
  b.subscribe("alpha",location(s,33,33));
  b.subscribe("beta",location(s,34,34));
  b.subscribe("gamma",location(s,290,290));
  assert.deepEqual(b.peers("alpha").map(x=>x.actor),["beta"]);
  assert.deepEqual(b.peers("gamma"),[]);
});

test("invalid cache arguments and region definitions fail fast",()=>{
  const s=spec();
  assert.throws(()=>new TerrainChunkCache([]),TypeError);
  assert.throws(()=>new TerrainChunkCache([s,s]),/duplicate/);
  assert.throws(()=>new TerrainChunkCache([s],{maxChunks:2}),RangeError);
  const c=new TerrainChunkCache([s]);
  for(const args of [[-1,0],[0,-1],[8,0],[0,8],[1.5,1]])assert.throws(()=>c.chunk(s.regionId,args[0],args[1]),RangeError);
  assert.throws(()=>c.chunk("nonexistent",0,0),RangeError);
});
