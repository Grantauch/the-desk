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

  // Trusted server-side snapshot contract only. Real deployment would use
  // SQLite transactions, replay protection, a backed-up checkpoint and migrations.
  exportSnapshot() {
    return {
      schema: 1,
      regions: [...this.regions.values()].map(s => ({
        regionId: s.regionId, seed: s.numericSeed, version: s.version, size: s.size
      })).sort((a,b)=>a.regionId.localeCompare(b.regionId)),
      players: [...this.players.values()].map(p => ({
        actor:p.actor,regionId:p.regionId,x:p.x,y:p.y,lastSeq:p.lastSeq,revision:p.revision
      })).sort((a,b)=>a.actor.localeCompare(b.actor)),
      events: this.events.map(e=>({...e}))
    };
  }

  static restoreSnapshot(regionSpecs, resourceCatalog, snapshot) {
    if(!snapshot||snapshot.schema!==1||!Array.isArray(snapshot.regions)||!Array.isArray(snapshot.players)||!Array.isArray(snapshot.events)){
      throw new Error("Invalid shared-world snapshot schema");
    }
    const world=new SharedWorldPilot(regionSpecs,resourceCatalog);
    const expected=world.exportSnapshot().regions;
    if(JSON.stringify(snapshot.regions)!==JSON.stringify(expected)) {
      throw new Error("World seed, size, or generator revision changed: migrate before restore");
    }
    for(const p of snapshot.players) {
      if(!p || typeof p.actor!=="string" || !/^[a-z][a-z0-9-]{0,31}$/.test(p.actor))throw new Error("Invalid saved actor");
      const spec=world.region(p.regionId);
      if(p.revision!==spec.version||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=spec.size||p.y>=spec.size||!WALKABLE.has(tileAt(spec,p.x,p.y))) {
        throw new Error("Saved player location does not match the current world");
      }
      if(!Number.isInteger(p.lastSeq)||p.lastSeq<0||world.players.has(p.actor))throw new Error("Invalid saved player sequence");
      world.players.set(p.actor,{...p,online:false});
    }
    for(const e of snapshot.events){
      if(!e||!Number.isInteger(e.eventId)||e.eventId!==world.nextEventId||!world.players.has(e.actor)||!Number.isInteger(e.seq)||e.seq<=0) {
        throw new Error("Invalid or reordered saved event");
      }
      const resource=world.resources.get(e.regionId+":"+e.resourceId);
      if(!resource || resource.x!==e.x || resource.y!==e.y)throw new Error("Saved event does not match trusted resource catalog");
      const key=e.regionId+":"+e.resourceId;
      if(world.claims.has(key))throw new Error("Duplicate claim in saved event history");
      const event={eventId:e.eventId,actor:e.actor,regionId:e.regionId,resourceId:e.resourceId,x:e.x,y:e.y,seq:e.seq};
      world.claims.set(key,event);
      world.events.push(event);
      world.nextEventId++;
    }
    return world;
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
