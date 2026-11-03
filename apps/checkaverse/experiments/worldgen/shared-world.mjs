// Isolated in-memory MULTIPLAYER CONCEPT, never imported by the production server.
// This proves a small interest-subscription and idempotent shared-claim model.
// It does NOT handle school tickets, actual WebSockets, SQLite transactions or reboots.
import { CHUNK_SIZE, createRegionSpec, tileAt } from "./prototype.mjs";

const WALKABLE = new Set(["P", "L", ".", "G", "F", "S", "D", "C", "I"]);
const MANHATTAN = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const bounded = n => Number.isInteger(n) && n >= 0 && n <= 1000000;

export function chunkKey(regionId, x, y) {
  if (typeof regionId !== "string" || !bounded(x) || !bounded(y)) throw new RangeError("Invalid chunk coordinates");
  return regionId + ":" + Math.floor(x / CHUNK_SIZE) + ":" + Math.floor(y / CHUNK_SIZE);
}

export class SharedWorldPilot {
  constructor(regionSpecs, resources = []) {
    if (!Array.isArray(regionSpecs) || regionSpecs.length < 1) throw new TypeError("Pass one or more region specs");
    this.regions = new Map();
    for (const spec of regionSpecs) {
      if (this.regions.has(spec.regionId)) throw new Error("Duplicate region ID");
      this.regions.set(spec.regionId, spec);
    }
    // Trusted resource catalog is supplied by the server at construction time;
    // clients never invent resource IDs or authoritative coordinates.
    this.resources = new Map();
    for (const {regionId, id, x, y} of resources) {
      const spec = this.region(regionId);
      if (typeof id !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(id)) throw new TypeError("Invalid authored resource ID");
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= spec.size || y >= spec.size || !WALKABLE.has(tileAt(spec,x,y))) {
        throw new RangeError("Invalid authored resource location");
      }
      const key=regionId+":"+id;
      if (this.resources.has(key)) throw new Error("Duplicate resource ID");
      this.resources.set(key, {regionId,id,x,y});
    }
    this.players = new Map(); // synthetic anonymous player tokens only
    this.claims = new Map(); // (region, resource id) -> single event
    this.events = [];
    this.nextEventId = 1;
  }

  region(id) {
    const spec = this.regions.get(id);
    if (!spec) throw new RangeError("Unknown region");
    return spec;
  }

  enter(actor, regionId) {
    if (typeof actor !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(actor)) throw new TypeError("Synthetic actor token required");
    const spec = this.region(regionId);
    const old = this.players.get(actor);
    if (old?.online) throw new Error("Already connected: one active session per actor");
    const saved = old && old.regionId === regionId ? {x: old.x, y: old.y} : null;
    const p = {
      actor, regionId, x: saved?.x ?? spec.center, y: saved?.y ?? spec.center,
      online:true, lastSeq:old?.lastSeq ?? 0, revision:spec.version
    };
    this.players.set(actor, p);
    return this.publicView(actor);
  }

  leave(actor) {
    const p = this.players.get(actor);
    if (!p || !p.online) return false;
    p.online = false;
    return true;
  }

  active(actor) {
    const p = this.players.get(actor);
    if (!p || !p.online) throw new Error("Player not connected");
    return p;
  }

  publicView(actor) {
    const p = this.active(actor);
    return {actor:p.actor,regionId:p.regionId,x:p.x,y:p.y,revision:p.revision};
  }

  move(actor, x, y, seq) {
    const p = this.active(actor);
    const spec = this.region(p.regionId);
    if (p.revision !== spec.version) throw new Error("Stale generator revision");
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= spec.size || y >= spec.size) {
      throw new RangeError("Out-of-bounds movement");
    }
    if (!Number.isInteger(seq) || seq <= p.lastSeq) throw new Error("Old or duplicate movement sequence");
    if (Math.abs(x-p.x)+Math.abs(y-p.y)!==1) throw new Error("Non-cardinal or teleported movement");
    if (!WALKABLE.has(tileAt(spec, x, y))) throw new Error("Movement hits solid terrain");
    p.x=x; p.y=y; p.lastSeq=seq;
    return this.publicView(actor);
  }

  visibleFor(actor, radiusChunks = 1) {
    const p = this.active(actor);
    if (!Number.isInteger(radiusChunks) || radiusChunks < 0 || radiusChunks > 3) throw new RangeError("Invalid interest radius");
    const spec = this.region(p.regionId), max=(spec.size/CHUNK_SIZE)-1;
    const px=Math.floor(p.x/CHUNK_SIZE),py=Math.floor(p.y/CHUNK_SIZE);
    const chunks=[];
    for(let cy=Math.max(0,py-radiusChunks);cy<=Math.min(max,py+radiusChunks);cy++) {
      for(let cx=Math.max(0,px-radiusChunks);cx<=Math.min(max,px+radiusChunks);cx++) {
        chunks.push(p.regionId+":"+cx+":"+cy);
      }
    }
    const chunkset=new Set(chunks);
    const nearby=[...this.players.values()]
      .filter(o=>o.online && o.regionId===p.regionId && o.actor!==actor && chunkset.has(chunkKey(o.regionId,o.x,o.y)))
      .map(o=>({actor:o.actor,x:o.x,y:o.y}));
    return {regionId:p.regionId,actor,chunkKeys:chunks,nearby};
  }

  claim(actor, resourceId, seq) {
    const p=this.active(actor);
    const spec=this.region(p.regionId);
    if(typeof resourceId!=="string" || !/^[a-z][a-z0-9-]{0,31}$/.test(resourceId)) throw new TypeError("Invalid resource ID");
    if(!Number.isInteger(seq)||seq<=0)throw new RangeError("Invalid claim nonce");
    const key=p.regionId+":"+resourceId; // server-owned, stable per shared region
    const resource=this.resources.get(key);
    if(!resource)throw new Error("Resource is not registered by server");
    const {x,y}=resource;
    if(MANHATTAN(p,resource)>1)throw new Error("Resource not in reach");
    const prior=this.claims.get(key);
    if(prior) {
      if(prior.actor===actor && prior.seq===seq)return {status:"already-committed",...prior};
      return {status:"already-claimed",eventId:prior.eventId};
    }
    // Catalog registration already validated this tile against server terrain.
    const event={eventId:this.nextEventId++,actor,regionId:p.regionId,resourceId,x,y,seq};
    this.claims.set(key,event);
    this.events.push(event);
    return {status:"claimed",...event};
  }

  committedSince(afterId=0) {
    if(!Number.isInteger(afterId)||afterId<0)throw new RangeError("Invalid event cursor");
    return this.events.filter(x=>x.eventId>afterId).map(x=>({...x}));
  }
}

export function makeIsolatedPilot(worldSeed="test-only-seed") {
  return new SharedWorldPilot([
    createRegionSpec("verdant_crown",worldSeed,256),
    createRegionSpec("frostglass_reach",worldSeed,256)
  ], [
    {regionId:"verdant_crown",id:"canopy-sample",x:128,y:128},
    {regionId:"frostglass_reach",id:"ice-sample",x:128,y:128}
  ]);
}
