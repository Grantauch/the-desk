'use strict';

// Checklings Living World prototype engine. No network, persistence or identity access.
// The caller must provide a server-owned opaque world seed and authoritative
// school-day ordinal; never derive either from a PIN or browser-local streak.
const SPECIES = Object.freeze({
  ember: { temperament: 'bold', voice: ['Let us see what is past that hill!', 'I saved the warmest spot for you.', 'That cloud looks like a dragon.'] },
  bolt: { temperament: 'curious', voice: ['I heard something clicking in the reeds.', 'Can we invent a new game?', 'I counted fourteen shooting stars!'] },
  mochi: { temperament: 'affectionate', voice: ['I made this cozy corner just for us.', 'Is it time for a tiny adventure?', 'I think the flowers remember you.'] },
  zee: { temperament: 'dreamy', voice: ['The moon told me a little secret.', 'What do you think stars dream about?', 'I found a quiet place to watch the sky.'] }
});

const HABITATS = Object.freeze({
  meadow: { title: 'Morning meadow', weather: ['sunny', 'breezy', 'fireflies'], visitors: ['a shy field mouse', 'a lantern beetle', 'a sleepy bee'] },
  grove: { title: 'Mossy grove', weather: ['drizzle', 'sunbeams', 'fireflies'], visitors: ['a mushroom sprite', 'a moss fox', 'a copper butterfly'] },
  cove: { title: 'Tidepool cove', weather: ['mist', 'sea breeze', 'sunny'], visitors: ['a pearl crab', 'a tiny sea dragon', 'a ribbon jellyfish'] },
  cloud: { title: 'Cloud island', weather: ['cloud drift', 'rainbow', 'starlight'], visitors: ['a kite moth', 'a floating sheep', 'a sky manta'] },
  cosmos: { title: 'Little cosmos', weather: ['meteor glow', 'starlight', 'aurora'], visitors: ['a comet fox', 'a lunar moth', 'a star whale'] }
});

const SEASONS = Object.freeze(['autumn', 'winter', 'spring', 'finals']);
const VITALS = Object.freeze(['hunger', 'joy', 'energy', 'clean', 'focus']);
const INITIAL = Object.freeze({ hunger: 82, joy: 85, energy: 84, clean: 88, focus: 78 });
const DECAY = Object.freeze({ hunger: 7, joy: 4, energy: 4, clean: 6, focus: 3 });
const ACTIONS = Object.freeze({
  meal: { hunger: 26, joy: 2 },
  treat: { hunger: 10, joy: 15 },
  bath: { clean: 30, joy: 4 },
  play: { joy: 23, energy: -7 },
  rest: { energy: 28, hunger: -3 },
  tidy: { clean: 18, focus: 4 },
  study: { focus: 24, energy: -5 }
});
const MAX_CARE_ACTIONS_PER_SCHOOL_DAY = 4;
const MAX_OFFLINE_DECAY_DAYS = 3;

function requireInteger(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${label} out of range`);
  return value;
}
function validateSeed(seed) {
  if (typeof seed !== 'string' || !/^[a-f0-9]{8,32}$/i.test(seed)) throw new TypeError('worldSeed must be opaque hexadecimal, 8-32 characters');
  return seed.toLowerCase();
}
function clamp(num) { return Math.max(0, Math.min(100, num)); }
function getVitals(state) {
  const raw = state && state.vitals;
  if (!raw || typeof raw !== 'object') throw new TypeError('missing vitals');
  return Object.fromEntries(VITALS.map(key => {
    if (!Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > 100) throw new RangeError(`invalid vital: ${key}`);
    return [key, Math.round(raw[key])];
  }));
}
function createCareState(schoolDayIndex = 0) {
  requireInteger(schoolDayIndex, 'schoolDayIndex', 0, 10000000);
  return { v: 1, schoolDayIndex, vitals: { ...INITIAL }, bond: 0, actionsToday: 0, actionCounts: {} };
}
function advanceSchoolDays(source, schoolDayIndex) {
  requireInteger(schoolDayIndex, 'schoolDayIndex', 0, 10000000);
  if (!source || source.v !== 1) throw new TypeError('invalid living world state');
  const oldIndex = requireInteger(source.schoolDayIndex, 'saved schoolDayIndex', 0, 10000000);
  const current = getVitals(source);
  const bond = requireInteger(source.bond, 'bond', 0, 1000);
  const actionsToday = requireInteger(source.actionsToday, 'actionsToday', 0, MAX_CARE_ACTIONS_PER_SCHOOL_DAY);
  if (schoolDayIndex < oldIndex) throw new RangeError('cannot rewind authoritative school day');
  const elapsed = schoolDayIndex - oldIndex;
  if (!elapsed) return { ...source, vitals: current, bond, actionsToday, actionCounts: { ...(source.actionCounts || {}) } };
  const applied = Math.min(MAX_OFFLINE_DECAY_DAYS, elapsed);
  const vitals = Object.fromEntries(VITALS.map(key => [key, clamp(current[key] - DECAY[key] * applied)]));
  // Missing many days is not a punishment. Bond, evolution and unlocked items persist.
  return { v: 1, schoolDayIndex, vitals, bond, actionsToday: 0, actionCounts: {} };
}
function performCare(source, action, schoolDayIndex) {
  if (!Object.hasOwn(ACTIONS, action)) throw new TypeError('unknown care action');
  const updated = advanceSchoolDays(source, schoolDayIndex);
  const timesUsed = updated.actionCounts[action] || 0;
  // Care remains a kind interaction; only the first two uses of an action per day
  // and four total uses change stats. Currency is deliberately never awarded here.
  if (updated.actionsToday >= MAX_CARE_ACTIONS_PER_SCHOOL_DAY || timesUsed >= 2) {
    return { state: updated, applied: false, reason: 'Daily care is complete; visit again tomorrow.' };
  }
  const vitals = { ...updated.vitals };
  for (const [key, amount] of Object.entries(ACTIONS[action])) vitals[key] = clamp(vitals[key] + amount);
  const result = {
    ...updated, vitals,
    bond: Math.min(1000, updated.bond + (updated.actionsToday < 2 ? 1 : 0)),
    actionsToday: updated.actionsToday + 1,
    actionCounts: { ...updated.actionCounts, [action]: timesUsed + 1 }
  };
  return { state: result, applied: true, reason: 'Your Checkling loved spending time with you.' };
}
function hash32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
function pickFrom(options, hash, offset) { return options[(hash >>> offset) % options.length]; }
function getMood(vitals) {
  if (vitals.hunger < 30) return { mood: 'hungry', nextCare: 'meal', expression: 'looking hopefully toward the snack shelf' };
  if (vitals.clean < 30) return { mood: 'dusty', nextCare: 'bath', expression: 'trying to shake the leaves out of its fur' };
  if (vitals.energy < 30) return { mood: 'sleepy', nextCare: 'rest', expression: 'curling into a tiny sleepy circle' };
  if (vitals.joy < 30) return { mood: 'lonely', nextCare: 'play', expression: 'watching for its favorite visitor' };
  if (vitals.focus < 30) return { mood: 'distracted', nextCare: 'study', expression: 'following a butterfly instead of practicing' };
  if (VITALS.every(k => vitals[k] >= 75)) return { mood: 'thriving', nextCare: 'play', expression: 'bounding from one discovery to the next' };
  return { mood: 'content', nextCare: 'play', expression: 'exploring at its own unhurried pace' };
}
function observeWorld({ worldSeed, dayKey, minuteOfDay, species = 'ember', habitat = 'meadow', season = 'autumn', careState }) {
  const seed = validateSeed(worldSeed);
  if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || new Date(`${dayKey}T00:00:00Z`).toISOString().slice(0, 10) !== dayKey) {
    throw new TypeError('dayKey must be a real YYYY-MM-DD date');
  }
  requireInteger(minuteOfDay, 'minuteOfDay', 0, 1439);
  if (!Object.hasOwn(SPECIES, species) || !Object.hasOwn(HABITATS, habitat) || !SEASONS.includes(season)) throw new TypeError('unknown world identity');
  const vitalState = careState ? getVitals(careState) : { ...INITIAL };
  const h = hash32(`${seed}|${dayKey}|${habitat}|${season}`);
  const scene = HABITATS[habitat];
  const timeOfDay = minuteOfDay < 360 ? 'night' : minuteOfDay < 720 ? 'morning' : minuteOfDay < 1080 ? 'afternoon' : 'evening';
  const mood = getMood(vitalState);
  const visitor = pickFrom(scene.visitors, h, 8);
  const weather = pickFrom(scene.weather, h, 0);
  const line = pickFrom(SPECIES[species].voice, h, 16);
  const sky = timeOfDay === 'night' || timeOfDay === 'evening' ? 'warm lanterns and stars' : 'soft light and wandering clouds';
  return {
    dayKey, timeOfDay, habitat, habitatTitle: scene.title, season, weather, visitor,
    mood: mood.mood, expression: mood.expression, suggestedCare: mood.nextCare,
    personality: SPECIES[species].temperament,
    greeting: `${line} Today ${visitor} stopped by ${scene.title.toLowerCase()}.`,
    ambiance: `${scene.title}: ${weather}, ${sky}.`,
    // Presentation hints only. The renderer controls sound, animation, and reduced-motion support.
    animation: mood.mood === 'sleepy' || timeOfDay === 'night' ? 'curl' : mood.mood === 'thriving' ? 'explore' : 'idle',
    eventKey: `${dayKey}:${(h % 10000).toString(16).padStart(4, '0')}`
  };
}
module.exports = { SPECIES, HABITATS, SEASONS, INITIAL, ACTIONS, createCareState, advanceSchoolDays, performCare, observeWorld };
