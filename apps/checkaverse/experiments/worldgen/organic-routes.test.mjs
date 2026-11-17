import test from "node:test";
import assert from "node:assert/strict";
import { REGION_THEMES, createRegionSpec, tileAt, terrainWithoutDebugPaths } from "./prototype.mjs";
import { makeLandmarkBlueprint, generateLandmarkChunk, auditLandmarkReachability } from "./landmark-network.mjs";
import { ORGANIC_ROUTE_VERSION, makeOrganicBlueprint } from "./organic-routes.mjs";

test("all twelve 256-square biomes keep nine accessible landmarks and return routes",()=>{
  for(const id of Object.keys(REGION_THEMES)){
    const s=createRegionSpec(id,"organic-preview-qa",256);
    const b=makeOrganicBlueprint(s);
    const audit=auditLandmarkReachability(b);
    assert.equal(b.organicRouteVersion,ORGANIC_ROUTE_VERSION);
    assert.equal(b.landmarks.length,9,id);
    assert.equal(b.links.length,13,id);
    assert.equal(audit.ok,true,id);
    assert.equal(audit.reached,9,id);
    assert.equal(audit.visited,audit.routeTiles,id);
    for(const p of b.landmarks)assert.equal(b.terrain(p.x,p.y),"L");
  }
});

test("curved routes differ meaningfully from the old cardinal L-shaped network",()=>{
  for(const id of ["bramblefen_basin","verdant_crown","frostglass_reach"]){
    const s=createRegionSpec(id,"meander-check",256);
    const old=makeLandmarkBlueprint(s);
    const now=makeOrganicBlueprint(s);
    const different=[...now.routeCoordinates].filter(k=>!old.routeCoordinates.has(k));
    assert.ok(different.length>100,id+" needs a visible non-grid route shape");
    assert.equal(auditLandmarkReachability(now).ok,true);
  }
});

test("organic overlay removes early proof-of-concept grid except authored curved paths",()=>{
  const s=createRegionSpec("bramblefen_basin","no-straight-grid",256);
  const b=makeOrganicBlueprint(s);
  assert.equal(tileAt(s,3,s.center),"P","parent base proof intentionally has a debug cross");
  assert.notEqual(terrainWithoutDebugPaths(s,3,s.center),"P");
  assert.notEqual(terrainWithoutDebugPaths(s,s.center,3),"P");
  for(let x=0;x<256;x++){
    const y=s.center;
    if(!b.routeCoordinates.has(x+","+y)&&!b.markings.has(x+","+y)){
      assert.notEqual(b.terrain(x,y),"P","unrelated horizontal debug path leaked");
    }
  }
});

test("same permanent seed gives identical paths regardless of read order",()=>{
  const one=createRegionSpec("verdant_crown","stable-route-seed",256);
  const two=createRegionSpec("verdant_crown","stable-route-seed",256);
  const a=makeOrganicBlueprint(one),b=makeOrganicBlueprint(two);
  assert.deepEqual(a.landmarks,b.landmarks);
  assert.deepEqual([...a.routeCoordinates].sort(),[...b.routeCoordinates].sort());
  assert.deepEqual(generateLandmarkChunk(one,a,3,4),generateLandmarkChunk(two,b,3,4));
});

test("new seed changes meanders without breaking critical paths",()=>{
  const id="bramblefen_basin";
  const x=makeOrganicBlueprint(createRegionSpec(id,"one",256));
  const y=makeOrganicBlueprint(createRegionSpec(id,"two",256));
  assert.notDeepEqual([...x.routeCoordinates].sort(),[...y.routeCoordinates].sort());
  assert.equal(auditLandmarkReachability(x).ok,true);
  assert.equal(auditLandmarkReachability(y).ok,true);
});

test("512-square arctic and jungle paths remain reachable and chunk-safe",()=>{
  for(const id of ["frostglass_reach","verdant_crown"]){
    const s=createRegionSpec(id,"large-organic",512);
    const b=makeOrganicBlueprint(s);
    assert.equal(auditLandmarkReachability(b).ok,true);
    for(const [cx,cy] of [[0,0],[3,3],[7,7],[8,8],[15,15]]){
      const chunk=generateLandmarkChunk(s,b,cx,cy);
      assert.equal(chunk.rows.length,32);
      for(let dy=0;dy<32;dy+=7)for(let dx=0;dx<32;dx+=7){
        assert.equal(chunk.rows[dy][dx],b.terrain(cx*32+dx,cy*32+dy));
      }
    }
  }
});

test("invalid widths, excessive jitter and outside coordinates fail closed",()=>{
  const spec=createRegionSpec("verdant_crown","narrow",256);
  for(const width of [0,-1,4,1.2])assert.throws(()=>makeOrganicBlueprint(spec,{width}),RangeError);
  for(const bend of [-0.1,0.31,Number.POSITIVE_INFINITY])assert.throws(()=>makeOrganicBlueprint(spec,{bend}),RangeError);
  const b=makeOrganicBlueprint(spec);
  for(const [x,y] of [[-1,0],[0,-1],[256,0],[0,256]])assert.throws(()=>b.terrain(x,y),RangeError);
});
