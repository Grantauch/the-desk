// Separate authored-route-and-landmark prototype. NOT part of the live map engine.
// Deterministic graph connecting authored landmarks over generated terrain. Bridges
// are marked where routes cross water; the world must be identical for all players.
import { CHUNK_SIZE, createRegionSpec, hashText, tileAt } from "./prototype.mjs";

export const BIOME_LANDMARKS=Object.freeze({
  bramblefen_basin: ["Crooked Footbridge","Sleeping Willow","Drowned Steps","Glasswater Pool"],
  cindergear_expanse: ["Silent Foundry","Bell Tower","Great Lift","Quarry Heart"],
  tempest_crown: ["Thunder Arch","Wind Observatory","Shepherd Hearth","Broken Spire"],
  starfall_gloam: ["Fallen Lens","Observatory Steps","Quiet Crater","Mirror Grove"],
  verdant_crown: ["Crownfall Waterfall","Vine Court","Old Canopy Bridge","Temple Root"],
  frostglass_reach: ["Blueglass Lake","North Cairn","Rime Shelter","Wind Carved Arch"],
  emberfall_caldera: ["Cinder Bell","Red Basin","Old Ash Road","Hearth Vent"],
  saltwind_coast: ["Singing Lighthouse","Three Shells","Saltwind Causeway","Reef Steps"],
  glassdune_wastes: ["Sunken Clock","Glass Arch","Dustwell","Sand Observatory"],
  hollowdeep: ["Resonance Hall","Starwell Chamber","Deep Foundry","Echo Gate"],
  sungrass_steppe: ["Windmill Ridge","Tall Bell","Stone Circle","Bloom Plain"],
  whisperwood: ["Listening Tree","Candle Stairs","Moon Hollow","Four Echoes"]
});

const key=(x,y)=>x+","+y;
const walkableRoad=new Set(["P","B","L"]);
const ceil=(x)=>Math.ceil(x);
const abs=(x)=>Math.abs(x);

export function makeLandmarkBlueprint(spec) {
  const names=BIOME_LANDMARKS[spec.regionId];
  if(!names||names.length!==4)throw new Error("Unknown biome landmark contract");
  const n=spec.size, c=spec.center, q=Math.floor(n/5), far=n-1-q;
  const wiggle=(text)=>{
    const d=Math.max(1,Math.floor(n/25));
    return (hashText(spec.numericSeed+"|"+text)%(2*d+1))-d;
  };
  // Four authored destinations, three support junctions, and the guaranteed
  // entrance. Coordinates remain stable under seed and generator version.
  const pts=[
    {id:"south-entry",name:"South gateway",x:c,y:n-1},
    {id:"central-camp",name:"Central landmark",x:c,y:c},
    {id:"north-route",name:"Northern passage",x:c+wiggle("north-x"),y:q},
    {id:"west-route",name:"Western passage",x:q,y:c+wiggle("west-y")},
    {id:"east-route",name:"Eastern passage",x:far,y:c+wiggle("east-y")},
    {id:"landmark-a",name:names[0],x:q+wiggle("a-x"),y:q+wiggle("a-y")},
    {id:"landmark-b",name:names[1],x:far+wiggle("b-x"),y:q+wiggle("b-y")},
    {id:"landmark-c",name:names[2],x:q+wiggle("c-x"),y:far+wiggle("c-y")},
    {id:"landmark-d",name:names[3],x:far+wiggle("d-x"),y:far+wiggle("d-y")}
  ];
  const index=new Map(pts.map(p=>[p.id,p]));
  if(index.size!==pts.length)throw new Error("Duplicate landmark IDs");
  for(const p of pts)if(p.x<1||p.y<1||p.x>=n-1||p.y>=n && p.id!=="south-entry")throw new Error("Landmark outside interior");

  const links=[
    ["south-entry","central-camp"],
    ["central-camp","north-route"],["central-camp","west-route"],["central-camp","east-route"],
    ["north-route","landmark-a"],["north-route","landmark-b"],
    ["west-route","landmark-a"],["west-route","landmark-c"],
    ["east-route","landmark-b"],["east-route","landmark-d"],
    ["landmark-c","landmark-d"],
    // Optional loop path creates a return alternative without hard-gating.
    ["landmark-c","south-entry"],["landmark-d","south-entry"]
  ];
  const mask=new Set();
  for(const [left,right] of links) {
    const a=index.get(left),b=index.get(right);
    if(!a||!b)throw new Error("Missing route endpoint");
    // L-shaped route using global coordinates, the turn orientation chosen
    // from the same immutable seed regardless of chunk generation order.
    const xFirst=(hashText(spec.numericSeed+"|"+left+"|"+right)&1)===0;
    const turn=xFirst?{x:b.x,y:a.y}:{x:a.x,y:b.y};
    const draw=(x0,y0,x1,y1)=>{
      if(x0!==x1 && y0!==y1)throw new Error("Non-cardinal segment");
      const dx=Math.sign(x1-x0),dy=Math.sign(y1-y0);
      let x=x0,y=y0;
      while(true) {
        mask.add(key(x,y));
        if(x===x1&&y===y1)break;
        x+=dx;y+=dy;
      }
    };
    draw(a.x,a.y,turn.x,turn.y);
    draw(turn.x,turn.y,b.x,b.y);
  }

  const labels=new Set(pts.map(p=>key(p.x,p.y)));
  // A path is a passable tile even if the underlying terrain is a tree, rock
  // or water; water crossings use a bridge for visual/QA distinction.
  const terrain=(x,y)=>{
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=n||y>=n)throw new RangeError("Out of world");
    const coord=key(x,y);
    if(labels.has(coord))return "L";
    if(mask.has(coord))return tileAt(spec,x,y)==="W"?"B":"P";
    return tileAt(spec,x,y);
  };
  return {regionId:spec.regionId,generatorVersion:spec.version,seed:spec.numericSeed,
    size:n,landmarks:pts,links,routeTileCount:mask.size,
    routeCoordinates:mask,terrain,markings:labels};
}

export function generateLandmarkChunk(spec,blueprint,cx,cy) {
  if(spec.regionId!==blueprint.regionId||spec.numericSeed!==blueprint.seed||spec.version!==blueprint.generatorVersion||spec.size!==blueprint.size)throw new Error("Stale region blueprint");
  const count=spec.size/CHUNK_SIZE;
  if(!Number.isInteger(cx)||!Number.isInteger(cy)||cx<0||cy<0||cx>=count||cy>=count)throw new RangeError("Invalid chunk");
  const rows=[];
  for(let y=0;y<CHUNK_SIZE;y++) {
    let row="";
    for(let x=0;x<CHUNK_SIZE;x++)row+=blueprint.terrain(cx*CHUNK_SIZE+x,cy*CHUNK_SIZE+y);
    rows.push(row);
  }
  return {regionId:spec.regionId,cx,cy,rows,hash:hashText(spec.numericSeed+"|"+spec.version+"|"+cx+"|"+cy+"|"+rows.join("")).toString(16)};
}

export function auditLandmarkReachability(blueprint) {
  // Only count guaranteed carved routes, so random passable flora cannot hide
  // a broken authored route or stranded building.
  const positions=new Set(blueprint.routeCoordinates);
  const start=blueprint.landmarks[0];
  const queue=[[start.x,start.y]],seen=new Set();
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i],k=key(x,y);
    if(seen.has(k)||!positions.has(k))continue;
    if(!walkableRoad.has(blueprint.terrain(x,y)))throw new Error("Nonwalkable carved route");
    seen.add(k);
    queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  const stranded=blueprint.landmarks.filter(p=>!seen.has(key(p.x,p.y))).map(p=>p.id);
  return {ok:stranded.length===0,stranded,reached:blueprint.landmarks.length-stranded.length,
    total:blueprint.landmarks.length,routeTiles:positions.size,visited:seen.size};
}
