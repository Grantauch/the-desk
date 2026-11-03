import test from "node:test";
import assert from "node:assert/strict";
import { buildPreviewData, buildPreviewHtml } from "./map-preview.mjs";
import { REGION_THEMES, createRegionSpec } from "./prototype.mjs";
import { TerrainChunkCache } from "./chunk-stream.mjs";
import { ORGANIC_ROUTE_VERSION } from "./organic-routes.mjs";

test("all twelve 256-square worlds have complete rows and nine named landmarks",()=>{
  const data=buildPreviewData({size:256});
  assert.equal(data.regions.length,12);
  const names=new Set();
  for(const r of data.regions){
    assert.equal(r.rows.length,256,r.id);
    assert.ok(r.rows.every(row=>row.length===256),r.id);
    assert.equal(r.landmarks.length,9,r.id);
    for(const p of r.landmarks){
      assert.ok(p.x>=0&&p.x<256&&p.y>=0&&p.y<256);
      assert.equal(r.rows[p.y][p.x],"L",r.id+"/"+p.name);
      if(p.id.startsWith("landmark-")){
        assert.ok(!names.has(p.name),"Duplicate named landmark "+p.name);
        names.add(p.name);
      }
    }
  }
  assert.equal(names.size,48);
});

test("offline inspector and streaming broker serve identical seeded organic terrain",()=>{
  const seed="shared-terrain-contract";
  const data=buildPreviewData({seed,size:256,regions:["verdant_crown","frostglass_reach"]});
  assert.equal(data.routeVersion,ORGANIC_ROUTE_VERSION);
  const specs=data.regions.map(r=>createRegionSpec(r.id,seed,256));
  const cache=new TerrainChunkCache(specs);
  for(const row of data.regions){
    for(const [cx,cy] of [[0,0],[3,3],[4,4],[7,7]]){
      const chunk=cache.chunk(row.id,cx,cy);
      assert.equal(chunk.routeVersion,ORGANIC_ROUTE_VERSION);
      for(let dy=0;dy<32;dy++){
        assert.equal(chunk.rows[dy],row.rows[cy*32+dy].slice(cx*32,cx*32+32));
      }
    }
  }
});

test("same seed produces byte-identical immutable landmark maps",()=>{
  const settings={seed:"repeatable",regions:["verdant_crown","frostglass_reach"]};
  assert.deepEqual(buildPreviewData(settings),buildPreviewData(settings));
  const other=buildPreviewData({...settings,seed:"different"});
  assert.notDeepEqual(buildPreviewData(settings).regions[0].rows,other.regions[0].rows);
});

test("a 512-square jungle inspector retains all rows and authored routes",()=>{
  const data=buildPreviewData({size:512,regions:["verdant_crown"]});
  assert.equal(data.regions.length,1);
  assert.equal(data.regions[0].rows.length,512);
  assert.ok(data.regions[0].rows.every(r=>r.length===512));
  assert.equal(data.regions[0].landmarks.length,9);
});

test("offline HTML contains a parseable 12-biome dataset and browser controls",()=>{
  const html=buildPreviewHtml({size:256});
  const payload=html.match(/<script id='payload' type='application\/json'>([\s\S]+?)<\/script>/)?.[1];
  assert.ok(payload,"map dataset should be embedded in a standalone offline document");
  const data=JSON.parse(payload);
  assert.equal(data.regions.length,12);
  assert.ok(html.includes("<canvas id='map'"));
  assert.ok(html.includes("PRIVATE")===false);
  assert.ok(html.includes("OFFLINE PREPRODUCTION"));
  assert.ok(!html.includes("https://"),"inspector should work offline with no external dependencies");
});

test("malicious seed strings cannot insert HTML script tags",()=>{
  const malicious="seed</script><img src=x onerror=alert(1)>";
  const html=buildPreviewHtml({seed:malicious,regions:["bramblefen_basin"]});
  assert.ok(!html.includes(malicious));
  assert.ok(!html.includes("<img src=x"));
  const payload=html.match(/<script id='payload' type='application\/json'>([\s\S]+?)<\/script>/)?.[1];
  assert.ok(payload);
  const json=JSON.parse(payload);
  assert.equal(json.seed,malicious);
});

test("bad world sizes, duplicate regions, invalid seeds and unknown IDs fail closed",()=>{
  assert.throws(()=>buildPreviewData({size:100}),RangeError);
  assert.throws(()=>buildPreviewData({size:0}),RangeError);
  assert.throws(()=>buildPreviewData({regions:[]}),TypeError);
  assert.throws(()=>buildPreviewData({regions:["verdant_crown","verdant_crown"]}),TypeError);
  assert.throws(()=>buildPreviewData({regions:["unknown"]}),RangeError);
  assert.throws(()=>buildPreviewData({seed:""}),TypeError);
  assert.equal(Object.keys(REGION_THEMES).length,12);
});
