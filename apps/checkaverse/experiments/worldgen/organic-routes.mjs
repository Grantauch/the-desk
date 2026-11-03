// PREPRODUCTION route-shape experiment. Curved seeded footpaths replace the
// parent lab's rigid L-shaped links while keeping permanent authored landmarks.
// This is NOT navmesh/A*, a natural river simulator, or live map content.
import { hashText, tileAt } from "./prototype.mjs";
import { makeLandmarkBlueprint } from "./landmark-network.mjs";

const cell=(x,y)=>x+","+y;
const isInt=n=>Number.isInteger(n);

export const ORGANIC_ROUTE_VERSION="organic-footpaths-preview-v1";

export function makeOrganicBlueprint(spec, {width=2,bend=0.13}={}){
  if(!isInt(width)||width<1||width>3)throw new RangeError("Road width must be 1..3");
  if(!Number.isFinite(bend)||bend<0||bend>0.3)throw new RangeError("Bend factor must be 0..0.3");
  const base=makeLandmarkBlueprint(spec);
  const points=new Map(base.landmarks.map(p=>[p.id,p]));
  const route=new Set();
  const n=spec.size;

  function paint(x,y){
    if(!isInt(x)||!isInt(y))throw new TypeError("Route coordinates must be integers");
    if(x<0||y<0||x>=n||y>=n) return;
    route.add(cell(x,y));
    if(width>=2&&x+1<n)route.add(cell(x+1,y));
    if(width>=3&&y+1<n)route.add(cell(x,y+1));
  }

  function connect(a,b,order){
    let x=a.x,y=a.y;
    paint(x,y);
    // Draw only four-neighbor steps. Deterministic axis ordering can vary
    // by segment to avoid a systematic horizontal-first appearance.
    if(order===0){
      while(x!==b.x){x+=Math.sign(b.x-x);paint(x,y);}
      while(y!==b.y){y+=Math.sign(b.y-y);paint(x,y);}
    }else{
      while(y!==b.y){y+=Math.sign(b.y-y);paint(x,y);}
      while(x!==b.x){x+=Math.sign(b.x-x);paint(x,y);}
    }
  }

  for(const [from,to] of base.links){
    const start=points.get(from),end=points.get(to);
    const dx=end.x-start.x,dy=end.y-start.y;
    const length=Math.max(1,Math.hypot(dx,dy));
    const nx=-dy/length,ny=dx/length;
    const salt=hashText(spec.numericSeed+"|"+from+"|"+to+"|"+ORGANIC_ROUTE_VERSION);
    const phase=(salt>>>0)/4294967296*2*Math.PI;
    const second=hashText("second|"+salt);
    const a=((salt&65535)/32767.5-1)*length*bend;
    const b=((second&65535)/32767.5-1)*length*bend*0.5;
    const ticks=Math.ceil(length*1.6);
    let last={x:start.x,y:start.y};
    for(let step=0;step<=ticks;step++){
      const t=step/ticks;
      const fade=Math.sin(Math.PI*t);
      const offset=fade*(a*Math.sin(2*Math.PI*t+phase)+b*Math.sin(4*Math.PI*t+phase));
      const next={x:Math.round(start.x+dx*t+nx*offset),
        y:Math.round(start.y+dy*t+ny*offset)};
      connect(last,next,(salt+step)&1);
      last=next;
    }
    connect(last,{x:end.x,y:end.y},salt&1);
  }
  const labels=new Set(base.landmarks.map(p=>cell(p.x,p.y)));
  const terrain=(x,y)=>{
    if(!isInt(x)||!isInt(y)||x<0||y<0||x>=n||y>=n)throw new RangeError("Tile outside region");
    const k=cell(x,y);
    if(labels.has(k))return "L";
    if(route.has(k))return tileAt(spec,x,y)==="W"?"B":"P";
    return tileAt(spec,x,y);
  };
  return {
    regionId:spec.regionId,generatorVersion:spec.version,
    seed:spec.numericSeed,size:n,landmarks:base.landmarks,
    links:base.links,markings:labels,routeCoordinates:route,routeTileCount:route.size,
    organicRouteVersion:ORGANIC_ROUTE_VERSION,terrain
  };
}
