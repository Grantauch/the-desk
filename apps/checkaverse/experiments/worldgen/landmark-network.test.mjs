import test from "node:test";
import assert from "node:assert/strict";
import { createRegionSpec, CHUNK_SIZE } from "./prototype.mjs";
import { BIOME_LANDMARKS, makeLandmarkBlueprint, generateLandmarkChunk, auditLandmarkReachability } from "./landmark-network.mjs";

test("all twelve worlds have four different authored destination concepts", () => {
  assert.equal(Object.keys(BIOME_LANDMARKS).length,12);
  const labels=Object.values(BIOME_LANDMARKS).flat();
  assert.equal(labels.length,48);
  assert.equal(new Set(labels.map(x=>x.toLowerCase())).size,48);
  for(const names of Object.values(BIOME_LANDMARKS))for(const n of names)assert.ok(n.length>=5);
});

test("author-controlled routes connect all nine landmarks through solid procedural terrain", () => {
  for(const regionId of Object.keys(BIOME_LANDMARKS)){
    const spec=createRegionSpec(regionId,"author-route-seed",256);
    const graph=makeLandmarkBlueprint(spec);
    const audit=auditLandmarkReachability(graph);
    assert.equal(graph.landmarks.length,9);
    assert.equal(graph.links.length,13);
    assert.ok(graph.routeTileCount>=100,regionId);
    assert.equal(audit.ok,true,regionId+":"+audit.stranded.join(","));
    assert.equal(audit.reached,9);
    assert.equal(audit.routeTiles,audit.visited);
    for(const p of graph.landmarks)assert.equal(graph.terrain(p.x,p.y),"L");
  }
});

test("route topology is global-coordinate seeded and independent of chunk request order", () => {
  const spec=createRegionSpec("verdant_crown","same-permanent-seed",256);
  const route1=makeLandmarkBlueprint(spec);
  const route2=makeLandmarkBlueprint(createRegionSpec("verdant_crown","same-permanent-seed",256));
  assert.deepEqual(route1.landmarks,route2.landmarks);
  for(const [cx,cy] of [[0,0],[3,3],[4,4],[7,7],[0,7],[7,0]]){
    assert.deepEqual(generateLandmarkChunk(spec,route1,cx,cy),generateLandmarkChunk(spec,route2,cx,cy));
  }
});

test("route chunks always match authored global coordinate tiles at every chunk seam", () => {
  const spec=createRegionSpec("bramblefen_basin","bridge-seed",256);
  const blueprint=makeLandmarkBlueprint(spec);
  let bridges=0;
  for(let cy=0;cy<8;cy++)for(let cx=0;cx<8;cx++){
    const chunk=generateLandmarkChunk(spec,blueprint,cx,cy);
    assert.equal(chunk.rows.length,CHUNK_SIZE);
    for(let dy=0;dy<CHUNK_SIZE;dy++)for(let dx=0;dx<CHUNK_SIZE;dx++){
      const absoluteX=cx*CHUNK_SIZE+dx,absoluteY=cy*CHUNK_SIZE+dy;
      assert.equal(chunk.rows[dy][dx],blueprint.terrain(absoluteX,absoluteY));
      if(chunk.rows[dy][dx]==="B")bridges++;
    }
  }
  assert.ok(bridges>0,"The wetland route should contain at least one authored bridge");
});

test("changing seed changes route path decisions while landmarks and gates stay reachable", () => {
  const one=makeLandmarkBlueprint(createRegionSpec("verdant_crown","seed-one",256));
  const two=makeLandmarkBlueprint(createRegionSpec("verdant_crown","seed-two",256));
  assert.notDeepEqual(one.landmarks,two.landmarks);
  assert.equal(auditLandmarkReachability(one).ok,true);
  assert.equal(auditLandmarkReachability(two).ok,true);
});

test("512-square destinations stay reachable; stale blueprints and invalid chunks fail", () => {
  for(const name of ["frostglass_reach","hollowdeep","glassdune_wastes"]){
    const spec=createRegionSpec(name,"huge-biome-design",512);
    const blueprint=makeLandmarkBlueprint(spec);
    assert.equal(auditLandmarkReachability(blueprint).ok,true);
    assert.equal(generateLandmarkChunk(spec,blueprint,15,15).rows.length,32);
    assert.throws(()=>generateLandmarkChunk(spec,blueprint,16,0),RangeError);
    assert.throws(()=>generateLandmarkChunk(spec,blueprint,-1,0),RangeError);
    assert.throws(()=>blueprint.terrain(512,10),RangeError);
    const another=createRegionSpec(name,"new-seed",512);
    assert.throws(()=>generateLandmarkChunk(another,blueprint,0,0),/Stale/);
  }
});
