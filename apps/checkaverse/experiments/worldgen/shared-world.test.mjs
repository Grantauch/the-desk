// No sockets, credentials, student data, reward currency or database writes.
import test from "node:test";
import assert from "node:assert/strict";
import { createRegionSpec, tileAt } from "./prototype.mjs";
import { SharedWorldPilot, makeIsolatedPilot, chunkKey } from "./shared-world.mjs";

test("two trainers in one region share its persistent identity and nearby visibility", () => {
  const world=makeIsolatedPilot("stable-world");
  const a=world.enter("alice","verdant_crown");
  const b=world.enter("bob","verdant_crown");
  const c=world.enter("cara","frostglass_reach");
  assert.deepEqual([a.regionId,b.regionId,c.regionId],["verdant_crown","verdant_crown","frostglass_reach"]);
  assert.deepEqual([a.x,a.y],[128,128]);
  assert.deepEqual([b.x,b.y],[128,128]);
  const seen=world.visibleFor("alice");
  assert.ok(seen.nearby.some(x=>x.actor==="bob"));
  assert.ok(!seen.nearby.some(x=>x.actor==="cara"));
  assert.equal(seen.chunkKeys.length,9);
  assert.ok(seen.chunkKeys.includes("verdant_crown:4:4"));
  assert.deepEqual(world.visibleFor("cara").nearby,[]);
  assert.equal(tileAt(world.region("verdant_crown"),128,128),"L");
});

test("world validates moves, rejects teleport, bad sequence and out-of-bounds", () => {
  const world=makeIsolatedPilot();
  world.enter("alice","verdant_crown");
  assert.deepEqual([world.move("alice",129,128,1).x,world.publicView("alice").y],[129,128]);
  assert.throws(()=>world.move("alice",130,128,1),/sequence/);
  assert.throws(()=>world.move("alice",134,128,2),/teleported/);
  assert.throws(()=>world.move("alice",130,129,2),/teleported/);
  assert.throws(()=>world.move("alice",256,128,2),RangeError);
  assert.throws(()=>world.move("alice",128,128,0),/sequence/);
  assert.equal(world.move("alice",128,128,2).x,128);
});

test("exclusive resource claim is idempotent and never trusts client positions", () => {
  const world=makeIsolatedPilot();
  world.enter("alice","verdant_crown"); world.enter("bob","verdant_crown");
  assert.throws(()=>world.claim("alice","invented-item",2),/not registered/);
  const win=world.claim("alice","canopy-sample",11);
  assert.equal(win.status,"claimed");
  const again=world.claim("alice","canopy-sample",11);
  assert.equal(again.status,"already-committed");
  assert.equal(again.eventId,win.eventId);
  const taken=world.claim("bob","canopy-sample",15);
  assert.equal(taken.status,"already-claimed");
  assert.equal(taken.eventId,win.eventId);
  assert.equal(world.committedSince().length,1);
  assert.equal(world.committedSince(win.eventId).length,0);
  assert.throws(()=>world.committedSince(-1),RangeError);
});

test("claims cannot cross region boundaries or originate beyond reach", () => {
  const world=makeIsolatedPilot();
  world.enter("alice","verdant_crown");
  world.enter("cara","frostglass_reach");
  assert.throws(()=>world.claim("cara","canopy-sample",5),/not registered/);
  assert.equal(world.claim("cara","ice-sample",5).status,"claimed");
  let seq=1;
  for(let x=129;x<=132;x++)world.move("alice",x,128,seq++);
  assert.throws(()=>world.claim("alice","canopy-sample",17),/not in reach/);
});

test("player disconnect and reconnect restore position without allowing duplicate sessions", () => {
  const world=makeIsolatedPilot("class-review");
  world.enter("alice","verdant_crown");
  assert.throws(()=>world.enter("alice","verdant_crown"),/Already connected/);
  world.move("alice",129,128,1);
  assert.equal(world.leave("alice"),true);
  assert.equal(world.leave("alice"),false);
  assert.throws(()=>world.move("alice",130,128,2),/not connected/);
  assert.deepEqual([world.enter("alice","verdant_crown").x,world.publicView("alice").y],[129,128]);
  assert.throws(()=>world.move("alice",130,128,1),/sequence/);
  assert.equal(world.move("alice",130,128,2).x,130);
});

test("interest window changes with movement and never leaks trainers in distant chunks", () => {
  const world=makeIsolatedPilot();
  world.enter("alice","verdant_crown");
  world.enter("bob","verdant_crown");
  const start=world.visibleFor("bob",0);
  assert.equal(start.chunkKeys.length,1);
  let seq=1;
  for(let x=129;x<=193;x++)world.move("alice",x,128,seq++);
  assert.equal(world.visibleFor("bob",0).nearby.length,0);
  assert.ok(!world.visibleFor("bob",1).nearby.some(p=>p.actor==="alice"));
  assert.equal(world.visibleFor("alice",1).nearby.length,0);
});

test("invalid catalog, unregistered actors and chunk indices are rejected", () => {
  assert.throws(()=>makeIsolatedPilot().enter("Bad Actor","verdant_crown"),TypeError);
  assert.throws(()=>makeIsolatedPilot().enter("alex","unknown"),RangeError);
  assert.throws(()=>chunkKey("r",-1,3),RangeError);
  const spec=createRegionSpec("verdant_crown","seed",256);
  assert.throws(()=>new SharedWorldPilot([spec,spec]),/Duplicate region/);
  assert.throws(()=>new SharedWorldPilot([spec],[{regionId:spec.regionId,id:"item",x:-1,y:0}]),RangeError);
  assert.throws(()=>new SharedWorldPilot([spec],[
    {regionId:spec.regionId,id:"item",x:128,y:128},
    {regionId:spec.regionId,id:"item",x:128,y:129}
  ]),/Duplicate resource/);
});
