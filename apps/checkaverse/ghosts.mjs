// Ghosts in Kettle Creek's cemetery (design bible, Ghosts). Pure rules: which ghosts are out today, where they float,
// what temperament each has, and the wanderer. No sockets, no database. Every number comes from content/ghosts.json.

import fs from 'node:fs';
import * as Care from './care.mjs';
import { seeded } from './accounts.mjs';

export function loadGhosts(file, care, rules) {
  const G = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = (msg) => { throw new Error(`ghosts.json: ${msg}`); };
  const share = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
  if (!(Number.isInteger(G.waitSchoolDays) && G.waitSchoolDays >= 0)) bad('waitSchoolDays must be a whole number');
  if (!share(G.dailyChance)) bad('dailyChance must be 0 to 1');
  if (!(Number.isInteger(G.maxPerDay) && G.maxPerDay >= 0)) bad('maxPerDay must be a whole number');
  if (!share(G.wanderer?.chance) || !(G.wanderer.levels[0] >= 1 && G.wanderer.levels[0] <= G.wanderer.levels[1] && G.wanderer.levels[1] <= 50)) bad('wanderer needs a chance and two levels');
  if (!(G.moss?.perDay >= 1 && G.moss.carry >= 1)) bad('moss needs perDay and carry');
  if (!(G.sight?.moss >= 1 && G.sight.minutes >= 1 && G.sight.minutes <= 60)) bad('sight needs moss and 1 to 60 minutes');
  if (!rules.moves[G.ghostMove] || rules.moves[G.ghostMove].cost === undefined) bad(`unknown ghostMove ${G.ghostMove}`);
  if (!(Number.isInteger(G.keepCloseSchoolDays) && G.keepCloseSchoolDays >= 1)) bad('keepCloseSchoolDays must be 1 or more');
  if (!(Number.isInteger(G.partyMax) && G.partyMax >= 1)) bad('partyMax must be 1 or more');
  if (!(Number.isInteger(G.caughtFadeEvery) && G.caughtFadeEvery >= 2)) bad('caughtFadeEvery must be 2 or more');
  for (const k of ['calm', 'restless', 'angry']) {
    const t = G.tempers?.[k];
    if (!t || !(Number.isInteger(t.fadeEvery) && t.fadeEvery >= 2) || !(t.catch >= -0.5 && t.catch <= 0.5) || !(t.power >= 0.5 && t.power <= 1.5) || !t.rise) bad(`temper ${k} needs fadeEvery, catch, power and rise`);
  }
  const known = new Set([...Object.keys(care.diseases), ...Object.keys(care.rare)]);
  for (const k of ['calm', 'angry']) for (const c of G.causes[k]) if (!known.has(c)) bad(`unknown cause ${c}`);
  if (!Array.isArray(G.clues) || !G.clues.length) bad('clues must list at least one line');
  for (const k of ['wandererClue', 'mossLine', 'mossFull', 'mossDone']) if (typeof G[k] !== 'string' || !G[k]) bad(`${k} is missing`);
  return G;
}

// How a Checkling died decides how its ghost behaves.
export function temperOf(G, cause, daysLived) {
  if (daysLived >= G.causes.calmAfterDays || G.causes.calm.includes(cause)) return 'calm';
  if (G.causes.angry.includes(cause)) return 'angry';
  return 'restless';
}

// School days since a death, counting today when it is one.
export function schoolDaysSince(care, died, day, noSchool) {
  const from = String(died).slice(0, 10);
  if (!from || from >= day) return 0;
  return Care.owedDays(care, from, day, () => true, noSchool).length + (Care.isSchoolDay(care, day, noSchool) ? 1 : 0);
}

// Which of these stones have their ghost out today. Seeded by grave and day, so every classmate sees the same ones.
// held: grave ids whose ghost a trainer is keeping. Ghosts only come out on school days.
export function presentToday(G, care, stones, day, held = new Set(), noSchool) {
  if (G.schoolDaysOnly !== false && !Care.isSchoolDay(care, day, noSchool)) return [];
  return stones
    .filter((st) => !held.has(st.id) && schoolDaysSince(care, st.died, day, noSchool) >= G.waitSchoolDays)
    .map((st) => ({ st, roll: seeded('ghost', st.id, day)() }))
    .filter((x) => x.roll < G.dailyChance)
    .sort((a, b) => a.roll - b.roll)
    .slice(0, G.maxPerDay)
    .map((x) => x.st);
}

// Where each ghost floats: on a walkable tile next to its stone, never two on one tile.
// walkable(x, y) is the map test. Returns [{ st, x, y }].
export function placeGhosts(list, walkable) {
  const taken = new Set();
  const out = [];
  for (const st of list) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = st.x + dx, y = st.y + dy, k = `${x},${y}`;
      if (taken.has(k) || !walkable(x, y)) continue;
      taken.add(k); out.push({ st, x, y });
      break;
    }
  }
  return out;
}

// The wanderer: one ghost with no stone, per trainer per day. table is a species weight table.
export function wandererToday(G, care, pid, day, table, noSchool) {
  if (G.schoolDaysOnly !== false && !Care.isSchoolDay(care, day, noSchool)) return null;
  const r = seeded('wanderer', pid, day);
  if (r() >= G.wanderer.chance) return null;
  const entries = Object.entries(table);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let pick = r() * total, species = entries[0][0];
  for (const [sp, w] of entries) { pick -= w; if (pick < 0) { species = sp; break; } }
  const [lo, hi] = G.wanderer.levels;
  return { species, level: lo + Math.floor(r() * (hi - lo + 1)), temper: 'restless' };
}

// The ghost side of a battle.
export function ghostSide(G, temper) {
  const t = G.tempers[temper] || G.tempers.restless;
  return { fadeEvery: t.fadeEvery, move: G.ghostMove, replaces: G.replaces };
}
