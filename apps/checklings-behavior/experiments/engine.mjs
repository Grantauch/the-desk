/**
 * Synthetic Checklings individuality experiment. NOT wired to production.
 * Pure replay from trusted synthetic events; does not authenticate, save, reward,
 * infer memories from old records, or use wall-clock/random global state.
 */
export const LIMITS = Object.freeze({ events: 256, memories: 16, preferences: 12, tagLength: 32, idLength: 64 });
const KINDS = Object.freeze({
  FEED: { energy: 5, trust: 3, comfort: 2, salience: 3, like: 2 },
  PLAY: { energy: -9, trust: 5, comfort: 7, salience: 5, like: 4 },
  EXPLORE: { energy: -11, trust: 1, comfort: 3, salience: 7, like: 5 },
  REST: { energy: 20, trust: 1, comfort: 1, salience: 2, like: 1 },
  FRIENDLY: { energy: -1, trust: 8, comfort: 6, salience: 6, like: 3 },
  SCARE: { energy: -6, trust: -8, comfort: -17, salience: 9, like: -5 },
  RECOVER: { energy: 14, trust: 4, comfort: 11, salience: 8, like: 1 }
});
const INTENTS = Object.freeze(['rest', 'explore', 'socialize', 'observe', 'seek_comfort', 'withdraw']);
const bounded = (n, low=0, high=100) => Math.max(low, Math.min(high, n));
const own = (o, p) => Object.prototype.hasOwnProperty.call(o, p);
const uint32 = (n) => n >>> 0;
function assertString(s, name, max=LIMITS.idLength) {
  if (typeof s !== 'string' || s.length < 1 || s.length > max || !/^[a-zA-Z0-9_.:-]+$/.test(s)) {
    throw new TypeError(name+' must be 1-'+max+' safe ASCII characters');
  }
}
function assertNumber(n, name) { if (!Number.isSafeInteger(n)) throw new TypeError(name+' must be a safe integer'); }
/** Noncryptographic deterministic hash; never use for identity/security. */
export function hash32(text) {
  let h = 2166136261;
  for (const codePoint of text) { h ^= codePoint.codePointAt(0); h = Math.imul(h, 16777619); }
  return uint32(h);
}
function derivedTrait(seed, key) { return 12 + (hash32(seed+':'+key) % 77); }
function normalizeSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('spec required');
  assertString(spec.id, 'spec.id');
  assertString(spec.speciesId, 'spec.speciesId');
  assertNumber(spec.seed, 'spec.seed');
  if (!Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 4294967295) throw new RangeError('seed must be unsigned 32-bit');
  const defaults = spec.speciesDefaults ?? {};
  const keys = ['curiosity','sociability','caution','activity','resilience'];
  for (const [key,value] of Object.entries(defaults)) {
    if (!keys.includes(key) || !Number.isInteger(value) || value < 0 || value > 100) throw new TypeError('speciesDefaults requires integer 0..100 for known keys');
  }
  // A species mean plus a seeded deviation. Stable traits are not mutated by events.
  const traits = Object.fromEntries(keys.map(key => [key, bounded(Math.round((defaults[key] ?? 50) * .72 + derivedTrait(spec.speciesId+':'+spec.seed, key) * .28))]));
  return { id: spec.id, speciesId: spec.speciesId, seed: spec.seed, traits };
}
function validateEvent(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw new TypeError('event must be object');
  assertString(e.id, 'event.id');
  assertNumber(e.seq, 'event.seq');
  if (e.seq < 1 || e.seq > LIMITS.events) throw new RangeError('event.seq out of bounds');
  if (!own(KINDS,e.kind)) throw new TypeError('unknown event kind');
  assertString(e.tag, 'event.tag', LIMITS.tagLength);
  for (const k of Object.keys(e)) if (!['id','seq','kind','tag'].includes(k)) throw new TypeError('unexpected event field');
  return e.id+'\u0000'+e.seq+'\u0000'+e.kind+'\u0000'+e.tag;
}
export function replay(spec, events=[]) {
  const individual=normalizeSpec(spec);
  if (!Array.isArray(events) || events.length > LIMITS.events) throw new RangeError('events must be array of at most '+LIMITS.events);
  const seen = new Map();
  const base = {energy:70, trust:50, comfort:65};
  const preferences = new Map();
  const memories=[];
  let seq=0;
  for (const e of events) {
    const signature=validateEvent(e);
    if (seen.has(e.id)) {
      if (seen.get(e.id) !== signature) throw new Error('conflicting duplicate event ID: '+e.id);
      continue; // Replaying an identical ledger event never changes the outcome.
    }
    if (e.seq !== seq+1) throw new Error('nonconsecutive event seq '+e.seq+'; expected '+(seq+1));
    seen.set(e.id,signature); seq=e.seq;
    const effect=KINDS[e.kind];
    base.energy=bounded(base.energy+effect.energy);
    base.trust=bounded(base.trust+effect.trust);
    base.comfort=bounded(base.comfort+effect.comfort + Math.floor((individual.traits.resilience-50)/25));
    preferences.set(e.tag, bounded((preferences.get(e.tag)||0)+effect.like, -25,25));
    memories.push({ eventId:e.id,seq:e.seq,kind:e.kind,tag:e.tag,salience:effect.salience });
    // Retain high-impact episodes and recent ties; deterministic, no synthetic backstory.
    if (memories.length>LIMITS.memories) {
      memories.sort((a,b)=> (b.salience*100+b.seq)-(a.salience*100+a.seq) || a.eventId.localeCompare(b.eventId));
      memories.length=LIMITS.memories;
    }
    if (preferences.size>LIMITS.preferences) {
      const drop=[...preferences].sort(([ak,av],[bk,bv])=>Math.abs(av)-Math.abs(bv) || ak.localeCompare(bk))[0][0];
      preferences.delete(drop);
    }
  }
  const memoryView=memories.slice().sort((a,b)=>a.seq-b.seq);
  const preferenceView=Object.fromEntries([...preferences].sort(([a],[b])=>a.localeCompare(b)));
  return {
    version:'synthetic-individuality-v1', creatureId: individual.id,speciesId:individual.speciesId,
    seed:individual.seed, revision:seq, traits:individual.traits,
    state:base, preferences:preferenceView, memories:memoryView,
    counters:{eventsProcessed:seen.size, memories:memoryView.length, preferences:preferences.size}
  };
}
/** Scores hypothetical behavior without ever claiming a server event occurred. */
export function chooseIntent(snapshot,{scene='home',tag='quiet'}={}) {
  if (!snapshot || snapshot.version!=='synthetic-individuality-v1') throw new TypeError('experiment snapshot required');
  assertString(scene,'scene',LIMITS.tagLength);assertString(tag,'tag',LIMITS.tagLength);
  const t=snapshot.traits, s=snapshot.state, affinity=snapshot.preferences[tag]||0;
  const scores={
    rest:(100-s.energy)*1.2+(100-t.activity)*.17,
    explore:t.curiosity*.83+s.energy*.35-t.caution*.35+affinity*.6,
    socialize:t.sociability*.75+s.trust*.4+affinity*.45,
    observe:t.curiosity*.56+t.caution*.34+s.comfort*.12,
    seek_comfort:(100-s.comfort)*.82+(100-s.trust)*.25,
    withdraw:(100-s.comfort)*.74+t.caution*.42+(100-s.trust)*.2
  };
  // 0..4 stable variability depends on the SAME committed revision/scene.
  const ranked=INTENTS.map(intent=>({intent,score:Math.round((scores[intent]+hash32([snapshot.creatureId,snapshot.seed,snapshot.revision,scene,tag,intent].join(':'))%5)*100)/100})).sort((a,b)=>b.score-a.score||a.intent.localeCompare(b.intent));
  return { intent:ranked[0].intent,score:ranked[0].score,alternatives:ranked.slice(1,3),
    scene,tag,revision:snapshot.revision,explanation:'scores derived from recorded revision '+snapshot.revision+', stable temperament and tag preference',
    commitsAction:false };
}
