import test from 'node:test';
import assert from 'node:assert/strict';
import { EvolutionRandom, founderSeed } from './rng.ts';
import { EvolutionClock, TIME_SPEEDS } from './clock.ts';
import { validatePopulation, MAX_COHORTS } from './population.ts';

test('seeded RNG reproduces stream and checkpoint continuation', () => {
  const a = new EvolutionRandom(12345), b = new EvolutionRandom(12345);
  for (let i = 0; i < 2000; i++) assert.equal(a.nextUint32(), b.nextUint32());
  const snap = a.snapshot();
  const future = Array.from({ length: 50 }, () => a.nextInt(17));
  b.restore(snap);
  assert.deepEqual(Array.from({ length: 50 }, () => b.nextInt(17)), future);
  assert.equal(founderSeed(4, 'Fish'), founderSeed(4, 'Fish'));
  assert.notEqual(founderSeed(4, 'Fish'), founderSeed(4, 'Plant'));
});

test('invalid random state is rejected', () => {
  for (const bad of [0, -1, 1.1, Infinity, 4294967296]) assert.throws(() => new EvolutionRandom(bad));
  const r = new EvolutionRandom(1);
  assert.throws(() => r.restore({version:1,state:0}));
  assert.throws(() => r.nextInt(0));
});

test('clock preserves pause, advance and restorable debt', () => {
  const a = new EvolutionClock();
  assert.equal(a.advance(1000).days, 0);
  a.setPaused(false); a.setSpeed(16);
  assert.deepEqual(a.advance(500, 3), {days: 3, pendingDays: 5, saturated: true});
  const b = new EvolutionClock(); b.restore(a.snapshot());
  assert.deepEqual(b.advance(0, 8), a.advance(0, 8));
  assert.deepEqual(b.snapshot(), a.snapshot());
  assert.deepEqual(TIME_SPEEDS, [1,4,16,64]);
});

test('clock never silently skips days under high speed and small budget', () => {
  const c = new EvolutionClock(); c.setPaused(false); c.setSpeed(64);
  const first = c.advance(1000, 1);
  assert.equal(first.days, 1);
  assert.equal(first.pendingDays, 63);
  for(let n=0;n<63;n++) c.advance(0,1);
  assert.equal(c.snapshot().day,64);
  assert.equal(c.snapshot().pendingMillis,0);
  for(const n of [-1,1.5,1001,NaN]) assert.throws(()=>c.advance(n));
});

test('cohorts validate and preserve metadata without changing the original', () => {
  const input = {version:1,cohorts:[{key:'a',founderId:'Fish',lineageId:'L1',habitatCell:13,represented:300,geneticSeed:5}]};
  const p=validatePopulation(input,1024);
  assert.deepEqual(p,input);
  assert.notEqual(p.cohorts[0],input.cohorts[0]);
  assert.throws(()=>validatePopulation({...input,cohorts:[...input.cohorts,...input.cohorts]},1024));
  assert.throws(()=>validatePopulation({version:1,cohorts:[{...input.cohorts[0],habitatCell:9999}]},1024));
  assert.throws(()=>validatePopulation({version:1,cohorts:Array.from({length:MAX_COHORTS+1},()=>input.cohorts[0])},1024));
});
