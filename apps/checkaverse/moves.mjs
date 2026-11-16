// Learning and forgetting moves (content/learnsets.json). Pure rules: which moves a Checkling can learn, what it is
// offered as it levels up, and what its move list looks like after learning one. No sockets, no database.

import fs from 'node:fs';

export function loadLearnsets(file, rules) {
  const L = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = (m) => { throw new Error(`learnsets.json: ${m}`); };
  const M = rules.moves, T = rules.types.types;
  if (!(Number.isInteger(L.slots) && L.slots >= 2 && L.slots <= 4)) bad('slots must be 2 to 4');
  for (const m of L.universal) if (!M[m]) bad(`unknown universal move ${m}`);
  for (const [type, list] of Object.entries(L.levelUp)) {
    if (!T[type]) bad(`unknown type ${type}`);
    for (const e of list) {
      if (!M[e.move]) bad(`unknown move ${e.move}`);
      if (M[e.move].type !== type && !L.universal.includes(e.move)) bad(`${e.move} is not a ${type} move`);
      if (!(Number.isInteger(e.level) && e.level >= 2 && e.level <= 50)) bad(`${e.move} level must be 2 to 50`);
    }
  }
  if (!(L.gym.dailyRounds >= 1 && L.gym.minRoundMs >= 1000)) bad('gym needs dailyRounds and minRoundMs');
  const seen = new Set();
  for (const g of L.gym.moves) {
    if (!M[g.move]) bad(`unknown gym move ${g.move}`);
    if (seen.has(g.move)) bad(`gym lists ${g.move} twice`);
    seen.add(g.move);
    if (!L.games[g.game]) bad(`${g.move} has unknown game ${g.game}`);
    if (!(Number.isInteger(g.cost) && g.cost >= 10 && g.cost <= 200)) bad(`${g.move} cost must be 10 to 200`);
    if (!(Number.isInteger(g.minLevel) && g.minLevel >= 1 && g.minLevel <= 50)) bad(`${g.move} minLevel must be 1 to 50`);
  }
  return L;
}

const typeOf = (rules, species) => rules.species.species[species]?.type;
export const isFree = (rules, move) => rules.moves[move]?.cost === 0;

// Can this species ever learn this move? Its own type's moves and the universal ones.
export function canLearn(L, rules, species, move) {
  const m = rules.moves[move];
  return Boolean(m && (L.universal.includes(move) || (m.type && m.type === typeOf(rules, species))));
}

// The moves offered between two levels (above from, up to and including to).
export function levelOffers(L, rules, species, from, to) {
  return (L.levelUp[typeOf(rules, species)] || []).filter((e) => e.level > from && e.level <= to).map((e) => e.move);
}

// A move list a battle can use: real moves, no repeats, within the slots, with a free move so it never gets stuck.
export function validKnown(L, rules, list) {
  return Array.isArray(list) && list.length >= 1 && list.length <= L.slots && new Set(list).size === list.length
    && list.every((m) => rules.moves[m]) && list.some((m) => isFree(rules, m));
}

// Learn a move, forgetting one if every slot is taken. Returns { ok, known } or { ok: false, msg }.
export function learn(L, rules, known, move, forget) {
  if (known.includes(move)) return { ok: false, msg: 'It already knows that move.' };
  let next;
  if (known.length < L.slots && !forget) next = [...known, move];
  else {
    if (!forget || !known.includes(forget)) return { ok: false, msg: 'Pick a move to forget first.' };
    next = known.map((m) => (m === forget ? move : m));
  }
  if (!next.some((m) => isFree(rules, m))) return { ok: false, msg: 'It has to keep one free move, or it could get stuck with no stamina.' };
  return { ok: true, known: next };
}

// Points a gym round earns from its 0 to 100 score.
export const roundPoints = (score) => Math.max(0, Math.min(10, Math.round(score / 10)));
