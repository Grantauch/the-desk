'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const world = require('./living-world.cjs');
const options = { worldSeed: 'deadbeef01234567', dayKey: '2026-10-22', minuteOfDay: 650, species: 'mochi', habitat: 'grove', season: 'autumn' };
test('stable daily character, visitor, weather and event key across reloads', () => {
  assert.deepEqual(world.observeWorld(options), world.observeWorld({ ...options }));
});
test('24-hour environment shifts but narrative world identity stays stable for the day', () => {
  const a = world.observeWorld(options), b = world.observeWorld({ ...options, minuteOfDay: 1360 });
  assert.equal(a.eventKey, b.eventKey); assert.equal(a.visitor, b.visitor); assert.notEqual(a.timeOfDay, b.timeOfDay);
});
test('species personalities vary without transmitting identity', () => {
  const scenes = Object.keys(world.SPECIES).map(species => world.observeWorld({ ...options, species }));
  assert.equal(new Set(scenes.map(s => s.personality)).size, 4);
  for (const scene of scenes) assert.equal(JSON.stringify(scene).includes(options.worldSeed), false);
});
test('habitats have distinct biomes and seasons are bounded', () => {
  for (const habitat of Object.keys(world.HABITATS)) for (const season of world.SEASONS) {
    const scene = world.observeWorld({ ...options, habitat, season });
    assert.ok(world.HABITATS[habitat].visitors.includes(scene.visitor));
    assert.ok(world.HABITATS[habitat].weather.includes(scene.weather));
  }
});
test('school-day progression is the only care clock; weekend or holiday does not decay', () => {
  const a = world.createCareState(100);
  assert.deepEqual(world.advanceSchoolDays(a, 100).vitals, a.vitals);
  assert.equal(world.advanceSchoolDays(a, 101).vitals.hunger, 75);
});
test('long absences have gentle capped decay; bond and progress survive', () => {
  const a = { ...world.createCareState(5), bond: 60 };
  const later = world.advanceSchoolDays(a, 95);
  assert.equal(later.vitals.hunger, 61); assert.equal(later.bond, 60);
  assert.ok(Object.values(later.vitals).every(n => n >= 0));
});
test('care changes vitals but never currency, streak or points', () => {
  const a = world.createCareState(11);
  const b = world.performCare(a, 'meal', 11);
  assert.equal(b.applied, true); assert.equal(b.state.vitals.hunger, 100);
  assert.equal(b.state.bond, 1); assert.equal('dust' in b.state, false);
  assert.equal('points' in b.state, false); assert.equal(a.vitals.hunger, 82);
});
test('repeating care cannot endlessly farm bond or boost vitals', () => {
  let state = world.createCareState(11);
  for (let i = 0; i < 100; i++) state = world.performCare(state, 'treat', 11).state;
  assert.equal(state.actionsToday, 2); assert.equal(state.bond, 2);
  const limited = world.performCare(state, 'treat', 11);
  assert.equal(limited.applied, false);
});
test('daily action budget resets on next verified school day', () => {
  let state = world.createCareState(11);
  for (const action of ['meal', 'bath', 'play', 'study']) state = world.performCare(state, action, 11).state;
  assert.equal(world.performCare(state, 'tidy', 11).applied, false);
  const next = world.performCare(state, 'tidy', 12);
  assert.equal(next.applied, true); assert.equal(next.state.actionsToday, 1);
});
test('low needs produce visible mood and an action recommendation', () => {
  const state = world.createCareState(11); state.vitals.hunger = 20;
  const scene = world.observeWorld({ ...options, careState: state });
  assert.equal(scene.mood, 'hungry'); assert.equal(scene.suggestedCare, 'meal');
});
test('malformed and hostile fields are rejected', () => {
  assert.throws(() => world.observeWorld({ ...options, worldSeed: 'student@example.com' }), /worldSeed/);
  assert.throws(() => world.observeWorld({ ...options, dayKey: '2026-02-30' }), /dayKey/);
  assert.throws(() => world.observeWorld({ ...options, minuteOfDay: 1500 }), /minuteOfDay/);
  assert.throws(() => world.observeWorld({ ...options, species: '<script>' }), /identity/);
  assert.throws(() => world.performCare(world.createCareState(2), 'free-dust', 2), /action/);
  assert.throws(() => world.advanceSchoolDays(world.createCareState(10), 9), /rewind/);
});


test('existing sky home remains the canonical Cloud Island habitat', () => {
  const scene = world.observeWorld({ ...options, habitat: 'sky' });
  assert.equal(scene.habitat, 'sky');
  assert.equal(scene.habitatTitle, 'Cloud island');
  assert.ok(world.HABITATS.sky.weather.includes(scene.weather));
  assert.ok(world.HABITATS.sky.visitors.includes(scene.visitor));
});

test('prototype cloud alias normalizes to sky without rerolling a daily event', () => {
  const canonical = world.observeWorld({ ...options, habitat: 'sky' });
  const oldAlias = world.observeWorld({ ...options, habitat: 'cloud' });
  assert.deepEqual(oldAlias,canonical);
  const laterAlias = world.observeWorld({ ...options, habitat: 'cloud', minuteOfDay: 1360 });
  const laterCanonical = world.observeWorld({ ...options, habitat: 'sky', minuteOfDay: 1360 });
  assert.deepEqual(laterAlias,laterCanonical);
  assert.equal(canonical.eventKey,laterCanonical.eventKey);
  assert.equal(canonical.habitat,'sky');
});
