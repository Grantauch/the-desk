// NONPRODUCTION Checklings chunk streaming proof. This models the immutable terrain
// channel only. It does not provide authentication, WebSockets, school identity,
// actor collision validation, dynamic state, resources, or database persistence.
// Inputs are trusted SERVER-VALIDATED positions, never raw client coordinates.
import { CHUNK_SIZE } from "./prototype.mjs";
import { makeLandmarkBlueprint, generateLandmarkChunk } from "./landmark-network.mjs";

const actorPattern = /^[a-z][a-z0-9-]{0,31}$/;
const validCoord = n => Number.isInteger(n) && n >= 0;
const chunkIdentity = (regionId,cx,cy) => regionId+":"+cx+":"+cy;

export class TerrainChunkCache {
  constructor(specs, { maxChunks = 64 } = {}) {
    if(!Array.isArray(specs) || specs.length === 0) throw new TypeError("One or more region specs required");
    if(!Number.isInteger(maxChunks) || maxChunks < 9 || maxChunks > 4096) throw new RangeError("maxChunks must be 9..4096");
    this.specs = new Map();
    this.blueprints = new Map();
    this.cache = new Map();
    this.maxChunks = maxChunks;
    this.hits = 0;
    this.generated = 0;
    this.evicted = 0;
    for(const spec of specs) {
      if(!spec || typeof spec.regionId !== "string" || this.specs.has(spec.regionId)) throw new Error("Invalid or duplicate region");
      if(spec.size % CHUNK_SIZE !== 0 || spec.version === undefined || spec.numericSeed === undefined) throw new Error("Bad region spec");
      this.specs.set(spec.regionId,spec);
      this.blueprints.set(spec.regionId,makeLandmarkBlueprint(spec));
    }
  }

  specFor(regionId) {
    const spec=this.specs.get(regionId);
    if(!spec) throw new RangeError("Unknown region");
    return spec;
  }

  chunk(regionId,cx,cy) {
    const spec=this.specFor(regionId);
    const max=spec.size/CHUNK_SIZE;
    if(!validCoord(cx) || !validCoord(cy) || cx>=max || cy>=max) throw new RangeError("Out-of-bounds chunk coordinate");
    const key=regionId+":"+spec.version+":"+spec.numericSeed+":"+cx+":"+cy;
    if(this.cache.has(key)){
      const out=this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key,out);
      this.hits++;
      return out;
    }
    const raw=generateLandmarkChunk(spec,this.blueprints.get(regionId),cx,cy);
    const rows=Object.freeze([...raw.rows]);
    const out=Object.freeze({regionId,cx,cy,version:spec.version,seed:spec.numericSeed,
      hash:raw.hash,rows});
    this.cache.set(key,out);
    this.generated++;
    if(this.cache.size>this.maxChunks){
      const oldest=this.cache.keys().next().value;
      this.cache.delete(oldest);
      this.evicted++;
    }
    return out;
  }

  stats() {
    return Object.freeze({hits:this.hits,generated:this.generated,
      evicted:this.evicted,size:this.cache.size,maxChunks:this.maxChunks});
  }
}

function surrounding(spec,x,y,radius){
  const chunksAcross=spec.size/CHUNK_SIZE;
  const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);
  const result=[];
  for(let iy=Math.max(0,cy-radius);iy<=Math.min(chunksAcross-1,cy+radius);iy++){
    for(let ix=Math.max(0,cx-radius);ix<=Math.min(chunksAcross-1,cx+radius);ix++){
      result.push([ix,iy]);
    }
  }
  return result;
}

export class TerrainInterestBroker {
  constructor(cache,{radius=1}={}){
    if(!(cache instanceof TerrainChunkCache)) throw new TypeError("A terrain cache is required");
    if(!Number.isInteger(radius)||radius<0||radius>2) throw new RangeError("Interest radius must be 0..2");
    this.cache=cache;
    this.radius=radius;
    this.clients=new Map();
  }

  // Important: a production server must derive this location from its own
  // authoritative player record AFTER validating movement/map transitions.
  // A client must never choose the region, instance, seed, or x/y directly.
  subscribe(actor,serverLocation){
    if(typeof actor!=="string"||!actorPattern.test(actor))throw new TypeError("Synthetic actor token is invalid");
    const {regionId,x,y,version,scope}=serverLocation??{};
    const spec=this.cache.specFor(regionId);
    if(!validCoord(x)||!validCoord(y)||x>=spec.size||y>=spec.size)throw new RangeError("Invalid server-owned position");
    if(version!==spec.version)throw new Error("Stale generator revision");
    if(typeof scope!=="string"||!/^shared$|^private:[a-z][a-z0-9-]{0,31}$/.test(scope))throw new TypeError("Untrusted instance scope");
    if(scope.startsWith("private:") && scope!=="private:"+actor)throw new Error("Private instance is not owned by this actor");
    const previous=this.clients.get(actor);
    const prior=new Set(previous?.keys??[]);
    // Changing instance/region/revision invalidates the prior subscription even
    // if the same static coordinates happen to produce identical chunk keys.
    const contextChanged=Boolean(previous && (
      previous.regionId!==regionId||previous.scope!==scope||previous.version!==version));
    if(contextChanged)prior.clear();
    const chunkCoords=surrounding(spec,x,y,this.radius);
    const keys=chunkCoords.map(([cx,cy])=>chunkIdentity(regionId,cx,cy));
    const wanted=new Set(keys);
    const added=chunkCoords.filter(([cx,cy])=>!prior.has(chunkIdentity(regionId,cx,cy)))
      .map(([cx,cy])=>this.cache.chunk(regionId,cx,cy));
    const removed=contextChanged?[...(previous?.keys??[])]:(
      previous?.keys??[]).filter(key=>!wanted.has(key));
    const retained=keys.filter(key=>prior.has(key));
    this.clients.set(actor,{regionId,scope,version,x,y,keys});
    return Object.freeze({actor,regionId,scope,version,
      position:Object.freeze({x,y}),added:Object.freeze(added),
      removed:Object.freeze(removed),retainedCount:retained.length,
      subscribedKeys:Object.freeze(keys)});
  }

  peers(actor) {
    const me=this.clients.get(actor);
    if(!me)throw new Error("Unknown actor session");
    const subscribed=new Set(me.keys);
    return [...this.clients.entries()].filter(([other,p])=>
      other!==actor&&p.scope===me.scope&&p.regionId===me.regionId&&p.version===me.version&&
      p.keys.some(key=>subscribed.has(key))
    ).map(([other,p])=>Object.freeze({actor:other,x:p.x,y:p.y}));
  }

  disconnect(actor){
    return this.clients.delete(actor);
  }

  activeCount(){return this.clients.size;}
}

// Creates a fresh broker with the same 12-biome definitions or a test subset.
// There is no network endpoint, saved credential, student roster, or game ID.
export function createTerrainPreview(specs,options={}){
  return new TerrainInterestBroker(new TerrainChunkCache(specs,{maxChunks:options.maxChunks??64}),
    {radius:options.radius??1});
}
